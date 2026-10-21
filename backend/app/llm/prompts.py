"""Prompts, versioned. Bump PROMPT_VERSION whenever wording changes: cached analyses are keyed on it."""

PROMPT_VERSION = "2026-10-21.3"

RULES = """Rules:
- Use only the passages provided. Never add experience, skills, employers, titles, dates or numbers that the passages don't contain.
- Support claims with citations: the passage label and a short quote copied word for word from it.
- "stated" means the passage says it; anything you judge, combine or interpret is "inferred".
- Be specific and plain. No flattery, no clichés ("results-driven", "passionate", "synergy")."""

SYSTEM = (
    "You are Shortlist, an honest career assistant. You help people show their real experience clearly and match it to jobs. "
    "You never invent or inflate experience, because a resume that overclaims hurts the candidate in interviews.\n\n" + RULES
)


def block(passages: list[tuple[str, str, str]]) -> str:
    return "\n\n".join(f"[{label}] ({loc})\n{text}" for label, loc, text in passages)


def profile_prompt(passages) -> str:
    return f"""Read this resume and build a profile:
- headline and summary: who this is professionally, at what level.
- skills: every skill or tool, marked "demonstrated" if a described piece of work uses it, "listed" if it only appears in a skills list. Cite where.
- achievements: the strongest 3-6, with has_metric true only if the resume gives a number.
- improvement_areas: where the resume undersells real work (vague bullets, results without outcomes, skills listed but never shown in use).

Resume passages:
{block(passages)}"""


def requirements_prompt(job_passages) -> str:
    return f"""Extract the requirements from this job description.
Each requirement must be one checkable thing (split "Python and SQL" into two). Mark "must" for required or essential items and "nice" for
preferred, bonus or "a plus". Include years-of-experience and education requirements. Ignore benefits, perks and company boilerplate.
Cite the J passage where each requirement appears.

Job description passages:
{block(job_passages)}"""


def match_prompt(requirements: list[tuple[str, str, str]], resume_passages) -> str:
    reqs = "\n".join(f"[{label}] ({kind}) {text}" for label, kind, text in requirements)
    return f"""Judge how well the resume meets each job requirement. Assess every requirement exactly once, using its label.
- met: the resume clearly shows it (directly, or through clearly equivalent experience; explain the equivalence).
- partial: related but weaker or indirect evidence.
- missing: the passages don't support it. Do not assume.
Evidence must cite resume passages (P labels) with exact quotes. Suggestions must only ask the candidate to make real experience visible.

Requirements:
{reqs}

Resume passages (the parts most relevant to these requirements):
{block(resume_passages)}"""


def rewrite_prompt(bullet: str, context: str, job: str | None) -> str:
    target = f"\nTailor it towards this role, emphasising what's relevant (without adding anything untrue):\n{job[:3000]}\n" if job else ""
    return f"""Rewrite this resume bullet three ways. Each version should open with a strong action verb, lead with the result where the
original states one, and stay under 30 words.
Hard rules:
- Keep every fact, number, tool and name from the original. Do not add numbers, metrics, tools, team sizes or outcomes it doesn't state.
- If a number would make it stronger but the original has none, write a placeholder in square brackets, e.g. "[X]%", and ask about it in questions.
- Each version's text is only the bullet as it would appear on the resume: no citations, passage labels, quotes of the original or notes.
{target}
Original bullet:
{bullet}

Surrounding context from the resume (for understanding only; don't import facts from it unless they're about this same work):
{context}"""


def answer_prompt(question: str, passages, history: list[tuple[str, str]], job_passages=None) -> str:
    convo = "\n".join(f"{role}: {text}" for role, text in history[-6:])
    if job_passages:
        return f"""Answer the question using the resume passages (labels P1, P2...) and the job description passages (J1, J2...).
- Facts about the candidate must cite P passages; facts about the role must cite J passages. Quote word for word.
- Comparing the two (what the job asks that the resume does or doesn't show) is a judgement: mark those claims "inferred" and cite both.
- General career advice that neither document supports is allowed only if the question asks for it: mark it "inferred" with no citations.
- If the documents don't contain what's needed, set status not_found. Never suggest claiming experience the resume doesn't show.

{f"Conversation so far:{chr(10)}{convo}{chr(10)}{chr(10)}" if convo else ""}Question: {question}

Resume passages:
{block(passages)}

Job description passages:
{block(job_passages)}"""
    return f"""Answer the question about this resume using only the passages. If they don't contain the answer, set status not_found.

{f"Conversation so far:{chr(10)}{convo}{chr(10)}{chr(10)}" if convo else ""}Question: {question}

Resume passages:
{block(passages)}"""
