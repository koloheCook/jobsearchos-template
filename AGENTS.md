# jobSearchOS

Canonical instruction file for Codex and other repo-aware coding agents working in this
repository. Claude Code sessions are governed by `CLAUDE.md`, which imports this file in full
via `@AGENTS.md` plus its own Claude-only section beneath it; both files defer to `PRD.md` for
architecture. Keep your own working notes in `DEVLOG.md` (newest entry first) if you use one.

## Project Scope

jobSearchOS runs a live job search: capture -> triage -> pursue -> meet -> learn. One folder
per opportunity; filed artifacts become context for the next artifact. The triage + brief +
debrief loop is the built, load-bearing core; anything beyond it (a scheduled digest, a
transcript pipeline) is optional and gated on real need.

## Architecture Map

```
landing/           PDF inbox + _ledger.md (append-only) + _runs.md (run log)
landing/web-captures/ restricted URL-capture inbox: primary .jd.md + optional snapshots
opportunities/     one folder per opportunity (LOCAL ONLY, never in git)
rubric/            fit-rubric.md + deal-breakers.md + jd-match-rubric.md (you calibrate)
playbook/          positioning modules (you author the content)
templates/         field contracts for assessment / meeting-brief / debrief
data/              tracker-mirror.json (LOCAL ONLY, never in git)
out/mc/            jobsearch-manifest.json (schema v1, PRD 4.5)
scripts/           deterministic node scripts + scripts/test-data/ (validator fixtures)
.claude/skills/    jd-intake, meeting-brief, debrief, refresh-tracker-mirror, tailor-handoff, cross-agent-review, next-moves-audit, prompt-queue (mirrored in .agents/skills/)
.claude/hooks/     guard hook scripts (mirrored in .codex/hooks/)
```

Machine-parseable formats (verdict banners, ledger/runs rows, folder slugs, log
lines) are contracted in PRD 4.7. Scripts and hooks parse ONLY through that grammar.

## Working Modes

- **LOCAL** (an agent pointed at your on-disk working tree): full access to `opportunities/`,
  `landing/`, `data/` on disk. These dirs are readable and writable per the zone rules below
  but NEVER committed. Concurrency rule: a session that changes committed files (code, docs,
  instructions) works in its own git worktree on its own branch, not in the shared tree
  (Claude Code does this by default; other agents can use their worktree mode or
  `git worktree add ../<repo>-wt/<task> -b <agent>/<task>`). A session that must write live
  data in the shared tree first runs `node scripts/write-preflight.mjs --root . <paths>`
  naming every path it will write, and stops only on `blocked`. Dirt elsewhere in the tree is
  another session's and is not a reason to stop. jd-intake uses its own lock below instead.
- **CLOUD** (a GitHub clone): the local-only dirs do not exist there. Use
  `scripts/test-data/` plus your own Notion connection for testing.

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
2. **The Notion tracker is READ-ONLY for all agents.** Set your Master Job Tracker
   database id and data source id via the env vars in `.env.example` (never hardcode
   them here). Your Notion connection could write; do not. Tracker writes stay human
   (plus any capture tool you use to add rows).
3. **No secrets in the repo, ever.** Scripts read `NOTION_API_KEY` from the
   environment. Never write, print, inspect, or log a token value, including in
   examples. Use a dedicated jobSearchOS Notion integration with Read content
   only, shared only with the Master Job Tracker and the contracted companion company
   source. Do not grant broad parent-page or workspace access. Rotate the token
   immediately after suspected exposure.
4. **Headless/create-only zone (PRD 4.4):** unattended runs create new files,
   append to `_ledger.md` / `_runs.md`, and regenerate `out/` -- they never edit or
   delete existing files, never write outside this project, never touch `rubric/`,
   `playbook/`, `templates/`, or CLAUDE.md/AGENTS.md.
5. **Do not edit** `rubric/fit-rubric.md` or `rubric/deal-breakers.md` once you have
   calibrated them, or any live assessment under `opportunities/`. Grammar drift in
   live artifacts is reported, never auto-fixed.
6. **Manual-forever items** (PRD principle 4): follow-up first drafts, pursue/pass
   confirmation, playbook content authoring. Do not build tooling for them.
7. **Style:** no em dashes in any file. No `Co-Authored-By` trailers in commits.
   Match existing file conventions; dated working docs open with a date +
   model/effort header, evergreen instruction files (this one, CLAUDE.md) do not.
8. **Capability boundary:** guard hooks fire only inside Claude Code's hook engine.
   Author and unit-test them standalone (stdin JSON -> exit code + log line), then
   verify matcher wiring with a Claude-side smoke test rather than assuming it.

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

- Work on feature branches; merge back via reviewed PR or an approved merge. A
  change is not "merged" until the commit is reachable from the canonical repo's
  `main` -- verify there, not on a satellite clone (dangling-clone "merged" claims
  are a known trap).
- In every clone, run `git config core.hooksPath scripts/hooks` once so the
  repository's career-content pre-commit guard is active.
- Keep the repo PRIVATE if it holds anything you would not publish.

## Verification Requirements

Before requesting a merge for any change:
- `node --check` on every JS file you touched.
- `node --test scripts/` passes using committed test data.
- `node scripts/validate-output.mjs --root scripts/test-data/valid` exits 0.
- In LOCAL mode, also run `node scripts/validate-output.mjs` against the real tree
  and report every finding. Exit 0 is required when no findings exist. Exit 1 is
  acceptable only when every finding is pre-existing, owner-owned protected drift;
  treat that result as the required conformance report, not a failed verification.
  Never edit protected artifacts merely to force exit 0.
- Any new finding introduced by the change, or any finding outside the documented
  protected drift, fails verification. Report the exact commands, outputs, and exit codes.

## Notes

- PRD 4.7 is the parsing contract. If a spec and this file ever disagree, the PRD
  wins; flag the conflict rather than resolving it silently.
- Keep per-project status in this project's own `DEVLOG.md` (working state: current
  build, last shipped, known bugs, punch list), not in a separate standalone roadmap
  file that can drift out of sync with it.
