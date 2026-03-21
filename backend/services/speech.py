from backend.schemas import SpeechScore


class SpeechService:
    def score(self, transcript: str, duration_seconds: float) -> SpeechScore:
        _ = transcript, duration_seconds
        return SpeechScore(
            filler_count=12,
            filler_words=["um", "like", "you know"],
            word_count=248,
            speech_pace_wpm=142.0,
            speech_score=71.5,
        )
