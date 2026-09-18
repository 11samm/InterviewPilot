import hmac
import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from backend import storage

router = APIRouter()
COOKIE_NAME = "interviewpilot_session"


def require_session(request: Request) -> str:
    owner = storage.session_owner(request.cookies.get(COOKIE_NAME))
    if not owner:
        raise HTTPException(401, "Your session expired. Reload the page to continue.")
    storage.rate_limit("api:" + owner, 60)
    return owner


class AccessInput(BaseModel):
    access_code: str = Field(default="", max_length=200)


@router.get("/session")
def session_status(request: Request):
    return {"authenticated": bool(storage.session_owner(request.cookies.get(COOKIE_NAME))),
            "access_code_required": bool(os.getenv("DEMO_ACCESS_CODE"))}


@router.post("/session")
def open_session(body: AccessInput, request: Request, response: Response):
    # Ignore forwarded IP headers: only a trusted proxy may configure that upstream.
    ip = request.client.host if request.client else "unknown"
    storage.rate_limit("login:" + ip, 10)
    code = os.getenv("DEMO_ACCESS_CODE", "")
    if code and not hmac.compare_digest(body.access_code.encode(), code.encode()):
        raise HTTPException(403, "Incorrect access code.")
    if not storage.session_owner(request.cookies.get(COOKIE_NAME)):
        response.set_cookie(
            COOKIE_NAME, storage.new_session(), httponly=True,
            secure=os.getenv("APP_ENV") == "production", samesite="lax",
            max_age=30 * 86400, path="/api",
        )
    return {"authenticated": True}
