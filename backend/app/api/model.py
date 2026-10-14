from fastapi import APIRouter, File, UploadFile, HTTPException
from app.schemas.models import ModelIngestResponse
from app.services.max_service import MaxModelService

router = APIRouter(prefix="/api", tags=["Model Ingestion"])


@router.post("/ingest-model", response_model=ModelIngestResponse)
async def ingest_model(file: UploadFile = File(...)) -> ModelIngestResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a valid filename")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        return MaxModelService.ingest_file(file.filename, content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest model: {str(e)}")
