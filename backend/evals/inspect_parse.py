"""Print what the parser and checks make of each synthetic resume (a debugging aid). python -m evals.inspect_parse"""

from app.ingest.parsers import parse
from app.resume.checks import run_checks
from app.resume.layout import inspect_pdf, no_layout
from app.resume.sections import parse_resume
from evals.fixtures import names, render


def main() -> None:
    for name in names():
        data, fname = render(name)
        doc = parse(data, fname, 8)
        layout = inspect_pdf(data) if doc.kind == "pdf" else no_layout(len(doc.pages))
        p = parse_resume(doc.pages)
        text = "\n".join(pg.text for pg in doc.pages)
        checks = run_checks(p, layout, text, doc.empty_pages)
        print(f"== {name} ({doc.kind}) name={p.name!r} years={(p.experience_months or 0) / 12:.1f}")
        print("   sections:", [(s.key, s.title) for s in p.sections])
        print("   contact:", {k: v for k, v in p.contact.items() if v})
        print("   entries:", [(e.section, e.header[:50], e.start, e.end) for e in p.entries])
        print("   bullets:", len(p.bullets), [b.text[:40] for b in p.bullets[:3]])
        print("   skills:", p.skills_listed[:8])
        print("   layout:", layout.to_dict())
        print("   checks:", {c["id"]: c["status"] for c in checks})


if __name__ == "__main__":
    main()
