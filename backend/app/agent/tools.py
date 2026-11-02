"""Tools the investigator can call, and the code that runs them.

The schemas (names, arguments, descriptions) are what the model sees. The bodies run here, with the resume loaded from
the database, so the model never gets more than the passages it searches for, and every quote it records is checked
against the resume before it counts.
"""

from langchain_core.tools import tool

from app.grounding import verify_quote
from app.retrieval.search import Candidate, search

SEARCH_K = 4


@tool
def search_resume(query: str) -> str:
    """Search the candidate's resume. Use different words than the requirement (synonyms, related tools, the kind of
    work it implies) to find evidence a first search missed. Returns the best-matching resume passages."""
    raise NotImplementedError("Executed by app.agent.tools.run_tool")


@tool
def record_evidence(requirement_id: str, quote: str) -> str:
    """Record evidence that the resume supports a requirement. quote must be copied word for word from a passage that
    search_resume returned. Only record real support; if you found none, record nothing."""
    raise NotImplementedError("Executed by app.agent.tools.run_tool")


TOOLS = [search_resume, record_evidence]


def run_tool(name: str, args: dict, pool: list[Candidate], embedder, allowed: set[str]) -> str:
    """Run one tool call and return what the model sees. Bad calls get a short error so the model can correct itself."""
    if name == "search_resume":
        query = str(args.get("query", "")).strip()
        if not query:
            return "error: query is empty."
        hits = search(pool, query, embedder, k=SEARCH_K)
        if not hits:
            return "No matching passages."
        return "\n\n".join(f"(page {h.candidate.page_start}, {h.candidate.heading or 'resume'})\n{h.candidate.text}" for h in hits)

    if name == "record_evidence":
        rid = str(args.get("requirement_id", "")).strip()
        if rid not in allowed:
            return f"rejected: {rid or 'that id'} is not one of the requirements you were asked to check ({', '.join(sorted(allowed))})."
        v = verify_quote(str(args.get("quote", "")), {c.id: (c.text, c.page_start, c.page_end) for c in pool}, None)
        if v.status == "unverified":
            return "rejected: that quote is not in the resume. Copy it word for word from a search result, or record nothing."
        return f"recorded ({v.status}) for {rid}."

    return f"error: unknown tool {name}."
