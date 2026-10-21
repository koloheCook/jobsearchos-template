# board-watch

**Date:** 2026-10-21
**Model, effort:** Claude Opus 5.5, default effort

The discovery stage. It reads the public job-board APIs of the companies you list, compares them against the last run, and writes the URLs of new postings that match your target roles. It finds links and does nothing else: it never applies, never writes a verdict, and never touches a tracker.

    board-watch  ->  out/new-urls.txt  ->  capture-url  ->  landing/web-captures/  ->  jd-intake

## Configure `boards.json`

Each entry in `boards` is one company:

| Field | Meaning |
|---|---|
| `org` | Any short name you like; used as the key in the saved state |
| `ats` | `greenhouse`, `ashby` or `lever` |
| `token` | The company's board token on that ATS (see below) |
| `enabled` | `false` keeps the entry but skips it |

`target` filters what counts as on-target: a title must contain one of `roleTerms` and none of `excludeTitle`. Matching is case-insensitive substring.

**Finding a token.** Open the company's careers page and click any job. The URL tells you the ATS and the token:

- `job-boards.greenhouse.io/<token>/jobs/...` or `boards.greenhouse.io/<token>` is Greenhouse
- `jobs.ashbyhq.com/<token>/...` is Ashby
- `jobs.lever.co/<token>/...` is Lever

A company with its own custom careers site and none of these in the URL has no public API here; clip those roles by hand with the capture extension.

## Run it

```sh
node board-watch/board-watch.mjs            # fetch, diff, write out/new-urls.txt
node board-watch/board-watch.mjs --dry-run  # fetch and report, write nothing
```

The first run for a company records a baseline and emits nothing, so you are not flooded with every open role. From the second run on, only postings that appeared since the last run are emitted, capped at 25 per run. A failed fetch keeps the previous snapshot, so a bad network day never makes old roles look new.

If you use the Notion tracker mirror, roles you marked `Not Interested` there are suppressed automatically.

Run state lives in `board-watch/state/` and output in `board-watch/out/`. Both are gitignored.

## Test

```sh
cd board-watch && node --test
```
