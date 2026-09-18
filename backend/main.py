import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).parent / ".env")

from backend.auth import router as auth_router, require_session
from backend.gemini import GeminiInvocationError
from backend.routers import analyze, deepdive, history, live, plan

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    if os.getenv("APP_ENV") == "production":
        if len(os.getenv("DEMO_ACCESS_CODE", "")) < 16:
            raise RuntimeError("Production requires a DEMO_ACCESS_CODE of at least 16 characters.")
        key = os.getenv("GEMINI_API_KEY", "").strip()
        if not key or key.startswith("your_"):
            raise RuntimeError("Production requires GEMINI_API_KEY.")
    yield


app = FastAPI(lifespan=lifespan)
origins = [v.strip() for v in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if v.strip()]
if "*" in origins:
    raise RuntimeError("CORS_ORIGINS must list explicit origins.")
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"],
)


@app.middleware("http")
async def protect_requests(request: Request, call_next):
    # Browser writes must come from the configured frontend; same-origin /api rewrites preserve Origin.
    if request.method in {"POST", "PUT", "DELETE"}:
        origin = request.headers.get("origin")
        if origin and origin not in origins:
            return JSONResponse(status_code=403, content={"detail": "Origin is not allowed."})
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(GeminiInvocationError)
async def gemini_error(request: Request, exc: GeminiInvocationError):
    # Do not return raw upstream exceptions (which may contain URLs or credentials).
    logger.warning("Gemini operation failed: %s", type(exc.__cause__).__name__)
    return JSONResponse(status_code=502, content={"detail": exc.message})


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    logger.error("Unhandled application error: %s", type(exc).__name__)
    return JSONResponse(status_code=500, content={"detail": "The request could not be completed. Please retry."})


app.include_router(auth_router, prefix="/api")
for router in (plan.router, deepdive.router):
    app.include_router(router, prefix="/api", dependencies=[Depends(require_session)])
for router in (analyze.router, history.router, live.router):
    app.include_router(router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
