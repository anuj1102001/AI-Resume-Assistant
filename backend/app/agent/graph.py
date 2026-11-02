"""The match agent as a LangGraph state machine.

    load_requirements -> retrieve -> assess --(anything missing and a tool model?)--> investigate <-> run_tools
                                       |                                                  |
                                       +----------------------> score <------- collect_findings
                                                                  |
                                    (rewrites wanted?) -> propose_rewrites -> human_review (pauses) -> apply

assess        the production matching prompt, then every evidence quote is checked against the resume. A "met" whose
              quote can't be found is downgraded to partial, as in the pipeline.
investigate   a tool-calling loop for the requirements still marked missing. The first pass retrieves 3 passages per
              requirement with the requirement's own wording, so evidence written in other words can be missed. The
              model searches again with its own queries and records quotes; each quote is checked in code, and a found
              requirement goes from missing to partial, never to met. The loop is capped at max_tool_rounds turns.
score         computed in code, never by the model (same formula as the pipeline).
propose       rewrites for the bullets behind partial matches. Variants that add numbers or skills the resume doesn't
              contain are kept out of what the user can pick.
human_review  the run stops here and is saved. It continues only when the user approves or rejects each rewrite.
"""

import time

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from langgraph.types import interrupt
from langsmith import traceable

from app.agent.state import AgentContext, AgentState, usage_entry
from app.agent.tools import TOOLS, run_tool
from app.db import loads
from app.errors import AppError
from app.grounding import normalize, verify_quote
from app.llm import prompts
from app.llm.schemas import MatchOut
from app.retrieval.search import search
from app.services import grounded, jobs, matching, resumes, rewrite

FIRST_PASS_K = 3

INVESTIGATOR_SYSTEM = """You double-check job requirements that a first pass marked as missing from a resume.
The first pass searched with the requirement's own wording, so it can miss evidence written in other words
(for example "built REST endpoints" for "API design", or "led a team of five" for "people management").

For each requirement you are given:
1. Call search_resume with one or two differently worded queries.
2. If a passage shows the requirement, or clearly equivalent work, call record_evidence with the requirement id and a
   quote copied word for word from that passage.
3. If nothing shows it, record nothing. "Missing" is a correct answer; a stretched match hurts the candidate in interviews.
Stop once every requirement has been checked."""


@traceable(run_type="llm", name="gemini.structured")
def _generate(llm, **kwargs):
    out, usage = llm.generate(**kwargs)
    return out, usage


def _pool(ctx: AgentContext, rid: str):
    return resumes.candidates(ctx.db, rid, ctx.embedder.dim)


def _labeled(pool, mapping: dict[str, str]) -> tuple[grounded.Labeled, list[tuple[str, str, str]]]:
    """Rebuild the labelled passages from a checkpoint; labels come out the same because the order is kept."""
    by_id = {c.id: c for c in pool}
    labeled = grounded.Labeled()
    passages = labeled.add("P", [by_id[cid] for cid in mapping.values() if cid in by_id])
    return labeled, passages


# ---- Nodes ---------------------------------------------------------------------------------------------------------


def load_requirements(state: AgentState, runtime: Runtime[AgentContext]) -> dict:
    if state.get("requirements"):
        return {"steps": [f"requirements: {len(state['requirements'])} supplied"]}
    ctx = runtime.context
    data, usage = jobs.requirements(ctx.db, ctx.llm, ctx.ws_id, state["job_id"])
    reqs = data["requirements"]
    if not reqs:
        raise AppError("No requirements were found in this job description, so there's nothing to match against.", 422, "NO_REQUIREMENTS")
    out = {"requirements": reqs, "steps": [f"requirements: {len(reqs)} extracted" if usage else f"requirements: {len(reqs)} (cached)"]}
    if usage:
        out["usage"] = [usage_entry("requirements", usage.model, usage.input_tokens, usage.output_tokens, usage.latency_ms)]
    return out


