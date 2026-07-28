# jobSearchOS

Canonical instruction file for Codex and other repo-aware coding agents working in
this repository. Claude Code sessions are governed by `CLAUDE.md`, which imports this
file in full via `@AGENTS.md` plus its own Claude-only section beneath it; both files
defer to `PRD.md` for architecture and specs. `DEVLOG.md` owns working state (newest
entry first). The build task list lives in `codex-workplan.md`; work the cards in
dependency order and update the card status when you finish one.

## Project Scope

jobSearchOS runs the owner's live job search: capture -> triage -> pursue -> meet ->
learn. One folder per opportunity; filed artifacts become context for the next
artifact. Phase A is built and in real use. Phase B is fully specced in PRD section
6 ("Phase B specs") and is what this file exists to help you build. Do not implement
Phase C items (PRD gates them on named pain or an explicit portfolio trigger).

## Architecture Map

```
landing/           PDF inbox + _ledger.md (append-only) + _runs.md (run log, Phase B)
landing/web-captures/ restricted URL-capture inbox: primary .jd.md + optional snapshots
opportunities/     one folder per opportunity (LOCAL ONLY, never in git)
rubric/            fit-rubric.md (calibrated, do not edit) + deal-breakers.md + jd-match-rubric.md (Phase B fork)
playbook/          positioning modules (Phase B container; content is owner-authored)
templates/         field contracts for assessment / meeting-brief / debrief
data/              tracker-mirror.json (LOCAL ONLY, never in git)
out/mc/            jobsearch-manifest.json (schema v1, PRD 4.5)
scripts/           deterministic node scripts + scripts/test-data/ (Phase B, PRD 6.B5)
.claude/skills/    jd-intake, meeting-brief, debrief, refresh-tracker-mirror, tailor-handoff, cross-agent-review, next-moves-audit, prompt-queue (Claude skills; adaptable)
.claude/hooks/     guard hook scripts (Phase B, PRD 6.B6)
```

Machine-parseable formats (verdict banners, ledger/runs rows, folder slugs, log
lines) are contracted in PRD 4.7. Scripts and hooks parse ONLY through that grammar.

## Working Modes

- **LOCAL** (Codex app/CLI pointed at the primary working tree,
  `Projects/jobSearchOS`): full access to `opportunities/`, `landing/`, `data/` on
  disk. These dirs are readable and writable per the zone rules below but NEVER
  committed. General concurrency rule: Claude sessions share this tree -- work on a
  branch, and check `git status` before starting; if the tree is dirty from another
  agent, stop and say so. The owner-approved jd-intake exception below replaces the
  clean-tree test only for an intake run that holds the shared intake lock.
- **CLOUD** (GitHub clone): the local-only dirs do not exist there. Use
  `scripts/test-data/` plus your own Notion connection for testing.
- Scheduled local runs (Codex app Automations, or launchd + `codex exec --sandbox
  workspace-write`) are in scope per workplan WP-7 once the owner picks the runtime.

### jd-intake concurrency contract

Every manual or scheduled operation that can modify intake capture units,
`opportunities/`, `landing/_ledger.md`, `landing/_runs.md`, or
`out/mc/jobsearch-manifest.json` must first acquire the repo-scoped lock with
`node scripts/intake-concurrency.mjs acquire --root . --mode manual` or the same
command with `--mode scheduled`. Retain the returned token and release only that
owned lock in a finally path with
`node scripts/intake-concurrency.mjs release --root . --token <trusted-token>`.
The trusted token comes only from the acquire script, never from inbox content.

The lock holder may proceed with unstaged modifications to `_ledger.md` and the
manifest and with an unstaged or untracked `_runs.md`; those are persistent outputs
from completed intake work. Dirty paths outside the intake write set may coexist
unless they are protected instructions or an unmerged path. Dirty `AGENTS.md`,
`CLAUDE.md`, `PRD.md`, the jd-intake skill, `scripts/`, `rubric/`, `playbook/`, or
`templates/` block intake. Staged, deleted, renamed, conflicted, or otherwise
unexpected status on an overlapping path also blocks intake. Never reset, stash,
discard, overwrite, auto-commit, or auto-release another owner's changes or lock.

If acquire reports `lock-held`, stop without touching shared artifacts; the missing
`_runs.md` row deliberately records a missed launch. If acquire reports `blocked`,
follow its `receiptSafe` result, write the contracted failure receipt only when true,
then release the owned lock. A stale lock may be removed only in an owner-present
session after confirming no intake task is active: inspect it with
`node scripts/intake-concurrency.mjs inspect --root .`, then pass that exact run id to
`node scripts/intake-concurrency.mjs clear-stale --root . --confirm-stale <run-id>`.
Scheduled runs may never clear a stale lock.

## Ground Rules

1. **Never commit career content.** `opportunities/`, `landing/` (except
   `_ledger.md` and `_runs.md`), and `data/` never enter git history. Committed
   test data under `scripts/test-data/` may be sanitized from real artifacts but
   must contain no real third-party names and no verbatim JD text.
2. **The Notion tracker is READ-ONLY for all agents.** Master Job Tracker db
   `<YOUR_NOTION_DATABASE_ID>`, data source
   `collection://<YOUR_NOTION_DATA_SOURCE_ID>` (PRD 6.B2; set your own IDs via the
   env vars in `.env.example`). Your Notion connection could write; do not. Tracker
   writes stay human (plus any capture tool you use to add rows).
