from uuid import UUID
from fastapi import APIRouter, Depends
from backend.auth import require_session
from backend import storage
from backend.schemas import AnalyzeInput

router = APIRouter(tags=["history"])


@router.get("/interviews")
def history(owner: str = Depends(require_session)):
    return storage.list_interviews(owner)


@router.get("/interviews/{interview_id}")
def detail(interview_id: UUID, owner: str = Depends(require_session)):
    return storage.get_interview(owner, str(interview_id))


@router.put("/interviews/{interview_id}")
def draft(interview_id: UUID, body: AnalyzeInput, owner: str = Depends(require_session)):
    from fastapi import HTTPException
    if interview_id != body.interview_id:
        raise HTTPException(422, "Interview ID does not match the draft.")
    storage.save_draft(owner, body)
    return {"saved": True}


@router.delete("/interviews/{interview_id}", status_code=204)
def delete(interview_id: UUID, owner: str = Depends(require_session)):
    storage.delete_interview(owner, str(interview_id))