def retrieve(state: AgentState, runtime: Runtime[AgentContext]) -> dict:
    ctx = runtime.context
    pool = _pool(ctx, state["resume_id"])
    chosen: dict[str, None] = {}
    for r in state["requirements"]:
        for h in search(pool, r["text"], ctx.embedder, k=FIRST_PASS_K):
            chosen.setdefault(h.candidate.id)
    position = {c.id: i for i, c in enumerate(pool)}
    ordered = sorted(chosen, key=position.__getitem__)  # resume order reads better than relevance order
    return {"passages": {f"P{i}": cid for i, cid in enumerate(ordered, start=1)}, "steps": [f"retrieve: {len(ordered)} passages"]}


def assess(state: AgentState, runtime: Runtime[AgentContext]) -> dict:
    ctx = runtime.context
    pool = _pool(ctx, state["resume_id"])
    labeled, passages = _labeled(pool, state["passages"])
    reqs = state["requirements"]
    out, usage = _generate(
        ctx.llm,
        system=prompts.SYSTEM,
        prompt=prompts.match_prompt([(r["id"], r["kind"], r["text"]) for r in reqs], passages),
        schema=MatchOut,
        max_output_tokens=8000,
    )
    data, stats = grounded.ground(out.model_dump(), labeled, lambda _id: resumes.pages_text(ctx.db, state["resume_id"]))

    seen: dict[str, dict] = {}
    for a in data["assessments"]:
        if a["requirement"] in seen or not any(r["id"] == a["requirement"] for r in reqs):
            continue
        if a["status"] == "met" and a.get("support") == "unverified":
            a["status"], a["downgraded"] = "partial", True
        seen[a["requirement"]] = a
    assessments = []
    for r in reqs:
        a = seen.get(r["id"]) or {
            "requirement": r["id"],
            "status": "missing",
            "explanation": "Not assessed by the model; treated as missing.",
            "evidence": [],
            "suggestion": None,
        }
        assessments.append({**a, "text": r["text"], "kind": r["kind"], "category": r.get("category", "other")})

    counts = {s: sum(a["status"] == s for a in assessments) for s in ("met", "partial", "missing")}
    return {
        "assessments": assessments,
        "grounding": stats,
        "usage": [usage_entry("assess", usage.model, usage.input_tokens, usage.output_tokens, usage.latency_ms)],
        "steps": [f"assess: {counts['met']} met, {counts['partial']} partial, {counts['missing']} missing"],
    }


def investigate(state: AgentState, runtime: Runtime[AgentContext]) -> dict:
    ctx = runtime.context
    update: dict = {}
    messages = list(state.get("messages") or [])
    if not messages:
        missing = [a for a in state["assessments"] if a["status"] == "missing"]
        missing.sort(key=lambda a: a["kind"] != "must")  # must-haves first
        chosen = missing[: ctx.max_investigated]
        listing = "\n".join(f"[{a['requirement']}] ({a['kind']}) {a['text']}" for a in chosen)
        messages = [SystemMessage(INVESTIGATOR_SYSTEM), HumanMessage(f"Requirements marked missing:\n{listing}")]
        update = {"investigating": [a["requirement"] for a in chosen], "messages": messages}

    started = time.perf_counter()
    reply = ctx.chat_model.bind_tools(TOOLS).invoke(messages)
    latency = int((time.perf_counter() - started) * 1000)
    um = getattr(reply, "usage_metadata", None) or {}
    calls = [c["name"] for c in getattr(reply, "tool_calls", []) or []]
    return {
        **update,
        "messages": [*update.get("messages", []), reply],
        "usage": [usage_entry("investigate", ctx.settings.gemini_model, um.get("input_tokens", 0), um.get("output_tokens", 0), latency)],
        "steps": [f"investigate: {', '.join(calls) if calls else 'done'}"],
    }


