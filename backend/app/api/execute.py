from fastapi import APIRouter, HTTPException
from app.schemas.models import ExecuteRequest, ExecuteResponse
from app.services.execution_service import ExecutionService

router = APIRouter(prefix="/api", tags=["Execution"])


@router.post("/execute", response_model=ExecuteResponse)
async def execute_code(req: ExecuteRequest) -> ExecuteResponse:
    if not req.code or not req.code.strip():
        raise HTTPException(status_code=400, detail="Source code cannot be empty")
    return ExecutionService.execute_code(req.code, req.runtime, req.stdin)
