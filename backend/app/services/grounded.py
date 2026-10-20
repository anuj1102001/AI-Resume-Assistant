"""Passage labelling, citation verification and analysis caching, shared by every AI feature.

The model cites short labels (P3 for a resume passage, J2 for a job-description passage). After every call each
citation is resolved, its quote is checked against the source text (verified / approximate / unverified) and given a
page, and every claim-like object gets a "support" level. See app/grounding.py for the matching rules.
"""

import hashlib
from typing import Any

from app.db import Database, dumps, loads, new_id, now
from app.grounding import verify_quote
from app.llm import prompts
from app.llm.client import Usage
from app.retrieval.search import Candidate

STATUS_RANK = {"verified": 2, "approximate": 1, "unverified": 0}


class Labeled:
    def __init__(self) -> None:
        self.by_label: dict[str, Candidate] = {}
        self.pages: dict[str, dict[int, str]] = {}

    def add(self, prefix: str, chunks: list[Candidate], page_label: str = "Page") -> list[tuple[str, str, str]]:
        out = []
        n = sum(1 for k in self.by_label if k.startswith(prefix))
        for c in chunks:
            n += 1
            label = f"{prefix}{n}"
            self.by_label[label] = c
            loc = c.heading or ""
            if page_label:
                loc = f"{page_label} {c.page_start}" + (f" · {c.heading}" if c.heading else "")
            out.append((label, loc, c.text))
        return out


def ground(result: Any, labeled: Labeled, pages_for=None, citation_keys: tuple[str, ...] = ("citations", "evidence")) -> tuple[Any, dict]:
    stats = {"claims": 0, "verified": 0, "approximate": 0, "unverified": 0, "stated_unverified": 0}
    passages = {label: (c.text, c.page_start, c.page_end) for label, c in labeled.by_label.items()}

    def visit(node: Any) -> Any:
        if isinstance(node, list):
            return [visit(n) for n in node]
        if not isinstance(node, dict):
            return node
        node = {k: visit(v) for k, v in node.items()}
        key = next((k for k in citation_keys if isinstance(node.get(k), list)), None)
        if key is None:
            return node
        best, enriched = "unverified", []
        for cit in node[key]:
            label = (cit.get("passage") or "").strip().strip("[]")
            chunk = labeled.by_label.get(label)
            prefix = label[:1]
            # Only verify against passages of the same kind (resume quotes against the resume, JD quotes against the JD).
            pool = {k: v for k, v in passages.items() if k[:1] == prefix} if prefix else passages
            pages = pages_for(chunk.document_id) if (pages_for and chunk) else None
            v = verify_quote(cit.get("quote", ""), pool, label if chunk else None, pages)
            src = labeled.by_label.get(v.passage_id) if v.passage_id else chunk
            enriched.append(
                {
                    "quote": cit.get("quote", ""),
                    "status": v.status,
                    "source": "job" if prefix == "J" else "resume",
                    "source_id": src.document_id if src else None,
                    "section": src.heading if src else None,
                    "page": v.page or (src.page_start if src else None),
                }
            )
            if STATUS_RANK[v.status] > STATUS_RANK[best]:
                best = v.status
        node[key] = enriched
        if key == "evidence" and not enriched:
            return node  # an assessment of "missing" has no evidence by design; don't count it as a claim
        node["support"] = best
        stats["claims"] += 1
        stats[best] += 1
        if node.get("kind") == "stated" and best == "unverified":
            stats["stated_unverified"] += 1
        return node

    out = visit(result)
    stats["grounded_rate"] = round((stats["verified"] + stats["approximate"]) / stats["claims"], 3) if stats["claims"] else None
    return out, stats


def cache_key(kind: str, parts: list[str], model: str) -> str:
    return hashlib.sha256("|".join([kind, *parts, prompts.PROMPT_VERSION, model]).encode()).hexdigest()


def public(row: dict, cached: bool = False) -> dict:
    return {
        "id": row["id"],
        "kind": row["kind"],
        "resume_id": row["resume_id"],
        "job_id": row["job_id"],
        "input": loads(row["input"]),
        "result": loads(row["result"]),
        "meta": {
            "model": row["model"],
            "prompt_version": row["prompt_version"],
            "input_tokens": row["input_tokens"],
            "output_tokens": row["output_tokens"],
            "latency_ms": row["latency_ms"],
            "cached": cached,
            "created_at": row["created_at"],
        },
    }


def cached(db: Database, ws_id: str, key: str) -> dict | None:
    row = db.one("SELECT * FROM analyses WHERE workspace_id = ? AND cache_key = ? ORDER BY created_at DESC LIMIT 1", (ws_id, key))
    return public(row, cached=True) if row else None


def save(
    db: Database, ws_id: str, kind: str, key: str, resume_id: str | None, job_id: str | None, inp: Any, result: dict, usage: Usage
) -> dict:
    row = {
        "id": new_id(),
        "workspace_id": ws_id,
        "kind": kind,
        "cache_key": key,
        "resume_id": resume_id,
        "job_id": job_id,
        "input": dumps(inp),
        "result": dumps(result),
        "model": usage.model,
        "prompt_version": prompts.PROMPT_VERSION,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "latency_ms": usage.latency_ms,
        "created_at": now(),
    }
    with db.tx() as c:
        c.execute(f"INSERT INTO analyses ({', '.join(row)}) VALUES ({', '.join('?' * len(row))})", tuple(row.values()))
    return public(row)


def sum_usage(usages: list[Usage], model: str) -> Usage:
    return Usage(model, sum(u.input_tokens for u in usages), sum(u.output_tokens for u in usages), sum(u.latency_ms for u in usages))
