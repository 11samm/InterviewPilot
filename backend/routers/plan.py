from fastapi import APIRouter

from backend.schemas import PlanOutput, SetupInput
from backend.services.interviewer import InterviewerService
from backend.services.planner import PlannerService

router = APIRouter(tags=["plan"])

_planner = PlannerService()
_interviewer = InterviewerService()


@router.post("/plan", response_model=PlanOutput)
async def create_plan(body: SetupInput) -> PlanOutput:
    planned = await _planner.generate(body)
    return _interviewer.format(planned)
