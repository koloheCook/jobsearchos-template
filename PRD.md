# jobSearchOS -- architecture overview

A condensed architecture reference for jobSearchOS. This is the doc the operating rules
(`CLAUDE.md`, `AGENTS.md`) defer to; the exact field-level contracts live in `templates/` and
the output validator (`scripts/validate-output.mjs`). The original design PRD carried
owner-specific build history and adjacent-project notes and was condensed for this shareable
template; section numbers cited elsewhere in the repo (4.7, 6.B*) are preserved below.

## 1. What it is

- **User:** a solo operator running a live senior TPM/PM (or similar) job search.
- **Job to be done:** capture roles, triage them before they cost attention, prepare and
  debrief every conversation, keep momentum, and learn across meetings.
- **Win condition:** every live opportunity has a next step with a date; no tailoring hours
  spent on low-fit roles; every scheduled call gets a brief and a same-day debrief.
- **Non-goals / ships no UI:** it does not replace your tracker (an optional Notion Master job
  tracker stays the pipeline ledger) or add a dashboard, networking tool, or transcript
  pipeline. The read surface is your tracker; the agent surface is Claude Code over the
  markdown tree.

## 2. Design principles

1. **One home per opportunity.** Every artifact files back to its opportunity folder and is
   read as context by the next. This loop is the system.
2. **Triage before attention.** New roles get a full assessment with a verdict and a
   deal-breaker gate BEFORE you spend time on them. No tailored materials until a written
   verdict exists and hard deal-breakers are resolved by named facts.
3. **Create-only automation zone.** Headless (scheduled) runs may create folders/files, move
   JDs out of `landing/`, append to the ledger, and regenerate `out/`. They may never edit or
   delete an existing file, write outside the project, or touch `rubric/`, `playbook/`, or
   `templates/`. Unattended writes are safe by construction, not by policy.
4. **Human-judgment steps stay manual forever:** the follow-up first draft, the final
   pursue/pass call, and playbook authoring. There, the judgment IS the artifact.
5. **Objectives written in the brief; the debrief scores them.** The learning loop has a
   durable record or it has nothing.
6. **Career-content privacy by construction.** `opportunities/`, `landing/` content, and
   `data/` never commit. Process, specs, templates, rubric structure, and skills commit
   normally. The never-commit boundary keeps career content out of any remote -- it never
   enters git history.
7. **Guards are enforced, not hoped for.** Generating skills bind named guards (no-invented-
   metric, ask-dont-guess, evidence markers); a number or fact with no source does not appear
   in an output, and the hooks in `.claude/hooks/` (mirrored in `.codex/hooks/`) catch
   violations as you write.
8. **Deterministic-shaped steps become scripts, not LLM calls** (ledger diff, folder scaffold,
   manifest emit, tracker mirror).

## 3. Entities and ground truth

Entities: **Opportunity, Contact, Meeting, Artifact.** Two stores, one rule each:

- **Pipeline STATE** = an optional Notion Master job tracker (see the README's "Connect
  Notion"). The agent reads it through a mirror (one scoped query -> read-only
  `data/tracker-mirror.json`; no polling; the agent never writes the tracker).
- **Opportunity CONTENT** = `opportunities/<company>_<role>_<YYYY-MM-DD>/` on disk: the JD, the
  assessment, meetings (briefs + debriefs), follow-up copies, notes.

Rendered surfaces are read-only projections; edits happen in the store that owns the data.

## 4. System design

### 4.2 Folder layout

```
CLAUDE.md / AGENTS.md   identity + operating rules
PRD.md                  this overview
landing/                INBOX: PDFs at root; web-captures/ = restricted URL inbox
opportunities/          one folder per opportunity (never committed)
  <company>_<role>_<date>/  jd.md, assessment.md, meetings/<date>/brief.md + debrief.md, followups/, notes.md
rubric/                 fit-rubric.md + deal-breakers.md (structure commits; you calibrate)
playbook/               positioning modules (you author; commits)
templates/              field contracts for assessment / meeting-brief / debrief
data/                   tracker-mirror.json (read-only mirror; never committed)
out/                    published surfaces: digest + mc/jobsearch-manifest.json
scripts/                deterministic helpers + the output validator
.claude/skills/         jd-intake, meeting-brief, debrief, ... (mirrored in .agents/skills/)
```

### 4.3 The artifact pipeline

