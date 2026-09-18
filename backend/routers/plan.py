from fastapi import APIRouter
from backend.schemas import PlanOutput, SetupInput
from backend.services.planner import PlannerService

router = APIRouter(tags=["plan"])
_planner = PlannerService()


@router.post("/plan", response_model=PlanOutput)
async def create_plan(body: SetupInput) -> PlanOutput:
    return await _planner.generate(body)
