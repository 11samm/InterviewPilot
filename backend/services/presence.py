from backend.schemas import FaceMetric, PresenceScore


class PresenceService:
    def score(self, metrics: list[FaceMetric]) -> PresenceScore:
        _ = metrics
        return PresenceScore(
            eye_contact_score=0.78,
            posture_score=0.82,
            presence_score=0.8,
        )
