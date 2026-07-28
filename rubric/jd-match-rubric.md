# jd-match-rubric.md -- you-fit-role scoring

**Date:** <YYYY-MM-DD>
**Status:** UNCALIBRATED. Fill in the `<OWNER: ...>` fields below, then this may
justify a PURSUE verdict subject to the CLAUDE.md gate (owner confirmation still
required; this rubric never self-confirms).
**Method:** score the JD's must-haves against sourced candidate evidence. Score only
against the written anchors. Missing evidence lowers the score and is named, never
invented.

Score each dimension 1-5, sum the four dimensions, then map the result to the
assessment's You-fit-role axis. Dimension 1 has precedence. Recency is a soft tilt,
never a disqualifier.

**Evidence sources.** Only sources you name here make a fact "sourced" -- for
example:

1. Your own resume/career-data file (canonical career record, read-only from this
   project). If you keep career data in a separate project or tool, point to it
   here.
2. <OWNER: any other evidence source you want to count, and the rule for when it
   counts -- e.g. research notes only once you've explicitly surfaced them into this
   project or session.>

Anything outside the sources you name is unsourced. Unsourced material never raises
a score, and any figure carried into an assessment follows NO-INVENTED-METRIC (cite
the source or write `[METRIC NEEDED]`).

## 1. JD relevance (precedence)

Scored against the same Tier 1 lanes calibrated into `fit-rubric.md`. One lane
definition serves both instruments; if the lanes are recalibrated there, update
them here in the same pass.

- 5: Core work sits squarely in a Tier 1 lane with sourced must-have coverage.
- 4: Strong sourced overlap covers the majority of must-haves, with limited adjacency.
- 3: Some must-haves are sourced; several are transferable rather than direct.
- 2: Evidence is mostly adjacent, with few direct must-haves.
- 1: Evidence is tangential or generic rather than JD-specific.

**Builder trip-wire (owner-set 2026-07-16).** `fit-rubric.md`'s primary trip-wire --
a safety/AI-titled TPM/PM role whose must-haves are really technical-builder or
eng-leadership work -- also fires on this side. When it fires, dimension 1 **floors
to 1-2 regardless of adjacent evidence**, and the trip-wire is named in the
assessment. Rationale: the owner does not fit a builder role, so adjacency-driven
confidence here would be false confidence carried into TAILOR-1. The trip-wire keys
on the builder ask, not on the word "lead": leading teams that build ML systems, and
owning ML data/metrics/vendor ops, stay in-lane and do not fire it.

## 2. Evidence strength

Judged only against the two sources named above.

- 5: Multiple named, sourced facts directly demonstrate the JD's must-haves.
- 4: At least one strong sourced fact plus supporting evidence is available.
- 3: Relevant evidence exists, but coverage or sourcing is partial.
- 2: Evidence is mostly qualitative, indirect, or weakly sourced.
- 1: No sourced evidence currently supports the must-haves.

A fact the owner believes but cannot trace to `master_cv.md` or surfaced NotebookLM
output scores as unsourced. Name the gap; do not round up.

## 3. Differentiation value

What is rare here, owner-set 2026-07-16, in priority order:

- **Primary edge:** <OWNER: the combination of strengths that few other candidates
  hold together -- name both sides of the pairing and why holding both is rare.>
- **Secondary edge:** <OWNER: your own secondary differentiator, e.g. running your
  own business, or carrying skill from one domain into an adjacent one.>

Score:

- 5: Sourced evidence shows the primary edge -- both ops rigor at scale AND
  safety/integrity domain depth.
- 4: The primary edge is partly sourced, or the secondary edge is sourced and
  materially strengthens the fit for this JD.
- 3: Useful evidence, but common for the role type (strong on one axis only).
- 2: Adds little beyond more directly relevant evidence.
- 1: Redundant or not meaningfully useful for this JD.

The secondary edge supports; it does not carry a 5 on its own.

## 4. Recency (SOFT -- never a disqualifier)

Window owner-set 2026-07-16 at roughly 4 years: ops fundamentals age more slowly
than tooling, and the wider window fairly reflects longer tenures.

- 5: Relevant sourced evidence is from roughly the last 4 years -- current practice.
- 4: Evidence is older than that but still clearly relevant to the JD.
- 3: Evidence is materially older and directly relevant.
- 2: Evidence is materially older and only adjacent.
- 1: Evidence is materially older and tangential. Surface the concern, do not exclude.

Age never gates. A dimension-4 score of 1 is a note in the assessment, never a
reason to withhold a PURSUE.

## Bands to You-fit-role axis

Confirmed as shipped, owner pass 2026-07-16. The dimension-1 floor on Strong is the
load-bearing part: it stops a high total from masking poor JD relevance.

- **Strong:** 17-20 and dimension 1 >= 4 -> 8-10/10.
- **Qualified:** 13-16 -> 6-7/10.
- **Thin:** 9-12 -> 4-5/10.
- **Weak:** 4-8, or dimension 1 = 1 -> 0-3/10.

No target-lane exceptions. Revisit after backtesting, as `fit-rubric.md` was.

## Use in assessments

- Cite this rubric version beside the You-fit-role score.
- Keep the owner-calibrated `fit-rubric.md` as the sole Role-fits-you instrument.
- This rubric is CALIBRATED as of 2026-07-16. The `rubric UNCALIBRATED, capped`
  label no longer applies to it. Verdicts remain owner-confirmed per CLAUDE.md rule 1.