def run_tools(state: AgentState, runtime: Runtime[AgentContext]) -> dict:
    ctx = runtime.context
    pool = _pool(ctx, state["resume_id"])
    last = state["messages"][-1]
    results = [
        ToolMessage(run_tool(c["name"], c.get("args") or {}, pool, ctx.embedder, set(state["investigating"])), tool_call_id=c["id"])
        for c in last.tool_calls
    ]
    return {"messages": results}


def collect_findings(state: AgentState, runtime: Runtime[AgentContext]) -> dict:
    """Turn accepted record_evidence calls into findings, re-verify each quote, and upgrade missing -> partial."""
    ctx = runtime.context
    pool = _pool(ctx, state["resume_id"])
    pages = resumes.pages_text(ctx.db, state["resume_id"])
    source = {c.id: (c.text, c.page_start, c.page_end) for c in pool}
    calls = {c["id"]: c for m in state.get("messages", []) if isinstance(m, AIMessage) for c in (m.tool_calls or [])}

    findings: list[dict] = []
    for m in state.get("messages", []):
        if not isinstance(m, ToolMessage) or not str(m.content).startswith("recorded"):
            continue
        call = calls.get(m.tool_call_id)
        if not call or call["name"] != "record_evidence":
            continue
        quote = str(call["args"].get("quote", ""))
        v = verify_quote(quote, source, None, pages)
        if v.status != "unverified":
            chunk = next(c for c in pool if c.id == v.passage_id)
            findings.append(
                {
                    "requirement": call["args"]["requirement_id"],
                    "quote": quote,
                    "status": v.status,
                    "page": v.page,
                    "section": chunk.heading,
                }
            )

    found = {}
    for f in findings:
        found.setdefault(f["requirement"], []).append(f)
    assessments = []
    for a in state["assessments"]:
        if a["status"] == "missing" and a["requirement"] in found:
            evidence = [
                {
                    "quote": f["quote"],
                    "status": f["status"],
                    "source": "resume",
                    "source_id": state["resume_id"],
                    "section": f["section"],
                    "page": f["page"],
                }
                for f in found[a["requirement"]]
            ]
            a = {
                **a,
                "status": "partial",
                "evidence": evidence,
                "support": "verified" if any(f["status"] == "verified" for f in found[a["requirement"]]) else "approximate",
                "explanation": "The first pass missed this; a second search found related evidence. Check it reads as a match.",
                "found_by": "investigator",
            }
        assessments.append(a)
    return {
        "assessments": assessments,
        "findings": findings,
        "steps": [f"collect: {len(found)} of {len(state['investigating'])} upgraded to partial"],
    }


def score(state: AgentState) -> dict:
    by_id = {r["id"]: r for r in state["requirements"]}
    s = matching.score(state["assessments"], by_id)
    return {"score": s, "steps": [f"score: coverage {s['coverage']}"]}


def propose_rewrites(state: AgentState, runtime: Runtime[AgentContext]) -> dict:
    ctx = runtime.context
    resume = resumes.get_resume(ctx.db, ctx.ws_id, state["resume_id"])
    bullets = loads(resume["parsed"], {}).get("bullets", [])

    targets: dict[str, list[str]] = {}
    ranked = sorted(state["assessments"], key=lambda a: a["kind"] != "must")
    for a in ranked:
        if a["status"] != "partial":
            continue
        for ev in a.get("evidence") or []:
            q = normalize(ev.get("quote", ""))
            b = next((b for b in bullets if q and q in normalize(b["text"])), None)
            if b and (b["id"] in targets or len(targets) < ctx.max_rewrites):
                targets.setdefault(b["id"], [])
                if a["requirement"] not in targets[b["id"]]:
                    targets[b["id"]].append(a["requirement"])

    proposals, usage = [], []
    for bullet_id, req_ids in targets.items():
        res = rewrite.rewrite(ctx.db, ctx.llm, ctx.ws_id, state["resume_id"], bullet_id, state.get("job_id"))
        result, meta = res["result"], res["meta"]
        if not meta["cached"]:
            usage.append(usage_entry("rewrite", meta["model"], meta["input_tokens"], meta["output_tokens"], meta["latency_ms"]))
        variants = [
            {**v, "index": i, "safe": not v["checks"]["new_numbers"] and not v["checks"]["new_skills"]}
            for i, v in enumerate(result["variants"])
        ]
        proposals.append(
            {
                "bullet_id": bullet_id,
                "original": result["original"],
                "requirements": req_ids,
                "variants": variants,
                "questions": result["questions"],
            }
        )
    blocked = sum(not v["safe"] for p in proposals for v in p["variants"])
    return {"proposals": proposals, "usage": usage, "steps": [f"propose: {len(proposals)} bullets, {blocked} unsafe variants held back"]}


