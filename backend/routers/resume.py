from fastapi import APIRouter, Depends, File, UploadFile

from backend.auth import require_session
from backend.schemas import ResumeParseOutput
from backend.services.resume import extract_resume_text
from backend import storage

router = APIRouter(tags=["resume"])


@router.post("/resume", response_model=ResumeParseOutput)
async def parse_resume(
    file: UploadFile = File(...),
    owner: str = Depends(require_session),
) -> ResumeParseOutput:
    storage.rate_limit("resume:" + owner, 10)
    data = await file.read()
    await file.close()
    filename = (file.filename or "resume").replace("\\", "/").split("/")[-1][:200] or "resume"
    text = extract_resume_text(
        filename=filename,
        content_type=file.content_type or "",
        data=data,
    )
    return ResumeParseOutput(text=text, filename=filename, char_count=len(text))
