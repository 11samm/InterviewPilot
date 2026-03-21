from fastapi import APIRouter, HTTPException

from backend.gemini import GeminiInvocationError
from backend.schemas import AnalyzeInput, AnalyzeOutput
from backend.services.coach import CoachService
from backend.services.presence import PresenceService
from backend.services.speech import SpeechService

router = APIRouter(tags=["analyze"])

_presence = PresenceService()
_speech = SpeechService()
_coach = CoachService()


@router.post("/analyze", response_model=AnalyzeOutput)
async def analyze_interview(body: AnalyzeInput) -> AnalyzeOutput:
    presence = _presence.score(body.face_metrics)
    speech = _speech.score(body.transcript, body.duration_seconds)
    try:
        coaching = await _coach.coach(body, presence=presence, speech=speech)
    except GeminiInvocationError as e:
        raise HTTPException(status_code=500, detail=e.message) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Interview analysis failed: {type(e).__name__}: {e}",
        ) from e
    return AnalyzeOutput(presence=presence, speech=speech, coaching=coaching)
