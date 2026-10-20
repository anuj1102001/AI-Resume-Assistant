# Evaluation data

Everything here is **synthetic**: written for testing, with fictional people, employers and job ads. No real resumes are used.

- `resumes/*.txt` — six resumes in deliberately different styles (heading names, bullet glyphs, date formats, one-page vs two-page,
  a two-column layout, a Word file, and some with problems the checks should catch). `fixtures.py` renders them to PDF/DOCX.
- `resumes.json` — gold labels per resume: sections, contact fields, number of roles, approximate years of experience.
- `jobs/*.txt` — four job descriptions.
- `requirements.jsonl` — gold requirement-level labels: for a (resume, job, requirement), whether the resume meets it
  (`met`, `partial`, `missing`), written by hand from reading both documents.
