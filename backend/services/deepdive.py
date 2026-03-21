from backend.gemini import generate_structured
from backend.schemas import DeepDiveInput, DeepDiveOutput

_DEEPDIVE_SYSTEM = (
    "You are a communication and interview coach. "
    "You design practical drills. "
    "You always return strictly valid JSON matching the provided schema."
)


class DeepDiveService:
    async def generate(self, payload: DeepDiveInput) -> DeepDiveOutput:
        user_prompt = f"""The candidate wants targeted practice for this weakness:
{payload.weakness}

Their full interview transcript:
{payload.transcript}

Produce a short practice exercise they can do in about 5-10 minutes, several concrete tips, and a brief example answer that models strong structure.
"""
        return await generate_structured(
            system_instruction=_DEEPDIVE_SYSTEM,
            user_prompt=user_prompt,
            output_model=DeepDiveOutput,
        )
