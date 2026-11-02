"""Agent endpoints: start a match run, read it, and approve or reject the rewrites it proposes."""

from fastapi import APIRouter, Depends
from langgraph.checkpoint.base import BaseCheckpointSaver
from pydantic import BaseModel, Field

from app.agent import service
from app.agent.state import AgentContext
from app.config import Settings
from app.db import Database
from app.deps import get_chat_model, get_checkpointer, get_db, get_embedder, get_llm, get_settings_dep
from app.llm.client import LLM
from app.retrieval.embeddings import Embedder
from app.security import charge_llm_call, current_workspace
from app.services import jobs, resumes

router = APIRouter(prefix="/api/agent")


class RunBody(BaseModel):
    resume_id: str
    job_id: str
    propose_rewrites: bool = True


class Decision(BaseModel):
    bullet_id: str = Field(max_length=20)
    variant: int | None = Field(default=None, description="Index of the variant to apply; null rejects the proposal.")
    text: str | None = Field(default=None, max_length=600, description="An edited version to apply instead.")


class ReviewBody(BaseModel):
    decisions: list[Decision] = Field(max_length=20)


def _context(ws: str, db: Database, settings: Settings, llm: LLM, embedder: Embedder, chat_model) -> AgentContext:
    return AgentContext(db=db, settings=settings, llm=llm, embedder=embedder, ws_id=ws, chat_model=chat_model)


@router.post("/runs", status_code=201)
def start_run(
    body: RunBody,
    ws: str = Depends(current_workspace),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    llm: LLM = Depends(get_llm),
    embedder: Embedder = Depends(get_embedder),
    chat_model=Depends(get_chat_model),
    checkpointer: BaseCheckpointSaver = Depends(get_checkpointer),
):
    resumes.get_resume(db, ws, body.resume_id)
    jobs.get_job(db, ws, body.job_id)
    if not llm.configured:
        llm.generate()  # raises a clear AI_NOT_CONFIGURED error
    charge_llm_call(ws, db, settings)
    ctx = _context(ws, db, settings, llm, embedder, chat_model)
    return service.start_run(ctx, checkpointer, body.resume_id, body.job_id, body.propose_rewrites)


@router.get("/runs/{run_id}")
def get_run(run_id: str, ws: str = Depends(current_workspace), checkpointer: BaseCheckpointSaver = Depends(get_checkpointer)):
    return service.get_run(ws, checkpointer, run_id)


@router.post("/runs/{run_id}/review")
def review_run(
    run_id: str,
    body: ReviewBody,
    ws: str = Depends(current_workspace),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    llm: LLM = Depends(get_llm),
    embedder: Embedder = Depends(get_embedder),
    chat_model=Depends(get_chat_model),
    checkpointer: BaseCheckpointSaver = Depends(get_checkpointer),
):
    ctx = _context(ws, db, settings, llm, embedder, chat_model)
    return service.review_run(ctx, checkpointer, run_id, [d.model_dump() for d in body.decisions])
