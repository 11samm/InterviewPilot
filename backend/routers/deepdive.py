from fastapi import APIRouter, HTTPException

from backend.gemini import GeminiInvocationError
from backend.schemas import DeepDiveInput, DeepDiveOutput
from backend.services.deepdive import DeepDiveService

router = APIRouter(tags=["deepdive"])

_deepdive = DeepDiveService()


@router.post("/deepdive", response_model=DeepDiveOutput)
async def deepdive(body: DeepDiveInput) -> DeepDiveOutput:
    try:
        return await _deepdive.generate(body)
    except GeminiInvocationError as e:
        raise HTTPException(status_code=500, detail=e.message) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Deep dive generation failed: {type(e).__name__}: {e}",
        ) from e
