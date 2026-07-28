# jobSearchOS

jobSearchOS is a job-search operating system built for Claude Code (and, optionally,
Codex): capture -> triage -> pursue -> meet -> learn. It turns a job description
into a scored, gated assessment before you spend a single hour tailoring materials,
prepares you for every scheduled call with an objectives-driven brief, and scores
the debrief the same day so nothing about the search relies on memory. Everything
that touches your real pipeline (job descriptions, assessments, tracker data) stays
on disk and out of git; the framework itself (skills, guard hooks, scripts,
templates, rubric scaffolding) is what this repo ships.

This is a template, not a finished tool. It ships with the scaffolding
calibrated to nobody in particular: you fill in your own rubric, deal-breakers,
and identity details before it makes real decisions for you.

## The pipeline

1. **Capture** -- drop a JD PDF in `landing/`, or grab one from the web with the
   included Chrome extension or CLI (`capture/`). Everything lands in a restricted
   inbox; nothing is transformed until intake runs.
2. **Triage** (`jd-intake` skill) -- scores the role against your calibrated
   `rubric/fit-rubric.md` (role-fits-you) and `rubric/jd-match-rubric.md`
   (you-fit-role), runs the hard `rubric/deal-breakers.md` gate, and writes a
   `PURSUE | EXPLORE | PASS` verdict to a new `opportunities/<slug>/assessment.md`.
   Nothing is tailored or pursued without your explicit confirmation.
3. **Meet** (`meeting-brief` skill) -- given your own written objectives for an
   upcoming call, produces a brief: posture, opening line, questions, and a
   defined ask.
4. **Learn** (`debrief` skill) -- scores the call against those objectives the same
   day, names ONE coaching problem, and sets dated next moves.

A deterministic script layer (`scripts/`) keeps the ledger, the manifest, and the
optional Notion tracker mirror consistent without relying on an LLM to get
formatting right every time; a small set of guard hooks (`.claude/hooks/`,
mirrored for Codex in `.codex/hooks/`) catch invented metrics, missing evidence
markers, and malformed verdict banners as you write.

## The rubric and skills model

The rubric is the part that makes this yours. `rubric/fit-rubric.md` and
`rubric/deal-breakers.md` ship as blank scaffolds (`<OWNER: ...>` placeholders) with
the scoring *structure* intact but none of the calibration filled in. Until you
calibrate them, verdicts are capped at `EXPLORE` by design (see `CLAUDE.md`) so a
default rubric can't accidentally green-light a role it knows nothing about.

Everything else lives as a Claude Code skill under `.claude/skills/` (mirrored for
Codex under `.agents/skills/`):

| Skill | When |
|---|---|
| `jd-intake` | New JD PDFs land in `landing/`; batch-processes everything new |
| `meeting-brief` | A call is scheduled; you supply objectives |
| `debrief` | Same day as any completed call |
| `refresh-tracker-mirror` | Refresh the optional Notion tracker mirror |
| `tailor-handoff` | Optional -- hand a qualified opportunity to a separate tailoring project (see its portability note) |
| `cross-agent-review` | A Claude/Codex finding on the same deliverable needs a bounded review |
| `next-moves-audit` | On-demand: what's overdue across debriefs, verdicts, and next moves |
| `prompt-queue` | Track what to run next, or log a new handoff prompt |

See `PRD.md` for the full architecture and design rationale, and `AGENTS.md` /
`CLAUDE.md` for the operating rules both agents follow (never commit career
content, Notion tracker is read-only, no invented metrics, etc.).

## Prerequisites

- **Node.js** (any recent LTS -- the scripts use only long-stable `node:` builtins,
  no build step).
- **Claude Code**, for the skills and guard hooks. Codex is optional and mirrors a
  subset of skills under `.agents/skills/`.
- **Google Chrome**, only if you want the optional web-capture extension.
- **A Notion workspace with a job tracker**, only if you want the pipeline mirror.
  The core triage loop works without Notion.

## Setup

1. Clone this repo and `cd` into it.
2. Wire the commit guard (blocks career content from ever being committed):
   ```sh
   git config core.hooksPath scripts/hooks
   ```
3. Verify the framework runs against the shipped fictional test data:
   ```sh
   node --test scripts/
   node scripts/validate-output.mjs --root scripts/test-data/valid   # expect exit 0
   ```
4. (Optional) install capture dependencies for the URL/JSON-LD CLI:
   ```sh
   cd capture && npm ci --ignore-scripts && node --test && cd ..
   ```
5. (Optional) load the Chrome extension: Chrome > Extensions > Developer mode >
   Load unpacked > select `capture/chrome-extension/`. At capture time, grant it
   access only to `landing/web-captures/`.

## Make it yours

