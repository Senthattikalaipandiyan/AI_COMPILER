from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.max_inference import MaxInferenceService

router = APIRouter(prefix="/api", tags=["MAX Inference"])


class InferenceRequest(BaseModel):
    shape: Optional[List[int]] = Field(default=[1, 16], description="Input tensor shape")
    layer_ops: Optional[List[str]] = Field(default=["relu", "tanh"], description="List of operations in the pipeline")


class InferenceResponse(BaseModel):
    engine: str
    device: str
    input_shape: List[int]
    input_sample: List[float]
    output_shape: List[int]
    output_values: List[float]
    output_mean: float
    output_std: float
    inference_latency_ms: float
    success: bool


@router.post("/max-inference", response_model=InferenceResponse)
async def run_max_inference(req: InferenceRequest) -> InferenceResponse:
    try:
        MaxInferenceService.compile_graph_pipeline(
            graph_name="interactive_max_pipeline",
            input_shape=req.shape,
            layer_ops=req.layer_ops,
        )
        res = MaxInferenceService.run_inference(shape=req.shape)
        return InferenceResponse(**res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MAX Engine inference failed: {str(e)}")
