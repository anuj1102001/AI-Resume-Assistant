"""Readability checks: concrete, explainable and deterministic.

Each check says what it found, why it matters, the exact lines involved and how to fix it. There is deliberately no
single "ATS score": applicant tracking systems differ, none publishes how it ranks, and a number would promise a
precision we can't back up. v1 reported a score out of 100 that included 10 points given to every resume.
"""

import re
from dataclasses import asdict, dataclass, field

from app.resume.layout import Layout
from app.resume.sections import ParsedResume

ACTION_VERBS = set(
    """achieved analysed analyzed architected automated built championed coached collaborated conceived consolidated created cut
    decreased defined delivered deployed designed developed devised directed doubled drove eliminated enabled engineered established
    evaluated expanded facilitated founded generated grew guided halved hired identified implemented improved increased initiated
    integrated introduced launched led maintained managed mentored migrated modernised modernized negotiated optimised optimized
    orchestrated organised organized owned partnered pioneered planned presented prioritised prioritized produced programmed
    prototyped published ran re-architected rebuilt reduced redesigned refactored released researched resolved restructured revamped
    saved scaled shipped simplified spearheaded standardised standardized streamlined strengthened supervised taught tested trained
    transformed tripled unified upgraded wrote""".split()
)
WEAK_OPENERS = (
    "responsible for",
    "worked on",
    "helped",
    "assisted",
    "involved in",
    "duties included",
    "tasked with",
    "participated in",
    "handled",
    "was part of",
)
PERSONAL = re.compile(
    r"\b(date of birth|d\.?o\.?b\.?|marital status|married|unmarried|gender|religion|nationality|father'?s name|mother'?s name|caste|blood group)\b",
    re.I,
)
PRONOUN = re.compile(r"\b(I|me|my|myself)\b")
NUMBER = re.compile(r"\d")


@dataclass
class Evidence:
    text: str
    page: int | None = None


@dataclass
class Check:
    id: str
    title: str
    status: str  # "pass" | "warn" | "fail" | "info"
    found: str
    why: str
    fix: str | None = None
    evidence: list[Evidence] = field(default_factory=list)


def _first_word(text: str) -> str:
    words = text.split()
    return re.sub(r"[^a-z-]", "", words[0].lower()) if words else ""


def _ev(bullets, limit: int = 5) -> list[Evidence]:
    return [Evidence(b.text, b.page) for b in bullets[:limit]]


