from backend.schemas import AnalyzeInput, CoachOutput


class CoachService:
    async def coach(self, payload: AnalyzeInput) -> CoachOutput:
        _ = payload
        return CoachOutput(
            strengths=[
                "Clear narrative arc across answers",
                "Concrete examples with enough context",
                "Steady, approachable delivery",
            ],
            improvements=[
                "Trim setup before the core story",
                "Name metrics or timelines where possible",
                "Pause briefly instead of using filler words",
            ],
            confidence_score=78,
            summary="Strong substance with a few delivery tweaks would elevate the overall impression.",
        )
