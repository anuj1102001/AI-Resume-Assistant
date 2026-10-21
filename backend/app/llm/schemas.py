"""Structured outputs requested from the model."""

from typing import Literal

from pydantic import BaseModel, Field


class Citation(BaseModel):
    passage: str = Field(description="The passage label exactly as given, e.g. P3 or J2.")
    quote: str = Field(description="A short verbatim quote (4-25 words) copied exactly from that passage.")


class Claim(BaseModel):
    text: str
    kind: Literal["stated", "inferred"] = Field(description="stated: the resume says this directly. inferred: your judgement.")
    citations: list[Citation] = Field(default_factory=list)


# ---- Resume profile -------------------------------------------------------------------------------------------------


class SkillEvidence(BaseModel):
    name: str = Field(description="The skill, named as the resume names it.")
    category: Literal["technical", "tool", "domain", "people"]
    strength: Literal["demonstrated", "listed"] = Field(
        description="demonstrated: used in a described piece of work. listed: only named in a skills list."
    )
    citations: list[Citation]


class Achievement(BaseModel):
    text: str = Field(description="The achievement in plain words.")
    has_metric: bool = Field(description="True only if the resume gives a number for it.")
    citations: list[Citation]


class ProfileOut(BaseModel):
    headline: str = Field(
        description="A one-line, factual description of the candidate's profile, e.g. 'Backend engineer, 3 years, payments'."
    )
    summary: list[Claim] = Field(description="2-4 claims: what this person does, at what level, in which domain.")
    skills: list[SkillEvidence]
    achievements: list[Achievement] = Field(description="The 3-6 strongest achievements.")
    improvement_areas: list[Claim] = Field(
        description="2-4 places where the resume undersells or leaves out evidence. Inferred, but cite the passage concerned."
    )


# ---- Job requirements -----------------------------------------------------------------------------------------------


class Requirement(BaseModel):
    text: str = Field(description="One requirement, rephrased as a short, checkable statement.")
    kind: Literal["must", "nice"] = Field(description="must: required. nice: preferred, a plus, or bonus.")
    category: Literal["skill", "experience", "education", "domain", "other"]
    citations: list[Citation] = Field(description="Where the job description states it (J passages).")


class RequirementsOut(BaseModel):
    title: str = Field(description="The job title, as written.")
    company: str | None = Field(default=None, description="The hiring company if named, else null.")
    seniority: str | None = None
    requirements: list[Requirement] = Field(description="8-20 distinct requirements. Merge duplicates; skip perks and boilerplate.")


# ---- Match ----------------------------------------------------------------------------------------------------------


class Assessment(BaseModel):
    requirement: str = Field(description="The requirement label exactly as given, e.g. R4.")
    status: Literal["met", "partial", "missing"] = Field(
        description="met: the resume clearly shows it. partial: related or weaker evidence. missing: nothing in the passages supports it."
    )
    explanation: str = Field(description="One or two sentences explaining the judgement, naming what the resume shows or lacks.")
    evidence: list[Citation] = Field(
        default_factory=list, description="Resume passages (P labels) that support the judgement. Empty when missing."
    )
    suggestion: str | None = Field(
        default=None,
        description="If partial or missing: what the candidate could truthfully add or make clearer, if they have the experience. Never suggest claiming experience they don't have.",
    )


class MatchOut(BaseModel):
    assessments: list[Assessment]
    summary: list[Claim] = Field(description="2-3 claims on overall fit, strongest matches and biggest gaps.")


# ---- Rewrite --------------------------------------------------------------------------------------------------------


class Variant(BaseModel):
    text: str = Field(description="The rewritten bullet exactly as it would appear on the resume, with no citation or notes.")
    rationale: str = Field(description="What changed and why, in one sentence.")


class RewriteOut(BaseModel):
    variants: list[Variant] = Field(description="Exactly 3 alternatives, different in emphasis.")
    questions: list[str] = Field(
        default_factory=list,
        description="Up to 2 questions whose answers would make the bullet stronger (e.g. 'How many users did this serve?').",
    )


# ---- Q&A ------------------------------------------------------------------------------------------------------------


class AnswerOut(BaseModel):
    status: Literal["answered", "partial", "not_found"]
    answer: list[Claim]
    follow_ups: list[str] = Field(default_factory=list)
