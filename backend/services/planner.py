from backend.gemini import generate_structured
from backend.schemas import PlanOutput, SetupInput

_PLANNER_SYSTEM = (
    "You are an expert technical and behavioral interviewer. "
    "You always return strictly valid JSON matching the provided schema."
)


class PlannerService:
    async def generate(self, payload: SetupInput) -> PlanOutput:
        num_q = max(1, min(10, payload.num_questions))
        user_prompt = f"""Create a mock interview plan.

Target role (use this verbatim as the candidate's role context): {payload.role}
Company vibe: {payload.vibe}
Interview style: {payload.style}
Difficulty level: {payload.difficulty}

Generate exactly {num_q} distinct, specific interview questions tailored to this role and vibe.
Include a concise scoring rubric (what excellent, average, and weak answers look like).
"""
        return await generate_structured(
            system_instruction=_PLANNER_SYSTEM,
            user_prompt=user_prompt,
            output_model=PlanOutput,
        )
