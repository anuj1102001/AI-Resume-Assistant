"""Parsing evaluation: v1 (the original code) vs v2 on the six synthetic resumes. No API key needed.

Run from backend/:  python -m evals.run_parsing
"""

import contextlib
import io
import json
from datetime import date

import pymupdf

from app.ingest.parsers import parse
from app.resume.sections import parse_resume
from evals.baselines.v1_chunk_service import split_text
from evals.baselines.v1_resume_summary import generate_resume_summary
from evals.fixtures import FORMATS, gold, names, render

V1_SECTION = {
    "PROFILE SUMMARY": "summary",
    "TECHNICAL SKILLS": "skills",
    "EXPERIENCE": "experience",
    "PROJECTS": "projects",
    "PUBLICATIONS": "publications",
    "EDUCATION": "education",
    "CERTIFICATIONS": "certifications",
    "ACHIEVEMENTS": "achievements",
}
FIELDS = ("email", "phone", "linkedin", "github")


def v1(data: bytes, fmt: str) -> dict | None:
    if fmt == "docx":
        return None  # v1 accepted PDFs only
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        text = "".join(page.get_text() for page in doc)  # exactly what v1's pdf_service did
    with contextlib.redirect_stdout(io.StringIO()):  # v1 prints debug output
        docs = split_text(text)
        summary = generate_resume_summary(docs)
    return {
        "sections": {V1_SECTION[d.metadata["section"]] for d in docs if d.metadata["section"] in V1_SECTION},
        "name": summary["name"] or None,
        "contact": {f: bool(summary.get(f)) for f in FIELDS},
        "roles": None,
    }


def v2(data: bytes, fname: str) -> dict:
    doc = parse(data, fname, 8)
    p = parse_resume(doc.pages)
    return {
        "sections": {s.key for s in p.sections if s.key not in ("header", "other")},
        "name": p.name,
        "contact": {f: bool(p.contact.get(f)) for f in FIELDS},
        "roles": sum(1 for e in p.entries if e.section == "experience"),
    }


def main() -> None:
    g = gold()
    rows, totals = (
        [],
        {
            "v1": {"tp": 0, "fp": 0, "fn": 0, "names": 0, "contact": 0, "roles": 0, "parsed": 0},
            "v2": {"tp": 0, "fp": 0, "fn": 0, "names": 0, "contact": 0, "roles": 0, "parsed": 0},
        },
    )
    contact_total = sum(len(g[n]["contact"]) for n in names())
    for name in names():
        data, fname = render(name)
        gold_sections = set(g[name]["sections"])
        for system, out in (("v1", v1(data, FORMATS.get(name, "pdf"))), ("v2", v2(data, fname))):
            t = totals[system]
            if out is None:
                t["fn"] += len(gold_sections)
                rows.append({"resume": name, "system": system, "note": "format not supported"})
                continue
            t["parsed"] += 1
            t["tp"] += len(out["sections"] & gold_sections)
            t["fp"] += len(out["sections"] - gold_sections)
            t["fn"] += len(gold_sections - out["sections"])
            t["names"] += out["name"] == g[name]["name"]
            t["contact"] += sum(out["contact"][f] for f in g[name]["contact"])
            t["roles"] += out["roles"] == g[name]["roles"]
            rows.append(
                {
                    "resume": name,
                    "system": system,
                    "sections": sorted(out["sections"]),
                    "name": out["name"],
                    "missed_sections": sorted(gold_sections - out["sections"]),
                }
            )

    n = len(names())
    summary = {}
    for system, t in totals.items():
        p = t["tp"] / (t["tp"] + t["fp"]) if t["tp"] + t["fp"] else 0
        r = t["tp"] / (t["tp"] + t["fn"]) if t["tp"] + t["fn"] else 0
        summary[system] = {
            "files_parsed": f"{t['parsed']}/{n}",
            "section_precision": round(p, 3),
            "section_recall": round(r, 3),
            "section_f1": round(2 * p * r / (p + r), 3) if p + r else 0,
            "name_accuracy": round(t["names"] / n, 3),
            "contact_recall": round(t["contact"] / contact_total, 3),
            "roles_correct": f"{t['roles']}/{n}" if system == "v2" else "not extracted",
        }
    md = [
        "# Parsing evaluation",
        "",
        f"Run on {date.today().isoformat()} over {n} synthetic resumes (PDF, two-column PDF and DOCX; see `data/README.md`).",
        "v1 is the original code from the main branch, run unchanged on the same files.",
        "",
        "**Caveat:** v2 was developed while looking at these same synthetic files, and the gold labels were written by the same person.",
        "Read these numbers as a regression suite and as the v1-to-v2 change on known cases, not as accuracy on unseen resumes.",
        "A held-out set of real, consented resumes labelled by someone else is the next step.",
        "",
        "| Metric | v1 | v2 |",
        "|---|---|---|",
    ]
    for k in summary["v2"]:
        md.append(f"| {k.replace('_', ' ')} | {summary['v1'][k]} | {summary['v2'][k]} |")
    md += ["", "Per resume:", ""]
    for row in rows:
        md.append(
            f"- `{row['resume']}` {row['system']}: "
            + (row.get("note") or f"missed {row['missed_sections'] or 'nothing'}; name {row['name']!r}")
        )
    from evals.common import RESULTS

    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "parsing.json").write_text(json.dumps({"summary": summary, "rows": rows}, indent=2), encoding="utf-8")
    (RESULTS / "parsing.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
