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

## Quickstart (about 15 minutes)

You need Node.js (any recent LTS), git, jq (`brew install jq` on a Mac), and Claude Code.

```sh
git clone https://github.com/koloheCook/jobsearchos-template.git jobsearchos
cd jobsearchos
git config core.hooksPath scripts/hooks          # blocks career content from being committed
node --test scripts/                             # framework self-test, expect 0 failures
cd capture && npm ci --ignore-scripts && cd ..   # capture dependencies (2 small packages)
node board-watch/board-watch.mjs                 # first run: records a baseline, emits nothing
node board-watch/board-watch.mjs                 # later runs: emits only NEW on-target postings
```

Then make it yours, in this order:

1. **Point board-watch at your companies.** Edit `board-watch/boards.json`: one entry per company with its ATS (`greenhouse`, `ashby` or `lever`) and its board token, plus your `roleTerms` and `excludeTitle` words. See `board-watch/README.md` for how to find a token.
2. **Calibrate the rubric** (step 6 below). Until you do, every verdict is capped at `EXPLORE`.
3. **Open Claude Code in this folder** and type `/jd-intake` (every skill in this repo runs the same way: a slash and its name, or just ask for it in plain words) to triage whatever landed. You get one scored, gated assessment per role.
4. **Run it daily** (see "Run it every morning" below).

The full setup below covers the optional pieces: the Chrome capture extension, the Notion tracker mirror, the positioning playbook.

## The pipeline

0. **Discover** (`board-watch/`) -- polls the public job-board APIs of the companies
   you list (Greenhouse, Ashby, Lever), diffs against yesterday, and writes only the
   new postings that match your role terms to `board-watch/out/new-urls.txt`.
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
formatting right every time; a small set of guard hooks (`.claude/hooks/`) catch invented metrics, missing evidence
markers, and malformed verdict banners as you write.

## The rubric and skills model

The rubric is the part that makes this yours. `rubric/fit-rubric.md` and
`rubric/deal-breakers.md` ship as blank scaffolds (`<OWNER: ...>` placeholders) with
the scoring *structure* intact but none of the calibration filled in. Until you
calibrate them, verdicts are capped at `EXPLORE` by design (see `CLAUDE.md`) so a
default rubric can't accidentally green-light a role it knows nothing about.

Everything else lives as a skill under `.agents/skills/` (read by Codex; `.claude/skills/`
holds a symlink to each one for Claude Code):

| Skill | When |
|---|---|
| `jd-intake` | New JD PDFs or captures land in `landing/`; batch-processes everything new |
| `meeting-brief` | A call is scheduled; you supply 2-3 written objectives |
| `debrief` | Same day as any completed call |
| `next-moves-audit` | On demand: what's overdue across debriefs, verdicts, and next moves |
| `refresh-tracker-mirror` | Refresh the optional Notion tracker mirror |
| `tailor-handoff` | Optional -- hand a qualified opportunity to a separate tailoring project (see its portability note) |

**Builder tools (optional, safe to delete).** Two skills exist for maintaining this repo with two AI agents, not for running a job search: `cross-agent-review` (settles a disagreement between Claude and Codex in bounded rounds) and `prompt-queue` (tracks which saved prompt in `prompts/` to run next). Ignore them, or delete their folders under `.agents/skills/` and the matching links under `.claude/skills/`.

See `PRD.md` for the full architecture and design rationale, and `AGENTS.md` /
`CLAUDE.md` for the operating rules both agents follow (never commit career
content, Notion tracker is read-only, no invented metrics, etc.).

## Prerequisites

- **Node.js** (any recent LTS -- the scripts use only long-stable `node:` builtins,
  no build step).
- **jq**, which the guard hooks use to read their input (`brew install jq` on a Mac).
- **Claude Code**, for the skills and guard hooks. Codex is optional and reads the same
  skills from `.agents/skills/`.
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
   have one, remove the skill (`.agents/skills/tailor-handoff` and its
   `.claude/skills/tailor-handoff` symlink), or adapt it to whatever tool you use.
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

## Run it every morning

The daily loop is three commands: discover, capture, triage.

```sh
node board-watch/board-watch.mjs
node capture/cli/capture-url.mjs --file board-watch/out/new-urls.txt
```

