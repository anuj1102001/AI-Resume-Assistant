# Parsing evaluation

Run on 2026-10-21 over 6 synthetic resumes (PDF, two-column PDF and DOCX; see `data/README.md`).
v1 is the original code from the main branch, run unchanged on the same files.

**Caveat:** v2 was developed while looking at these same synthetic files, and the gold labels were written by the same person.
Read these numbers as a regression suite and as the v1-to-v2 change on known cases, not as accuracy on unseen resumes.
A held-out set of real, consented resumes labelled by someone else is the next step.

| Metric | v1 | v2 |
|---|---|---|
| files parsed | 5/6 | 6/6 |
| section precision | 1.0 | 1.0 |
| section recall | 0.577 | 1.0 |
| section f1 | 0.732 | 1.0 |
| name accuracy | 0.5 | 1.0 |
| contact recall | 0.533 | 1.0 |
| roles correct | not extracted | 6/6 |

Per resume:

- `arjun` v1: missed ['experience', 'skills', 'summary']; name 'ARJUN MEHTA'
- `arjun` v2: missed nothing; name 'Arjun Mehta'
- `kavya` v1: format not supported
- `kavya` v2: missed nothing; name 'Kavya Iyer'
- `neha` v1: missed ['interests', 'projects', 'summary']; name 'NEHA KULKARNI'
- `neha` v2: missed nothing; name 'Neha Kulkarni'
- `priya` v1: missed nothing; name 'Priya Raman'
- `priya` v2: missed nothing; name 'Priya Raman'
- `rohan` v1: missed nothing; name 'Rohan Das'
- `rohan` v2: missed nothing; name 'Rohan Das'
- `vikram` v1: missed ['summary']; name 'Vikram Singh'
- `vikram` v2: missed nothing; name 'Vikram Singh'