6. **Calibrate the rubric.** Edit `rubric/fit-rubric.md`, `rubric/deal-breakers.md`,
   and `rubric/jd-match-rubric.md`: fill in your own comp floor, location/commute
   constraints, target lanes, trip-wires, and mission signals. Every `<OWNER: ...>`
   placeholder is something only you can answer. Until you do, verdicts stay capped
   at `EXPLORE`.
7. **Backtest before you trust it.** `prompts/jobSearchOS_rubric_backtest.md` walks
   one past role at a time through your calibrated rubric and checks the verdict
   against your own gut; `prompts/backtest_synthesis.md` rolls the results up and
   proposes rubric edits. Do this before you let the rubric gate real decisions.
8. **(Optional) personalize the docs.** The only *required* fill-ins are the
   `<OWNER: ...>` markers in the rubric files (step 6). `PRD.md` and `CLAUDE.md` are
   written generically and have no mandatory blanks -- skim them and add your own name or
   context if you like, but nothing there gates the pipeline.
9. **Decide on `tailor-handoff`.** It assumes a separate downstream project that
   turns a qualified opportunity into tailored application materials. If you don't
   have one, remove the skill (both `.claude/skills/tailor-handoff` and
   `.agents/skills/tailor-handoff`), or adapt it to whatever tool you use.
10. **Author your positioning playbook.** `playbook/` ships as an empty container --
    `index.md` (a routing table) and `core-messaging.md`, both blank scaffolds. The
    `meeting-brief` skill loads playbook modules to build a call brief, so before your
    first meeting add one module per talk-track theme at `playbook/modules/NN_<slug>.md`
    and fill in the `index.md` routing table. Module content is yours to author and stays
    manual; until you add modules, `meeting-brief` has no positioning to draw on.

## Connect Notion (optional)

The pipeline *reads* (never writes) a Notion job tracker through a scoped mirror. To use
it you first need **two databases** whose property names match what
`scripts/refresh-tracker-mirror.mjs` expects -- it prints `missing properties` for any it
cannot find. Match these names exactly, or edit the property map near the top of that
script.

**Companies database** (companion; resolves the tracker's company relation to a name):

| Property | Type |
|---|---|
| `Company Name` | Title |

**Master job tracker database:**

| Property | Type | Notes |
|---|---|---|
| `Role` | Title | the role title |
| `🏢 Company` | Relation -> your Companies database | ships with the 🏢 in the name; rename it in the script if you prefer plain text |
| `Application Status` | Status | only rows set to `Not Applied`, `Applied`, `AI Screen`, `Phone Screen`, or `Interview` are mirrored |
| `CC Status` | Status | your tailoring/cover-letter stage |
| `Interest` | Select | |
| `Date Applied` | Date | |
| `Next Step` | Text | optional |
| `Next Step Date` | Date | optional |
| `jobSearchOS Folder` | Text | optional; the on-disk opportunity-folder pointer |
| `Application` | URL or Text | optional |
| `Last Edited` | Notion built-in "Last edited time" | automatic |

Then wire the integration:

11. Create a Notion internal integration with **Read content only**, and share it with
    *just* your job tracker database **and its companion Companies database** (least
    privilege -- not workspace-wide).
12. Copy `.env.example` to `.env` (already gitignored) and fill in `NOTION_API_KEY`
    plus your tracker's database ID, data source ID, and company-source ID (see the
    comments in `.env.example` and `scripts/refresh-tracker-mirror.mjs` for where to
    find these in Notion).
13. Run the `refresh-tracker-mirror` skill (or `node scripts/refresh-tracker-mirror.mjs`
    directly) to pull your tracker into `data/tracker-mirror.json`.

## Daily use

Drop a JD PDF into `landing/` (or capture a URL to `landing/web-captures/`), then
run the `jd-intake` skill. It scaffolds an opportunity folder and a triage
assessment with a verdict and a deal-breaker gate. Use `meeting-brief` before a
call and `debrief` the same day after one.

Your own JDs, assessments, tracker mirror, and `.env` stay local and are
gitignored -- `opportunities/`, `data/`, `networking/`, and everything in
`landing/` except the append-only ledger, run log, and READMEs never enter git.
Keep it that way; the pre-commit guard (step 2 above) is there to help, not to
replace judgment.

## Third-party notices

This framework bundles a few third-party libraries in `capture/` (Turndown, domino).
Their license texts live in `capture/licenses/`. Those libraries are MIT-licensed, which
requires their license text to travel with the code -- so **keep `capture/licenses/` in any
copy or fork you distribute; do not delete it.** If you add new dependencies, add their
license files there too.

## What's not included

A few files were left out of this template because they were the previous
owner's real, identifying job-search history rather than reusable framework: a
working `DEVLOG.md`, a build-history workplan, a filled-in application ledger and
tracker manifest, and several one-time session-handoff prompts. Nothing about
their absence changes how the framework runs -- `jd-intake` creates a fresh
`landing/_ledger.md` row and manifest entry the first time you use it, and
`DEVLOG.md` is meant to be your own working log from day one.
