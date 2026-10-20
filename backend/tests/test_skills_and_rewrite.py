from app.resume.keywords import keyword_overlap
from app.resume.skills import find_skills, required_years
from app.services.rewrite import validate_variant


def test_skills_match_on_word_boundaries_not_substrings():
    # v1 matched "ai" inside "maintain" and "email"; none of these mention a skill.
    assert find_skills("We maintain our systems and email the wider team, explaining trade-offs.") == {}
    assert set(find_skills("Strong in React.js, Node and PostgreSQL (postgres)")) == {"React", "Node.js", "PostgreSQL"}


def test_aliases_map_to_one_canonical_skill():
    found = find_skills("Deployed on k8s; built RAG with retrieval-augmented generation; used sklearn")
    assert {"Kubernetes", "RAG", "scikit-learn"} <= set(found)
    assert len(found["RAG"]) == 2


def test_ambiguous_short_aliases_need_context():
    assert "Go" not in find_skills("I go to the office on Mondays.")
    assert "Go" in find_skills("Languages: Go, Python, SQL")


def test_required_years():
    assert required_years("4+ years of backend experience; 2 years of Go") == 2
    assert required_years("No experience needed") is None


def test_keyword_overlap_reports_coverage_and_years():
    out = keyword_overlap("Python, SQL and Tableau dashboards", "Need SQL, Python, Power BI. 3+ years.", 30)
    assert [m["skill"] for m in out["matched"]] == ["Python", "SQL"]
    assert out["missing"] == ["Power BI"]
    assert out["coverage"] == round(2 / 3, 3)
    assert out["years_required"] == 3 and out["years_estimated"] == 2.5


def test_rewrite_guardrails_flag_invented_numbers_and_skills():
    resume = "Reduced infrastructure costs for the analytics cluster. Python, AWS."
    checks = validate_variant("Cut costs by 45% using Kubernetes", "Reduced infrastructure costs for the analytics cluster.", resume)
    assert checks["new_numbers"] == ["45"]
    assert checks["new_skills"] == ["Kubernetes"]
    ok = validate_variant(
        "Reduced analytics infrastructure costs by [X]% on AWS", "Reduced infrastructure costs for the analytics cluster.", resume
    )
    assert ok["new_numbers"] == [] and ok["new_skills"] == [] and ok["placeholders"] == ["[X]"]
