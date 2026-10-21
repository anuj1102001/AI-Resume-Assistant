"""Requirement-level matching evaluation against hand-labelled gold (data/requirements.jsonl).

Methods compared on the same 74 (resume, requirement) pairs:
  v1          the original matcher: 37 hard-coded keywords, substring matching
  v2-keywords the new instant matcher: ~250 skills with aliases, word-boundary matching, years-of-experience rule
  v2-llm      the full pipeline: hybrid retrieval of resume evidence + Gemini judgement + quote verification (needs a key)

Metrics:
  coverage        share of requirements the method can assess at all (keyword methods can't judge "track record" or "portfolio")
  accuracy        3-class (met / partial / missing) over ALL requirements; an unassessed requirement counts as wrong
  evidence F1     binary: does the resume show evidence (met or partial)?
  over-claim rate share of requirements with no evidence (gold "missing") that the method calls "met": the error that
                  most misleads a candidate

Run from backend/:  python -m evals.run_matching [--llm]
"""

import argparse
import contextlib
import io
import json
import os
import tempfile
import time
from collections import defaultdict
from datetime import date
from pathlib import Path

from app.ingest.parsers import parse
from app.resume.sections import parse_resume
from app.resume.skills import find_skills, required_years
from evals.baselines.v1_chunk_service import split_text
from evals.baselines.v1_job_match_service import extract_job_keywords
from evals.baselines.v1_resume_summary import generate_resume_summary
from evals.common import EVAL_DIR, RESULTS
from evals.fixtures import render


