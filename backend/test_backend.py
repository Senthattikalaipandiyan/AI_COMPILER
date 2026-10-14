import io
import time
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    print("[PASS] Health:", data["status"], "Mojo:", data["mojo_version"], "MAX:", data["max_version"])

def test_presets():
    res = client.get("/api/presets")
    assert res.status_code == 200
    presets = res.json()
    assert "gemm" in presets
    print("[PASS] Presets loaded:", list(presets.keys()))

def test_execute_python():
    res = client.post("/api/execute", json={
        "code": "import sys\nline = sys.stdin.read().strip()\nprint('ECHO:', line)",
        "runtime": "python",
        "stdin": "enterprise-grade-input-42"
    })
    assert res.status_code == 200
    data = res.json()
    assert "ECHO: enterprise-grade-input-42" in data["stdout"]
    print("[PASS] Execute Python with Stdin:", data["execution_time_ms"], "ms")

def test_execute_mojo():
    strict_fn_code = """fn main():
    var n: Int = 128
    var total: Float64 = 0.0
    for i in range(n):
        for j in range(n):
            for k in range(n):
                total += 0.001 * Float64(i + j + k)
    print("Mojo GEMM 128x128 completed. Accumulator:", total)
"""
    res = client.post("/api/execute", json={
        "code": strict_fn_code,
        "runtime": "mojo",
        "stdin": ""
    })
    assert res.status_code == 200
    data = res.json()
    assert "Mojo GEMM 128x128 completed. Accumulator:" in data["stdout"]
    print("[PASS] Execute Mojo (AOT + Isolated Timing):", data["execution_time_ms"], "ms (Output:", data["stdout"].strip(), ")")

def test_compile_mojo():
    res = client.post("/api/compile", json={
        "code": "def main():\n    var x: Int = 10\n    var y: Int = 20\n    print(x + y)\n",
        "flags": ["--unroll", "--vectorize"],
        "opt_level": "-O3"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["mlir"]) > 50
    print("[PASS] Compile Mojo to MLIR/IR. Duration:", data["duration_ms"], "ms, Dialects:", data["dialect_info"].get("dialects_detected"))

def test_benchmark():
    py_code = "print(sum(i**2 for i in range(200000)))"
    mojo_code = "def main():\n    var s: Int = 0\n    for i in range(200000):\n        s += i * i\n    print(s)\n"
    res = client.post("/api/benchmark", json={
        "python_code": py_code,
        "mojo_code": mojo_code,
        "runs": 2
    })
    assert res.status_code == 200
    data = res.json()
    print("[PASS] Benchmark:", "Python Latency:", data["python"]["latency_ms"], "ms, Mojo Latency:", data["mojo"]["latency_ms"], "ms, Speedup:", data["speedup_factor"], "x")

def test_model_ingest():
    import onnx
    from onnx import helper, TensorProto
    X = helper.make_tensor_value_info('X', TensorProto.FLOAT, [1, 8])
    Y = helper.make_tensor_value_info('Y', TensorProto.FLOAT, [1, 8])
    node = helper.make_node('Relu', ['X'], ['Y'])
    graph = helper.make_graph([node], 'test_net', [X], [Y])
    model = helper.make_model(graph)
    buf = io.BytesIO()
    onnx.save(model, buf)
    buf.seek(0)

    res = client.post("/api/ingest-model", files={"file": ("test_net.onnx", buf.getvalue(), "application/octet-stream")})
    assert res.status_code == 200
    data = res.json()
    assert data["format"] == "onnx"
    assert "mo.graph" in data["mlir"]
    print("[PASS] Model Ingest MAX MLIR:", data["mlir"][:120])

if __name__ == "__main__":
    test_health()
    test_presets()
    test_execute_python()
    test_execute_mojo()
    test_compile_mojo()
    test_benchmark()
    test_model_ingest()
    print("\nALL BACKEND TESTS PASSED SUCCESSFULLY!")
