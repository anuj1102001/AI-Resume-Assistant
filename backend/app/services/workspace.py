"""The workspace as a whole: saved recommendations, and the user's right to export or delete everything."""

from app.config import Settings
from app.db import Database, dumps, loads, new_id, now
from app.errors import AppError
from app.services import jobs, resumes

SAVED_KINDS = ("suggestion", "gap", "claim", "answer")
_EXT = {"pdf": ".pdf", "docx": ".docx", "text": ".txt"}


def _public_saved(row: dict) -> dict:
    return {
        "id": row["id"],
        "resume_id": row["resume_id"],
        "job_id": row["job_id"],
        "kind": row["kind"],
        "text": row["text"],
        "detail": loads(row["detail"], {}),
        "href": row["href"],
        "done": bool(row["done"]),
        "created_at": row["created_at"],
    }


def list_saved(db: Database, ws_id: str) -> list[dict]:
    return [_public_saved(r) for r in db.all("SELECT * FROM saved WHERE workspace_id = ? ORDER BY done, created_at DESC", (ws_id,))]


def save_item(
    db: Database, ws_id: str, *, kind: str, text: str, detail: dict | None, resume_id: str | None, job_id: str | None, href: str | None
) -> dict:
    if kind not in SAVED_KINDS:
        raise AppError("Unknown kind of item.", 422, "INVALID_INPUT")
    text = text.strip()
    if not text:
        raise AppError("Nothing to save.", 422, "INVALID_INPUT")
    if resume_id:
        resumes.get_resume(db, ws_id, resume_id)
    if job_id:
        jobs.get_job(db, ws_id, job_id)
    if href and not href.startswith("/"):
        raise AppError("Links must point inside the app.", 422, "INVALID_INPUT")
    existing = db.one(
        "SELECT * FROM saved WHERE workspace_id = ? AND text = ? AND COALESCE(resume_id, '') = ? AND COALESCE(job_id, '') = ?",
        (ws_id, text, resume_id or "", job_id or ""),
    )
    if existing:
        return _public_saved(existing)
    sid = new_id()
    with db.tx() as c:
        c.execute(
            "INSERT INTO saved (id, workspace_id, resume_id, job_id, kind, text, detail, href, done, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)",
            (sid, ws_id, resume_id, job_id, kind, text[:2000], dumps(detail or {}), href, now()),
        )
    return _public_saved(db.one("SELECT * FROM saved WHERE id = ?", (sid,)))


def _get_saved(db: Database, ws_id: str, sid: str) -> dict:
    row = db.one("SELECT * FROM saved WHERE id = ? AND workspace_id = ?", (sid, ws_id))
    if not row:
        raise AppError("That saved item doesn't exist.", 404, "NOT_FOUND")
    return row


def set_done(db: Database, ws_id: str, sid: str, done: bool) -> dict:
    _get_saved(db, ws_id, sid)
    with db.tx() as c:
        c.execute("UPDATE saved SET done = ? WHERE id = ?", (int(done), sid))
    return _public_saved(_get_saved(db, ws_id, sid))


def delete_saved(db: Database, ws_id: str, sid: str) -> None:
    _get_saved(db, ws_id, sid)
    with db.tx() as c:
        c.execute("DELETE FROM saved WHERE id = ?", (sid,))


def export(db: Database, ws_id: str) -> dict:
    """Everything stored for this workspace, as plain JSON. Original files and embeddings are left out."""
    ws = db.one("SELECT created_at FROM workspaces WHERE id = ?", (ws_id,))
    out_resumes = []
    for r in db.all("SELECT * FROM resumes WHERE workspace_id = ? ORDER BY created_at", (ws_id,)):
        out_resumes.append(resumes.public_resume(r, full=True) | {"text": r["text"]})
    out_jobs = [
        {"id": j["id"], "title": j["title"], "company": j["company"], "text": j["text"], "requirements": loads(j["requirements"]), "created_at": j["created_at"]}
        for j in db.all("SELECT * FROM jobs WHERE workspace_id = ? ORDER BY created_at", (ws_id,))
    ]
    analyses = [
        {
            "kind": a["kind"],
            "resume_id": a["resume_id"],
            "job_id": a["job_id"],
            "input": loads(a["input"]),
            "result": loads(a["result"]),
            "model": a["model"],
            "created_at": a["created_at"],
        }
        for a in db.all("SELECT * FROM analyses WHERE workspace_id = ? ORDER BY created_at", (ws_id,))
    ]
    tailored = [
        {"resume_id": t["resume_id"], "job_id": t["job_id"], "original": t["original"], "revised": t["revised"], "created_at": t["created_at"]}
        for t in db.all("SELECT * FROM tailored WHERE workspace_id = ? ORDER BY created_at", (ws_id,))
    ]
    return {
        "exported_at": now(),
        "workspace_created_at": ws["created_at"] if ws else None,
        "note": "Everything Shortlist stores for this workspace. Original files and search embeddings are not included.",
        "resumes": out_resumes,
        "jobs": out_jobs,
        "analyses": analyses,
        "tailored": tailored,
        "saved": list_saved(db, ws_id),
    }


def summary(db: Database, ws_id: str) -> dict:
    count = lambda table: db.one(f"SELECT COUNT(*) AS n FROM {table} WHERE workspace_id = ?", (ws_id,))["n"]  # noqa: E731
    ws = db.one("SELECT created_at FROM workspaces WHERE id = ?", (ws_id,))
    return {
        "created_at": ws["created_at"] if ws else None,
        "resumes": count("resumes"),
        "jobs": count("jobs"),
        "analyses": count("analyses"),
        "saved": count("saved"),
    }


def delete_workspace(db: Database, settings: Settings, ws_id: str) -> None:
    """Delete every file and row for the workspace. Its token stops working immediately."""
    files = db.all("SELECT id, kind FROM resumes WHERE workspace_id = ?", (ws_id,))
    with db.tx() as c:
        c.execute("DELETE FROM analyses WHERE workspace_id = ?", (ws_id,))
        c.execute("DELETE FROM workspaces WHERE id = ?", (ws_id,))  # cascades to resumes, pages, chunks, jobs, tailored, saved
    for f in files:
        (settings.files_dir / f"{f['id']}{_EXT[f['kind']]}").unlink(missing_ok=True)
