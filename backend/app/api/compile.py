from fastapi import APIRouter, HTTPException
from app.schemas.models import CompileRequest, CompileResponse
from app.services.compiler_service import CompilerService

router = APIRouter(prefix="/api", tags=["Compiler"])


@router.post("/compile", response_model=CompileResponse)
async def compile_code(req: CompileRequest) -> CompileResponse:
    if not req.code or not req.code.strip():
        raise HTTPException(status_code=400, detail="Source code cannot be empty")
    return CompilerService.compile_mojo(req.code, req.flags, req.opt_level or "-O3")
