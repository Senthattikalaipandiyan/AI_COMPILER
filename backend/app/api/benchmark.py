from fastapi import APIRouter, HTTPException
from app.schemas.models import BenchmarkRequest, BenchmarkResponse
from app.services.benchmark_service import BenchmarkService

router = APIRouter(prefix="/api", tags=["Benchmarking"])


@router.post("/benchmark", response_model=BenchmarkResponse)
async def run_benchmark(req: BenchmarkRequest) -> BenchmarkResponse:
    py_code = req.python_code if (req.python_code and req.python_code.strip()) else BenchmarkService.DEFAULT_PYTHON_CODE
    mojo_code = req.mojo_code if (req.mojo_code and req.mojo_code.strip()) else BenchmarkService.DEFAULT_MOJO_CODE
    return BenchmarkService.benchmark(py_code, mojo_code, req.stdin, req.runs)

