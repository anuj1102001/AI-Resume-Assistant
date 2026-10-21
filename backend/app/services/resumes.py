"""Resume lifecycle: upload -> parse, inspect layout, run checks, chunk by section and embed -> ready.

Resumes are a few pages, so indexing runs inline (well under a second) instead of in a background job: the user gets
checks and a parsed view in the upload response itself.
"""

import hashlib
import re

import numpy as np

from app.config import Settings
from app.db import Database, dumps, loads, new_id, now
from app.errors import AppError
from app.ingest.parsers import Page, parse
from app.llm import prompts
from app.llm.client import LLM
from app.llm.schemas import ProfileOut
from app.resume.checks import run_checks
from app.resume.layout import inspect_pdf, no_layout
from app.resume.sections import parse_resume
from app.retrieval.embeddings import Embedder
from app.retrieval.search import Candidate
from app.services import grounded

_EXT = {"pdf": ".pdf", "docx": ".docx", "text": ".txt"}
SECTION_LABEL = {
    "header": "Contact",
    "summary": "Summary",
    "experience": "Experience",
    "education": "Education",
    "skills": "Skills",
    "projects": "Projects",
    "certifications": "Certifications",
    "achievements": "Achievements",
    "publications": "Publications",
    "volunteering": "Leadership & volunteering",
    "languages": "Languages",
    "interests": "Interests",
}
CHUNK_CHARS = 900


def _display_name(filename: str) -> str:
    name = re.split(r"[\\/]", filename or "")[-1]
    return "".join(ch for ch in name if ch.isprintable())[:200] or "resume"


def _section_chunks(parsed_sections) -> list[tuple[str, str, int]]:
    """(heading, text, page) chunks: one per section, split at line boundaries when a section is long."""
    out = []
    for s in parsed_sections:
        heading = s.title or SECTION_LABEL.get(s.key, s.key.title())
        if s.key == "header":
            heading = "Contact"
        buf, n = [], 0
        for line in s.text.split("\n"):
            if n + len(line) > CHUNK_CHARS and buf:
                out.append((heading, "\n".join(buf), s.page))
                buf, n = [], 0
            buf.append(line)
            n += len(line) + 1
        if buf:
            out.append((heading, "\n".join(buf), s.page))
    return [c for c in out if c[1].strip()]


