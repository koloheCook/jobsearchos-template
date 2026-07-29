# fit-rubric.md -- role-fits-you scoring
**Date:** <YYYY-MM-DD>
**Calibrated:** <YYYY-MM-DD> (owner interview; <YOUR_NAME>)
**Model, effort:** <model, effort>
**Status: UNCALIBRATED.** Fill in every `<OWNER: ...>` field below with your own
target lanes, level, comp floor, location constraints, and mission signals, then
backtest against your own past roles (see `prompts/jobSearchOS_rubric_backtest.md`
and `prompts/backtest_synthesis.md`) before trusting verdicts above EXPLORE
(CLAUDE.md rule 7). Score against written anchors only; nothing inferred from
career data (ASK-DONT-GUESS).

## Target lanes (tiered)
- **Tier 1 (bullseye):** <OWNER: the role shapes, seniority, and domain that are
  your ideal target -- be as specific as your Tier 3 trip-wires below so the two
  can be told apart. Note what Tier 1 explicitly EXCLUDES (e.g. adjacent-looking
  roles with a different core skill requirement).>
- **Tier 2 (adjacent, pursue with a story):** <OWNER: roles that are a genuine but
  secondary fit -- worth pursuing with a positioning story, not a bullseye match.>
- **Tier 3 (trip-wires: plausible-looking but historically wrong for you):**
  1. <OWNER: a role type that has looked promising before but failed on a specific,
     nameable requirement. Name the trip-wire condition precisely, not just a
     keyword, so scoring doesn't fire on the wrong signal.>
  2. <OWNER: a second trip-wire pattern.>
  3. <OWNER: a third trip-wire pattern.>

## Scored axes (role-fits-you, n/10 overall)
| Axis | What 9-10 looks like | What 3-or-less looks like |
|---|---|---|
| Lane fit | Tier 1 | Tier 3 or unlisted (Tier 2 scores mid) |
| Level | <OWNER: your target seniority band and what over/under-leveled looks like> | <OWNER: too junior or too senior, and how you tell> |
| Comp | <OWNER: your comp anchor, e.g. base >= YOUR_TARGET> | Below <YOUR_COMP_FLOOR>, or undisclosed base at a thinly-funded entity |
| Location/remote | <OWNER: your remote/hybrid/commute tolerance> | <OWNER: your hard location exclusions and any relocation exceptions> |
| Mission/domain pull | <OWNER: the kind of mission or domain work that energizes you> | <OWNER: the kind of work that drains you> |

Mission/domain pull midpoint: a role with no mission signal (neutral corporate work,
neither pull nor drain) scores **5**. Document your own convention here once your
backtest establishes it, so it is not re-derived per assessment.

## Flags (surface on the assessment; do NOT gate)
- Weekend or 6th-day work required.
- Entity viability: early or thinly-funded company = higher risk the offer or role does
  not survive (soft flag, not a comp question -- your comp floor already screens
  ability-to-pay).
- Scope mismatch: the role's real scope (IC vs. management) differs materially from its
  title.

## Scoring rules
1. Score against written anchors only; never inflate to fit a preferred story
   (imported: CCv2.7 scoring discipline).
2. The written "read" must cite which anchor produced the score.
3. You-fit-role (the JD-side axis) uses JD must-haves vs sourced evidence; until a
   dedicated in-repo JD-side rubric fork is built, a CCv2.7 session's rubric scoring
   may be referenced read-only.