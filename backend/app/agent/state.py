"""What the agent carries between steps (saved in every checkpoint) and what it gets at run time (never saved)."""

import operator
from dataclasses import dataclass
from typing import Annotated, Any, TypedDict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

from app.config import Settings
from app.db import Database
from app.llm.client import LLM
from app.retrieval.embeddings import Embedder


class AgentState(TypedDict, total=False):
    resume_id: str
    job_id: str | None
    propose_rewrites: bool

    requirements: list[dict]  # {id, text, kind, category, citations}
    passages: dict[str, str]  # passage label (P1, P2...) -> resume chunk id, so citations can be checked after a reload
    assessments: list[dict]
    grounding: dict

    # Investigation: a tool-calling loop over the requirements still marked missing.
    investigating: list[str]
    messages: Annotated[list[AnyMessage], add_messages]
    findings: list[dict]

    score: dict
    proposals: list[dict]
    decisions: list[dict]
    applied: list[dict]

    # Appended to by every step: one entry per model call, and one line per step for the run log.
    usage: Annotated[list[dict], operator.add]
    steps: Annotated[list[str], operator.add]


@dataclass
class AgentContext:
    """Run-time dependencies. Passed on every invoke and resume; not stored in checkpoints."""

    db: Database
    settings: Settings
    llm: LLM
    embedder: Embedder
    ws_id: str
    chat_model: BaseChatModel | None = None  # tool-calling model; None skips the investigation step
    max_investigated: int = 4  # requirements the investigator looks at, must-haves first
    max_tool_rounds: int = 6  # model turns in the investigation loop before it is stopped
    max_rewrites: int = 3


def usage_entry(step: str, model: str, input_tokens: int, output_tokens: int, latency_ms: int) -> dict[str, Any]:
    return {"step": step, "model": model, "input_tokens": input_tokens, "output_tokens": output_tokens, "latency_ms": latency_ms}