def load() -> list[dict]:
    return [json.loads(x) for x in (EVAL_DIR / "data" / "requirements.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]


def resume_info(name: str) -> dict:
    data, fname = render(name)
    doc = parse(data, fname, 8)
    text = "\n".join(p.text for p in doc.pages)
    parsed = parse_resume(doc.pages)
    v1_skills = set()
    if not fname.endswith(".docx"):
        with contextlib.redirect_stdout(io.StringIO()):
            v1_skills = {s.lower() for s in generate_resume_summary(split_text(text))["skills"]}
    return {"text": text, "months": parsed.experience_months, "v1_skills": v1_skills, "data": data, "fname": fname}


def predict_v1(req: str, info: dict) -> str | None:
    kws = extract_job_keywords(req)
    if not kws:
        return None
    hit = len(kws & info["v1_skills"])
    return "met" if hit == len(kws) else ("partial" if hit else "missing")


def predict_v2(req: str, info: dict) -> str | None:
    yrs = required_years(req)
    need = set(find_skills(req))
    if yrs is not None and not need:
        if info["months"] is None:
            return "missing"
        return "met" if info["months"] / 12 >= yrs else "missing"
    if not need:
        return None
    have = set(find_skills(info["text"]))
    hit = len(need & have)
    return "met" if hit == len(need) else ("partial" if hit else "missing")


def predict_llm(rows: list[dict], infos: dict) -> list[str]:
    """Run the production matching prompt with the gold requirement list (so requirement extraction isn't being graded)."""
    from app.config import Settings
    from app.db import Database
    from app.llm import prompts
    from app.llm.client import build_llm
    from app.llm.schemas import MatchOut
    from app.retrieval.embeddings import build_embedder
    from app.retrieval.search import search
    from app.security import create_workspace
    from app.services import grounded, resumes

    base = Settings()
    if not base.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is not set in backend/.env; run without --llm or add a key.")
    preds = [""] * len(rows)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:  # SQLite keeps the file open on Windows
        s = Settings(data_dir=Path(tmp), gemini_api_key=base.gemini_api_key, gemini_model=base.gemini_model)
        db, llm, emb = Database(s.db_path), build_llm(s), build_embedder(s.embedding_backend, s.embedding_model)
        ws, _ = create_workspace(db)
        groups = defaultdict(list)
        for i, r in enumerate(rows):
            groups[(r["resume"], r["job"])].append(i)
        pause = float(os.environ.get("EVAL_PAUSE_S", "13"))  # free-tier keys allow ~5 requests a minute
        for n, ((resume, _job), idxs) in enumerate(groups.items()):
            if n:
                time.sleep(pause)
            info = infos[resume]
            rec, _ = resumes.create_resume(db, s, emb, ws, info["fname"], info["data"])
            pool = resumes.candidates(db, rec["id"], emb.dim)
            reqs = [(f"R{k + 1}", rows[i]["kind"], rows[i]["text"]) for k, i in enumerate(idxs)]
            chosen = {}
            for _, _, text in reqs:
                for h in search(pool, text, emb, k=3):
                    chosen.setdefault(h.candidate.id, h.candidate)
            labeled = grounded.Labeled()
            passages = labeled.add("P", [c for c in pool if c.id in chosen])
            out, _ = llm.generate(
                system=prompts.SYSTEM, prompt=prompts.match_prompt(reqs, passages), schema=MatchOut, max_output_tokens=8000
            )
            data, _ = grounded.ground(out.model_dump(), labeled)
            by = {a["requirement"]: a for a in data["assessments"]}
            for k, i in enumerate(idxs):
                a = by.get(f"R{k + 1}")
                status = a["status"] if a else "missing"
                if a and status == "met" and a.get("support") == "unverified":
                    status = "partial"
                preds[i] = status
            print(f"{resume} x {_job}: done")
    return preds


def metrics(rows: list[dict], preds: list[str | None]) -> dict:
    n = len(rows)
    assessed = [p for p in preds if p]
    correct = sum(1 for r, p in zip(rows, preds, strict=True) if p == r["gold"])
    tp = sum(1 for r, p in zip(rows, preds, strict=True) if p in ("met", "partial") and r["gold"] in ("met", "partial"))
    fp = sum(1 for r, p in zip(rows, preds, strict=True) if p in ("met", "partial") and r["gold"] == "missing")
    fn = sum(1 for r, p in zip(rows, preds, strict=True) if p not in ("met", "partial") and r["gold"] in ("met", "partial"))
    missing = [i for i, r in enumerate(rows) if r["gold"] == "missing"]
    over = sum(1 for i in missing if preds[i] == "met")
    prec = tp / (tp + fp) if tp + fp else 0
    rec = tp / (tp + fn) if tp + fn else 0
    return {
        "coverage": round(len(assessed) / n, 3),
        "accuracy": round(correct / n, 3),
        "evidence_precision": round(prec, 3),
        "evidence_recall": round(rec, 3),
        "evidence_f1": round(2 * prec * rec / (prec + rec), 3) if prec + rec else 0,
        "over_claim_rate": round(over / len(missing), 3) if missing else None,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--llm", action="store_true")
    args = ap.parse_args()
    rows = load()
    infos = {name: resume_info(name) for name in {r["resume"] for r in rows}}
    results = {
        "v1": metrics(rows, [predict_v1(r["text"], infos[r["resume"]]) for r in rows]),
        "v2-keywords": metrics(rows, [predict_v2(r["text"], infos[r["resume"]]) for r in rows]),
    }
    llm_note = "Not run yet: needs GEMINI_API_KEY (python -m evals.run_matching --llm)."
    if args.llm:
        results["v2-llm"] = metrics(rows, predict_llm(rows, infos))
        llm_note = ""
    else:
        previous = RESULTS / "matching.json"
        if previous.exists() and "v2-llm" in (old := json.loads(previous.read_text(encoding="utf-8")))["results"]:
            results["v2-llm"] = old["results"]["v2-llm"]
            llm_note = f"v2-llm figures are from the run on {old['results'].get('v2-llm_date', 'an earlier date')}."
    if "v2-llm" in results and args.llm:
        results["v2-llm_date"] = date.today().isoformat()

    gold_counts = {g: sum(1 for r in rows if r["gold"] == g) for g in ("met", "partial", "missing")}
    cols = ["coverage", "accuracy", "evidence_precision", "evidence_recall", "evidence_f1", "over_claim_rate"]
    systems = [s for s in ("v1", "v2-keywords", "v2-llm") if s in results]
    md = [
        "# Matching evaluation",
        "",
        f"Run on {date.today().isoformat()}: {len(rows)} requirements across 8 resume-job pairs, hand-labelled "
        f"({gold_counts['met']} met, {gold_counts['partial']} partial, {gold_counts['missing']} missing). Synthetic data; see `data/README.md`.",
        "",
        "**Caveat:** v2 was developed while looking at these same synthetic files, and the gold labels were written by the same person.",
        "Read these numbers as a regression suite and as the v1-to-v2 change on known cases, not as accuracy on unseen resumes.",
        "A held-out set of real, consented resumes labelled by someone else is the next step.",
        "",
        "| Metric | " + " | ".join(systems) + " |",
        "|---" * (len(systems) + 1) + "|",
    ]
    for c in cols:
        md.append(f"| {c.replace('_', ' ')} | " + " | ".join(str(results[s][c]) for s in systems) + " |")
    md += ["", llm_note] if llm_note else []
    md += [
        "",
        "Accuracy counts a requirement the method can't assess as wrong; coverage shows how often that happens. Keyword methods",
        'can\'t judge requirements like "a track record of improving latency" or "a portfolio", which is why the product uses them',
        "only for the instant keyword view and relies on retrieval + model judgement for the match itself.",
    ]
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "matching.json").write_text(json.dumps({"results": results}, indent=2), encoding="utf-8")
    (RESULTS / "matching.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
