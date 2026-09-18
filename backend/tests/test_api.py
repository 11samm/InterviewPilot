from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.gemini import GeminiInvocationError
from backend.tests.test_analysis import payload


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.sqlite3"))
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("DEMO_ACCESS_CODE", raising=False)
    with TestClient(app) as value:
        assert value.post("/api/session", json={}).status_code == 200
        yield value


def draft():
    data = payload(2).model_dump(mode="json")
    for a in data["answers"]:
        a.update(text="", speaking_seconds=0)
    return data


def test_authentication_required(client):
    with TestClient(app) as outsider:
        assert outsider.get("/api/interviews").status_code == 401
        assert outsider.post("/api/live-token").status_code == 401
        assert outsider.post(
            "/api/resume",
            files={"file": ("resume.txt", b"x" * 100, "text/plain")},
        ).status_code == 401


def test_resume_upload_and_rate_limit(client):
    body = (
        "Senior engineer at Aurora Labs. Led checkout latency work across payments "
        "and reduced p99 for the storefront checkout path."
    ).encode()
    response = client.post(
        "/api/resume",
        files={"file": ("my-resume.txt", body, "text/plain")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "Aurora Labs" in payload["text"]
    assert payload["filename"] == "my-resume.txt"
    assert payload["char_count"] == len(payload["text"])
    for _ in range(9):
        assert client.post(
            "/api/resume",
            files={"file": ("my-resume.txt", body, "text/plain")},
        ).status_code == 200
    assert client.post(
        "/api/resume",
        files={"file": ("my-resume.txt", body, "text/plain")},
    ).status_code == 429


def test_plan_rejects_short_resume(client):
    response = client.post(
        "/api/plan",
        json={
            "role": "Software Engineer",
            "style": "behavioral",
            "vibe": "startup",
            "difficulty": "medium",
            "num_questions": 2,
            "resume_text": "x" * 40,
        },
    )
    assert response.status_code == 422
    assert "too short" in response.json()["detail"]


def test_analyze_rejects_resume_based_extra_field(client):
    data = draft()
    data["resume_based"] = True
    assert client.post("/api/analyze", json=data).status_code == 422


def test_save_history_retry_and_session_isolation(client):
    data = draft()
    response = client.post("/api/analyze", json=data)
    assert response.status_code == 200
    assert response.json()["coaching"]["overall_score"] == 0
    assert response.json()["presence"]["eye_contact_score"] is None
    assert response.headers["cache-control"] == "no-store"
    assert client.post("/api/analyze", json=data).json() == response.json()
    assert len(client.get("/api/interviews").json()) == 1
    url = f'/api/interviews/{data["interview_id"]}'
    assert client.get(url).json()["payload"]["interview_id"] == data["interview_id"]
    with TestClient(app) as other:
        other.post("/api/session", json={})
        assert other.get(url).status_code == 404
        assert other.get("/api/interviews").json() == []
        other.delete(url)
    assert client.get(url).status_code == 200
    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404


def test_ai_failure_preserves_draft(client, monkeypatch):
    data = payload().model_dump(mode="json")
    monkeypatch.setattr("backend.routers.analyze._coach.coach", AsyncMock(side_effect=GeminiInvocationError("Please retry.")))
    assert client.post("/api/analyze", json=data).status_code == 502
    saved = client.get(f'/api/interviews/{data["interview_id"]}').json()
    assert saved["payload"]["answers"][3]["text"]
    assert saved["result"] is None


def test_completed_interview_cannot_be_overwritten(client):
    data = draft()
    assert client.post("/api/analyze", json=data).status_code == 200
    data["rubric"] = "Changed"
    assert client.post("/api/analyze", json=data).status_code == 409


def test_payload_bounds_and_csrf_origin(client):
    data = draft()
    data["duration_seconds"] = -1
    assert client.post("/api/analyze", json=data).status_code == 422
    assert client.post("/api/session", json={}, headers={"Origin": "https://attacker.test"}).status_code == 403


def test_temporary_tokens_are_constrained_and_rate_limited(client, monkeypatch):
    create = AsyncMock(return_value=SimpleNamespace(name="auth_tokens/test"))
    fake = SimpleNamespace(aio=SimpleNamespace(auth_tokens=SimpleNamespace(create=create)))
    monkeypatch.setattr("backend.routers.live.get_client", lambda: fake)
    response = client.post("/api/live-token")
    assert response.status_code == 200
    assert response.json()["token"] == "auth_tokens/test"
    config = create.call_args.kwargs["config"]
    assert config["uses"] == 1
    assert (config["new_session_expire_time"] - config["expire_time"]).total_seconds() == -29 * 60
    assert config["live_connect_constraints"]["config"]["response_modalities"] == ["AUDIO"]
    for _ in range(4):
        assert client.post("/api/live-token").status_code == 200
    assert client.post("/api/live-token").status_code == 429


def test_access_code_and_cookie_flags(client, monkeypatch):
    monkeypatch.setenv("DEMO_ACCESS_CODE", "a-long-private-code")
    with TestClient(app) as visitor:
        assert visitor.post("/api/session", json={}).status_code == 403
        response = visitor.post("/api/session", json={"access_code": "a-long-private-code"})
        assert response.status_code == 200
        assert "HttpOnly" in response.headers["set-cookie"]
        assert "SameSite=lax" in response.headers["set-cookie"]


def test_production_fails_closed_without_configuration(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DEMO_ACCESS_CODE", raising=False)
    with pytest.raises(RuntimeError, match="DEMO_ACCESS_CODE"):
        with TestClient(app):
            pass
