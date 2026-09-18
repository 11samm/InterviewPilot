import math
import re

from backend.schemas import SpeechScore

# Keep this list and tokenization in sync with app/lib/speechMetrics.ts.
# Context-dependent words such as "like", "right" and "yeah" are deliberately excluded.
FILLERS = ("you know", "i mean", "sort of", "kind of", "um", "uh", "erm", "hmm")
WORDS = re.compile(r"[^\W_]+(?:['’][^\W_]+)*", re.UNICODE)


class SpeechService:
    def score(self, transcript: str, speaking_seconds: float) -> SpeechScore:
        tokens = WORDS.findall(transcript.lower())
        found = []
        index = 0
        while index < len(tokens):
            for phrase in FILLERS:
                parts = phrase.split()
                if tokens[index:index + len(parts)] == parts:
                    found.append(phrase)
                    index += len(parts)
                    break
            else:
                index += 1
        seconds = speaking_seconds if math.isfinite(speaking_seconds) and speaking_seconds > 0 else 0
        pace = math.floor(len(tokens) / seconds * 600 + 0.5) / 10 if seconds >= 5 and tokens else None
        return SpeechScore(
            filler_count=len(found), filler_words=sorted(set(found)),
            word_count=len(tokens), speaking_seconds=round(seconds, 3),
            speech_pace_wpm=pace,
        )
