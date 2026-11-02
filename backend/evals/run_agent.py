"""Does the agent's investigation step help, and what does it cost?

Runs the LangGraph agent on the same 74 hand-labelled (resume, requirement) pairs as run_matching.py, with the gold
requirement list supplied so requirement extraction isn't being graded. One run per resume-job pair gives two
predictions for every requirement:

  pipeline   the statuses straight after the assess step: the production matching prompt + quote verification,
             i.e. what /api/match returns today
  agent      the statuses after the investigation loop has re-searched the requirements still marked missing

Both are scored with the metrics from run_matching.py, plus model calls, tokens and model latency per pair.
The thing to watch is the trade: recall gained on requirements the first pass missed against over-claiming on
requirements the resume really doesn't show (the agent can only upgrade missing -> partial, so "met" over-claims
can't rise, but accuracy drops if it finds "evidence" for a gold-missing requirement).

Run from backend/ (needs GEMINI_API_KEY in backend/.env):  python -m evals.run_agent
Set LANGSMITH_TRACING=true and LANGSMITH_API_KEY to see every run, step and tool call in LangSmith.
"""

import json
import os
import tempfile
import time
from collections import defaultdict
from datetime import date
from pathlib import Path

from langgraph.checkpoint.memory import InMemorySaver

from evals.common import RESULTS
from evals.run_matching import load, metrics, resume_info


def run(rows: list[dict], infos: dict) -> tuple[list[str], list[str], dict]:
    from app.agent.graph import build_graph
    from app.agent.service import build_chat_model
    from app.agent.state import AgentContext
    from app.config import Settings
    from app.db import Database
    from app.llm.client import build_llm
    from app.retrieval.embeddings import build_embedder
    from app.security import create_workspace
    from app.services import resumes

    base = Settings()
    if not base.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is not set in backend/.env.")
    before, after = [""] * len(rows), [""] * len(rows)
    cost = {"pipeline": defaultdict(int), "agent": defaultdict(int)}
    pause = float(os.environ.get("EVAL_PAUSE_S", "13"))  # free-tier keys allow ~5 requests a minute

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        s = Settings(data_dir=Path(tmp), gemini_api_key=base.gemini_api_key, gemini_model=base.gemini_model)
        db, emb = Database(s.db_path), build_embedder(s.embedding_backend, s.embedding_model)
        ws, _ = create_workspace(db)
        ctx = AgentContext(db=db, settings=s, llm=build_llm(s), embedder=emb, ws_id=ws, chat_model=build_chat_model(s))
        graph = build_graph().compile(checkpointer=InMemorySaver())

        groups = defaultdict(list)
        for i, r in enumerate(rows):
            groups[(r["resume"], r["job"])].append(i)
        for n, ((resume, job), idxs) in enumerate(groups.items()):
            if n:
                time.sleep(pause)
            info = infos[resume]
            rec, _ = resumes.create_resume(db, s, emb, ws, info["fname"], info["data"])
            reqs = [{"id": f"R{k + 1}", "text": rows[i]["text"], "kind": rows[i]["kind"], "category": "other"} for k, i in enumerate(idxs)]
            config = {"configurable": {"thread_id": f"{resume}-{job}"}}
            state = {"resume_id": rec["id"], "job_id": None, "propose_rewrites": False, "requirements": reqs}

            first_pass = None
            started = time.perf_counter()
            for update in graph.stream(state, config, context=ctx, stream_mode="updates"):
                if "assess" in update:
                    first_pass = {a["requirement"]: a["status"] for a in update["assess"]["assessments"]}
            wall_ms = int((time.perf_counter() - started) * 1000)
            final = graph.get_state(config).values
            last = {a["requirement"]: a["status"] for a in final["assessments"]}
            for k, i in enumerate(idxs):
                before[i] = first_pass.get(f"R{k + 1}", "missing")
                after[i] = last.get(f"R{k + 1}", "missing")

            for u in final.get("usage", []):
                for system in ("pipeline", "agent") if u["step"] == "assess" else ("agent",):
                    cost[system]["llm_calls"] += 1
                    cost[system]["input_tokens"] += u["input_tokens"]
                    cost[system]["output_tokens"] += u["output_tokens"]
                    cost[system]["model_latency_ms"] += u["latency_ms"]
            cost["agent"]["wall_ms"] += wall_ms
            upgraded = sum(before[i] != after[i] for i in idxs)
            print(f"{resume} x {job}: {upgraded} upgraded, {len(final.get('findings', []))} findings, {wall_ms} ms")

    pairs = len(groups)
    per_pair = {
        system: {k: round(v / pairs) for k, v in c.items() if k != "wall_ms"}
        | ({"wall_ms": round(c["wall_ms"] / pairs)} if "wall_ms" in c else {})
        for system, c in cost.items()
    }
    return before, after, per_pair


def main() -> None:
    rows = load()
    infos = {name: resume_info(name) for name in {r["resume"] for r in rows}}
    before, after, cost = run(rows, infos)
    results = {"pipeline": metrics(rows, before), "agent": metrics(rows, after)}
    changed = [
        {"resume": r["resume"], "requirement": r["text"], "gold": r["gold"], "pipeline": b, "agent": a}
        for r, b, a in zip(rows, before, after, strict=True)
        if a != b
    ]

    cols = ["accuracy", "evidence_precision", "evidence_recall", "evidence_f1", "over_claim_rate"]
    md = [
        "# Agent evaluation",
        "",
        f"Run on {date.today().isoformat()}: the same {len(rows)} hand-labelled requirements as `matching.md`, gold requirement lists supplied.",
        "`pipeline` is the first-pass judgement (what /api/match returns); `agent` adds the tool-calling investigation step.",
        "Same caveat as matching.md: synthetic data, labelled by the author. Read it as a regression suite.",
        "",
        "| Metric | pipeline | agent |",
        "|---|---|---|",
        *[f"| {c.replace('_', ' ')} | {results['pipeline'][c]} | {results['agent'][c]} |" for c in cols],
        "",
        "Cost per resume-job pair (averages):",
        "",
        "| | model calls | input tokens | output tokens | model latency (ms) |",
        "|---|---|---|---|---|",
        *[
            f"| {s} | {cost[s].get('llm_calls', 0)} | {cost[s].get('input_tokens', 0)} | {cost[s].get('output_tokens', 0)} | {cost[s].get('model_latency_ms', 0)} |"
            for s in ("pipeline", "agent")
        ],
        "",
        f"Requirements the investigation changed: {len(changed)}"
        + (
            f" ({sum(c['gold'] != 'missing' for c in changed)} correctly, {sum(c['gold'] == 'missing' for c in changed)} wrongly)."
            if changed
            else "."
        ),
    ]
    md += [f'- {c["resume"]}: "{c["requirement"]}" gold {c["gold"]}, {c["pipeline"]} -> {c["agent"]}' for c in changed]
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "agent.json").write_text(
        json.dumps({"results": results, "cost_per_pair": cost, "changed": changed}, indent=2), encoding="utf-8"
    )
    (RESULTS / "agent.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
