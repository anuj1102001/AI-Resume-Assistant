"""Deterministic resume parsing: sections, bullets, contact details, roles and date ranges.

No model is involved, so this is fast, free, testable and works without an API key. The LLM later adds meaning
(skills with evidence, requirement matching); this layer gives it clean, located text to work from.

v1 recognised a fixed list of the author's own headings and job titles. This version normalises headings against a
broad synonym table, treats short ALL-CAPS lines as headings, and handles the usual PDF artefacts (bullet glyphs on
their own line, bullets wrapped across lines).
"""

import re
from dataclasses import asdict, dataclass, field
from datetime import date

from app.ingest.parsers import Page

SECTION_SYNONYMS: dict[str, list[str]] = {
    "summary": [
        "summary",
        "professional summary",
        "profile",
        "professional profile",
        "about",
        "about me",
        "objective",
        "career objective",
        "career summary",
        "overview",
    ],
    "experience": [
        "experience",
        "work experience",
        "professional experience",
        "employment",
        "employment history",
        "work history",
        "career history",
        "relevant experience",
        "internships",
        "internship",
        "internship experience",
        "industry experience",
    ],
    "education": [
        "education",
        "academic background",
        "academics",
        "education and training",
        "educational qualifications",
        "qualifications",
        "academic qualifications",
    ],
    "skills": [
        "skills",
        "technical skills",
        "core skills",
        "key skills",
        "core competencies",
        "competencies",
        "technologies",
        "tech stack",
        "tools",
        "tools and technologies",
        "skills and tools",
        "technical proficiencies",
        "areas of expertise",
        "expertise",
    ],
    "projects": [
        "projects",
        "personal projects",
        "academic projects",
        "selected projects",
        "key projects",
        "project experience",
        "portfolio",
    ],
    "certifications": [
        "certifications",
        "certificates",
        "licenses and certifications",
        "licences and certifications",
        "courses",
        "training",
        "courses and certifications",
    ],
    "achievements": ["achievements", "awards", "honors", "honours", "awards and achievements", "accomplishments", "awards and honors"],
    "publications": ["publications", "research", "papers", "research and publications"],
    "volunteering": [
        "volunteering",
        "volunteer experience",
        "volunteer",
        "leadership",
        "leadership and activities",
        "extracurricular activities",
        "extracurriculars",
        "activities",
    ],
    "languages": ["languages", "language skills"],
    "interests": ["interests", "hobbies", "hobbies and interests"],
}
_HEADING_LOOKUP = {re.sub(r"[^a-z]", "", syn): key for key, syns in SECTION_SYNONYMS.items() for syn in syns}

BULLET_CHARS = "•●▪■◦‣∙·–—*-➢➤►"
_BULLET = re.compile(rf"^\s*(?:[{re.escape(BULLET_CHARS)}]|\d{{1,2}}[.)])\s+")

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE = re.compile(r"(?:\+\d{1,3}[ \t-]?)?(?:\(?\d{2,5}\)?[ \t-]?)?\d{3,5}[ \t-]?\d{4,5}")  # never across a line break
LINKEDIN = re.compile(r"(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/in/[A-Za-z0-9_\-%]+/?", re.I)
GITHUB = re.compile(r"(?:https?://)?github\.com/[A-Za-z0-9_\-]+/?", re.I)
URL = re.compile(r"(?:https?://)?(?:www\.)?[a-z0-9-]+\.(?:dev|io|me|com|in|co|site|app|page|portfolio)(?:/[^\s|,]*)?", re.I)

MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}
_MONTH = r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?"
_POINT = rf"(?:{_MONTH}\s*'?\d{{2,4}}|\d{{1,2}}[/.-]\d{{4}}|\d{{4}})"
DATE_RANGE = re.compile(rf"({_POINT})\s*(?:-|–|—|to|until)\s*({_POINT}|present|current|now|today|ongoing)", re.I)


@dataclass
class Section:
    key: str  # canonical key, e.g. "experience"; "header" for the top block; "other" for unknown headings
    title: str  # as written
    text: str
    page: int


@dataclass
class Bullet:
    id: str
    section: str
    text: str
    page: int
    entry: int | None = None


