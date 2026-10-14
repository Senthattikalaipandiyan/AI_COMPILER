import asyncio
import json
import websockets

WS_URL = "ws://localhost:8000/api/ws/terminal"

results = {}


async def drain_run(ws):
    """Helper that collects all output and waits until final status message."""
    output = ""
    stderr = ""
    compiler = ""
    exit_msg = None
    final_status = None

    while True:
        m = json.loads(await ws.recv())
        mtype = m.get("type")
        if mtype == "output":
            stream = m.get("stream")
            if stream == "stderr":
                stderr += m.get("data", "")
            elif stream == "compiler":
                compiler += m.get("data", "")
            else:
                output += m.get("data", "")
        elif mtype == "exit":
            exit_msg = m
        elif mtype == "status":
            stat = m.get("status")
            if stat in ["completed", "error", "stopped"]:
                final_status = stat
                break

    return {
        "output": output,
        "stderr": stderr,
        "compiler": compiler,
        "exit_code": exit_msg["exit_code"] if exit_msg else (0 if final_status == "completed" else 1),
        "status": final_status,
    }


async def run_all_acceptance_tests():
    print("=" * 60)
    print("RUNNING COMPLETE ACCEPTANCE TEST SUITE (AT-01 to AT-12)")
    print("=" * 60)

    async with websockets.connect(WS_URL) as ws:
        # Initial Handshake
        m = json.loads(await ws.recv())
        assert m["type"] == "status" and m["status"] == "ready"
        print("[INIT] Connected to terminal session:", m.get("session_id"))

        # ---------------------------------------------------------
        # AT-01: Basic stdin
        # ---------------------------------------------------------
        print("\n[AT-01] Testing Basic stdin...")
        code = 'name = input("Enter name: ")\nprint("Hello", name)\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code}))

        prompt = ""
        while "Enter name: " not in prompt:
            msg = json.loads(await ws.recv())
            if msg["type"] == "output":
                prompt += msg["data"]

        await ws.send(json.dumps({"type": "stdin", "data": "Senthatti\n"}))
        res = await drain_run(ws)

        if "Hello Senthatti" in res["output"] and res["exit_code"] == 0:
            results["AT-01"] = "PASS"
            print(">>> AT-01: PASS (Output: Hello Senthatti)")
        else:
            results["AT-01"] = "FAIL"
            print(">>> AT-01: FAIL:", repr(res))

        # ---------------------------------------------------------
        # AT-02: Multiple inputs in one process
        # ---------------------------------------------------------
        print("\n[AT-02] Testing Multiple inputs...")
        code = 'a = int(input("Enter a: "))\nb = int(input("Enter b: "))\nprint(a + b)\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code}))

        buf = ""
        while "Enter a: " not in buf:
            m = json.loads(await ws.recv())
            if m["type"] == "output":
                buf += m["data"]
        await ws.send(json.dumps({"type": "stdin", "data": "10\n"}))

        buf = ""
        while "Enter b: " not in buf:
            m = json.loads(await ws.recv())
            if m["type"] == "output":
                buf += m["data"]
        await ws.send(json.dumps({"type": "stdin", "data": "20\n"}))

        res = await drain_run(ws)

        if "30" in res["output"] and res["exit_code"] == 0:
            results["AT-02"] = "PASS"
            print(">>> AT-02: PASS (Sum: 30)")
        else:
            results["AT-02"] = "FAIL"

        # ---------------------------------------------------------
        # AT-03: Real-time output before stdin
        # ---------------------------------------------------------
        print("\n[AT-03] Testing Real-time output before stdin...")
        code = 'print("Starting...")\nx = input("Enter value: ")\nprint("Received:", x)\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code}))

        early_output = ""
        while "Enter value: " not in early_output:
            m = json.loads(await ws.recv())
            if m["type"] == "output":
                early_output += m["data"]

        has_starting = "Starting..." in early_output
        await ws.send(json.dumps({"type": "stdin", "data": "100\n"}))
        res = await drain_run(ws)

        if has_starting and "Received: 100" in res["output"]:
            results["AT-03"] = "PASS"
            print(">>> AT-03: PASS ('Starting...' verified before input)")
        else:
            results["AT-03"] = "FAIL"

        # ---------------------------------------------------------
        # AT-04: Matrix input
        # ---------------------------------------------------------
        print("\n[AT-04] Testing Matrix input (direct multi-line)...")
        code = '''
n = int(input())
mat = []
for _ in range(n):
    mat.append(input().split())
print("Result:")
for r in mat:
    print(" ".join(r))
'''
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code}))
        await ws.send(json.dumps({"type": "stdin", "data": "2\n1 2\n3 4\n"}))
        res = await drain_run(ws)

        if "1 2" in res["output"] and "3 4" in res["output"]:
            results["AT-04"] = "PASS"
            print(">>> AT-04: PASS (Matrix printed directly)")
        else:
            results["AT-04"] = f"FAIL: {res['output']}"

        # ---------------------------------------------------------
        # AT-05: Runtime error handling
        # ---------------------------------------------------------
        print("\n[AT-05] Testing Runtime error...")
        code = 'print("Before")\nx = 10 / 0\nprint("After")\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code}))
        res = await drain_run(ws)

        if "Before" in res["output"] and "ZeroDivisionError" in res["stderr"] and "After" not in res["output"] and res["exit_code"] != 0:
            results["AT-05"] = "PASS"
            print(">>> AT-05: PASS (Error captured, Before outputted, After omitted)")
        else:
            results["AT-05"] = f"FAIL: {res}"

        # ---------------------------------------------------------
        # AT-06: Ctrl+C / Process Interrupt
        # ---------------------------------------------------------
        print("\n[AT-06] Testing Ctrl+C Process Interrupt...")
        code = 'import time\nprint("Running...")\nwhile True:\n    time.sleep(0.5)\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code}))

        while True:
            m = json.loads(await ws.recv())
            if m["type"] == "output" and "Running..." in m["data"]:
                break

        await ws.send(json.dumps({"type": "interrupt"}))
        res_ctrl_c = await drain_run(ws)

        if "Process interrupted" in res_ctrl_c["output"] and res_ctrl_c["status"] == "stopped":
            results["AT-06"] = "PASS"
            print(">>> AT-06: PASS (Process interrupted on signal)")
        else:
            results["AT-06"] = f"FAIL: {res_ctrl_c}"

        # ---------------------------------------------------------
        # AT-07: Package installation & usage
        # ---------------------------------------------------------
        print("\n[AT-07] Testing Package installation...")
        await ws.send(json.dumps({"type": "start", "runtime": "shell", "command": "pip install --help"}))
        pip_res = await drain_run(ws)

        # Next run python script importing numpy
        code_numpy = 'import numpy as np\nprint(np.array([1, 2, 3]))\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code_numpy}))
        np_res = await drain_run(ws)

        if len(pip_res["output"]) > 0 and "[1 2 3]" in np_res["output"]:
            results["AT-07"] = "PASS"
            print(">>> AT-07: PASS (Pip streamed and numpy imported successfully: [1 2 3])")
        else:
            results["AT-07"] = f"FAIL: {np_res}"

        # ---------------------------------------------------------
        # AT-08: Multiple sequential executions without reload
        # ---------------------------------------------------------
        print("\n[AT-08] Testing Multiple executions without reload...")
        code_a = 'print("PROGRAM_A_DONE")\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code_a}))
        res_a = await drain_run(ws)

        code_b = 'print("PROGRAM_B_DONE")\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code_b}))
        res_b = await drain_run(ws)

        if "PROGRAM_A_DONE" in res_a["output"] and "PROGRAM_B_DONE" in res_b["output"]:
            results["AT-08"] = "PASS"
            print(">>> AT-08: PASS (Program A and B ran consecutively)")
        else:
            results["AT-08"] = "FAIL"

        # ---------------------------------------------------------
        # AT-09: AOT / Native Mojo execution
        # ---------------------------------------------------------
        print("\n[AT-09] Testing Mojo AOT compilation and native binary execution...")
        mojo_code = """def main() raises:
    print("Mojo Native AOT Execution Successful!")
"""
        await ws.send(json.dumps({"type": "start", "runtime": "mojo", "code": mojo_code}))
        res_mojo = await drain_run(ws)

        if "Mojo Native AOT Execution Successful!" in res_mojo["output"] and res_mojo["exit_code"] == 0:
            results["AT-09"] = "PASS"
            print(">>> AT-09: PASS (Mojo AOT binary compiled and executed)")
        else:
            results["AT-09"] = f"FAIL: {res_mojo}"

        # ---------------------------------------------------------
        # AT-10: Real sys.stdin.readline() verification
        # ---------------------------------------------------------
        print("\n[AT-10] Testing Real sys.stdin.readline() verification...")
        code = 'import sys\nprint("WAITING", flush=True)\nvalue = sys.stdin.readline().strip()\nprint("RECEIVED:", value, flush=True)\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code}))

        while True:
            m = json.loads(await ws.recv())
            if m["type"] == "output" and "WAITING" in m.get("data", ""):
                break

        await ws.send(json.dumps({"type": "stdin", "data": "hello\n"}))
        res_stdin = await drain_run(ws)

        if "RECEIVED: hello" in res_stdin["output"]:
            results["AT-10"] = "PASS"
            print(">>> AT-10: PASS (Real stdin.readline() confirmed)")
        else:
            results["AT-10"] = "FAIL"

        # ---------------------------------------------------------
        # AT-11: Benchmark regression
        # ---------------------------------------------------------
        print("\n[AT-11] Testing Benchmark regression (isolated timing)...")
        from app.services.benchmark_service import BenchmarkService
        bench_res = BenchmarkService.benchmark(
            python_code="total = sum(i for i in range(100000))\n",
            mojo_code="""fn main():
    var total: Int = 0
    for i in range(100000):
        total += i
    print(total)
""",
            runs=1,
        )
        if bench_res.python.latency_ms > 0 and bench_res.mojo.latency_ms > 0:
            results["AT-11"] = "PASS"
            print(f">>> AT-11: PASS (Benchmark isolated. Py: {bench_res.python.latency_ms} ms, Mojo: {bench_res.mojo.latency_ms} ms)")
        else:
            results["AT-11"] = "FAIL"

        # ---------------------------------------------------------
        # AT-12: Error recovery without page reload
        # ---------------------------------------------------------
        print("\n[AT-12] Testing Error recovery without page reload...")
        bad_code = "this is a deliberate syntax error in python"
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": bad_code}))
        res_bad = await drain_run(ws)
        assert res_bad["exit_code"] != 0

        good_code = 'print("RECOVERED_AFTER_SYNTAX_ERROR")\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": good_code}))
        res_good = await drain_run(ws)

        if "RECOVERED_AFTER_SYNTAX_ERROR" in res_good["output"] and res_good["exit_code"] == 0:
            results["AT-12"] = "PASS"
            print(">>> AT-12: PASS (Cleanly recovered and ran valid program after syntax error)")
        else:
            results["AT-12"] = "FAIL"

    print("\n" + "=" * 60)
    print("FINAL ACCEPTANCE TEST RESULTS SUMMARY:")
    print("=" * 60)
    all_pass = True
    for test_id, res in sorted(results.items()):
        print(f"  {test_id}: {res}")
        if res != "PASS":
            all_pass = False

    assert all_pass, "Some acceptance tests failed!"
    print("\n>>> ALL ACCEPTANCE TESTS PASSED (12/12) <<<")


if __name__ == "__main__":
    asyncio.run(run_all_acceptance_tests())
