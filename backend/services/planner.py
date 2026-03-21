from backend.schemas import PlanOutput, SetupInput


class PlannerService:
    _MOCK_QUESTIONS: tuple[str, str] = (
        "Tell me about a time you failed and what you learned from it.",
        "Describe a situation where you had to influence someone who disagreed with you.",
    )
    _MOCK_RUBRIC: str = (
        "Score clarity, STAR structure, ownership, and reflection. "
        "Penalize vague claims; reward specific outcomes and lessons learned."
    )

    async def generate(self, payload: SetupInput) -> PlanOutput:
        _ = payload
        return PlanOutput(questions=list(self._MOCK_QUESTIONS), rubric=self._MOCK_RUBRIC)
