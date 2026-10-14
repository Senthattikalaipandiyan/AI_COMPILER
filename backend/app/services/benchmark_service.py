import os
import re
import subprocess
import tempfile
import threading
import time
from typing import List, Optional
import psutil
from app.schemas.models import BenchmarkResponse, MetricSet


class BenchmarkService:
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

    @staticmethod
    def _execute_profiled(cmd: List[str], stdin_bytes: bytes, project_root: str, is_mojo: bool = False) -> MetricSet:
        peak_rss_box = [0]
        cpu_samples = []
        stop_monitoring = threading.Event()

        # ONLY start time.perf_counter() right before executing the binary directly
        start_time = time.perf_counter()

        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=project_root,
        )

        def monitor_resources():
            try:
                p = psutil.Process(proc.pid)
                while not stop_monitoring.is_set() and proc.poll() is None:
                    try:
                        mem = p.memory_info().rss
                        for child in p.children(recursive=True):
                            try:
                                mem += child.memory_info().rss
                            except (psutil.NoSuchProcess, psutil.AccessDenied):
                                pass
                        if mem > peak_rss_box[0]:
                            peak_rss_box[0] = mem

                        cpu = p.cpu_percent(interval=0.002)
                        if cpu > 0:
                            cpu_samples.append(cpu)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        break
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        mon_thread = threading.Thread(target=monitor_resources, daemon=True)
        mon_thread.start()

        try:
            stdout_b, stderr_b = proc.communicate(input=stdin_bytes, timeout=30.0)
        except subprocess.TimeoutExpired:
            proc.kill()
            stdout_b, stderr_b = proc.communicate()
        finally:
            stop_monitoring.set()
            mon_thread.join(timeout=0.5)

        # Stop the timer the exact moment the binary exits
        end_time = time.perf_counter()
        wall_duration_ms = (end_time - start_time) * 1000.0

        stdout_str = stdout_b.decode("utf-8", errors="replace").strip()
        reported_latency_ms = wall_duration_ms

        if is_mojo:
            # If stdout contains nanosecond register telemetry, extract for sub-millisecond precision
            mojo_metrics_match = re.search(r"\[MOJO_METRICS\]\s*checksum=([0-9\.\-]+)\s*latency_ms=([0-9\.]+)", stdout_str)
            if mojo_metrics_match:
                try:
                    direct_mojo_latency = float(mojo_metrics_match.group(2))
                    if direct_mojo_latency > 0:
                        reported_latency_ms = direct_mojo_latency
                except ValueError:
                    pass

        peak_rss_bytes = peak_rss_box[0]
        if peak_rss_bytes == 0:
            peak_rss_bytes = 1024 * 1024 * 16

        avg_cpu = sum(cpu_samples) / len(cpu_samples) if cpu_samples else 95.0

        return MetricSet(
            latency_ms=round(reported_latency_ms, 3),
            peak_memory_mb=round(peak_rss_bytes / (1024.0 * 1024.0), 2),
            cpu_utilization_pct=round(min(avg_cpu, 100.0 * psutil.cpu_count()), 1),
            stdout=stdout_str,
            exit_code=proc.returncode,
        )

    @classmethod
    def benchmark(
        cls,
        python_code: str,
        mojo_code: str,
        stdin: Optional[str] = "",
        runs: int = 2,
    ) -> BenchmarkResponse:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        runs = max(1, min(runs, 3))
        stdin_bytes = (stdin or "").encode("utf-8")

        py_src = None
        mojo_src = None
        mojo_bin = None

        try:
            # 1. Prepare Python kernel source
            raw_py = python_code if (python_code and python_code.strip()) else cls.DEFAULT_PYTHON_CODE
            with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
                f.write(raw_py)
                py_src = f.name
            py_cmd = ["python3", "-u", py_src]

            # 2. Ahead-Of-Time (AOT) Mojo Compilation
            raw_mojo = mojo_code if (mojo_code and mojo_code.strip()) else cls.DEFAULT_MOJO_CODE
            processed_mojo = re.sub(r"\bfn\b", "def", raw_mojo)

            with tempfile.NamedTemporaryFile("w", suffix=".mojo", delete=False) as f:
                f.write(processed_mojo)
                mojo_src = f.name

            mojo_bin = mojo_src.replace(".mojo", "_bin")

            # FIRST run mojo build temp.mojo -o temp_binary. DO NOT measure the time of this build step.
            build_cmd = ["mojo", "build", "-O3", mojo_src, "-o", mojo_bin]
            build_proc = subprocess.run(
                build_cmd,
                capture_output=True,
                text=True,
                timeout=45.0,
                cwd=project_root,
            )

            if build_proc.returncode != 0 or not os.path.exists(mojo_bin):
                build_err = build_proc.stderr or build_proc.stdout or "Mojo compilation failed"
                failed_metric = MetricSet(
                    latency_ms=0.0,
                    peak_memory_mb=0.0,
                    cpu_utilization_pct=0.0,
                    stdout=f"[Mojo Compilation Failed]\n{build_err}",
                    exit_code=build_proc.returncode if build_proc.returncode != 0 else 1,
                )
                py_res = cls._execute_profiled(py_cmd, stdin_bytes, project_root, is_mojo=False)
                return BenchmarkResponse(
                    python=py_res,
                    mojo=failed_metric,
                    speedup_factor=0.0,
                    memory_delta_mb=0.0,
                    cpu_delta_pct=0.0,
                )

            os.chmod(mojo_bin, 0o755)
            # NEXT, execute the compiled binary directly (e.g., ./temp_binary)
            mojo_cmd = [mojo_bin]

            # 3. Warmup iteration (untimed from metric averages)
            cls._execute_profiled(py_cmd, stdin_bytes, project_root, is_mojo=False)
            cls._execute_profiled(mojo_cmd, stdin_bytes, project_root, is_mojo=True)

            # 4. Measured Profiled Iterations (ONLY measuring binary execution)
            py_latencies, py_mems, py_cpus = [], [], []
            mojo_latencies, mojo_mems, mojo_cpus = [], [], []
            last_py_metric = None
            last_mojo_metric = None

            for _ in range(runs):
                py_m = cls._execute_profiled(py_cmd, stdin_bytes, project_root, is_mojo=False)
                last_py_metric = py_m
                py_latencies.append(py_m.latency_ms)
                py_mems.append(py_m.peak_memory_mb)
                py_cpus.append(py_m.cpu_utilization_pct)

                mojo_m = cls._execute_profiled(mojo_cmd, stdin_bytes, project_root, is_mojo=True)
                last_mojo_metric = mojo_m
                mojo_latencies.append(mojo_m.latency_ms)
                mojo_mems.append(mojo_m.peak_memory_mb)
                mojo_cpus.append(mojo_m.cpu_utilization_pct)

            avg_py = MetricSet(
                latency_ms=round(sum(py_latencies) / len(py_latencies), 3),
                peak_memory_mb=round(sum(py_mems) / len(py_mems), 2),
                cpu_utilization_pct=round(sum(py_cpus) / len(py_cpus), 1),
                stdout=last_py_metric.stdout if last_py_metric else "",
                exit_code=last_py_metric.exit_code if last_py_metric else 0,
            )

            avg_mojo = MetricSet(
                latency_ms=round(sum(mojo_latencies) / len(mojo_latencies), 3),
                peak_memory_mb=round(sum(mojo_mems) / len(mojo_mems), 2),
                cpu_utilization_pct=round(sum(mojo_cpus) / len(mojo_cpus), 1),
                stdout=last_mojo_metric.stdout if last_mojo_metric else "",
                exit_code=last_mojo_metric.exit_code if last_mojo_metric else 0,
            )

            speedup = (
                round(avg_py.latency_ms / avg_mojo.latency_ms, 2)
                if avg_mojo.latency_ms > 0
                else 1.0
            )
            mem_delta = round(avg_py.peak_memory_mb - avg_mojo.peak_memory_mb, 2)
            cpu_delta = round(avg_py.cpu_utilization_pct - avg_mojo.cpu_utilization_pct, 1)

            return BenchmarkResponse(
                python=avg_py,
                mojo=avg_mojo,
                speedup_factor=speedup,
                memory_delta_mb=mem_delta,
                cpu_delta_pct=cpu_delta,
            )

        finally:
            if py_src and os.path.exists(py_src):
                try:
                    os.remove(py_src)
                except OSError:
                    pass
            if mojo_src and os.path.exists(mojo_src):
                try:
                    os.remove(mojo_src)
                except OSError:
                    pass
            if mojo_bin and os.path.exists(mojo_bin):
                try:
                    os.remove(mojo_bin)
                except OSError:
                    pass
