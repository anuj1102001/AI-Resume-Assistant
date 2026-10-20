from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.config import Settings
from app.db import Database, loads
from app.deps import get_db, get_embedder, get_llm, get_settings_dep
from app.errors import AppError
from app.llm.client import LLM
from app.resume.keywords import keyword_overlap
from app.retrieval.embeddings import Embedder
from app.security import charge_llm_call, create_workspace, current_workspace
from app.services import grounded, jobs, matching, qa, resumes, rewrite

router = APIRouter(prefix="/api")


def _ai(ws: str, db: Database, settings: Settings, llm: LLM, key: str | None = None, refresh: bool = False) -> dict | None:
    """Return a cached analysis if there is one; otherwise make sure AI is on and count the call against the limit."""
    if key and not refresh and (hit := grounded.cached(db, ws, key)):
        return hit
    if not llm.configured:
        llm.generate()  # raises a clear AI_NOT_CONFIGURED error
    charge_llm_call(ws, db, settings)
    return None


@router.get("/health")
def health(settings: Settings = Depends(get_settings_dep), llm: LLM = Depends(get_llm)):
    return {
        "status": "ok",
        "ai_configured": llm.configured,
        "model": llm.model if llm.configured else None,
        "embedding_model": settings.embedding_model,
    }


@router.post("/workspaces", status_code=201)
def new_workspace(db: Database = Depends(get_db)):
    ws_id, token = create_workspace(db)
    return {"workspace_id": ws_id, "token": token}


@router.get("/overview")
def overview(ws: str = Depends(current_workspace), db: Database = Depends(get_db)):
    return {"resumes": resumes.list_resumes(db, ws), "jobs": jobs.list_jobs(db, ws), "matches": matching.matches_for(db, ws)}


# ---- resumes --------------------------------------------------------------------------------------------------------


@router.post("/resumes", status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    label: str | None = Form(default=None),
    ws: str = Depends(current_workspace),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    embedder: Embedder = Depends(get_embedder),
):
    data = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    resume, created = resumes.create_resume(db, settings, embedder, ws, file.filename or "resume", data, label)
    return {"resume": resume, "duplicate": not created}


@router.get("/resumes/{rid}")
def get_resume(rid: str, ws: str = Depends(current_workspace), db: Database = Depends(get_db)):
    return {"resume": resumes.public_resume(resumes.get_resume(db, ws, rid), full=True)}


class RenameBody(BaseModel):
    label: str = Field(min_length=1, max_length=80)


@router.post("/resumes/{rid}/rename")
def rename_resume(rid: str, body: RenameBody, ws: str = Depends(current_workspace), db: Database = Depends(get_db)):
    return {"resume": resumes.rename_resume(db, ws, rid, body.label)}


@router.delete("/resumes/{rid}", status_code=204)
def delete_resume(
    rid: str, ws: str = Depends(current_workspace), db: Database = Depends(get_db), settings: Settings = Depends(get_settings_dep)
):
    resumes.delete_resume(db, settings, ws, rid)
    return Response(status_code=204)


@router.get("/resumes/{rid}/pages/{page_no}")
def page_text(rid: str, page_no: int, ws: str = Depends(current_workspace), db: Database = Depends(get_db)):
    resumes.get_resume(db, ws, rid)
    text = resumes.pages_text(db, rid).get(page_no)
    if text is None:
        raise AppError("Page not found.", 404, "NOT_FOUND")
    return {"page": page_no, "text": text}


