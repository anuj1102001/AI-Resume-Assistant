"""Start, read and resume agent runs.

Every step is checkpointed (SQLite in production), keyed by a thread id that includes the workspace, so a run paused
for review survives restarts and can only be read or resumed from the workspace that started it.
"""

import sqlite3
from pathlib import Path

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command

from app.agent.graph import build_graph
from app.agent.state import AgentContext
from app.config import Settings
from app.db import new_id
from app.errors import AppError


def build_chat_model(settings: Settings):
    """The tool-calling model for the investigation step, or None when AI is off (the step is then skipped)."""
    if settings.llm_provider != "gemini" or not settings.gemini_api_key:
        return None
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0,
        max_retries=settings.llm_max_retries,
        timeout=settings.llm_timeout_s,
    )


def sqlite_checkpointer(path: Path) -> SqliteSaver:
    path.parent.mkdir(parents=True, exist_ok=True)
    saver = SqliteSaver(sqlite3.connect(str(path), check_same_thread=False))
    saver.setup()
    return saver


def _config(ws_id: str, run_id: str) -> dict:
    return {"configurable": {"thread_id": f"{ws_id}:{run_id}"}}


def _totals(usage: list[dict]) -> dict:
    return {
        "llm_calls": len(usage),
        "input_tokens": sum(u["input_tokens"] for u in usage),
        "output_tokens": sum(u["output_tokens"] for u in usage),
        "model_latency_ms": sum(u["latency_ms"] for u in usage),
        "by_step": usage,
    }


def _view(graph, config: dict, run_id: str) -> dict:
    snap = graph.get_state(config)
    v = snap.values
    if not v:
        raise AppError("Agent run not found.", 404, "NOT_FOUND")
    waiting = "human_review" in (snap.next or ())
    return {
        "run_id": run_id,
        "status": "awaiting_review" if waiting else ("done" if not snap.next else "stopped"),
        "resume_id": v.get("resume_id"),
        "job_id": v.get("job_id"),
        "score": v.get("score"),
        "assessments": v.get("assessments", []),
        "grounding": v.get("grounding"),
        "findings": v.get("findings", []),
        "proposals": v.get("proposals", []),
        "applied": v.get("applied", []),
        "steps": v.get("steps", []),
        "usage": _totals(v.get("usage", [])),
    }


def start_run(
    ctx: AgentContext, checkpointer: BaseCheckpointSaver, resume_id: str, job_id: str | None, propose_rewrites: bool = True
) -> dict:
    graph = build_graph().compile(checkpointer=checkpointer)
    run_id = new_id()
    config = _config(ctx.ws_id, run_id)
    graph.invoke({"resume_id": resume_id, "job_id": job_id, "propose_rewrites": propose_rewrites}, config, context=ctx)
    return _view(graph, config, run_id)


def get_run(ws_id: str, checkpointer: BaseCheckpointSaver, run_id: str) -> dict:
    return _view(build_graph().compile(checkpointer=checkpointer), _config(ws_id, run_id), run_id)


def review_run(ctx: AgentContext, checkpointer: BaseCheckpointSaver, run_id: str, decisions: list[dict]) -> dict:
    graph = build_graph().compile(checkpointer=checkpointer)
    config = _config(ctx.ws_id, run_id)
    current = _view(graph, config, run_id)
    if current["status"] != "awaiting_review":
        raise AppError("This run isn't waiting for review.", 409, "NOT_AWAITING_REVIEW")

    proposals = {p["bullet_id"]: p for p in current["proposals"]}
    for d in decisions:
        p = proposals.get(d.get("bullet_id"))
        if not p:
            raise AppError(f"Bullet {d.get('bullet_id')} isn't one of this run's proposals.", 422, "INVALID_INPUT")
        idx = d.get("variant")
        if idx is not None:
            if not 0 <= idx < len(p["variants"]):
                raise AppError("That variant doesn't exist.", 422, "INVALID_INPUT")
            if not p["variants"][idx]["safe"] and not d.get("text"):
                raise AppError(
                    "That variant adds numbers or skills your resume doesn't show, so it can't be applied as is. Edit it first.",
                    422,
                    "UNSAFE_VARIANT",
                )

    graph.invoke(Command(resume={"decisions": decisions}), config, context=ctx)
    return _view(graph, config, run_id)
