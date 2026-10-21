"""SQLite storage (standard library). Small, file-based and transactional, which suits a single-node demo.

Every query that touches user data takes a workspace id, so one workspace can never read another's resumes or jobs.
"""

import json
import sqlite3
import threading
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  filename TEXT NOT NULL,
  kind TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  text TEXT NOT NULL,
  parsed TEXT NOT NULL,      -- deterministic parse: contact, sections, bullets, dates (JSON)
  checks TEXT NOT NULL,      -- readability checks (JSON)
  layout TEXT NOT NULL,      -- layout facts from the PDF: columns, images, fonts (JSON)
  created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resumes_ws ON resumes(workspace_id, created_at);
CREATE TABLE IF NOT EXISTS resume_pages (
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  page_no INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (resume_id, page_no)
);
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL,
  section TEXT NOT NULL,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB
);
CREATE INDEX IF NOT EXISTS idx_chunks_resume ON chunks(resume_id, ord);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT,
  text TEXT NOT NULL,
  requirements TEXT,         -- extracted requirements (JSON), filled by the first analysis
  created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_ws ON jobs(workspace_id, created_at);
CREATE TABLE IF NOT EXISTS tailored (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  original TEXT NOT NULL,    -- the bullet as written in the resume
  revised TEXT NOT NULL,     -- the version the user accepted (possibly edited)
  created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tailored ON tailored(resume_id, job_id);
CREATE TABLE IF NOT EXISTS analyses (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  resume_id TEXT,
  job_id TEXT,
  input TEXT,
  result TEXT NOT NULL,
  model TEXT,
  prompt_version TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analyses_cache ON analyses(workspace_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_analyses_resume ON analyses(resume_id, kind);
CREATE TABLE IF NOT EXISTS usage_events (
  workspace_id TEXT NOT NULL,
  at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage ON usage_events(workspace_id, at);
CREATE TABLE IF NOT EXISTS saved (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  resume_id TEXT REFERENCES resumes(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,        -- suggestion | gap | claim | answer
  text TEXT NOT NULL,
  detail TEXT,               -- context shown with it (JSON): where it came from, citations
  href TEXT,                 -- where in the app it came from
  done INTEGER NOT NULL DEFAULT 0,
  created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saved_ws ON saved(workspace_id, created_at);
"""


def new_id() -> str:
    return uuid.uuid4().hex


class Database:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self._local = threading.local()
        with self.tx() as c:
            c.executescript(SCHEMA)

    def _conn(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA journal_mode = WAL")
            self._local.conn = conn
        return conn

    @contextmanager
    def tx(self) -> Iterator[sqlite3.Connection]:
        conn = self._conn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    def one(self, sql: str, args: tuple = ()) -> dict[str, Any] | None:
        row = self._conn().execute(sql, args).fetchone()
        return dict(row) if row else None

    def all(self, sql: str, args: tuple = ()) -> list[dict[str, Any]]:
        return [dict(r) for r in self._conn().execute(sql, args).fetchall()]


def now() -> float:
    return time.time()


def dumps(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False)


def loads(v: str | None, default: Any = None) -> Any:
    return json.loads(v) if v else default