| Artifact | Trigger | Output | Human split |
|---|---|---|---|
| **Intake + triage** (`jd-intake`) | New JD in `landing/` | New opportunity folder + `assessment.md` (`PURSUE/EXPLORE/PASS` banner, two-way fit scores, deal-breaker gate, next moves); ledger line; refreshed manifest | AI runs end to end in the create-only zone; a PURSUE needs your confirmation before tailoring |
| **Tailoring handoff** (`tailor-handoff`) | You invoke after a confirmed PURSUE | Append-only handoff packet + a copy-ready start prompt for a separate downstream tailoring project | You authorize; jobSearchOS never writes into that project |
| **Meeting brief** (`meeting-brief`) | Meeting scheduled | One page: posture, opener, questions, expected key question + beats, a defined ask, traps, walk-out-with list | You set objectives; AI drafts; you rehearse |
| **Debrief** (`debrief`) | Call done, same day | What went well (with evidence), ONE named coaching problem, objectives hit y/n, next moves with dates | You trigger and correct; AI analyzes |
| **Follow-up** | After debrief, before its deadline | Send-ready note; copy filed | You draft first; AI polishes (never a from-scratch generate) |
| **Manifest** | End of any state-changing run | `out/mc/jobsearch-manifest.json` (counts, not content) for an optional dashboard | AI emits; the dashboard reads it one-way |

### 4.4 Write-safety zones

| Zone | May | May never |
|---|---|---|
| Headless (scheduled `jd-intake`) | Create new opportunity folders/files; move a JD out of `landing/`; append to the ledger + run log; regenerate `out/`; hold its own transient lock | Edit or delete an existing file; write outside the project; touch `rubric/`/`playbook/`/`templates/`/`CLAUDE.md`; produce tailored materials; mark its own verdicts confirmed |
| In-session (you present) | Everything above, plus edits with review | Commit `opportunities/` or `landing/` content; write to the Notion tracker; write into other projects |

### 4.5 Manifest contract

`out/mc/jobsearch-manifest.json` (schema v1) carries pipeline COUNTS -- by-stage totals,
overdue items, today's meetings, pending verdicts, new-since-yesterday -- never content. An
external dashboard may read it one-way and compute staleness from `generatedAt`; nothing here
waits on or reads the dashboard. Additive changes only within v1; breaking changes bump the
version.

### 4.6 External seams (all read-only from this side)

| System | Relationship |
|---|---|
| Notion Master job tracker | Optional pipeline ledger; mirror-read only (see README) |
| A browser capture extension | Optional: web/LinkedIn -> a tracker row or a `landing/web-captures/` file; monitoring only |
| A separate tailoring project | Optional downstream; a handoff packet authorizes a manual JD paste into that project's own mirror folder; jobSearchOS never writes into it |
| An external dashboard | Optional one-way consumer of the manifest (4.5), nothing else |

Only the manifest (counts) leaves this project; career content never does.

### 4.7 Artifact line grammar + naming contract

The machine-parseable formats that scripts, hooks, and the validator rely on are
additive-frozen -- new fields may be added; existing shapes never change without bumping the
grammar version in `scripts/validate-output.mjs`. The authoritative definitions live with the
code:

- **Folder slug:** `slug(company)_slug(role)_YYYY-MM-DD` (lowercase; every non-alphanumeric
  run collapses to a single hyphen; collisions append `-2`, `-3`). The same function decides
  folder-pointer matches.
- **Verdict banner:** `## VERDICT: <PURSUE|EXPLORE|PASS>`; scores line directly under it:
  `Role-fits-you: <n>/10 | You-fit-role: <n>/10 | Gate: <RESOLVED-PASS|RESOLVED-FAIL|UNRESOLVED>`.
- **Ledger, run-log, manifest lines, and the guard-hits JSONL** are defined in `templates/`
  and enforced by `scripts/validate-output.mjs`. Run
  `node scripts/validate-output.mjs --root scripts/test-data/valid` (expect exit 0) to see the
  contracts checked against the shipped fixtures.

## 6. Phases (build roadmap)

Phase A -- the triage + brief + debrief loop in section 4 -- is **built and in real use**. The
rest is a roadmap a fork can ignore or build selectively (the original section 5 component
audit was removed from this shareable overview).

- **Phase B (specs):** `6.B1` playbook module system; `6.B2` tracker mirror
  (`data/tracker-mirror.json`, with the required Notion properties in the README); `6.B3`
  scheduled `jd-intake`; `6.B4` TAILOR-1 tailoring import-vs-reference; `6.B5` deterministic
  scripts + the output validator; `6.B6` guard hooks; `6.B7` jd-match rubric fork; `6.B8` build
  ownership and order; `6.B9` local-first URL capture (the Chrome extension + capture CLI).
- **Phase C (deferred):** a scheduled daily digest and a transcript pipeline -- build only when
  the pain appears.