def human_review(state: AgentState) -> dict:
    answer = interrupt({"kind": "review_rewrites", "proposals": state["proposals"]})
    decisions = answer.get("decisions", []) if isinstance(answer, dict) else list(answer or [])
    accepted = sum(d.get("variant") is not None or bool(d.get("text")) for d in decisions)
    return {"decisions": decisions, "steps": [f"review: {accepted} of {len(state['proposals'])} accepted"]}


def apply(state: AgentState, runtime: Runtime[AgentContext]) -> dict:
    ctx = runtime.context
    by_bullet = {p["bullet_id"]: p for p in state["proposals"]}
    applied = []
    for d in state.get("decisions", []):
        p = by_bullet.get(d.get("bullet_id"))
        if not p:
            continue
        text = (d.get("text") or "").strip()
        if not text and d.get("variant") is not None:
            v = p["variants"][d["variant"]]
            if not v["safe"]:
                continue  # also rejected before resuming; never apply a variant that adds facts
            text = v["text"]
        if text:
            applied.append(rewrite.save_tailored(ctx.db, ctx.ws_id, state["resume_id"], state.get("job_id"), p["bullet_id"], text))
    return {"applied": applied, "steps": [f"apply: {len(applied)} bullets saved"]}


# ---- Routing -------------------------------------------------------------------------------------------------------


def after_assess(state: AgentState, runtime: Runtime[AgentContext]) -> str:
    has_missing = any(a["status"] == "missing" for a in state["assessments"])
    return "investigate" if has_missing and runtime.context.chat_model is not None else "score"


def after_investigate(state: AgentState, runtime: Runtime[AgentContext]) -> str:
    last = state["messages"][-1]
    turns = sum(isinstance(m, AIMessage) for m in state["messages"])
    if isinstance(last, AIMessage) and last.tool_calls and turns < runtime.context.max_tool_rounds:
        return "run_tools"
    return "collect_findings"


def after_score(state: AgentState) -> str:
    return "propose_rewrites" if state.get("propose_rewrites") and state.get("job_id") else END


def after_propose(state: AgentState) -> str:
    return "human_review" if state.get("proposals") else END


def build_graph() -> StateGraph:
    g = StateGraph(AgentState, context_schema=AgentContext)
    for name, fn in [
        ("load_requirements", load_requirements),
        ("retrieve", retrieve),
        ("assess", assess),
        ("investigate", investigate),
        ("run_tools", run_tools),
        ("collect_findings", collect_findings),
        ("score", score),
        ("propose_rewrites", propose_rewrites),
        ("human_review", human_review),
        ("apply", apply),
    ]:
        g.add_node(name, fn)
    g.add_edge(START, "load_requirements")
    g.add_edge("load_requirements", "retrieve")
    g.add_edge("retrieve", "assess")
    g.add_conditional_edges("assess", after_assess, ["investigate", "score"])
    g.add_conditional_edges("investigate", after_investigate, ["run_tools", "collect_findings"])
    g.add_edge("run_tools", "investigate")
    g.add_edge("collect_findings", "score")
    g.add_conditional_edges("score", after_score, ["propose_rewrites", END])
    g.add_conditional_edges("propose_rewrites", after_propose, ["human_review", END])
    g.add_edge("human_review", "apply")
    g.add_edge("apply", END)
    return g
