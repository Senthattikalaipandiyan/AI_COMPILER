import asyncio
import json
import websockets

WS_URL = "ws://localhost:8000/api/ws/terminal"


async def test_terminal_suite():
    print("Connecting to:", WS_URL)
    async with websockets.connect(WS_URL) as ws:
        # 1. Verify ready handshake
        init_msg = json.loads(await ws.recv())
        assert init_msg["type"] == "status" and init_msg["status"] == "ready"
        print("[PASS] Initial status:", init_msg)

        # 2. Test AT-01 / AT-03: Real-time output and prompt BEFORE input
        print("\n--- Testing AT-01 & AT-03: Real-time prompt streaming & stdin ---")
        code_1 = 'print("Starting...")\nname = input("Enter name: ")\nprint("Hello " + name)\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code_1}))

        prompt_received = ""
        while True:
            msg = json.loads(await ws.recv())
            if msg["type"] == "output" and msg["stream"] == "stdout":
                prompt_received += msg["data"]
                if "Enter name: " in prompt_received:
                    print("[PASS] Prompt received before stdin input:", repr(prompt_received))
                    break

        # Send input
        await ws.send(json.dumps({"type": "stdin", "data": "Senthatti\n"}))

        output_after = ""
        while True:
            msg = json.loads(await ws.recv())
            if msg["type"] == "output" and msg["stream"] == "stdout":
                output_after += msg["data"]
            elif msg["type"] == "exit":
                assert msg["exit_code"] == 0
                print("[PASS] Process completed with exit code 0. Output after input:", repr(output_after))
                assert "Hello Senthatti" in output_after
                break

        # 3. Test AT-02: Multiple inputs in one running process
        print("\n--- Testing AT-02: Multiple inputs in single process ---")
        code_2 = 'a = int(input("Enter a: "))\nb = int(input("Enter b: "))\nprint("SUM:", a + b)\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code_2}))

        # Wait for "Enter a: "
        buf = ""
        while "Enter a: " not in buf:
            m = json.loads(await ws.recv())
            if m["type"] == "output":
                buf += m["data"]
        print("[PASS] First prompt received:", repr(buf))
        await ws.send(json.dumps({"type": "stdin", "data": "10\n"}))

        # Wait for "Enter b: "
        buf = ""
        while "Enter b: " not in buf:
            m = json.loads(await ws.recv())
            if m["type"] == "output":
                buf += m["data"]
        print("[PASS] Second prompt received:", repr(buf))
        await ws.send(json.dumps({"type": "stdin", "data": "20\n"}))

        buf = ""
        while True:
            m = json.loads(await ws.recv())
            if m["type"] == "output":
                buf += m["data"]
            elif m["type"] == "exit":
                assert m["exit_code"] == 0
                print("[PASS] Multiple inputs result:", repr(buf))
                assert "SUM: 30" in buf
                break

        # 4. Test AT-05: Runtime error & terminal usability
        print("\n--- Testing AT-05: Runtime error handling ---")
        code_err = 'print("Before error")\nx = 10 / 0\nprint("After error")\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code_err}))

        stderr_buf = ""
        stdout_buf = ""
        while True:
            m = json.loads(await ws.recv())
            if m["type"] == "output":
                if m["stream"] == "stderr":
                    stderr_buf += m["data"]
                else:
                    stdout_buf += m["data"]
            elif m["type"] == "exit":
                assert m["exit_code"] != 0
                print("[PASS] Exit code non-zero:", m["exit_code"])
                break

        assert "Before error" in stdout_buf
        assert "ZeroDivisionError" in stderr_buf
        assert "After error" not in stdout_buf
        print("[PASS] Correctly captured stdout before error and stderr traceback.")

        # 5. Test AT-06: Ctrl+C / Interrupt
        print("\n--- Testing AT-06: Process interrupt (Ctrl+C) ---")
        code_loop = 'import time\nprint("Loop started")\nwhile True:\n    time.sleep(0.5)\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code_loop}))

        # Wait for "Loop started"
        while True:
            m = json.loads(await ws.recv())
            if m["type"] == "output" and "Loop started" in m.get("data", ""):
                print("[PASS] Loop started, sending interrupt...")
                break

        await ws.send(json.dumps({"type": "interrupt"}))

        interrupted = False
        while True:
            m = json.loads(await ws.recv())
            if m["type"] == "output" and "Process interrupted" in m.get("data", ""):
                interrupted = True
            elif m["type"] == "status" and m.get("status") == "stopped":
                print("[PASS] Process stopped status received.")
                break

        assert interrupted, "Expected interruption message"

        # 6. Test AT-08 & AT-12: Error recovery / Next execution without reconnect
        print("\n--- Testing AT-08 & AT-12: Immediate subsequent execution ---")
        code_recover = 'print("RECOVERED_SUCCESS")\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code_recover}))

        recov_buf = ""
        while True:
            m = json.loads(await ws.recv())
            if m["type"] == "output":
                recov_buf += m["data"]
            elif m["type"] == "exit":
                assert m["exit_code"] == 0
                break

        assert "RECOVERED_SUCCESS" in recov_buf
        print("[PASS] Immediate execution after error/interrupt succeeded:", repr(recov_buf))

        # 7. Test AT-07: Package installation command
        print("\n--- Testing AT-07: Controlled package management via pip ---")
        await ws.send(json.dumps({"type": "start", "runtime": "shell", "command": "pip install --help"}))
        pip_buf = ""
        while True:
            m = json.loads(await ws.recv())
            if m["type"] == "output":
                pip_buf += m["data"]
            elif m["type"] == "exit":
                assert m["exit_code"] == 0
                break
        assert "Usage:" in pip_buf
        print("[PASS] Pip installation command output streamed successfully.")

        # 8. Test AT-10: sys.stdin.readline() verification
        print("\n--- Testing AT-10: Real sys.stdin.readline() verification ---")
        code_stdin = 'import sys\nprint("WAITING", flush=True)\nval = sys.stdin.readline().strip()\nprint("RECEIVED:", val, flush=True)\n'
        await ws.send(json.dumps({"type": "start", "runtime": "python", "code": code_stdin}))

        while True:
            m = json.loads(await ws.recv())
            if m["type"] == "output" and "WAITING" in m.get("data", ""):
                print("[PASS] WAITING received. Sending hello...")
                break

        await ws.send(json.dumps({"type": "stdin", "data": "hello\n"}))

        recv_val = ""
        while True:
            m = json.loads(await ws.recv())
            if m["type"] == "output":
                recv_val += m["data"]
            elif m["type"] == "exit":
                assert m["exit_code"] == 0
                break

        assert "RECEIVED: hello" in recv_val
        print("[PASS] Stdin verification confirmed:", repr(recv_val))

    print("\nALL INTERACTIVE TERMINAL TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(test_terminal_suite())
