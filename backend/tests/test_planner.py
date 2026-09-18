import asyncio
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from backend.gemini import GeminiInvocationError
from backend.schemas import PlannerDraft, SetupInput
from backend.services.planner import PlannerService

RESUME = (
    "Jane Doe. Senior Software Engineer at Aurora Labs (2021-2024). "
    "Led checkout latency reduction; cut p99 from 800ms to 200ms using Redis caching."
)


def setup(**overrides):
    data = dict(
        role="Software Engineer",
        style="behavioral",
        vibe="startup",
        difficulty="medium",
        num_questions=2,
        resume_text="",
    )
    data.update(overrides)
    return SetupInput(**data)


def draft(*, questions, grounds):
    return PlannerDraft(
        questions=questions,
        rubric="Excellent answers cite specific evidence.",
        question_grounds=grounds,
    )


def test_generic_plan_rejects_grounds(monkeypatch):
    mock = AsyncMock(
        return_value=draft(
            questions=["Q1 about teamwork?", "Q2 about conflict?"],
            grounds=[],
        )
    )
    monkeypatch.setattr("backend.services.planner.generate_structured", mock)
    result = asyncio.run(PlannerService().generate(setup()))
    assert result.resume_based is False
    assert result.questions == ["Q1 about teamwork?", "Q2 about conflict?"]


def test_generic_plan_errors_on_unexpected_grounds(monkeypatch):
    mock = AsyncMock(
        return_value=draft(
            questions=["Q1?", "Q2?"],
            grounds=[{"question_index": 0, "evidence": "Aurora Labs"}],
        )
    )
    monkeypatch.setattr("backend.services.planner.generate_structured", mock)
    with pytest.raises(GeminiInvocationError, match="unsupported resume grounding"):
        asyncio.run(PlannerService().generate(setup()))


def test_resume_plan_accepts_valid_grounds(monkeypatch):
    mock = AsyncMock(
        return_value=draft(
            questions=[
                "Tell me about reducing checkout latency at Aurora Labs.",
                "How did Redis caching help your p99 improvement?",
            ],
            grounds=[
                {"question_index": 0, "evidence": "Aurora Labs"},
                {"question_index": 1, "evidence": "Redis caching"},
            ],
        )
    )
    monkeypatch.setattr("backend.services.planner.generate_structured", mock)
    result = asyncio.run(PlannerService().generate(setup(resume_text=RESUME)))
    assert result.resume_based is True
    assert len(result.questions) == 2


def test_resume_plan_rejects_invented_evidence(monkeypatch):
    mock = AsyncMock(
        return_value=draft(
            questions=["Q1?", "Q2?"],
            grounds=[
                {"question_index": 0, "evidence": "Aurora Labs"},
                {"question_index": 1, "evidence": "invented accomplishment"},
            ],
        )
    )
    monkeypatch.setattr("backend.services.planner.generate_structured", mock)
    with pytest.raises(GeminiInvocationError, match="unsupported resume evidence"):
        asyncio.run(PlannerService().generate(setup(resume_text=RESUME)))


@pytest.mark.parametrize("broken", ["missing", "duplicate"])
def test_resume_plan_rejects_bad_ground_indices(monkeypatch, broken):
    grounds = [
        {"question_index": 0, "evidence": "Aurora Labs"},
        {"question_index": 1, "evidence": "Redis caching"},
    ]
    if broken == "missing":
        grounds.pop()
    else:
        grounds[1]["question_index"] = 0
    mock = AsyncMock(return_value=draft(questions=["Q1?", "Q2?"], grounds=grounds))
    monkeypatch.setattr("backend.services.planner.generate_structured", mock)
    with pytest.raises(GeminiInvocationError, match="incomplete resume grounding"):
        asyncio.run(PlannerService().generate(setup(resume_text=RESUME)))


def test_wrong_question_count(monkeypatch):
    mock = AsyncMock(
        return_value=draft(questions=["Only one?"], grounds=[])
    )
    monkeypatch.setattr("backend.services.planner.generate_structured", mock)
    with pytest.raises(GeminiInvocationError, match="wrong question count"):
        asyncio.run(PlannerService().generate(setup(num_questions=2)))


def test_short_resume_rejected_without_gemini(monkeypatch):
    mock = AsyncMock()
    monkeypatch.setattr("backend.services.planner.generate_structured", mock)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(PlannerService().generate(setup(resume_text="x" * 40)))
    assert exc.value.status_code == 422
    assert "too short" in exc.value.detail
    assert not mock.called