def create_resume(
    db: Database, settings: Settings, embedder: Embedder, ws_id: str, filename: str, data: bytes, label: str | None = None
) -> tuple[dict, bool]:
    if not data:
        raise AppError("The file is empty.", 422, "EMPTY")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise AppError(f"Resumes can be up to {settings.max_upload_mb} MB. Is this the right file?", 413, "TOO_LARGE")
    sha = hashlib.sha256(data).hexdigest()
    if existing := db.one("SELECT * FROM resumes WHERE workspace_id = ? AND sha256 = ?", (ws_id, sha)):
        return public_resume(existing), False

    doc = parse(data, filename, settings.max_pages)
    layout = inspect_pdf(data) if doc.kind == "pdf" else no_layout(len(doc.pages))
    parsed = parse_resume(doc.pages)
    text = "\n".join(p.text for p in doc.pages)
    checks = run_checks(parsed, layout, text, doc.empty_pages)
    rid = new_id()
    label = (label or "").strip()[:80] or (
        f"{parsed.name}" if parsed.name else re.sub(r"\.(pdf|docx|txt|md)$", "", _display_name(filename), flags=re.I)
    )

    chunks = _section_chunks(parsed.sections)
    vectors = embedder.embed_passages([f"{h}\n{t}" for h, t, _ in chunks])
    settings.files_dir.mkdir(parents=True, exist_ok=True)
    (settings.files_dir / f"{rid}{_EXT[doc.kind]}").write_bytes(data)
    with db.tx() as c:
        c.execute(
            """INSERT INTO resumes (id, workspace_id, label, filename, kind, size_bytes, sha256, page_count, text, parsed, checks, layout, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                rid,
                ws_id,
                label,
                _display_name(filename),
                doc.kind,
                len(data),
                sha,
                len(doc.pages),
                text,
                dumps(parsed.to_dict()),
                dumps(checks),
                dumps(layout.to_dict()),
                now(),
            ),
        )
        c.executemany("INSERT INTO resume_pages (resume_id, page_no, text) VALUES (?, ?, ?)", [(rid, p.number, p.text) for p in doc.pages])
        c.executemany(
            "INSERT INTO chunks (id, resume_id, ord, section, page_start, page_end, text, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [(new_id(), rid, i, h, pg, pg, t, vectors[i].astype(np.float32).tobytes()) for i, (h, t, pg) in enumerate(chunks)],
        )
    return public_resume(db.one("SELECT * FROM resumes WHERE id = ?", (rid,))), True


def public_resume(row: dict, full: bool = False) -> dict:
    parsed = loads(row["parsed"], {})
    checks = loads(row["checks"], [])
    out = {
        "id": row["id"],
        "label": row["label"],
        "filename": row["filename"],
        "kind": row["kind"],
        "size_bytes": row["size_bytes"],
        "page_count": row["page_count"],
        "name": parsed.get("name"),
        "experience_years": round(parsed["experience_months"] / 12, 1) if parsed.get("experience_months") else None,
        "check_counts": {s: sum(1 for c in checks if c["status"] == s) for s in ("pass", "warn", "fail", "info")},
        "created_at": row["created_at"],
    }
    if full:
        out |= {"parsed": parsed, "checks": checks, "layout": loads(row["layout"], {})}
    return out


def get_resume(db: Database, ws_id: str, rid: str) -> dict:
    row = db.one("SELECT * FROM resumes WHERE id = ? AND workspace_id = ?", (rid, ws_id))
    if not row:
        raise AppError("Resume not found.", 404, "NOT_FOUND")
    return row


def list_resumes(db: Database, ws_id: str) -> list[dict]:
    return [public_resume(r) for r in db.all("SELECT * FROM resumes WHERE workspace_id = ? ORDER BY created_at DESC", (ws_id,))]


def rename_resume(db: Database, ws_id: str, rid: str, label: str) -> dict:
    get_resume(db, ws_id, rid)
    label = label.strip()[:80]
    if not label:
        raise AppError("Give the resume a name.", 422, "INVALID_INPUT")
    with db.tx() as c:
        c.execute("UPDATE resumes SET label = ? WHERE id = ?", (label, rid))
    return public_resume(get_resume(db, ws_id, rid))


def delete_resume(db: Database, settings: Settings, ws_id: str, rid: str) -> None:
    row = get_resume(db, ws_id, rid)
    with db.tx() as c:
        c.execute("DELETE FROM resumes WHERE id = ?", (rid,))
        c.execute("DELETE FROM analyses WHERE resume_id = ?", (rid,))
    (settings.files_dir / f"{rid}{_EXT[row['kind']]}").unlink(missing_ok=True)


def candidates(db: Database, rid: str, dim: int | None = None) -> list[Candidate]:
    rows = db.all(
        "SELECT id, resume_id, section, page_start, page_end, text, embedding FROM chunks WHERE resume_id = ? ORDER BY ord", (rid,)
    )
    out = []
    for r in rows:
        emb = np.frombuffer(r["embedding"], dtype=np.float32) if r["embedding"] else None
        if emb is not None and dim and emb.shape[0] != dim:
            emb = None
        out.append(Candidate(r["id"], r["resume_id"], r["text"], r["page_start"], r["page_end"], r["section"], emb))
    return out


def pages_text(db: Database, rid: str) -> dict[int, str]:
    return {r["page_no"]: r["text"] for r in db.all("SELECT page_no, text FROM resume_pages WHERE resume_id = ?", (rid,))}


def render_page(settings: Settings, row: dict, page_no: int, zoom: float = 1.8) -> bytes:
    if row["kind"] != "pdf":
        raise AppError("Only PDF resumes have page images.", 404, "NOT_FOUND")
    import pymupdf

    with pymupdf.open(settings.files_dir / f"{row['id']}.pdf") as doc:
        if not 1 <= page_no <= doc.page_count:
            raise AppError("Page not found.", 404, "NOT_FOUND")
        return doc[page_no - 1].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False).tobytes("png")


def locate_quote(settings: Settings, row: dict, page_no: int, quote: str) -> list[list[float]]:
    if row["kind"] != "pdf" or not quote.strip():
        return []
    import pymupdf

    with pymupdf.open(settings.files_dir / f"{row['id']}.pdf") as doc:
        if not 1 <= page_no <= doc.page_count:
            return []
        page = doc[page_no - 1]
        w, h = page.rect.width, page.rect.height
        rects = page.search_for(quote.strip()) or page.search_for(" ".join(quote.split()[:7]))
        return [[r.x0 / w, r.y0 / h, r.x1 / w, r.y1 / h] for r in rects]


def profile(db: Database, llm: LLM, ws_id: str, rid: str, refresh: bool = False) -> dict:
    get_resume(db, ws_id, rid)
    key = grounded.cache_key("profile", [rid], llm.model)
    if not refresh and (hit := grounded.cached(db, ws_id, key)):
        return hit
    labeled = grounded.Labeled()
    passages = labeled.add("P", candidates(db, rid))
    out, usage = llm.generate(system=prompts.SYSTEM, prompt=prompts.profile_prompt(passages), schema=ProfileOut, max_output_tokens=6000)
    result, stats = grounded.ground(out.model_dump(), labeled, lambda _id: pages_text(db, rid))
    result["grounding"] = stats
    return grounded.save(db, ws_id, "profile", key, rid, None, None, result, usage)


def page_list(pages: dict[int, str]) -> list[Page]:
    return [Page(n, t) for n, t in sorted(pages.items())]
