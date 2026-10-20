"""Resume x job matching, requirement by requirement.

1. Extract the job's requirements (once per job).
2. For each requirement, retrieve the 3 most relevant resume passages (hybrid search), and union them.
3. One model call judges every requirement as met / partial / missing, citing resume evidence.
4. Verify every evidence quote against the resume, and compute the score in code (never by the model):

   coverage = sum(weight x credit) / sum(weight), with weight 2 for must-haves and 1 for nice-to-haves, and credit 1 for
   met, 0.5 for partial, 0 for missing. A "met" whose evidence can't be found in the resume is downgraded to partial.

It is a coverage measure of what the resume shows, not a prediction of hiring or of any ATS ranking.
"""

from app.config import Settings
from app.db import Database, loads
from app.errors import AppError
from app.llm import prompts
from app.llm.client import LLM
from app.llm.schemas import MatchOut
from app.resume.keywords import keyword_overlap
from app.retrieval.embeddings import Embedder
from app.retrieval.search import search
from app.services import grounded, jobs, resumes

CREDIT = {"met": 1.0, "partial": 0.5, "missing": 0.0}
WEIGHT = {"must": 2.0, "nice": 1.0}


def score(assessments: list[dict], reqs: dict[str, dict]) -> dict:
    total = got = 0.0
    counts = {"met": 0, "partial": 0, "missing": 0}
    must = {"met": 0, "total": 0}
    for a in assessments:
        r = reqs.get(a["requirement"])
        if not r:
            continue
        w = WEIGHT[r["kind"]]
        total += w
        got += w * CREDIT[a["status"]]
        counts[a["status"]] += 1
        if r["kind"] == "must":
            must["total"] += 1
            must["met"] += a["status"] == "met"
    return {"coverage": round(got / total, 3) if total else None, **counts, "must_met": must["met"], "must_total": must["total"]}


def match(db: Database, settings: Settings, llm: LLM, embedder: Embedder, ws_id: str, rid: str, jid: str, refresh: bool = False) -> dict:
    resume = resumes.get_resume(db, ws_id, rid)
    job = jobs.get_job(db, ws_id, jid)
    key = grounded.cache_key("match", [rid, jid], llm.model)
    if not refresh and (hit := grounded.cached(db, ws_id, key)):
        return hit

    reqs, req_usage = jobs.requirements(db, llm, ws_id, jid)
    if not reqs["requirements"]:
        raise AppError("No requirements were found in this job description, so there's nothing to match against.", 422, "NO_REQUIREMENTS")
    by_id = {r["id"]: r for r in reqs["requirements"]}

    pool = resumes.candidates(db, rid, embedder.dim)
    chosen: dict[str, object] = {}
    for r in reqs["requirements"]:
        for h in search(pool, r["text"], embedder, k=3):
            chosen.setdefault(h.candidate.id, h.candidate)
    ordered = sorted(chosen.values(), key=lambda c: next(i for i, p in enumerate(pool) if p.id == c.id))
    labeled = grounded.Labeled()
    passages = labeled.add("P", ordered)
    out, usage = llm.generate(
        system=prompts.SYSTEM,
        prompt=prompts.match_prompt([(r["id"], r["kind"], r["text"]) for r in reqs["requirements"]], passages),
        schema=MatchOut,
        max_output_tokens=8000,
    )
    data, stats = grounded.ground(out.model_dump(), labeled, lambda _id: resumes.pages_text(db, rid))

    # Keep one assessment per known requirement, in requirement order; anything the model skipped counts as missing.
    seen = {}
    for a in data["assessments"]:
        if a["requirement"] in by_id and a["requirement"] not in seen:
            if a["status"] == "met" and a.get("support") == "unverified":
                a["status"] = "partial"
                a["downgraded"] = True
            seen[a["requirement"]] = a
    assessments = []
    for rid_, r in by_id.items():
        a = seen.get(rid_) or {
            "requirement": rid_,
            "status": "missing",
            "explanation": "Not assessed by the model; treated as missing.",
            "evidence": [],
            "suggestion": None,
        }
        assessments.append({**a, "text": r["text"], "kind": r["kind"], "category": r["category"], "job_citations": r.get("citations", [])})

    parsed = loads(resume["parsed"], {})
    result = {
        "score": score(assessments, by_id),
        "assessments": assessments,
        "summary": data["summary"],
        "keywords": keyword_overlap(resume["text"], job["text"], parsed.get("experience_months")),
        "grounding": stats,
        "passages_used": len(ordered),
    }
    usages = [usage] + ([req_usage] if req_usage else [])
    return grounded.save(db, ws_id, "match", key, rid, jid, None, result, grounded.sum_usage(usages, llm.model))


def matches_for(db: Database, ws_id: str) -> list[dict]:
    """Latest match per (resume, job), for the dashboard."""
    rows = db.all(
        """SELECT a.* FROM analyses a
           JOIN (SELECT resume_id, job_id, MAX(created_at) AS m FROM analyses WHERE workspace_id = ? AND kind = 'match' GROUP BY resume_id, job_id) l
             ON a.resume_id = l.resume_id AND a.job_id = l.job_id AND a.created_at = l.m
           WHERE a.workspace_id = ? AND a.kind = 'match' ORDER BY a.created_at DESC""",
        (ws_id, ws_id),
    )
    return [
        {"resume_id": r["resume_id"], "job_id": r["job_id"], "score": loads(r["result"])["score"], "created_at": r["created_at"]}
        for r in rows
    ]