@dataclass
class Entry:
    section: str
    header: str
    start: str | None
    end: str | None
    months: int | None
    bullets: list[str] = field(default_factory=list)


@dataclass
class ParsedResume:
    name: str | None
    contact: dict[str, str | None]
    sections: list[Section]
    bullets: list[Bullet]
    entries: list[Entry]
    skills_listed: list[str]
    experience_months: int | None

    def to_dict(self) -> dict:
        return asdict(self)


def heading_key(line: str) -> str | None:
    """Canonical section key if the line is a section heading, else None."""
    s = line.strip().strip(":").strip()
    if not s or len(s) > 48 or EMAIL.search(s) or DATE_RANGE.search(s):
        return None
    norm = re.sub(r"[^a-z]", "", s.lower().replace("&", "and"))
    if norm in _HEADING_LOOKUP:
        return _HEADING_LOOKUP[norm]
    letters = [c for c in s if c.isalpha()]
    words = s.split()
    if len(letters) >= 4 and 1 <= len(words) <= 4 and all(c.isupper() for c in letters) and not _BULLET.match(s):
        return "other"
    return None


def _parse_point(raw: str, is_end: bool) -> tuple[int, int] | None:
    raw = raw.strip().lower().rstrip(".")
    if raw in ("present", "current", "now", "today", "ongoing"):
        t = date.today()
        return t.year, t.month
    m = re.match(rf"({_MONTH})\s*'?(\d{{2,4}})", raw)
    if m:
        year = int(m.group(2))
        year = year + 2000 if year < 100 else year
        return year, MONTHS[m.group(1)[:3]]
    m = re.match(r"(\d{1,2})[/.-](\d{4})", raw)
    if m:
        return int(m.group(2)), max(1, min(12, int(m.group(1))))
    m = re.match(r"(\d{4})", raw)
    if m:
        return int(m.group(1)), 12 if is_end else 1
    return None


def months_between(start: str, end: str) -> int | None:
    a, b = _parse_point(start, False), _parse_point(end, True)
    if not a or not b:
        return None
    n = (b[0] - a[0]) * 12 + (b[1] - a[1]) + 1
    return n if 0 < n < 600 else None


def _merged_months(entries: list[Entry]) -> int | None:
    """Total months worked, counting overlapping roles once."""
    spans = []
    for e in entries:
        if e.section != "experience" or not e.start or not e.end:
            continue
        a, b = _parse_point(e.start, False), _parse_point(e.end, True)
        if a and b and (b[0] * 12 + b[1]) >= (a[0] * 12 + a[1]):
            spans.append((a[0] * 12 + a[1], b[0] * 12 + b[1]))
    if not spans:
        return None
    spans.sort()
    total, (cs, ce) = 0, spans[0]
    for s, e in spans[1:]:
        if s <= ce + 1:
            ce = max(ce, e)
        else:
            total += ce - cs + 1
            cs, ce = s, e
    return total + ce - cs + 1


def _find_phone(text: str) -> str | None:
    """A phone number with at least 10 digits: on one line if possible, else allowing one wrap (narrow columns)."""
    for candidate in [*text.split("\n"), text.replace("\n", " ")]:
        for m in PHONE.finditer(candidate):
            if sum(c.isdigit() for c in m.group(0)) >= 10:
                return m.group(0).strip()
    return None


def _lines(pages: list[Page]) -> list[tuple[str, int]]:
    out = []
    for p in pages:
        for line in p.text.split("\n"):
            if line.strip():
                out.append((line.strip(), p.number))
    return out


def _split_skills(text: str) -> list[str]:
    items = []
    for line in text.split("\n"):
        line = _BULLET.sub("", line)
        if ":" in line and len(line.split(":", 1)[0].split()) <= 4:
            line = line.split(":", 1)[1]
        for part in re.split(r"[,|;•·/]|\s{2,}", line):
            part = part.strip(" .-–")
            if 1 < len(part) <= 40 and len(part.split()) <= 4:
                items.append(part)
    seen, out = set(), []
    for it in items:
        if it.lower() not in seen:
            seen.add(it.lower())
            out.append(it)
    return out