Then run `jd-intake` in Claude Code. Two ways to make that automatic:

- **Claude Code desktop app (simplest):** create a scheduled task on this folder, daily at a time you like, with the prompt: "Run `node board-watch/board-watch.mjs`, then `node capture/cli/capture-url.mjs --file board-watch/out/new-urls.txt`, then run the jd-intake skill on everything new and summarize the verdicts." You read the summary with your coffee.
- **Plain cron or launchd (discovery only):** schedule the two `node` commands above; they need no AI. Run `jd-intake` yourself when you sit down.

Either way, board-watch never applies, never writes to a tracker, and never sets a verdict. It only finds new links.

## Clip a job posting by hand

For roles board-watch can't see (custom careers sites, LinkedIn, a link a friend sent), use the Chrome extension. Load it once (setup step 5), then:

1. Open the job posting and highlight the job description text with your mouse.
2. Click the jobSearchOS extension icon in the Chrome toolbar.
3. First time only: click **Choose web-captures folder** and pick `landing/web-captures/` inside your clone. The extension checks the folder's `README.md` marker and refuses any other folder. It remembers the choice; Chrome may ask you to re-allow access later.
4. Optional: tick **Keep sanitized source snapshot** to also save a cleaned copy of the page.
5. Click **Capture selected job description**. The popup confirms `Saved <id>.jd.md` and shows a preview.

Then run `jd-intake` in Claude Code as usual. The extension only reads what you highlighted and cannot send anything over the network.

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

## Before and after a call

**Before (`/meeting-brief`).** Once a role has an assessment and a call is on the calendar, run `/meeting-brief`. It first asks for your 2-3 written objectives for this specific call (no objectives, no brief), plus who you are meeting, how many times you have met, and how long the call is. Paste in anything useful about the person or company. It reads the role's folder, including every earlier brief and debrief, and writes a one-page `opportunities/<role>/meetings/<date>_<slug>/brief.md`: posture, opening line, questions, the question they are most likely to ask you with a three-beat answer, your ask, and traps drawn from your own past debriefs. It works better once you have written playbook modules (setup step 10), but runs without them on stories you supply.

**After (`/debrief`), the same day.** Paste your notes or just talk it through. It scores the call against the brief's objectives (hit / partial / not), lists what went well with evidence, names ONE coaching problem, and sets three dated next moves in `debrief.md` next to the brief. It will not write your follow-up email for you: you draft it, then ask it to polish. The next brief for the same role reads this debrief, so its coaching problem becomes the next call's trap to avoid.

**Weekly (`/next-moves-audit`).** A read-only check across all your roles: debrief next moves whose date has passed, PURSUE verdicts you never confirmed, and calls that happened with no debrief. It ends with the one thing to do first. It writes nothing.

## Test the rubric on past roles (backtest)

Do this after calibrating the rubric (step 6) and before trusting its verdicts. Open Claude Code and say: "Follow `prompts/jobSearchOS_rubric_backtest.md` for this role:" followed by a link to, or the pasted text of, a job you applied to or seriously considered. It scores that one role, asks for your gut call, and appends a MATCH or MISMATCH row to `rubric/backtest-log.md`, naming the rubric axis at fault when it disagrees with you. Do 5-10 past roles, one per session, then run `prompts/backtest_synthesis.md` the same way to get proposed rubric edits.

## What the guard hooks do

Claude Code runs a few checks automatically whenever it writes an assessment or ledger row: no salary or metric that is not in the job description, every job description marked as a literal extraction, verdict banners in the right shape, and ledger rows that parse. They warn rather than block, except the verdict gate, which stops tailoring until you have confirmed a PURSUE verdict, and log each hit to `.claude/metrics/guard-hits.jsonl`, which stays local. If you see one fire, the fix is usually to cite the source or correct the format.

## Files you can ignore

`out/mc/jobsearch-manifest.json` is a machine-readable list of roles and pending verdicts that `jd-intake` keeps up to date and `next-moves-audit` reads; you never edit it. The scripts `write-preflight`, `intake-concurrency`, `ledger-diff`, `emit-manifest` and `requisition-key` are internal plumbing for those skills.

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
