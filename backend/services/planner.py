from backend.gemini import GeminiInvocationError, generate_structured
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
Include a concise scoring rubric with strict criteria:
- Excellent (80-100): Specific, substantive answers with concrete examples and clear structure.
- Average (50-70): Partially relevant but vague, generic, or lacking depth.
- Weak (0-50): Vague, off-topic, rambling, or answers that merely mention keywords without substance. Superficial alignment with the question should not exceed 50.
"""
        result = await generate_structured(
            system_instruction=_PLANNER_SYSTEM,
            user_prompt=user_prompt,
            output_model=PlanOutput,
        )

        if len(result.questions) != num_q:
            raise GeminiInvocationError("The planner returned the wrong question count. Please retry.")
        return result
