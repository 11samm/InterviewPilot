from fastapi import APIRouter

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
    coaching = await _coach.coach(body)
    return AnalyzeOutput(presence=presence, speech=speech, coaching=coaching)
