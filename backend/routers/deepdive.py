from fastapi import APIRouter

from backend.schemas import DeepDiveInput, DeepDiveOutput
from backend.services.deepdive import DeepDiveService

router = APIRouter(tags=["deepdive"])

_deepdive = DeepDiveService()


@router.post("/deepdive", response_model=DeepDiveOutput)
async def deepdive(body: DeepDiveInput) -> DeepDiveOutput:
    return await _deepdive.generate(body)
