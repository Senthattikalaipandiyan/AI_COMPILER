import asyncio
import os
import re
import shlex
import signal
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from typing import Dict, List, Optional
from fastapi import WebSocket


class InteractiveSession:
    def __init__(self, session_id: str, websocket: WebSocket):
        self.session_id = session_id
        self.websocket = websocket
        self.current_run_id: str = ""
        self.proc: Optional[subprocess.Popen] = None
        self.is_running: bool = False
        self.timeout_seconds: float = 180.0
        self.project_root: str = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..")
        )
        self.active_threads: List[threading.Thread] = []
        self.temp_files: List[str] = []

    async def send_msg(self, msg_type: str, **kwargs) -> None:
        """Sends JSON message safely over active WebSocket."""
        try:
            payload = {"type": msg_type, **kwargs}
            await self.websocket.send_json(payload)
        except Exception:
            pass

    def _pipe_reader(self, pipe, stream_name: str, loop: asyncio.AbstractEventLoop, run_id: str):
        """Reads pipe chunks until EOF and pushes directly to WebSocket."""
        fd = pipe.fileno()
        while self.current_run_id == run_id:
            try:
                chunk = os.read(fd, 2048)
                if not chunk:
                    break
                text = chunk.decode("utf-8", errors="replace")
                asyncio.run_coroutine_threadsafe(
                    self.send_msg("output", stream=stream_name, data=text), loop
                )
            except OSError:
                break
            except Exception:
                break

    async def start_python(self, code: str):
        """Spawns Python process with unbuffered streaming."""
        await self._stop_current_process()
        raw_code = code if (code and code.strip()) else "print('No Python code provided')\n"

        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
            f.write(raw_code)
            temp_src = f.name
        self.temp_files.append(temp_src)

        cmd = [sys.executable, "-u", temp_src]
        await self._spawn_process(cmd, runtime="python", temp_files=[temp_src])

    async def start_mojo(self, code: str, opt_level: str = "-O3"):
        """Compiles Mojo code AOT and streams native execution."""
        await self._stop_current_process()
        raw_code = code if (code and code.strip()) else "fn main():\n    print('No Mojo code provided')\n"

        dedicated_kernel_bin = os.path.join(self.project_root, "kernels", "compute_kernel_bin")
        dedicated_kernel_mojo = os.path.join(self.project_root, "kernels", "compute_kernel.mojo")
        if "compute_kernel" in raw_code and os.path.exists(dedicated_kernel_mojo):
            if not os.path.exists(dedicated_kernel_bin):
                await self.send_msg("status", status="compiling")
                await self.send_msg("output", stream="compiler", data="[Compiling dedicated Mojo SIMD kernel...]\n")
                compile_res = await asyncio.to_thread(
                    subprocess.run,
                    ["mojo", "build", "-O3", dedicated_kernel_mojo, "-o", dedicated_kernel_bin],
                    capture_output=True,
                    text=True,
                )
                if compile_res.returncode != 0:
                    await self.send_msg("output", stream="stderr", data=compile_res.stderr or "Mojo compilation failed\n")
                    await self.send_msg("status", status="error")
                    await self.send_msg("exit", exit_code=compile_res.returncode, execution_time_ms=0)
                    return
            await self._spawn_process([dedicated_kernel_bin], runtime="mojo", temp_files=[])
            return

        processed_code = re.sub(r"\bfn\b", "def", raw_code)

        with tempfile.NamedTemporaryFile("w", suffix=".mojo", delete=False) as f:
            f.write(processed_code)
            temp_src = f.name

        temp_bin = temp_src.replace(".mojo", "_bin")
        temp_list = [temp_src, temp_bin]
        self.temp_files.extend(temp_list)

        await self.send_msg("status", status="compiling")
        await self.send_msg("output", stream="compiler", data="Compiling Mojo kernel (AOT -O3)...\n")

        compile_start = time.perf_counter()
        build_cmd = ["mojo", "build", opt_level, temp_src, "-o", temp_bin]

        build_proc = await asyncio.to_thread(
            subprocess.run,
            build_cmd,
            capture_output=True,
            text=True,
            timeout=45.0,
            cwd=self.project_root,
        )
        compile_time_ms = round((time.perf_counter() - compile_start) * 1000.0, 1)

        if build_proc.returncode != 0 or not os.path.exists(temp_bin):
            err_msg = build_proc.stderr or build_proc.stdout or "Mojo compilation failed"
            await self.send_msg("output", stream="stderr", data=f"[Mojo Compilation Error]\n{err_msg}\n")
            await self.send_msg("status", status="error")
            await self.send_msg("exit", exit_code=build_proc.returncode if build_proc.returncode != 0 else 1, execution_time_ms=compile_time_ms)
            return

        os.chmod(temp_bin, 0o755)
        await self.send_msg("output", stream="compiler", data=f"Mojo build completed in {compile_time_ms} ms. Executing binary...\n")
        await self._spawn_process([temp_bin], runtime="mojo", temp_files=temp_list)

    async def start_command(self, cmd_line: str):
        """Runs controlled shell commands (pip install, local binary)."""
        await self._stop_current_process()
        parts = shlex.split(cmd_line.strip())
        if not parts:
            await self.send_msg("status", status="ready")
            return

        cmd_name = parts[0]

        if cmd_name == "pip" or (cmd_name == "python3" and len(parts) > 2 and parts[1] == "-m" and parts[2] == "pip"):
            pip_args = parts[1:] if cmd_name == "pip" else parts[3:]
            if pip_args and pip_args[0] == "install":
                exec_cmd = [sys.executable, "-m", "pip", *pip_args]
                custom_env = os.environ.copy()
                custom_env["PIP_BREAK_SYSTEM_PACKAGES"] = "1"
                custom_env["PYTHONUNBUFFERED"] = "1"
                await self.send_msg("output", stream="system", data=f"$ {' '.join(parts)}\n")
                await self._spawn_process(exec_cmd, runtime="shell", env=custom_env, temp_files=[])
                return
            else:
                await self.send_msg("output", stream="stderr", data="Only 'pip install <package>' is supported for package management.\n")
                await self.send_msg("status", status="error")
                await self.send_msg("exit", exit_code=1, execution_time_ms=0)
                return

        if cmd_name.startswith("./") or cmd_name.startswith("kernels/"):
            bin_path = os.path.abspath(os.path.join(self.project_root, cmd_name))
            if os.path.exists(bin_path) and os.access(bin_path, os.X_OK):
                await self.send_msg("output", stream="system", data=f"$ {' '.join(parts)}\n")
                await self._spawn_process([bin_path] + parts[1:], runtime="native", temp_files=[])
                return
            else:
                await self.send_msg("output", stream="stderr", data=f"Binary not found or not executable: {cmd_name}\n")
                await self.send_msg("status", status="error")
                await self.send_msg("exit", exit_code=127, execution_time_ms=0)
                return

        await self.send_msg(
            "output",
            stream="stderr",
            data=f"Command '{cmd_name}' not permitted. Supported: pip install <package>, ./<binary>, or click Execute.\n",
        )
        await self.send_msg("status", status="error")
        await self.send_msg("exit", exit_code=1, execution_time_ms=0)

    async def _stop_current_process(self):
        """Stops any existing process before starting a new one."""
        if self.is_running and self.proc:
            try:
                self.proc.kill()
            except Exception:
                pass
            self.is_running = False
            await asyncio.sleep(0.02)

    async def _spawn_process(self, cmd: List[str], runtime: str, env: Optional[Dict[str, str]] = None, temp_files: Optional[List[str]] = None):
        """Spawns process, attaches reader threads, and monitors lifecycle."""
        run_id = str(uuid.uuid4())
        self.current_run_id = run_id
        self.is_running = True

        process_env = os.environ.copy()
        process_env["PYTHONUNBUFFERED"] = "1"
        if env:
            process_env.update(env)

        start_time = time.perf_counter()

        try:
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=0,
                cwd=self.project_root,
                env=process_env,
            )
            self.proc = proc
        except Exception as e:
            self.is_running = False
            await self.send_msg("output", stream="stderr", data=f"Process launch error: {str(e)}\n")
            await self.send_msg("status", status="error")
            await self.send_msg("exit", exit_code=1, execution_time_ms=0)
            return

        await self.send_msg("status", status="running", pid=proc.pid, runtime=runtime)

        loop = asyncio.get_running_loop()

        t_stdout = threading.Thread(
            target=self._pipe_reader,
            args=(proc.stdout, "stdout", loop, run_id),
            daemon=True,
        )
        t_stderr = threading.Thread(
            target=self._pipe_reader,
            args=(proc.stderr, "stderr", loop, run_id),
            daemon=True,
        )
        self.active_threads = [t_stdout, t_stderr]
        t_stdout.start()
        t_stderr.start()

        asyncio.create_task(
            self._monitor_run(run_id, proc, runtime, start_time, [t_stdout, t_stderr], temp_files or [])
        )

    async def _monitor_run(self, run_id: str, proc: subprocess.Popen, runtime: str, start_time: float, threads: List[threading.Thread], temp_files: List[str]):
        """Scoped monitor task for a specific run ID."""
        try:
            while self.current_run_id == run_id:
                ret = proc.poll()
                if ret is not None:
                    break

                if time.perf_counter() - start_time > self.timeout_seconds:
                    await self.send_msg("output", stream="stderr", data=f"\n[Execution terminated: Process timed out after {int(self.timeout_seconds)}s]\n")
                    try:
                        proc.kill()
                    except Exception:
                        pass
                    break

                await asyncio.sleep(0.02)

            for t in threads:
                await asyncio.to_thread(t.join, 1.5)

        except Exception:
            pass
        finally:
            if self.current_run_id == run_id:
                self.is_running = False
                duration_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
                exit_code = proc.returncode if proc.returncode is not None else 0

                is_interrupted = exit_code in (-2, -9, -15, 130)
                final_status = "stopped" if is_interrupted else ("completed" if exit_code == 0 else "error")

                await self.send_msg(
                    "exit",
                    exit_code=exit_code,
                    execution_time_ms=duration_ms,
                    runtime=runtime,
                )
                await self.send_msg(
                    "status",
                    status=final_status,
                )

                for fpath in temp_files:
                    if fpath and os.path.exists(fpath):
                        try:
                            os.remove(fpath)
                        except OSError:
                            pass

    def write_stdin(self, data: str):
        """Sends data directly to active process stdin."""
        if not self.proc or self.proc.poll() is not None or not self.is_running:
            return

        try:
            if not data.endswith("\n"):
                data += "\n"
            self.proc.stdin.write(data.encode("utf-8"))
            self.proc.stdin.flush()
        except (BrokenPipeError, OSError):
            pass

    def interrupt(self, force: bool = False):
        """Sends SIGINT or kills the running process."""
        if not self.proc or self.proc.poll() is not None:
            return

        try:
            if not force:
                self.proc.send_signal(signal.SIGINT)
            else:
                self.proc.kill()
        except ProcessLookupError:
            pass
        except Exception:
            try:
                self.proc.kill()
            except Exception:
                pass

    def cleanup(self):
        """Session teardown."""
        self.is_running = False
        self.current_run_id = ""
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.kill()
            except Exception:
                pass
        for path in self.temp_files:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
        self.temp_files.clear()


class SessionManager:
    """Session tracker keyed by UUID."""
    _sessions: Dict[str, InteractiveSession] = {}

    @classmethod
    def get_or_create(cls, session_id: str, websocket: WebSocket) -> InteractiveSession:
        if session_id not in cls._sessions:
            cls._sessions[session_id] = InteractiveSession(session_id, websocket)
        else:
            cls._sessions[session_id].websocket = websocket
        return cls._sessions[session_id]

    @classmethod
    def get(cls, session_id: str) -> Optional[InteractiveSession]:
        return cls._sessions.get(session_id)

    @classmethod
    def remove(cls, session_id: str) -> None:
        session = cls._sessions.pop(session_id, None)
        if session:
            session.cleanup()
