import re


def normalize(text: str):

    return re.sub(
        r"[^a-z0-9#+.]",
        " ",
        text.lower()
    )


def extract_resume_skills(summary):

    return {
        skill.lower()
        for skill in summary.get("skills", [])
    }


def extract_job_keywords(job_description):

    job = normalize(job_description)

    keywords = {
        "python",
        "java",
        "sql",
        "javascript",
        "html",
        "css",
        "django",
        "react",
        "react.js",
        "mysql",
        "postgresql",
        "mongodb",
        "aws",
        "azure",
        "gcp",
        "docker",
        "kubernetes",
        "git",
        "linux",
        "fastapi",
        "flask",
        "langchain",
        "rag",
        "llm",
        "transformers",
        "machine learning",
        "deep learning",
        "tensorflow",
        "pytorch",
        "opencv",
        "numpy",
        "pandas",
        "scikit-learn",
        "prompt engineering",
        "data annotation",
        "ai",
        "genai"
    }

    found = set()

    for keyword in keywords:

        if keyword in job:
            found.add(keyword)

    return found


def calculate_match(summary, job_description):

    resume_skills = extract_resume_skills(summary)

    job_keywords = extract_job_keywords(job_description)

    matched = sorted(
        resume_skills.intersection(job_keywords)
    )

    missing = sorted(
        job_keywords - resume_skills
    )

    if len(job_keywords) == 0:

        score = 0

    else:

        score = round(
            len(matched) / len(job_keywords) * 100
        )

    if score >= 80:

        recommendation = (
            "Excellent match for this position."
        )

    elif score >= 60:

        recommendation = (
            "Good match with a few missing skills."
        )

    elif score >= 40:

        recommendation = (
            "Moderate match. Upskilling recommended."
        )

    else:

        recommendation = (
            "Low match. Candidate lacks several required skills."
        )

    return {
        "score": score,
        "matched": matched,
        "missing": missing,
        "recommendation": recommendation
    }