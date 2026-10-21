---
name: refresh-tracker-mirror
description: 'Refresh the read-only local Master Job Tracker mirror (data/tracker-mirror.json) with the deterministic refresh script. Use when the owner says refresh the tracker, sync from Notion, or the mirror looks stale.'
---

# Refresh Tracker Mirror

Use this skill only to refresh the local, read-only `data/tracker-mirror.json`
mirror. It never writes to Notion or commits the mirror.

1. Confirm that `scripts/refresh-tracker-mirror.mjs` exists. If it does not,
   stop and report that the refresh script is not present in this checkout.
2. Require `NOTION_API_KEY` from the current process environment only. Do not ask
   for, print, write, or inspect a secret file. If it is unavailable, stop and
   report the owner prerequisite: run from the same trusted environment that
   exported `NOTION_API_KEY`.
3. Run `node scripts/refresh-tracker-mirror.mjs` from the repository root.
4. Report the validation summary, including source validation and row count, but
   do not expose tracker content beyond what the local workflow already needs.

The mirror remains local-only. Do not stage, commit, or copy `data/` into a
tracked fixture. The Master Job Tracker stays read-only for every agent.
