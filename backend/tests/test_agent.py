"""The LangGraph match agent: the investigation loop, its guardrails, the human review pause, and workspace isolation.

The structured model calls use the same test model as the rest of the suite. The tool-calling model is scripted, so
each test decides exactly which tools the "model" calls and with what arguments.
"""

import pytest
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langgraph.checkpoint.memory import InMemorySaver

from app.deps import get_chat_model, get_checkpointer
from evals.fixtures import job_text, render
from tests.conftest import add_job, auth, upload

REAL_QUOTE = "building payment and billing APIs in Go and Python"  # in Priya's summary, not in any bullet


class ScriptedToolModel(FakeMessagesListChatModel):
    """Plays back AIMessages in order (repeating the last one) and accepts bind_tools like a real chat model."""

    def bind_tools(self, tools, **kwargs):
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        reply = self.responses[min(self.i, len(self.responses) - 1)]
        self.i += 1
        # A fresh message each turn, as a real model sends; tool call ids made unique the same way.
        calls = [{**c, "id": f"{c['id']}_{self.i}"} for c in reply.tool_calls]
        return ChatResult(generations=[ChatGeneration(message=AIMessage(reply.content, tool_calls=calls))])


def call(name: str, args: dict, n: int) -> dict:
    return {"name": name, "args": args, "id": f"call_{n}"}


@pytest.fixture
def agent_client(make_client, fake_llm):
    def build(chat_model=None):
        c = make_client(fake_llm)
        saver = InMemorySaver()
        c.app.dependency_overrides[get_chat_model] = lambda: chat_model
        c.app.dependency_overrides[get_checkpointer] = lambda: saver
        return c

    return build


def _setup(c, job_extra: str = ""):
    h = auth(c)
    data, name = render("priya")
    resume = upload(c, h, data, name)
    job = add_job(c, h, job_text("backend") + job_extra, "Senior Backend Engineer")
    return h, resume, job


def _start(c, h, resume, job, investigate: bool = True) -> dict:
    r = c.post("/api/agent/runs", headers=h, json={"resume_id": resume["id"], "job_id": job["id"], "investigate": investigate})
    assert r.status_code == 201, r.text
    return r.json()


def test_investigation_is_off_unless_asked_for(agent_client):
    model = ScriptedToolModel(responses=[AIMessage("", tool_calls=[call("search_resume", {"query": "Java"}, 1)])])
    c = agent_client(model)
    h, resume, job = _setup(c)
    run = _start(c, h, resume, job, investigate=False)
    assert not any(s.startswith("investigate") for s in run["steps"]) and model.i == 0


def _by_text(run: dict, fragment: str) -> dict:
    return next(a for a in run["assessments"] if fragment in a["text"])


def test_investigator_finds_missed_evidence_and_rejects_invented_quotes(agent_client):
    model = ScriptedToolModel(
        responses=[
            AIMessage("", tool_calls=[call("search_resume", {"query": "Go programming language experience"}, 1)]),
            AIMessage(
                "",
                tool_calls=[
                    call("record_evidence", {"requirement_id": "R6", "quote": REAL_QUOTE}, 2),
                    call("record_evidence", {"requirement_id": "R6", "quote": "ten years of Java at Google"}, 3),
                    call("record_evidence", {"requirement_id": "R99", "quote": REAL_QUOTE}, 4),
                ],
            ),
            AIMessage("Checked every requirement."),
        ]
    )
    c = agent_client(model)
    h, resume, job = _setup(c)
    run = _start(c, h, resume, job)

    go = _by_text(run, "Go or Java")
    assert go["status"] == "partial" and go["found_by"] == "investigator"  # upgraded, but never straight to "met"
    assert [e["quote"] for e in go["evidence"]] == [REAL_QUOTE] and go["evidence"][0]["status"] == "verified"
    assert len(run["findings"]) == 1  # the invented quote and the unknown requirement id were both rejected
    assert any(s.startswith("investigate: search_resume") for s in run["steps"])
    assert run["usage"]["llm_calls"] >= 4 and run["usage"]["by_step"][0]["step"] in ("requirements", "assess")


def test_review_pauses_the_run_and_applies_only_approved_rewrites(agent_client):
    c = agent_client(None)  # no tool model: the investigation step is skipped
    h, resume, job = _setup(c)
    run = _start(c, h, resume, job)
    assert run["status"] == "awaiting_review" and not any(s.startswith("investigate") for s in run["steps"])
    first, second = run["proposals"][:2]

    # The paused run is saved: reading it back gives the same proposals.
    again = c.get(f"/api/agent/runs/{run['run_id']}", headers=h).json()
    assert again["status"] == "awaiting_review" and again["proposals"] == run["proposals"]

    r = c.post(
        f"/api/agent/runs/{run['run_id']}/review",
        headers=h,
        json={"decisions": [{"bullet_id": first["bullet_id"], "variant": 0}, {"bullet_id": second["bullet_id"], "variant": None}]},
    )
    assert r.status_code == 200, r.text
    done = r.json()
    assert done["status"] == "done" and [a["bullet_id"] for a in done["applied"]] == [first["bullet_id"]]

    tailored = c.get(f"/api/resumes/{resume['id']}/tailored", headers=h, params={"job_id": job["id"]}).json()
    assert tailored["changed"] == 1
    assert c.post(f"/api/agent/runs/{run['run_id']}/review", headers=h, json={"decisions": []}).status_code == 409


def test_variants_that_add_facts_cannot_be_approved(agent_client):
    c = agent_client(None)
    h, resume, job = _setup(c, "\nINFLATE")
    run = _start(c, h, resume, job)
    p = run["proposals"][0]
    unsafe = next(v for v in p["variants"] if not v["safe"])
    assert unsafe["checks"]["new_numbers"] == ["45"]
    r = c.post(
        f"/api/agent/runs/{run['run_id']}/review",
        headers=h,
        json={"decisions": [{"bullet_id": p["bullet_id"], "variant": unsafe["index"]}]},
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "UNSAFE_VARIANT"
    # Still paused, so the user can choose again.
    assert c.get(f"/api/agent/runs/{run['run_id']}", headers=h).json()["status"] == "awaiting_review"


def test_tool_loop_is_capped(agent_client):
    looping = ScriptedToolModel(responses=[AIMessage("", tool_calls=[call("search_resume", {"query": "Java"}, 1)])])
    c = agent_client(looping)
    h, resume, job = _setup(c)
    run = _start(c, h, resume, job)
    assert sum(s.startswith("investigate") for s in run["steps"]) == 6  # max_tool_rounds
    assert run["status"] == "awaiting_review"  # the run carries on after the cap instead of failing


def test_runs_are_private_to_their_workspace(agent_client):
    c = agent_client(None)
    h, resume, job = _setup(c)
    run = _start(c, h, resume, job)
    other = auth(c)
    assert c.get(f"/api/agent/runs/{run['run_id']}", headers=other).status_code == 404
    assert c.post(f"/api/agent/runs/{run['run_id']}/review", headers=other, json={"decisions": []}).status_code == 404


def test_agent_needs_ai_configured(make_client):
    c = make_client(None)  # NotConfiguredLLM
    c.app.dependency_overrides[get_checkpointer] = lambda: InMemorySaver()
    c.app.dependency_overrides[get_chat_model] = lambda: None
    h, resume, job = _setup(c)
    r = c.post("/api/agent/runs", headers=h, json={"resume_id": resume["id"], "job_id": job["id"]})
    assert r.status_code == 503 and r.json()["error"]["code"] == "AI_NOT_CONFIGURED"
