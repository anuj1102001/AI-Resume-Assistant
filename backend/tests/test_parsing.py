import pytest

from app.ingest.parsers import Page, parse
from app.resume.checks import run_checks
from app.resume.layout import inspect_pdf, no_layout
from app.resume.sections import heading_key, months_between, parse_resume
from evals.fixtures import gold, names, render

GOLD = gold()


def _parse(name):
    data, fname = render(name)
    doc = parse(data, fname, 8)
    layout = inspect_pdf(data) if doc.kind == "pdf" else no_layout(len(doc.pages))
    parsed = parse_resume(doc.pages)
    checks = {c["id"]: c["status"] for c in run_checks(parsed, layout, "\n".join(p.text for p in doc.pages), doc.empty_pages)}
    return parsed, checks


@pytest.mark.parametrize("name", names())
def test_each_synthetic_resume_parses_to_its_gold_labels(name):
    g = GOLD[name]
    parsed, checks = _parse(name)
    keys = [s.key for s in parsed.sections if s.key != "header"]
    assert sorted(keys) == sorted(g["sections"]), keys
    assert parsed.name == g["name"]
    for field in g["contact"]:
        assert parsed.contact[field], f"{field} missing"
    assert sum(1 for e in parsed.entries if e.section == "experience") == g["roles"]
    assert (parsed.experience_months or 0) / 12 >= g["min_years"]
    assert len(parsed.bullets) == g["bullets"]
    for check, status in g.get("expect_checks", {}).items():
        assert checks.get(check) == status, (check, checks.get(check))


@pytest.mark.parametrize(
    "line,key",
    [
        ("PROFESSIONAL EXPERIENCE", "experience"),
        ("Employment History", "experience"),
        ("Skills & Tools", "skills"),
        ("Core Competencies:", "skills"),
        ("Academic Background", "education"),
        ("Licenses & Certifications", "certifications"),
        ("VOLUNTEER WORK", "other"),
        ("Built a Kafka consumer that cut latency", None),
        ("Senior Engineer, Acme — Jan 2020 – Present", None),
    ],
)
def test_heading_detection(line, key):
    assert heading_key(line) == key


@pytest.mark.parametrize(
    "start,end,months",
    [
        ("Jan 2021", "Dec 2021", 12),
        ("2019", "2020", 24),
        ("06/2020", "05/2023", 36),
        ("March 2024", "March 2024", 1),
        ("Dec 2022", "Jan 2022", None),
    ],
)
def test_months_between(start, end, months):
    assert months_between(start, end) == months


def test_overlapping_roles_are_counted_once():
    text = "Experience\nLead, A\nJan 2020 – Dec 2021\n• Did a thing well.\nAdvisor, B\nJan 2021 – Dec 2021\n• Advised on things."
    parsed = parse_resume([Page(1, text)])
    assert parsed.experience_months == 24


def test_glyph_on_its_own_line_and_wrapped_bullets():
    text = "Experience\nEngineer, Acme\nJan 2020 – Present\n•\nBuilt the billing service and moved it to\nPostgreSQL with zero downtime.\n• Wrote tests."
    parsed = parse_resume([Page(1, text)])
    assert [b.text for b in parsed.bullets] == ["Built the billing service and moved it to PostgreSQL with zero downtime.", "Wrote tests."]


def test_two_column_resume_is_read_column_by_column():
    parsed, checks = _parse("rohan")
    exp = next(s for s in parsed.sections if s.key == "experience")
    assert "ML Engineer, Orbit Logistics" in exp.text and "Python, PyTorch" not in exp.text
    assert checks["columns"] == "warn"  # we can read it, but some tracking systems can't