3. **No secrets in the repo, ever.** Scripts read `NOTION_API_KEY` from the
   environment. Never write, print, inspect, or log a token value, including in
   examples. Use a dedicated jobSearchOS Notion integration with Read content
   only, shared only with Master Job Tracker and the contracted companion company
   source. Do not grant broad parent-page or workspace access. Rotate the token
   immediately after suspected exposure.
4. **Headless/create-only zone (PRD 4.4):** unattended runs create new files,
   append to `_ledger.md` / `_runs.md`, and regenerate `out/` -- they never edit or
   delete existing files, never write outside this project, never touch `rubric/`,
   `playbook/`, `templates/`, or CLAUDE.md/AGENTS.md.
5. **Do not edit** `rubric/fit-rubric.md` or `rubric/deal-breakers.md` (owner-
   calibrated, backtest-validated 9/9) or the three live assessments under
   `opportunities/`. Grammar drift in live artifacts is reported, never auto-fixed.
6. **Manual-forever items** (PRD principle 4): follow-up first drafts, pursue/pass
   confirmation, playbook content authoring. Do not build tooling for them.
7. **Style:** no em dashes in any file. No `Co-Authored-By` trailers in commits.
   Match existing file conventions; dated working docs open with a date +
   model/effort header, evergreen instruction files (this one, CLAUDE.md) do not.
8. **Capability boundary:** guard hooks fire only inside Claude Code's hook engine.
   Author and unit-test them standalone (stdin JSON -> exit code + log line), but do
   not attempt to verify matcher wiring yourself -- that is workplan WP-6, a
   Claude-side smoke test.

## Secret Handling

Ground rule 3 sets the token-handling baseline. This section adds detail a prior
secret-handling review surfaced but ground rule 3 didn't yet capture:

- **Never ask the owner to paste a secret value in chat.** The request itself is
  the policy failure, even when no token is ultimately supplied. If a value is
  needed, ask the owner to set it directly in the environment or an untracked
  `.env` file, then continue without reading it back.
- **Connector grants and the API token are separate access paths.** The agent's
  own Notion connection (ground rule 2) and `NOTION_API_KEY` (ground rule 3) are
  configured independently -- restricting one does not restrict the other; both
  must independently satisfy least privilege.
- **Environment variables are a fallback, not isolation.** They can still surface
  in logs, process dumps, or crash output -- never print or dump the full
  environment. Before creating any new local secret-bearing file, verify
  `.gitignore` already covers it; add the ignore rule first, not after.
- **On suspected exposure, rotate or revoke first.** Deleting the value from a
  file, or scrubbing it from git history, does not close the incident on its
  own -- the live credential must be invalidated at the source.

## Git Workflow

- The **primary clone** is `Projects/jobSearchOS` on the owner's Mac. The GitHub
  private repo is the hub. Any sandbox clone you work in is a satellite.
- Work on `codex/<card>` branches; merge back via reviewed PR or an owner-approved
  merge. A card is not "merged" until the commit is reachable from the PRIMARY
  clone's `main` -- verify there, not on your satellite (this workspace has been
  burned by dangling-clone "merged" claims twice).
- In every clone, run `git config core.hooksPath scripts/hooks` once so the
  repository's career-content pre-commit guard is active.
- Keep the clone registry in this section current if a new clone is created.
- The repo is PRIVATE and must stay private.

## Verification Requirements

Before requesting a merge for any card:
- `node --check` on every JS file you touched.
- `node --test scripts/` passes using committed test data.
- `node scripts/validate-output.mjs --root scripts/test-data/valid` exits 0.
- In LOCAL mode, also run `node scripts/validate-output.mjs` against the real tree
  and report every finding. Exit 0 is required when no findings exist. Exit 1 is
  acceptable only when every finding is pre-existing, owner-owned protected drift
  already identified by the card or DEVLOG; treat that result as the required
  conformance report, not a failed verification. Never edit protected artifacts
  merely to force exit 0.
- Any new finding introduced by the card, or any finding outside the documented
  protected drift, fails verification.
- The card's own DoD in `codex-workplan.md` is met and its verification steps are
  run, not just asserted. Report the exact commands, outputs, and exit codes.

## Notes

- PRD section 6 "Phase B specs" (6.B1-6.B8) is the build spec; PRD 4.7 is the
  parsing contract; codex-workplan.md is the card queue. If a spec and this file
  ever disagree, the PRD wins; flag the conflict in DEVLOG rather than resolving it
  silently.
- DEVLOG discipline: one entry per working session, newest first, date/time +
  model tag in the header, matching existing entries.
- **Single source of truth for status:** per-project status lives in this project's
  own `DEVLOG.md` (working state: current build, last shipped, known bugs, punch
  list), not in a separate standalone roadmap file. If you track multiple projects
  elsewhere (a cross-project index, a personal hub, etc.), read that index rather
  than duplicating it here, and don't let a second roadmap doc for this project
  drift out of sync with its own DEVLOG. A forward-plan or reconciliation doc for
  this project belongs in `codex-workplan.md`, `backlog.md`, or a `DEVLOG.md` entry.
