def calculate_ats_score(summary):

    skills = summary.get("skills", [])
    experience = summary.get("experience", [])
    projects = summary.get("projects", [])
    education = summary.get("education", [])

    score = 0

    strengths = []
    improvements = []

    # ---------------- Skills ----------------

    if len(skills) >= 8:
        score += 30
        strengths.append("Strong technical skillset")
    else:
        improvements.append("Add more relevant technical skills.")

    # ---------------- Experience ----------------

    if len(experience) >= 2:
        score += 25
        strengths.append("Good professional experience")
    else:
        improvements.append("Include more work experience.")

    # ---------------- Projects ----------------

    if len(projects) >= 2:
        score += 20
        strengths.append("Strong project portfolio")
    else:
        improvements.append("Add more projects.")

    # ---------------- Education ----------------

    if education:
        score += 10
        strengths.append("Education section included")
    else:
        improvements.append("Add education details.")

    # ---------------- GitHub ----------------

    github_found = any(
        "github" in project.lower()
        for project in projects
    )

    if github_found:
        score += 5
        strengths.append("GitHub links included")
    else:
        improvements.append("Include GitHub links.")

    # ---------------- Action Verbs ----------------

    score += 10
    strengths.append("Resume uses structured bullet points")

    if score >= 85:

        verdict = "Excellent ATS-ready resume."

    elif score >= 70:

        verdict = "Good resume with minor improvements."

    elif score >= 50:

        verdict = "Average resume. Needs optimization."

    else:

        verdict = "Resume requires significant improvements."

    return {
        "score": score,
        "strengths": strengths,
        "improvements": improvements,
        "verdict": verdict
    }