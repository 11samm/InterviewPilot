"""Shared Gemini client and JSON generation helpers."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import TypeVar

from dotenv import load_dotenv
from google.genai import Client, types
from pydantic import BaseModel, ValidationError

_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(_BACKEND_DIR / ".env")

MODEL_ID = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

_client: Client | None = None

T = TypeVar("T", bound=BaseModel)


class GeminiInvocationError(Exception):
    """Raised when configuration or the Gemini API call fails."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def _require_api_key() -> str:
    key = (os.environ.get("GEMINI_API_KEY") or "").strip()
    if not key or key.startswith("your_"):
        raise GeminiInvocationError(
            "GEMINI_API_KEY is missing or still set to the placeholder. "
            "Set a valid key in backend/.env."
        )
    return key


def get_client() -> Client:
    global _client
    key = _require_api_key()
    if _client is None:
        _client = Client(api_key=key, http_options=types.HttpOptions(api_version="v1beta", timeout=90000))
    return _client


def _schema_prompt_fragment(model_cls: type[BaseModel]) -> str:
    return (
        "Respond with JSON only that matches this JSON Schema exactly "
        "(field names and types must match; no markdown or extra keys):\n"
        f"{json.dumps(model_cls.model_json_schema(), indent=2)}"
    )


async def generate_structured(
    *,
    system_instruction: str,
    user_prompt: str,
    output_model: type[T],
) -> T:
    client = get_client()
    schema = output_model.model_json_schema()
    full_user = f"{user_prompt.strip()}\n\n{_schema_prompt_fragment(output_model)}"
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_json_schema=schema,
        system_instruction=system_instruction,
    )
    try:
        response = await client.aio.models.generate_content(
            model=MODEL_ID,
            contents=full_user,
            config=config,
        )
    except Exception as e:
        raise GeminiInvocationError(
            "The AI service is unavailable. Please retry shortly."
        ) from e

    text = (response.text or "").strip()
    if not text:
        raise GeminiInvocationError("Gemini returned an empty response.")

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as e:
        raise GeminiInvocationError(
            "The AI service returned invalid JSON. Please retry."
        ) from e

    try:
        return output_model.model_validate(payload)
    except ValidationError as e:
        raise GeminiInvocationError(
            "The AI response did not match the expected format. Please retry."
        ) from e
