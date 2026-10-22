<!-- Template field contract. Created 2026-07-06, Claude Fable 5, effort high.
     Format imported from an external reference system (output-observable
     elements only). Generated assessments copy this structure, not this comment.

     2026-07-14 (Claude Opus 4.8, high): the scores line now matches the PRD 4.7
     machine grammar exactly -- colons after both axes, and Gate carries ONE of the
     three enum values and nothing else, so scripts can parse it. The prose that used
     to live in the Gate field moved to the Gate detail line below it, which is free
     text and is not parsed. PRD 4.7 claimed this template emitted the machine grammar;
     it never did, which is why the three 2026-07-06 assessments failed validation.
     Keep these two lines in this order directly under the banner: validate-output and
     emit-manifest both read the scores line as the line immediately below it. -->


# OPPORTUNITY ASSESSMENT
<role> | <company> | <date> | Rubric: <calibrated | UNCALIBRATED -- verdict capped at EXPLORE>
Playbook: <omit until playbook v1 exists; then Playbook vN.N (date)>

## VERDICT: <PURSUE | EXPLORE | PASS>
Role-fits-you: <n>/10 | You-fit-role: <n>/10 | Gate: <RESOLVED-PASS | RESOLVED-FAIL | UNRESOLVED>
Gate detail: <one-line gate status in free prose: which deal-breakers pass, what is
still open, pointers to the gaps below>

## Verdict in one line
<Two or three sentences. If any hard deal-breaker is unresolved: name it and state
"no tailored materials until <named fact> resolves it.">

## The two scores
| Axis | Score | Read |
|---|---|---|
| Role-fits-you (your rubric: lanes, level, comp, location, mission) | n/10 | <written reason, cites rubric lines> |
| You-fit-role (JD must-haves vs your evidence) | n/10 | <written reason; every claim traces to a source or is marked [METRIC NEEDED]> |

## Red flags and open questions
- <numbered; distinguish "missing from posting" from "present and concerning">

## Gaps to resolve before any further work
1. <the facts that must be named before the gate opens>

## What would flip it to PURSUE
- <conditions>

## What would flip it to PASS
- <conditions>

## Next 3 moves
1. <specific, dated where possible; if verdict is PURSUE: "owner confirms verdict,
   then applies" (name a tailoring session only if a tailoring project is set up;
   see jd-intake step 4)>
