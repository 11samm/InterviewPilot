import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Response
from backend.auth import require_session
from backend.gemini import GeminiInvocationError, get_client
from backend import storage

router = APIRouter(tags=["live"])


@router.post("/live-token")
async def live_token(response: Response, owner: str = Depends(require_session)):
    storage.rate_limit("live:" + owner, 5)
    model = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.8-live")
    now = datetime.now(timezone.utc)
    try:
        token = await get_client().aio.auth_tokens.create(config={
            "uses": 1,
            "expire_time": now + timedelta(minutes=30),
            "new_session_expire_time": now + timedelta(minutes=1),
            "live_connect_constraints": {"model": model, "config": {"response_modalities": ["AUDIO"]}},
        })
        if not token.name:
            raise ValueError("Empty token")
    except Exception as exc:
        raise GeminiInvocationError("Could not authorize the live interview. Check server configuration and retry.") from exc
    response.headers["Cache-Control"] = "no-store"
    return {"token": token.name, "model": model}
