from backend.schemas import FaceMetric, PresenceScore


class PresenceService:
    def score(self, metrics: list[FaceMetric]) -> PresenceScore:
        return PresenceScore(
            available=bool(metrics),
            sample_count=len(metrics),
            eye_contact_score=round(sum(m.eye_contact for m in metrics) / len(metrics), 3) if metrics else None,
        )
