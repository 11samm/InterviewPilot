from fastapi import APIRouter, HTTPException

from backend.gemini import GeminiInvocationError
from backend.schemas import PlanOutput, SetupInput
from backend.services.interviewer import InterviewerService
from backend.services.planner import PlannerService

router = APIRouter(tags=["plan"])

_planner = PlannerService()
_interviewer = InterviewerService()


@router.post("/plan", response_model=PlanOutput)
async def create_plan(body: SetupInput) -> PlanOutput:
    try:
        planned = await _planner.generate(body)
    except GeminiInvocationError as e:
        raise HTTPException(status_code=500, detail=e.message) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Plan generation failed: {type(e).__name__}: {e}",
        ) from e
    return _interviewer.format(planned)
