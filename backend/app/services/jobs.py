"""Job descriptions: pasted text, split into passages, and the requirements the model extracts from them."""

import re

from app.config import Settings
from app.db import Database, dumps, loads, new_id, now
from app.errors import AppError
from app.llm import prompts
from app.llm.client import LLM, Usage
from app.llm.schemas import RequirementsOut
from app.retrieval.search import Candidate
from app.services import grounded

PASSAGE_CHARS = 500


def job_passages(job_id: str, text: str) -> list[Candidate]:
    """Split a job description into short passages (paragraphs and bullet groups) for citation."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    out, buf = [], ""
    for para in paras:
        for line in para.split("\n"):
            if len(buf) + len(line) > PASSAGE_CHARS and buf:
                out.append(buf)
                buf = ""
            buf = f"{buf}\n{line}".strip()
        if len(buf) > PASSAGE_CHARS * 0.4:
            out.append(buf)
            buf = ""
    if buf:
        out.append(buf)
    return [Candidate(f"{job_id}-{i}", job_id, t, 1, 1, None, None) for i, t in enumerate(out)]


def _guess_title(text: str) -> str:
    for line in text.split("\n")[:6]:
        s = line.strip(" #*-:")
        if 3 <= len(s) <= 90 and not s.endswith("."):
            return s
    return "Untitled role"


def create_job(db: Database, settings: Settings, ws_id: str, text: str, title: str | None, company: str | None) -> dict:
    text = text.strip()
    if len(text) < 150:
        raise AppError("Paste the full job description (at least a few lines) so requirements can be found.", 422, "TOO_SHORT")
    if len(text) > settings.max_job_chars:
        raise AppError(f"Job descriptions can be up to {settings.max_job_chars:,} characters.", 413, "TOO_LONG")
    jid = new_id()
    row = {
        "id": jid,
        "workspace_id": ws_id,
        "title": (title or "").strip()[:120] or _guess_title(text),
        "company": (company or "").strip()[:120] or None,
        "text": text,
        "requirements": None,
        "created_at": now(),
    }
    with db.tx() as c:
        c.execute(f"INSERT INTO jobs ({', '.join(row)}) VALUES ({', '.join('?' * len(row))})", tuple(row.values()))
    return public_job(row)


def public_job(row: dict, full: bool = False) -> dict:
    out = {
        "id": row["id"],
        "title": row["title"],
        "company": row["company"],
        "created_at": row["created_at"],
        "has_requirements": bool(row["requirements"]),
    }
    if full:
        out |= {"text": row["text"], "requirements": loads(row["requirements"])}
    return out


def get_job(db: Database, ws_id: str, jid: str) -> dict:
    row = db.one("SELECT * FROM jobs WHERE id = ? AND workspace_id = ?", (jid, ws_id))
    if not row:
        raise AppError("Job not found.", 404, "NOT_FOUND")
    return row


def list_jobs(db: Database, ws_id: str) -> list[dict]:
    return [public_job(r) for r in db.all("SELECT * FROM jobs WHERE workspace_id = ? ORDER BY created_at DESC", (ws_id,))]


def delete_job(db: Database, ws_id: str, jid: str) -> None:
    get_job(db, ws_id, jid)
    with db.tx() as c:
        c.execute("DELETE FROM jobs WHERE id = ?", (jid,))
        c.execute("DELETE FROM analyses WHERE job_id = ?", (jid,))


def requirements(db: Database, llm: LLM, ws_id: str, jid: str, refresh: bool = False) -> tuple[dict, Usage | None]:
    """Returns (requirements, usage). Requirements are stored on the job, so they're extracted once."""
    row = get_job(db, ws_id, jid)
    if row["requirements"] and not refresh:
        return loads(row["requirements"]), None
    labeled = grounded.Labeled()
    passages = labeled.add("J", job_passages(jid, row["text"]), page_label="")
    out, usage = llm.generate(
        system=prompts.SYSTEM, prompt=prompts.requirements_prompt(passages), schema=RequirementsOut, max_output_tokens=4000
    )
    data, stats = grounded.ground(out.model_dump(), labeled)
    for i, req in enumerate(data["requirements"], start=1):
        req["id"] = f"R{i}"
    data["grounding"] = stats
    with db.tx() as c:
        # Keep the title the user typed; only fill in the company if they left it blank.
        c.execute("UPDATE jobs SET requirements = ?, company = COALESCE(company, ?) WHERE id = ?", (dumps(data), data.get("company"), jid))
    return data, usage
