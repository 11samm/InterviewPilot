from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

ShortText = Annotated[str, Field(min_length=1, max_length=2000)]
Score = Annotated[int, Field(ge=0, le=100)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class SetupInput(StrictModel):
    role: Annotated[str, Field(min_length=1, max_length=200)]
    style: Annotated[str, Field(min_length=1, max_length=100)]
    vibe: Annotated[str, Field(min_length=1, max_length=100)]
    difficulty: Annotated[str, Field(min_length=1, max_length=100)]
    num_questions: int = Field(default=2, ge=1, le=10)
    resume_text: str = Field(default="", max_length=30000)


class FaceMetric(StrictModel):
    timestamp: float = Field(ge=0)
    eye_contact: float = Field(ge=0, le=1)
    head_pitch: float = Field(ge=-180, le=180)
    head_yaw: float = Field(ge=-180, le=180)


class QuestionGround(StrictModel):
    question_index: int = Field(ge=0, le=9)
    evidence: str = Field(min_length=1, max_length=500)


class PlannerDraft(StrictModel):
    questions: Annotated[list[ShortText], Field(min_length=1, max_length=10)]
    rubric: Annotated[str, Field(min_length=1, max_length=10000)]
    question_grounds: Annotated[list[QuestionGround], Field(max_length=10)]


class PlanOutput(StrictModel):
    questions: Annotated[list[ShortText], Field(min_length=1, max_length=10)]
    rubric: Annotated[str, Field(min_length=1, max_length=10000)]
    resume_based: bool = False


class ResumeParseOutput(StrictModel):
    text: str = Field(min_length=1, max_length=30000)
    filename: Annotated[str, Field(min_length=1, max_length=200)]
    char_count: int = Field(ge=1, le=30000)


class AnswerInput(StrictModel):
    question_index: int = Field(ge=0, le=9)
    asked: bool
    text: str = Field(max_length=30000)
    speaking_seconds: float = Field(ge=0, le=3600)

    @model_validator(mode="after")
    def validate_unasked(self):
        if not self.asked and (self.text.strip() or self.speaking_seconds):
            raise ValueError("An unasked question cannot have an answer or speaking time")
        return self


class AnalyzeInput(StrictModel):
    interview_id: UUID
    questions: Annotated[list[ShortText], Field(min_length=1, max_length=10)]
    rubric: Annotated[str, Field(min_length=1, max_length=10000)]
    answers: Annotated[list[AnswerInput], Field(min_length=1, max_length=10)]
    duration_seconds: float = Field(ge=0, le=7200)
    face_metrics: Annotated[list[FaceMetric], Field(max_length=7200)]

    @model_validator(mode="after")
    def validate_answers(self):
        if [a.question_index for a in self.answers] != list(range(len(self.questions))):
            raise ValueError("Supply one answer entry per question, in question order")
        if self.speaking_seconds > self.duration_seconds + 1:
            raise ValueError("Speaking time cannot exceed interview duration")
        return self

    @property
    def transcript(self) -> str:
        return " ".join(a.text.strip() for a in self.answers if a.text.strip())

    @property
    def speaking_seconds(self) -> float:
        return sum(a.speaking_seconds for a in self.answers)


class PresenceScore(StrictModel):
    available: bool
    sample_count: int
    eye_contact_score: float | None


class SpeechScore(StrictModel):
    filler_count: int
    filler_words: list[str]
    word_count: int
    speaking_seconds: float
    speech_pace_wpm: float | None


class QuestionGrade(StrictModel):
    question_index: int = Field(ge=0, le=9)
    score: Score
    evidence: str = Field(max_length=2000)
    feedback: ShortText


class ModelCoaching(StrictModel):
    question_grades: Annotated[list[QuestionGrade], Field(min_length=1, max_length=10)]
    strengths: Annotated[list[ShortText], Field(max_length=3)]
    improvements: Annotated[list[ShortText], Field(max_length=3)]
    summary: ShortText


class QuestionResult(StrictModel):
    question_index: int
    question: str
    answer: str
    status: Literal["graded", "unanswered", "not_asked"]
    score: int | None
    evidence: str
    feedback: str


class CoachOutput(StrictModel):
    question_results: list[QuestionResult]
    overall_score: float | None
    strengths: list[str]
    improvements: list[str]
    summary: str


class AnalyzeOutput(StrictModel):
    presence: PresenceScore
    speech: SpeechScore
    coaching: CoachOutput


class DeepDiveInput(StrictModel):
    transcript: Annotated[str, Field(min_length=1, max_length=300000)]
    weakness: ShortText


class DeepDiveOutput(StrictModel):
    exercise: ShortText
    tips: Annotated[list[ShortText], Field(min_length=1, max_length=10)]
    example_answer: Annotated[str, Field(min_length=1, max_length=10000)]
