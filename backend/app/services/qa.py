"""Ask questions about a resume, optionally alongside a job ad: hybrid retrieval over the resume's sections, the job ad's
passages (all of it when it's short), and grounded answers whose citations say which document they come from."""

from app.config import Settings
from app.db import Database, new_id
from app.llm import prompts
from app.llm.client import LLM, Usage
from app.llm.schemas import AnswerOut
from app.retrieval.embeddings import Embedder
from app.retrieval.search import search
from app.services import grounded, jobs, resumes

WHOLE_JOB_CHARS = 6000  # job ads up to this length go to the model whole; longer ones are searched


def ask(
    db: Database,
    settings: Settings,
    llm: LLM,
    embedder: Embedder,
    ws_id: str,
    rid: str,
    question: str,
    history: list[tuple[str, str]],
    jid: str | None = None,
) -> dict:
    resumes.get_resume(db, ws_id, rid)
    job = jobs.get_job(db, ws_id, jid) if jid else None
    hits = search(resumes.candidates(db, rid, embedder.dim), question, embedder, k=settings.retrieval_k)
    labeled = grounded.Labeled()
    passages = labeled.add("P", [h.candidate for h in hits])
    retrieval = [
        {
            "label": p[0],
            "section": h.candidate.heading,
            "page": h.candidate.page_start,
            "dense_rank": h.dense_rank,
            "sparse_rank": h.sparse_rank,
        }
        for p, h in zip(passages, hits, strict=True)
    ]
    job_passages = None
    if job:
        pool = jobs.job_passages(job["id"], job["text"])
        if len(job["text"]) > WHOLE_JOB_CHARS:
            keep = {h.candidate.id for h in search(pool, question, embedder, k=settings.retrieval_k)} | {pool[0].id}
            pool = [c for c in pool if c.id in keep]
        job_passages = labeled.add("J", pool, page_label="")
        retrieval += [{"label": label, "section": "Job description", "page": None, "dense_rank": None, "sparse_rank": None} for label, _, _ in job_passages]
    if not hits and not job_passages:
        result = {"status": "not_found", "answer": [], "follow_ups": [], "retrieval": [], "grounding": {"claims": 0, "grounded_rate": None}}
        return grounded.save(db, ws_id, "qa", new_id(), rid, jid, {"question": question}, result, Usage(llm.model))
    out, usage = llm.generate(system=prompts.SYSTEM, prompt=prompts.answer_prompt(question, passages, history, job_passages), schema=AnswerOut)
    # Page numbers only exist for the resume; job-ad quotes are checked against the job passages alone.
    data, stats = grounded.ground(out.model_dump(), labeled, lambda doc_id: resumes.pages_text(db, rid) if doc_id == rid else None)
    data |= {"grounding": stats, "retrieval": retrieval}
    return grounded.save(db, ws_id, "qa", new_id(), rid, jid, {"question": question}, data, usage)


def history(db: Database, ws_id: str, rid: str, jid: str | None = None) -> list[dict]:
    rows = db.all(
        "SELECT * FROM analyses WHERE workspace_id = ? AND resume_id = ? AND kind = 'qa' AND COALESCE(job_id, '') = ? ORDER BY created_at",
        (ws_id, rid, jid or ""),
    )
    return [grounded.public(r) for r in rows]
