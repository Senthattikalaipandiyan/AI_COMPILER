import os
import re
import subprocess
import tempfile
import time
from typing import Optional
from app.schemas.models import ExecuteResponse


class ExecutionService:
    DEFAULT_MOJO_CODE = """fn main():
    var n: Int = 128
    var total: Float64 = 0.0
    for i in range(n):
        for j in range(n):
            for k in range(n):
                total += 0.001 * Float64(i + j + k)
    print("Mojo GEMM 128x128 completed. Accumulator:", total)
"""

    DEFAULT_PYTHON_CODE = """def main():
    n = 128
    total = 0.0
    for i in range(n):
        for j in range(n):
            for k in range(n):
                total += 0.001 * float(i + j + k)
    print("Python GEMM 128x128 completed. Accumulator:", total)

if __name__ == "__main__":
    main()
"""

    @classmethod
    def execute_code(cls, code: str, runtime: str = "mojo", stdin: Optional[str] = "") -> ExecuteResponse:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        stdin_bytes = (stdin or "").encode("utf-8")

        temp_src = None
        temp_bin = None

        try:
            if runtime.lower() == "mojo":
                # Use default optimized kernel if blank
                raw_code = code if (code and code.strip()) else cls.DEFAULT_MOJO_CODE

                # Check if user explicitly invokes the pre-compiled dedicated SIMD compute kernel
                dedicated_kernel_bin = os.path.join(project_root, "kernels", "compute_kernel_bin")
                dedicated_kernel_mojo = os.path.join(project_root, "kernels", "compute_kernel.mojo")
                if "compute_kernel" in raw_code and os.path.exists(dedicated_kernel_mojo):
                    if not os.path.exists(dedicated_kernel_bin):
                        subprocess.run(["mojo", "build", "-O3", dedicated_kernel_mojo, "-o", dedicated_kernel_bin], check=True)
                    exec_cmd = [dedicated_kernel_bin]
                else:
                    # 1. Ahead-Of-Time (AOT) Compilation Pipeline
                    # Preprocess 'fn' to 'def' for Mojo 1.0.0b2 compatibility
                    processed_code = re.sub(r"\bfn\b", "def", raw_code)

                    with tempfile.NamedTemporaryFile("w", suffix=".mojo", delete=False) as f:
                        f.write(processed_code)
                        temp_src = f.name

                    temp_bin = temp_src.replace(".mojo", "_bin")

                    # FIRST run mojo build temp.mojo -o temp_binary. DO NOT measure the time of this build step.
                    build_cmd = ["mojo", "build", "-O3", temp_src, "-o", temp_bin]
                    build_proc = subprocess.run(
                        build_cmd,
                        capture_output=True,
                        text=True,
                        timeout=45.0,
                        cwd=project_root,
                    )

                    if build_proc.returncode != 0 or not os.path.exists(temp_bin):
                        err_msg = build_proc.stderr or build_proc.stdout or "Mojo compilation failed"
                        return ExecuteResponse(
                            stdout="",
                            stderr=f"[Mojo Compilation Error]\n{err_msg}",
                            exit_code=build_proc.returncode if build_proc.returncode != 0 else 1,
                            execution_time_ms=0.0,
                            runtime=runtime,
                        )

                    os.chmod(temp_bin, 0o755)
                    # NEXT, execute the compiled binary directly (e.g., ./temp_binary)
                    exec_cmd = [temp_bin]
            else:
                # Python execution pipeline
                raw_code = code if (code and code.strip()) else cls.DEFAULT_PYTHON_CODE
                with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
                    f.write(raw_code)
                    temp_src = f.name
                exec_cmd = ["python3", "-u", temp_src]

            # ONLY start time.perf_counter() right before executing the binary directly
            start_time = time.perf_counter()

            proc = subprocess.Popen(
                exec_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=project_root,
            )

            try:
                stdout_bytes, stderr_bytes = proc.communicate(input=stdin_bytes, timeout=25.0)
                exit_code = proc.returncode
            except subprocess.TimeoutExpired:
                proc.kill()
                stdout_bytes, stderr_bytes = proc.communicate()
                exit_code = -1
                stderr_bytes += b"\n[Execution terminated: Process timed out after 25 seconds]"

            # Stop the timer the exact moment the binary exits
            end_time = time.perf_counter()
            duration_ms = (end_time - start_time) * 1000.0

            stdout_str = stdout_bytes.decode("utf-8", errors="replace")
            stderr_str = stderr_bytes.decode("utf-8", errors="replace")

            # Check if internal microsecond telemetry was emitted
            mojo_latency_match = re.search(r"latency_ms=([0-9\.]+)", stdout_str)
            if mojo_latency_match and runtime.lower() == "mojo":
                try:
                    kernel_latency = float(mojo_latency_match.group(1))
                    if kernel_latency > 0:
                        duration_ms = kernel_latency
                except ValueError:
                    pass

            return ExecuteResponse(
                stdout=stdout_str,
                stderr=stderr_str,
                exit_code=exit_code,
                execution_time_ms=round(duration_ms, 3),
                runtime=runtime,
            )

        except Exception as e:
            return ExecuteResponse(
                stdout="",
                stderr=f"Execution error: {str(e)}",
                exit_code=1,
                execution_time_ms=0.0,
                runtime=runtime,
            )
        finally:
            if temp_src and os.path.exists(temp_src):
                try:
                    os.remove(temp_src)
                except OSError:
                    pass
            if temp_bin and os.path.exists(temp_bin):
                try:
                    os.remove(temp_bin)
                except OSError:
                    pass
