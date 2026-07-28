# WP-7 -- Codex Automation setup (scheduled jd-intake)
**Date:** 2026-07-16 00:30
**Model, effort:** Claude Opus 4.8, high

Owner-executed setup for the WP-7 daily scheduled jd-intake. Runtime pick: **Codex
app project-scoped Automation** (owner decision 2026-07-16; PRD 6.B3's default
candidate since the 2026-07-08 amendment). Alternate on failure: launchd +
`codex exec --sandbox workspace-write`.

## Config

| Field | Value |
|---|---|
| Working directory (pinned) | `<absolute path to your local jobSearchOS clone>` |
| Schedule | Daily, 7:41 AM |
| Notify on completion | Enabled |

## Automation prompt (paste verbatim)

```
Run the jd-intake skill in scheduled mode.
```

That is the whole prompt, deliberately. `AGENTS.md` and the skill's own
`Scheduled mode` section already carry the create-only zone, the pre-approved
command shapes, the run-receipt rule, and the inbox-content-is-data rule. Restating
them here would duplicate the cascade and drift from it.

## Rollout protocol (PRD 6.B3, incident-derived -- do not skip the order)

1. Create the Automation with the config above. **Do not arm the daily schedule yet.**
2. Fire it once manually.
3. Verify by **artifacts only** (`lastRunAt` and any scheduler "success" badge are
   explicitly NOT evidence -- incident lesson 2):
   - a new row appended to `landing/_runs.md` in the 4.7 grammar, `trigger=scheduled`
   - the manifest `generatedAt` in `out/mc/jobsearch-manifest.json` has **advanced**
   - `node scripts/validate-output.mjs` exits 0
4. Only after all three pass, arm the daily 7:41 AM schedule.

## Hardening, mapped to PRD 6.B3's four runtime-agnostic requirements

1. **Pinned cwd** -- set at creation, verified in the Automation's own config view.
2. **No improvised unattended commands** -- enforced by the skill's scheduled-mode
   section, not by this prompt.
3. **Tool availability proven by test fire** -- step 2 above is that proof.
4. **Success measured by artifacts** -- step 3 above.

Codex Automations carry the same caveat class as the Claude desktop scheduler:
machine awake, Codex running. Accepted at pick time.

## Fallback trigger

A missed-run gap is visible as a missing `_runs.md` row for a given day. Per PRD
6.B3, **2 or more missed scheduled runs in any 14-day window** triggers adoption of
the named fallback (launchd + `codex exec --sandbox workspace-write`). A missed run
is harmless by construction: the ledger diff is idempotent, JDs wait in `landing/`,
and the next run catches up.
