"""Instant keyword view (no AI): which skills a job mentions, and where (if anywhere) the resume shows them."""

from app.resume.skills import find_skills, required_years


def keyword_overlap(resume_text: str, job_text: str, experience_months: int | None) -> dict:
    job = find_skills(job_text)
    res = find_skills(resume_text)
    matched = sorted(k for k in job if k in res)
    missing = sorted(k for k in job if k not in res)
    yrs = required_years(job_text)
    have = round(experience_months / 12, 1) if experience_months else None
    return {
        "job_skills": len(job),
        "matched": [{"skill": k, "mentions_in_resume": len(res[k])} for k in matched],
        "missing": missing,
        "coverage": round(len(matched) / len(job), 3) if job else None,
        "years_required": yrs,
        "years_estimated": have,
        "note": "Exact skill names only, matched on whole words. It doesn't understand synonyms or experience described in other words; the AI match does.",
    }
