---
name: next-moves-audit
description: Report-only follow-through audit of the live pipeline. Surfaces overdue debrief next moves, PURSUE verdicts still awaiting owner confirmation, and completed calls missing a same-day debrief. Use when the owner asks "what's overdue", "what am I dropping", "pipeline check", or "audit my next moves". Never drafts follow-ups and never writes anything.
---

# next-moves-audit

The capture side of the system produces dated commitments (three next moves per
debrief, verdict banners per assessment); nothing else checks whether those dates
passed. This skill is that check. Owner-invoked, on demand only: a scheduled
version would be a Phase C pull-forward (PRD section 6) and needs an explicit
owner decision first.

## Inputs (all read-only)
- `opportunities/*/debrief*.md` -- "Next 3 moves" section: numbered lines shaped
  `<n>. <move> -- by <date>` (templates/debrief.md).
- `opportunities/*/assessment.md` -- verdict banner and Confirmed line, parsed per
  the PRD 4.7 grammar (`^## VERDICT: ...`), never an improvised regex.
- `opportunities/*/meeting-brief*.md` -- evidence a call was scheduled/held.
- `out/mc/jobsearch-manifest.json` -- pendingVerdicts cross-check.
- `data/tracker-mirror.json` when present -- Next Step / Next Step Date fields
  (may be null until the owner adds the properties, workplan WP-8).

## Report (single table + short verdict, nothing else)
1. **Overdue next moves:** every debrief move whose date is before today and has
   no completion evidence in a later artifact. Quote the move line literally
   (SCRIBE), name the folder, days overdue.
2. **Unconfirmed PURSUE:** every `PURSUE (awaiting owner confirmation)` banner
   with no `Confirmed:` line; note age since the assessment date.
3. **Missing debriefs:** every meeting-brief whose call date has passed with no
   same-day debrief file in the folder.
4. **Cross-check drift:** manifest pendingVerdicts vs what the folders actually
   show; report mismatches, never edit either side.
End with the one thing the owner should do first, and dates for the rest.

## Bounds
- Read-only. No file writes, no ledger rows, no manifest regeneration.
- Never draft the follow-up itself (manual forever, PRD principle 4). Name WHAT is
  overdue, not the words to send.
- Missing or ambiguous dates: list under "could not evaluate" and ask
  (ASK-DONT-GUESS); do not infer completion.
