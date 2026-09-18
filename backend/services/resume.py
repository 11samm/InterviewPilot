"""Deterministic resume text extraction. No LLM, no disk writes."""
from io import BytesIO

from fastapi import HTTPException
from pypdf import PdfReader

from backend.services.textnorm import normalized

MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_PAGES = 8
MAX_CHARS = 30000
MIN_CHARS = 80


def extract_resume_text(*, filename: str, content_type: str, data: bytes) -> str:
    del content_type  # Classification uses filename + magic bytes, not client Content-Type.
    if len(data) == 0 or len(data) > MAX_FILE_BYTES:
        raise HTTPException(422, "Resume files must be a PDF or .txt file under 2 MB.")

    lower = filename.lower()
    is_pdf = data.startswith(b"%PDF") and lower.endswith(".pdf")
    is_txt = lower.endswith(".txt") and b"\x00" not in data

    if is_pdf:
        text = _extract_pdf(data)
    elif is_txt:
        text = _extract_txt(data)
    else:
        raise HTTPException(422, "Upload a PDF or a .txt file, or paste the resume text.")

    text = text.replace("\x00", "").strip()
    if len(normalized(text)) < MIN_CHARS:
        raise HTTPException(
            422,
            "Could not find enough readable text. If this is a scanned PDF, paste the resume text instead.",
        )
    if len(text) > MAX_CHARS:
        cut = text[:MAX_CHARS]
        boundary = cut.rfind(" ")
        text = cut[:boundary] if boundary > 0 else cut
    return text


def _extract_pdf(data: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise HTTPException(
                422,
                "This PDF is encrypted. Export it as a normal PDF or paste the text.",
            )
        if len(reader.pages) > MAX_PAGES:
            raise HTTPException(422, "Resume PDFs can have at most 8 pages.")
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            422,
            "Could not read that PDF. Try a text .txt export or paste the resume.",
        ) from exc


def _extract_txt(data: bytes) -> str:
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("latin-1")
