"""Offline demo "model": rule-based, schema-valid placeholders so the product runs locally without a key.

Not AI, and labelled as such (health reports model "offline-demo"; the UI shows a banner). Every quote it emits is
copied from the passages, so citation verification runs on the real code path.
"""

import re

from pydantic import BaseModel

from app.llm.client import Usage
from app.llm.schemas import (
    Achievement,
    AnswerOut,
    Assessment,
    Citation,
    Claim,
    MatchOut,
    ProfileOut,
    Requirement,
    RequirementsOut,
    RewriteOut,
    SkillEvidence,
    Variant,
)
from app.resume.skills import find_skills
from app.retrieval.search import tokenize

PASSAGE = re.compile(r"\[([PJ]\d+)\] \(([^)]*)\)\n(.*?)(?=\n\n\[[PJ]\d+\] \(|\Z)", re.S)
REQ_LINE = re.compile(r"^\[(R\d+)\] \((must|nice)\) (.+)$", re.M)
WEAK = re.compile(r"^(responsible for|worked on|helped( to)?|assisted( in)?|involved in|tasked with|participated in)\s+", re.I)


def _passages(prompt: str) -> list[tuple[str, str]]:
    return [(m.group(1), m.group(3).strip()) for m in PASSAGE.finditer(prompt)]


def _lines(text: str) -> list[str]:
    return [re.sub(r"^\s*[•●▪■◦‣∙·*-]\s*", "", ln).strip() for ln in text.split("\n") if len(ln.split()) >= 3]


def _quote(line: str, n: int = 12) -> str:
    return " ".join(line.split()[:n])


class OfflineDemoLLM:
    configured = True
    model = "offline-demo"

    def generate(self, *, system: str, prompt: str, schema: type[BaseModel], temperature: float = 0.1, max_output_tokens: int = 4096):
        ps = _passages(prompt)
        lines = [(label, ln) for label, text in ps for ln in _lines(text)]
        if schema is ProfileOut:
            skills, seen = [], set()
            for label, ln in lines:
                for sk in find_skills(ln):
                    if sk not in seen:
                        seen.add(sk)
                        listed = ln.count(",") >= 2
                        skills.append(
                            SkillEvidence(
                                name=sk,
                                category="technical",
                                strength="listed" if listed else "demonstrated",
                                citations=[Citation(passage=label, quote=_quote(ln))],
                            )
                        )
            wins = [(label, ln) for label, ln in lines if re.search(r"\d", ln) and len(ln.split()) > 6][:5]
            out = ProfileOut(
                headline="Profile (offline demo)",
                summary=[Claim(text=ln, kind="stated", citations=[Citation(passage=label, quote=_quote(ln))]) for label, ln in lines[:2]],
                skills=skills,
                achievements=[
                    Achievement(text=ln, has_metric=True, citations=[Citation(passage=label, quote=_quote(ln))]) for label, ln in wins
                ],
                improvement_areas=[],
            )
        elif schema is RequirementsOut:
            reqs = []
            for label, ln in lines:
                if len(ln.split()) < 4 or ln.endswith(":"):
                    continue
                nice = bool(re.search(r"\b(prefer|plus|nice|bonus|ideally)", ln, re.I))
                cat = "skill" if find_skills(ln) else ("experience" if re.search(r"years?|experience", ln, re.I) else "other")
                reqs.append(
                    Requirement(
                        text=ln[:160], kind="nice" if nice else "must", category=cat, citations=[Citation(passage=label, quote=_quote(ln))]
                    )
                )
            out = RequirementsOut(title="Role (offline demo)", company=None, requirements=reqs[:16])
        elif schema is MatchOut:
            assessments = []
            for rid, _kind, text in REQ_LINE.findall(prompt):
                need = set(find_skills(text)) or set(tokenize(text))
                best, best_hit = None, 0
                for label, ln in lines:
                    have = set(find_skills(ln)) | set(tokenize(ln))
                    hit = len(need & have)
                    if hit > best_hit:
                        best, best_hit = (label, ln), hit
                ratio = best_hit / max(1, len(need))
                status = "met" if ratio >= 0.99 and best else ("partial" if best_hit else "missing")
                assessments.append(
                    Assessment(
                        requirement=rid,
                        status=status,
                        explanation=f"Rule-based word overlap: {best_hit} of {len(need)} key terms found.",
                        evidence=[Citation(passage=best[0], quote=_quote(best[1]))] if best and status != "missing" else [],
                        suggestion=None
                        if status == "met"
                        else "If you have this experience, describe it with the same terms the job uses.",
                    )
                )
            out = MatchOut(assessments=assessments, summary=[])
        elif schema is RewriteOut:
            original = prompt.split("Original bullet:\n", 1)[-1].split("\n\n", 1)[0].strip()
            core = WEAK.sub("", original).rstrip(".")
            core = core[:1].upper() + core[1:]
            out = RewriteOut(
                variants=[
                    Variant(text=core, rationale="Removed the duty phrase so the bullet opens with the work itself."),
                    Variant(
                        text=f"{core}, improving [metric] by [X]%",
                        rationale="Adds a placeholder for a result you can fill in if you have one.",
                    ),
                    Variant(text=f"Delivered: {core[:1].lower() + core[1:]}", rationale="Frames the bullet as an outcome."),
                ],
                questions=["What measurable result did this have?"],
            )
        elif schema is AnswerOut:
            q = set(tokenize(prompt.split("Question:", 1)[-1].split("\n", 1)[0]))
            scored = sorted(((len(q & set(tokenize(ln))), label, ln) for label, ln in lines), reverse=True)
            best = [x for x in scored if x[0] > 0][:2]
            out = AnswerOut(
                status="answered" if best else "not_found",
                answer=[Claim(text=ln, kind="stated", citations=[Citation(passage=label, quote=_quote(ln))]) for _, label, ln in best],
            )
        else:
            raise ValueError(f"offline demo can't produce {schema.__name__}")
        return out, Usage(self.model, len(prompt) // 4, 0, 5)
