"""Ask questions about a resume: hybrid retrieval over its sections, grounded answers with section citations."""

from app.config import Settings
from app.db import Database, new_id
from app.llm import prompts
from app.llm.client import LLM, Usage
from app.llm.schemas import AnswerOut
from app.retrieval.embeddings import Embedder
from app.retrieval.search import search
from app.services import grounded, resumes


def ask(
    db: Database, settings: Settings, llm: LLM, embedder: Embedder, ws_id: str, rid: str, question: str, history: list[tuple[str, str]]
) -> dict:
    resumes.get_resume(db, ws_id, rid)
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
    if not hits:
        result = {"status": "not_found", "answer": [], "follow_ups": [], "retrieval": [], "grounding": {"claims": 0, "grounded_rate": None}}
        return grounded.save(db, ws_id, "qa", new_id(), rid, None, {"question": question}, result, Usage(llm.model))
    out, usage = llm.generate(system=prompts.SYSTEM, prompt=prompts.answer_prompt(question, passages, history), schema=AnswerOut)
    data, stats = grounded.ground(out.model_dump(), labeled, lambda _id: resumes.pages_text(db, rid))
    data |= {"grounding": stats, "retrieval": retrieval}
    return grounded.save(db, ws_id, "qa", new_id(), rid, None, {"question": question}, data, usage)


def history(db: Database, ws_id: str, rid: str) -> list[dict]:
    rows = db.all("SELECT * FROM analyses WHERE workspace_id = ? AND resume_id = ? AND kind = 'qa' ORDER BY created_at", (ws_id, rid))
    return [grounded.public(r) for r in rows]
