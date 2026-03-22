from backend.schemas import FaceMetric, PresenceScore


class PresenceService:
    def score(self, metrics: list[FaceMetric]) -> PresenceScore:
        if not metrics:
            return PresenceScore(
                eye_contact_score=0.0,
                posture_score=0.0,
                presence_score=0.0,
            )

        eye_contact_score = sum(m.eye_contact for m in metrics) / len(metrics)

        posture_scores = [
            max(0.0, 1.0 - (abs(m.head_pitch) + abs(m.head_yaw)) / 60.0)
            for m in metrics
        ]
        posture_score = sum(posture_scores) / len(posture_scores)

        presence_score = eye_contact_score * 0.6 + posture_score * 0.4
        return PresenceScore(
            eye_contact_score=round(eye_contact_score, 3),
            posture_score=round(posture_score, 3),
            presence_score=round(presence_score, 3),
        )