def parse_resume(pages: list[Page]) -> ParsedResume:
    lines = _lines(pages)
    sections: list[Section] = []
    cur_key, cur_title, cur_lines, cur_page = "header", "", [], lines[0][1] if lines else 1

    def close() -> None:
        if cur_lines or cur_key != "header":
            sections.append(Section(cur_key, cur_title, "\n".join(cur_lines), cur_page))

    for text, page in lines:
        key = heading_key(text)
        if key == "other" and cur_key == "header":
            key = None  # an ALL-CAPS line before the first real heading is the name or a tagline, not a section
        if key:
            close()
            cur_key, cur_title, cur_lines, cur_page = key, text.strip(": "), [], page
        else:
            cur_lines.append(text)
    close()

    # Bullets and role entries.
    bullets: list[Bullet] = []
    entries: list[Entry] = []
    for sec in sections:
        if sec.key in ("header", "skills", "languages", "interests"):
            continue
        pending_glyph = False
        header_buf: list[str] = []
        for raw in sec.text.split("\n"):
            line = raw.strip()
            if line in BULLET_CHARS:  # glyph on its own line: the bullet text is the next line
                pending_glyph = True
                continue
            is_bullet = pending_glyph or bool(_BULLET.match(line))
            pending_glyph = False
            if is_bullet:
                text = _BULLET.sub("", line).strip()
                if entries and entries[-1].section == sec.key:
                    entry_idx = len(entries) - 1
                else:
                    entry_idx = None
                b = Bullet(f"b{len(bullets) + 1}", sec.key, text, sec.page, entry_idx)
                bullets.append(b)
                if entry_idx is not None:
                    entries[entry_idx].bullets.append(b.id)
                header_buf = []
                continue
            # A wrapped bullet continues on the next line. Role headers ("Software Developer, Zoho") are short and
            # capitalised, so only treat a line as a continuation when it clearly is one.
            if bullets and bullets[-1].section == sec.key and not header_buf and not DATE_RANGE.search(line):
                prev = bullets[-1].text
                if (
                    line[:1].islower()
                    or prev.endswith((",", "-", "–", " and", " &", " of", " to", " the", " for", " with"))
                    or (not prev.endswith((".", "!", "?", ")")) and len(line.split()) >= 9)
                ):
                    bullets[-1].text = f"{prev} {line}"
                    continue
            m = DATE_RANGE.search(line)
            if m and sec.key in ("experience", "projects", "education", "volunteering"):
                header = " · ".join([*header_buf, DATE_RANGE.sub("", line).strip(" |,–-")]).strip(" ·")
                entries.append(Entry(sec.key, header, m.group(1), m.group(2), months_between(m.group(1), m.group(2))))
                header_buf = []
            else:
                header_buf.append(line)
                if len(header_buf) > 3:
                    header_buf = header_buf[-3:]

    header_text = next((s.text for s in sections if s.key == "header"), "")
    all_text = "\n".join(t for t, _ in lines)
    # URLs often wrap right after a slash ("github.com/\npriyaraman"); rejoin them before matching.
    link_text = re.sub(r"/\n(?=\S)", "/", all_text)
    contact = {
        "email": (m.group(0) if (m := EMAIL.search(all_text)) else None),
        "phone": _find_phone(header_text or all_text[:400]),
        "linkedin": (m.group(0) if (m := LINKEDIN.search(link_text)) else None),
        "github": (m.group(0) if (m := GITHUB.search(link_text)) else None),
    }
    name = None
    for line in header_text.split("\n")[:3]:
        cand = line.strip()
        words = cand.split()
        if (
            2 <= len(words) <= 5
            and not any(ch.isdigit() for ch in cand)
            and "@" not in cand
            and sum(c.isalpha() or c in " .'-" for c in cand) / len(cand) > 0.9
        ):
            name = cand.title() if cand.isupper() else cand
            break

    skills = _split_skills("\n".join(s.text for s in sections if s.key == "skills"))
    return ParsedResume(name, contact, sections, bullets, entries, skills, _merged_months(entries))