@router.get("/resumes/{rid}/pages/{page_no}/image")
def page_image(
    rid: str,
    page_no: int,
    ws: str = Depends(current_workspace),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
):
    return Response(
        resumes.render_page(settings, resumes.get_resume(db, ws, rid), page_no),
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/resumes/{rid}/pages/{page_no}/locate")
def locate(
    rid: str,
    page_no: int,
    q: str = Query(..., max_length=600),
    ws: str = Depends(current_workspace),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
):
    return {"rects": resumes.locate_quote(settings, resumes.get_resume(db, ws, rid), page_no, q)}


class Refresh(BaseModel):
    refresh: bool = False


@router.post("/resumes/{rid}/profile")
def profile(
    rid: str,
    body: Refresh = Refresh(),
    ws: str = Depends(current_workspace),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    llm: LLM = Depends(get_llm),
):
    resumes.get_resume(db, ws, rid)
    if hit := _ai(ws, db, settings, llm, grounded.cache_key("profile", [rid], llm.model), body.refresh):
        return hit
    return resumes.profile(db, llm, ws, rid, refresh=True)


class AskBody(BaseModel):
    question: str = Field(min_length=2, max_length=800)
    history: list[tuple[str, str]] = Field(default_factory=list, max_length=12)


@router.post("/resumes/{rid}/ask")
def ask(
    rid: str,
    body: AskBody,
    ws: str = Depends(current_workspace),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    llm: LLM = Depends(get_llm),
    embedder: Embedder = Depends(get_embedder),
):
    resumes.get_resume(db, ws, rid)
    _ai(ws, db, settings, llm)
    return qa.ask(db, settings, llm, embedder, ws, rid, body.question.strip(), body.history)


@router.get("/resumes/{rid}/questions")
def questions(rid: str, ws: str = Depends(current_workspace), db: Database = Depends(get_db)):
    resumes.get_resume(db, ws, rid)
    return {"analyses": qa.history(db, ws, rid)}


class RewriteBody(BaseModel):
    bullet_id: str = Field(max_length=20)
    job_id: str | None = None
    refresh: bool = False


@router.post("/resumes/{rid}/rewrite")
def rewrite_bullet(
    rid: str,
    body: RewriteBody,
    ws: str = Depends(current_workspace),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    llm: LLM = Depends(get_llm),
):
    resumes.get_resume(db, ws, rid)
    if body.job_id:
        jobs.get_job(db, ws, body.job_id)
    if hit := _ai(ws, db, settings, llm, grounded.cache_key("rewrite", [rid, body.bullet_id, body.job_id or ""], llm.model), body.refresh):
        return hit
    return rewrite.rewrite(db, llm, ws, rid, body.bullet_id, body.job_id, refresh=True)


class TailorBody(BaseModel):
    bullet_id: str = Field(max_length=20)
    job_id: str | None = None
    revised: str = Field(max_length=600)


@router.post("/resumes/{rid}/tailored")
def save_tailored(rid: str, body: TailorBody, ws: str = Depends(current_workspace), db: Database = Depends(get_db)):
    return rewrite.save_tailored(db, ws, rid, body.job_id, body.bullet_id, body.revised)


@router.get("/resumes/{rid}/tailored")
def tailored(rid: str, job_id: str | None = None, ws: str = Depends(current_workspace), db: Database = Depends(get_db)):
    return rewrite.tailored_version(db, ws, rid, job_id)


@router.get("/resumes/{rid}/export")
def export(rid: str, job_id: str | None = None, ws: str = Depends(current_workspace), db: Database = Depends(get_db)):
    data, name = rewrite.export_docx(db, ws, rid, job_id)
    return Response(
        data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


# ---- jobs -----------------------------------------------------------------------------------------------------------


class JobBody(BaseModel):
    text: str = Field(max_length=25_000)
    title: str | None = Field(default=None, max_length=120)
    company: str | None = Field(default=None, max_length=120)


@router.post("/jobs", status_code=201)
def create_job(
    body: JobBody, ws: str = Depends(current_workspace), db: Database = Depends(get_db), settings: Settings = Depends(get_settings_dep)
):
    return {"job": jobs.create_job(db, settings, ws, body.text, body.title, body.company)}


@router.get("/jobs/{jid}")
def get_job(jid: str, ws: str = Depends(current_workspace), db: Database = Depends(get_db)):
    return {"job": jobs.public_job(jobs.get_job(db, ws, jid), full=True)}


@router.delete("/jobs/{jid}", status_code=204)
def delete_job(jid: str, ws: str = Depends(current_workspace), db: Database = Depends(get_db)):
    jobs.delete_job(db, ws, jid)
    return Response(status_code=204)


@router.post("/jobs/{jid}/requirements")
def requirements(
    jid: str,
    body: Refresh = Refresh(),
    ws: str = Depends(current_workspace),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    llm: LLM = Depends(get_llm),
):
    row = jobs.get_job(db, ws, jid)
    if row["requirements"] and not body.refresh:
        return {"requirements": loads(row["requirements"]), "cached": True}
    _ai(ws, db, settings, llm)
    data, _ = jobs.requirements(db, llm, ws, jid, refresh=True)
    return {"requirements": data, "cached": False}


# ---- matching -------------------------------------------------------------------------------------------------------


class MatchBody(BaseModel):
    resume_id: str
    job_id: str
    refresh: bool = False


@router.post("/match")
def match(
    body: MatchBody,
    ws: str = Depends(current_workspace),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    llm: LLM = Depends(get_llm),
    embedder: Embedder = Depends(get_embedder),
):
    resumes.get_resume(db, ws, body.resume_id)
    jobs.get_job(db, ws, body.job_id)
    if hit := _ai(ws, db, settings, llm, grounded.cache_key("match", [body.resume_id, body.job_id], llm.model), body.refresh):
        return hit
    return matching.match(db, settings, llm, embedder, ws, body.resume_id, body.job_id, refresh=True)


@router.get("/keywords")
def keywords(resume_id: str, job_id: str, ws: str = Depends(current_workspace), db: Database = Depends(get_db)):
    """Instant, no-AI keyword overlap (works even when AI is switched off)."""
    r = resumes.get_resume(db, ws, resume_id)
    j = jobs.get_job(db, ws, job_id)
    if not r or not j:
        raise AppError("Not found.", 404, "NOT_FOUND")
    return keyword_overlap(r["text"], j["text"], loads(r["parsed"], {}).get("experience_months"))
