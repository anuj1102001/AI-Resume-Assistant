# Matching evaluation

Run on 2026-10-21: 74 requirements across 8 resume-job pairs, hand-labelled (28 met, 14 partial, 32 missing). Synthetic data; see `data/README.md`.

**Caveat:** v2 was developed while looking at these same synthetic files, and the gold labels were written by the same person.
Read these numbers as a regression suite and as the v1-to-v2 change on known cases, not as accuracy on unseen resumes.
A held-out set of real, consented resumes labelled by someone else is the next step.

| Metric | v1 | v2-keywords | v2-llm |
|---|---|---|---|
| coverage | 0.5 | 0.838 | 1.0 |
| accuracy | 0.216 | 0.622 | 0.905 |
| evidence precision | 1.0 | 1.0 | 0.953 |
| evidence recall | 0.095 | 0.738 | 0.976 |
| evidence f1 | 0.174 | 0.849 | 0.965 |
| over claim rate | 0.0 | 0.0 | 0.0 |

Accuracy counts a requirement the method can't assess as wrong; coverage shows how often that happens. Keyword methods
can't judge requirements like "a track record of improving latency" or "a portfolio", which is why the product uses them
only for the instant keyword view and relies on retrieval + model judgement for the match itself.
