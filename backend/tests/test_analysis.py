import asyncio
from uuid import uuid4
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from backend.gemini import GeminiInvocationError
from backend.schemas import AnalyzeInput, ModelCoaching
from backend.services.coach import CoachService
from backend.services.presence import PresenceService
from backend.services.speech import SpeechService


def payload(count=4):
    return AnalyzeInput(
        interview_id=uuid4(), questions=[f"Question {i}" for i in range(count)], rubric="Specific evidence",
        answers=[dict(question_index=i, asked=True, text=f"I delivered project {i}.", speaking_seconds=10) for i in range(count)],
        duration_seconds=120, face_metrics=[],
    )


def test_speech_matches_words_phrases_and_real_duration():
    score = SpeechService().score("Um, you know, I mean: umbrella. I like TypeScript.", 10)
    assert score.filler_count == 3
    assert score.filler_words == ["i mean", "um", "you know"]
    assert score.word_count == 9
    assert score.speech_pace_wpm == 54


@pytest.mark.parametrize("text,seconds", [("", 20), ("Hello", 0), ("Hello", 4.99), ("Hello", float("nan"))])
def test_unavailable_pace(text, seconds):
    assert SpeechService().score(text, seconds).speech_pace_wpm is None


def test_missing_camera_is_unavailable():
    score = PresenceService().score([])
    assert score.eye_contact_score is None
    assert not score.available


@pytest.mark.parametrize("change", [
    lambda p: p.update(duration_seconds=-1),
    lambda p: p["answers"][0].update(speaking_seconds=999),
    lambda p: p["answers"][0].update(question_index=1),
    lambda p: p["answers"][0].update(asked=False),
    lambda p: p["face_metrics"].append(dict(timestamp=1, eye_contact=2, head_pitch=0, head_yaw=0)),
])
def test_bad_recordings_rejected(change):
    data = payload().model_dump(mode="json")
    change(data)
    with pytest.raises(ValidationError):
        AnalyzeInput.model_validate(data)


def model_output(count=4):
    return ModelCoaching(
        question_grades=[dict(question_index=i, score=60+i*10, evidence=f"project {i}", feedback="Explain the measured result.") for i in range(count)],
        strengths=["Specific projects."], improvements=["Include results."], summary="Useful project examples.",
    )


def test_every_question_is_graded_and_aggregate_is_deterministic(monkeypatch):
    model = AsyncMock(return_value=model_output())
    monkeypatch.setattr("backend.services.coach.generate_structured", model)
    result = asyncio.run(CoachService().coach(payload()))
    assert len(result.question_results) == 4
    assert result.overall_score == 75
    assert '"question_index": 3' in model.call_args.kwargs["user_prompt"]


@pytest.mark.parametrize("broken", ["missing", "duplicate", "unsupported"])
def test_incomplete_or_invented_grades_are_rejected(monkeypatch, broken):
    output = model_output()
    if broken == "missing":
        output.question_grades.pop()
    elif broken == "duplicate":
        output.question_grades[-1].question_index = 0
    else:
        output.question_grades[0].evidence = "an invented accomplishment"
    monkeypatch.setattr("backend.services.coach.generate_structured", AsyncMock(return_value=output))
    with pytest.raises(GeminiInvocationError):
        asyncio.run(CoachService().coach(payload()))


def test_unasked_excluded_unanswered_zero_without_llm(monkeypatch):
    model = AsyncMock()
    monkeypatch.setattr("backend.services.coach.generate_structured", model)
    data = payload(2)
    data.answers[0].text = ""
    data.answers[1].asked = False
    data.answers[1].text = ""
    data.answers[1].speaking_seconds = 0
    result = asyncio.run(CoachService().coach(data))
    assert result.overall_score == 0
    assert [q.status for q in result.question_results] == ["unanswered", "not_asked"]
    assert result.question_results[1].score is None
    model.assert_not_called()
