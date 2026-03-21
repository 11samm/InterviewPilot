from backend.schemas import DeepDiveInput, DeepDiveOutput


class DeepDiveService:
    async def generate(self, payload: DeepDiveInput) -> DeepDiveOutput:
        _ = payload
        return DeepDiveOutput(
            exercise=(
                "Record a 90-second answer to the same prompt using STAR: "
                "state the situation in one sentence, your action in two, and the result with one metric."
            ),
            tips=[
                "Open with the outcome, then rewind to how you got there.",
                "Use 'I' for ownership; avoid blaming teams or tools.",
                "End with what you would do differently next time.",
            ],
            example_answer=(
                "In my last role, customer churn ticked up 8% after a pricing change. "
                "I pulled cohort data, ran five user interviews, and proposed a grandfather window "
                "that product shipped in two weeks. Churn normalized within a month. "
                "Next time I would socialize the change earlier with success metrics attached."
            ),
        )
