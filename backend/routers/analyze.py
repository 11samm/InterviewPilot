from fastapi import APIRouter, Depends
from backend import storage
from backend.auth import require_session
from backend.schemas import AnalyzeInput, AnalyzeOutput
from backend.services.coach import CoachService
from backend.services.presence import PresenceService
from backend.services.speech import SpeechService

router = APIRouter(tags=["analyze"])
_presence = PresenceService()
_speech = SpeechService()
_coach = CoachService()


@router.post("/analyze", response_model=AnalyzeOutput)
async def analyze_interview(body: AnalyzeInput, owner: str = Depends(require_session)) -> AnalyzeOutput:
    storage.save_draft(owner, body)
    saved = storage.get_interview(owner, str(body.interview_id))
    if saved["result"]:
        return AnalyzeOutput.model_validate(saved["result"])
    storage.rate_limit("analyze:" + owner, 10)
    result = AnalyzeOutput(
        presence=_presence.score(body.face_metrics),
        speech=_speech.score(body.transcript, body.speaking_seconds),
        coaching=await _coach.coach(body),
    )
    storage.save_result(owner, str(body.interview_id), result)
    return result
