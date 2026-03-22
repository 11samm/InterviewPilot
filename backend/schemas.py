from typing import Annotated

from pydantic import BaseModel, Field


class SetupInput(BaseModel):
    role: str
    style: str
    vibe: str
    difficulty: str
    num_questions: int = 2


class FaceMetric(BaseModel):
    timestamp: float
    eye_contact: float
    head_pitch: float
    head_yaw: float


class PlanOutput(BaseModel):
    questions: Annotated[list[str], Field(min_length=1, max_length=10)]
    rubric: str


class AnalyzeInput(BaseModel):
    questions: list[str]
    rubric: str
    transcript: str
    duration_seconds: float
    face_metrics: list[FaceMetric]


class PresenceScore(BaseModel):
    eye_contact_score: float
    posture_score: float
    presence_score: float


class SpeechScore(BaseModel):
    filler_count: int
    filler_words: list[str]
    word_count: int
    speech_pace_wpm: float
    speech_score: float


class CoachOutput(BaseModel):
    strengths: Annotated[list[str], Field(min_length=3, max_length=3)]
    improvements: Annotated[list[str], Field(min_length=3, max_length=3)]
    confidence_score: Annotated[int, Field(ge=0, le=100)]
    summary: str


class AnalyzeOutput(BaseModel):
    presence: PresenceScore
    speech: SpeechScore
    coaching: CoachOutput


class DeepDiveInput(BaseModel):
    transcript: str
    weakness: str


class DeepDiveOutput(BaseModel):
    exercise: str
    tips: list[str]
    example_answer: str