def run_checks(parsed: ParsedResume, layout: Layout, text: str, empty_pages: list[int]) -> list[dict]:
    checks: list[Check] = []
    keys = {s.key for s in parsed.sections}
    work_bullets = [b for b in parsed.bullets if b.section in ("experience", "projects", "volunteering")]

    # 1. Can the text be read at all?
    if len(text) < 400 or empty_pages:
        checks.append(
            Check(
                "readable",
                "Text can be extracted",
                "fail" if len(text) < 400 else "warn",
                f"{len(text)} characters of text"
                + (f"; page(s) {', '.join(map(str, empty_pages))} have no selectable text" if empty_pages else ""),
                "Tracking systems read the text layer. Text that's an image (a scan, or a design exported as a picture) is invisible to them.",
                "Export the resume as a PDF from Word, Google Docs or your design tool, not as a scan or image.",
            )
        )
    else:
        checks.append(
            Check(
                "readable",
                "Text can be extracted",
                "pass",
                f"{len(text):,} characters of selectable text on {layout.pages} page(s)",
                "Tracking systems read the text layer, and yours has one.",
            )
        )

    # 2. Contact details
    c = parsed.contact
    missing = [k for k in ("email", "phone") if not c.get(k)]
    checks.append(
        Check(
            "contact",
            "Contact details",
            "warn" if missing else "pass",
            ("Missing: " + " and ".join(missing))
            if missing
            else "Email and phone found" + (", plus LinkedIn" if c.get("linkedin") else ""),
            "Recruiters need a way to reach you, and some systems file a resume under its email address.",
            "Put your email and phone number as plain text at the top (not inside a header, footer or image)." if missing else None,
        )
    )

    # 3. Standard headings
    core = {"experience": "Experience", "education": "Education", "skills": "Skills"}
    absent = [label for k, label in core.items() if k not in keys]
    unknown = [s.title for s in parsed.sections if s.key == "other"]
    status = "warn" if absent else ("info" if unknown else "pass")
    found = (
        "Found " + ", ".join(s.title for s in parsed.sections if s.key not in ("header", "other"))
        if len(parsed.sections) > 1
        else "No section headings recognised"
    )
    checks.append(
        Check(
            "headings",
            "Standard section headings",
            status,
            found + (f". Unrecognised: {', '.join(unknown)}" if unknown else ""),
            "Tracking systems sort your text into fields by its headings. Familiar names (Experience, Education, Skills) are the most reliably understood.",
            (f"Add or rename sections so these are clearly labelled: {', '.join(absent)}." if absent else "")
            + (f" Consider standard names instead of: {', '.join(unknown)}." if unknown else "")
            or None,
        )
    )

    # 4. Layout
    if layout.multi_column_pages:
        checks.append(
            Check(
                "columns",
                "Single-column layout",
                "warn",
                f"Two or more columns on page(s) {', '.join(map(str, layout.multi_column_pages))}",
                "Some systems read straight across the page, so text from side-by-side columns can be merged out of order.",
                "Use one column for the main content. A narrow sidebar for contact details is lower risk than two columns of experience.",
            )
        )
    elif layout.pages and layout.fonts:
        checks.append(
            Check("columns", "Single-column layout", "pass", "Content flows in one column", "Text is read in the order you wrote it.")
        )
    if layout.tables or layout.images:
        parts = ([f"{layout.tables} table(s)"] if layout.tables else []) + ([f"{layout.images} image(s)"] if layout.images else [])
        checks.append(
            Check(
                "objects",
                "No tables or images holding text",
                "warn",
                "Found " + " and ".join(parts),
                "Text inside tables can be read cell by cell in the wrong order, and text inside images isn't read at all. Photos are also discouraged in many countries to reduce bias.",
                "Replace tables with plain lines of text, and remove photos and skill-level graphics.",
            )
        )

    # 5. Length
    years = (parsed.experience_months or 0) / 12
    if layout.pages > 2:
        checks.append(
            Check(
                "length",
                "Length",
                "warn",
                f"{layout.pages} pages",
                "Recruiters skim; most read the first page closely and the rest briefly.",
                "Aim for one page under ~5 years of experience, two at most beyond that.",
            )
        )
    elif layout.pages == 2 and parsed.experience_months is not None and years < 5:
        checks.append(
            Check(
                "length",
                "Length",
                "info",
                f"2 pages with about {years:.1f} years of experience",
                "With under ~5 years of experience, one page usually holds everything that matters.",
                "Cut older or less relevant bullets to fit one page.",
            )
        )
    elif layout.pages:
        checks.append(Check("length", "Length", "pass", f"{layout.pages} page(s)", "A length recruiters can read in full."))

    # 6. Bullets
    if not work_bullets:
        checks.append(
            Check(
                "bullets",
                "Experience written as bullet points",
                "warn",
                "No bullet points found under Experience or Projects",
                "Bullets make achievements scannable; paragraphs are often skipped.",
                "Describe each role in 3-6 bullets, one achievement each.",
            )
        )
    else:
        long = [b for b in work_bullets if len(b.text.split()) > 35]
        checks.append(
            Check(
                "bullet_length",
                "Bullets are easy to scan",
                "warn" if long else "pass",
                f"{len(long)} of {len(work_bullets)} bullets are longer than 35 words"
                if long
                else f"All {len(work_bullets)} bullets are 35 words or fewer",
                "Long bullets bury the result. Recruiters spend seconds per resume.",
                "Split long bullets, or cut to the action and its result." if long else None,
                _ev(long),
            )
        )
        weak = [b for b in work_bullets if b.text.lower().startswith(WEAK_OPENERS)]
        strong = [b for b in work_bullets if _first_word(b.text) in ACTION_VERBS]
        checks.append(
            Check(
                "openers",
                "Bullets start with what you did",
                "warn" if weak else ("pass" if len(strong) / len(work_bullets) >= 0.5 else "info"),
                (
                    f"{len(weak)} bullet(s) open with duty phrases like “Responsible for”"
                    if weak
                    else f"{len(strong)} of {len(work_bullets)} bullets open with an action verb"
                ),
                "Opening with an action verb (Built, Cut, Led) shows your contribution; “Responsible for” describes the job, not what you achieved.",
                "Rewrite these to start with the action you took. The Improve tab can suggest versions." if weak else None,
                _ev(weak),
            )
        )
        quantified = [b for b in work_bullets if NUMBER.search(b.text)]
        share = len(quantified) / len(work_bullets)
        checks.append(
            Check(
                "numbers",
                "Results are measurable",
                "pass" if share >= 0.4 else ("info" if share >= 0.2 else "warn"),
                f"{len(quantified)} of {len(work_bullets)} bullets include a number",
                "Numbers (time saved, users, revenue, %) make impact concrete and comparable.",
                None
                if share >= 0.4
                else "Add numbers where you genuinely have them: team size, volume, before/after. Never estimate figures you can't back up.",
                _ev([b for b in work_bullets if not NUMBER.search(b.text)], 3) if share < 0.4 else [],
            )
        )
        pron = [b for b in work_bullets if PRONOUN.search(b.text)]
        if pron:
            checks.append(
                Check(
                    "pronouns",
                    "No first-person pronouns",
                    "info",
                    f"{len(pron)} bullet(s) use “I”, “me” or “my”",
                    "Resume convention drops pronouns; it reads tighter.",
                    "Start with the verb: “Led…” rather than “I led…”.",
                    _ev(pron),
                )
            )

    # 7. Personal details that aren't needed
    hits = [line.strip() for line in text.split("\n") if PERSONAL.search(line)]
    if hits:
        checks.append(
            Check(
                "personal",
                "No unnecessary personal details",
                "warn",
                "Found " + ", ".join(sorted({m.group(0).lower() for line in hits for m in [PERSONAL.search(line)] if m})),
                "Date of birth, marital status, religion and similar details aren't needed to judge your work and can invite bias. They're common on Indian resumes but rarely requested.",
                "Remove them unless an application explicitly asks for them.",
                [Evidence(h) for h in hits[:5]],
            )
        )

    # 8. Date formats
    formats = set()
    for e in parsed.entries:
        if e.start:
            formats.add(
                "month name" if re.search(r"[a-z]", e.start, re.I) else ("MM/YYYY" if re.search(r"\d[/.-]\d", e.start) else "year only")
            )
    if len(formats) > 1:
        checks.append(
            Check(
                "dates",
                "Consistent date format",
                "info",
                "Mixed formats: " + ", ".join(sorted(formats)),
                "Consistent dates are easier to scan and parse.",
                "Pick one format, e.g. “Jan 2023 – Present”, and use it everywhere.",
            )
        )

    return [asdict(c) for c in checks]
