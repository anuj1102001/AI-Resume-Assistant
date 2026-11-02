# Agent evaluation

Run on 2026-11-02: the same 74 hand-labelled requirements as `matching.md`, gold requirement lists supplied.
`pipeline` is the first-pass judgement (what /api/match returns); `agent` adds the tool-calling investigation step.
Same caveat as matching.md: synthetic data, labelled by the author. Read it as a regression suite.

| Metric | pipeline | agent |
|---|---|---|
| accuracy | 0.986 | 0.986 |
| evidence precision | 1.0 | 1.0 |
| evidence recall | 1.0 | 1.0 |
| evidence f1 | 1.0 | 1.0 |
| over claim rate | 0.0 | 0.0 |

Cost per resume-job pair (averages):

| | model calls | input tokens | output tokens | model latency (ms) |
|---|---|---|---|---|
| pipeline | 1 | 748 | 1170 | 6629 |
| agent | 3 | 2436 | 1266 | 10224 |

Requirements the investigation changed: 0.
