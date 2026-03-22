from backend.gemini import generate_structured
from backend.schemas import AnalyzeInput, CoachOutput, PresenceScore, SpeechScore

_COACH_SYSTEM = (
    "You are a strict executive interview coach. "
    "Grade harshly: answers that are vague, generic, rambling, or superficially touch on topics without substance should score below 50. "
    "Only substantive, specific, well-structured answers with concrete examples deserve 70+. "
    "Do not give credit for keyword alignment alone—the candidate must demonstrate real understanding. "
    "You give constructive, specific feedback. "
    "You always return strictly valid JSON matching the provided schema."
)


class CoachService:
    async def coach(
        self,
        payload: AnalyzeInput,
        *,
        presence: PresenceScore,
        speech: SpeechScore,
    ) -> CoachOutput:
        q1 = payload.questions[0] if len(payload.questions) > 0 else ""
        q2 = payload.questions[1] if len(payload.questions) > 1 else ""
        user_prompt = f"""Analyze this mock interview performance.

Interview questions:
1) {q1}
2) {q2}

Rubric:
{payload.rubric}

Candidate transcript:
{payload.transcript}

Interview duration (seconds): {payload.duration_seconds:.1f}

Objective signals (use alongside the transcript):
- Presence: composite {presence.presence_score:.2f} (eye contact {presence.eye_contact_score:.2f}, posture {presence.posture_score:.2f})
- Speech: composite score {speech.speech_score:.1f}, filler count {speech.filler_count}, pace {speech.speech_pace_wpm:.0f} WPM

Provide exactly 3 strengths, exactly 3 improvements, one integer confidence_score from 0-100, and a concise summary.

SCORING: Be strict. Vague or generic answers that only superficially align with the rubric should score 0-50. Reserve 70+ for clearly substantive, specific responses. Do not inflate scores for weak performance.
"""
        return await generate_structured(
            system_instruction=_COACH_SYSTEM,
            user_prompt=user_prompt,
            output_model=CoachOutput,
        )
