---
name: prompt-queue
description: Maintain and consult the prompts/ queue so the owner never guesses which saved prompt to run next, in which agent, in what order. Use when the owner asks "what do I run next", "which prompt is next", "queue this", "mark that prompt done", or when a session writes a new handoff prompt for a future Codex or Claude session. Also owns handoff-prompt drafting.
---

# prompt-queue

`prompts/_queue.md` is the index: one row per prompt file, with target agent,
dependencies, and status (`pending` | `done` | `superseded`). Sessions write
prompts; this skill keeps them findable, ordered, and honest against reality.

NOT scheduler-safe: this skill edits `prompts/_queue.md` rows in place, which is
outside the headless create-only zone (PRD 4.4). Interactive sessions only.

## Modes

### next (default)
1. Read `prompts/_queue.md` pending rows.
2. Re-verify each candidate against reality BEFORE recommending: current branch and
   `git status`, `codex-workplan.md` card statuses, top DEVLOG entry. A pending
   prompt contradicted by reality is flagged for supersede, never recommended.
3. Report: the single best next prompt (file, target agent, why now), anything
   blocked and on what, anything that looks stale.
4. If the recommended prompt is runnable now, finish with
   `pbcopy < prompts/<file>` and tell the owner which agent to paste it into.

### add / done / supersede
Update the named prompt's row: `add` appends a pending row (file, agent,
depends-on, created date, one-line note); `done` and `supersede` flip status with
a dated note and move the row to the Done / superseded table. Never delete rows.

### handoff
Draft a new handoff prompt for a future session:
1. Re-verify state immediately before writing (cross-agent-review rule: never
   write a handoff from an earlier-in-session snapshot).
2. Write to `prompts/` per the existing naming convention
   (`<agent>-<slug>_<YYYY_MM_DD>.md`, `**Created:** | **Model:**` first line).
   Sanitized: no career content, no third-party names.
3. Register it as a pending row (mode add) in the same pass.

## Bounds
- Read-only against everything except `prompts/`.
- Do not run the recommended prompt yourself; the owner decides when and where.
- If the queue and reality disagree and the cause is not determinable, ask the
  owner instead of guessing a status (ASK-DONT-GUESS).
