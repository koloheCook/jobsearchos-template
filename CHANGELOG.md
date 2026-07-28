# Changelog

Framework-level history for jobSearchOS: skills, guard hooks, the deterministic
script layer, the rubric model, the capture layer, and architecture phases.
This is a curated summary, not a full development log -- the project's real
working log (day-to-day session notes, real opportunity data, application
history) stays private and local, same as the career content itself. See
`README.md` for what ships in this template versus what stays out of it.

Reverse-chronological; grouped by date.

## 2026-07-27 -- Handoff hardening + clearance gate

- Fixed the handoff skill dropping the canonical opportunity-folder path from
  its output packet; added a completeness check that runs before any handoff
  write.
- Switched JD transfer in the handoff flow from embedded/re-typed text to a
  byte-exact file copy from the source folder (with a manual-paste fallback),
  removing a transcription-fidelity risk from the earlier approach.
- Broadened the clearance deal-breaker to catch conditional and future
  security-clearance language, not just active requirements, with guards
  against false positives (negations, export-control notices). Added
  regression fixtures for both the positive and negative cases.
- Closed a coverage gap between the capture pipeline and the optional tracker
  mirror, so every triaged opportunity is reflected in the mirror.

## 2026-07-22 -- Pipeline documentation

- Documented the full pipeline as a 7-stage spine (capture -> triage -> decide
  -> tailor -> meet -> learn -> publish), with a complete inventory of every
  guard hook across both agent mirrors and a per-stage command/prompt map.

## 2026-07-21 -- Concurrency-lock bug fix

- Fixed a scheduled-run stall caused by uncommitted protected instruction
  files blocking the file-locking contract; documented a three-way-merge
  recovery pattern for the same failure mode going forward.

## 2026-07-17 -- Single source of truth for both agents

- Wired the primary instructions file to import the canonical cross-agent
  rules file, so both coding agents load the same rules instead of two files
  that could silently drift apart.
- Added a secret-handling policy: never request secret values in chat, treat
  environment variables as a fallback rather than isolation, and rotate/revoke
  on any exposure rather than relying on scrubbing alone.

## 2026-07-16 -- Hardening pass: false positives, a real sanitizer bug, scheduling

- Fixed the row-grammar guard counting markdown table headers and separators
  as data rows -- a guaranteed false positive on every ledger and run-log
  write.
- Fixed the invented-metric guard flagging the rubric's own calibrated
  compensation anchors as invented, via magnitude-normalized citation matching
  instead of literal string matching.
- Fixed a real sanitizer gap in the capture extension: content nested inside a
  link (including images and scripts) survived the safety filter and could
  reach the saved snapshot. Extracted one shared sanitizer module used by both
  the extension and the CLI to remove the drift that let the same bug ship
  twice in parallel code paths.
- Fixed content-security-policy violations in the capture popup by moving
  inline styles to an external stylesheet.
- Armed daily scheduled intake, backed by a new file-locking contract shared
  by every manual and scheduled writer, so concurrent runs can't corrupt the
  ledger or manifest.

## 2026-07-15 -- Guard hooks, tracker mirror, capture extension, handoff skill

- Added a native git pre-commit guard that blocks career content from ever
  being committed, plus staging and JavaScript-syntax guards; added the
  `prompt-queue` and `next-moves-audit` skills and a report-only
  boundary-auditing agent.
- Shipped four guard hooks: three warn-and-log linters (missing-evidence-marker
  check, row-grammar check, invented-metric check) and one blocking
  pre-write verdict gate, mirrored byte-identical across both agents' hook
  directories.
- Shipped the playbook v0.1 container (per-module files, routing index,
  versioned header contract) and a second, JD-relevance-first rubric fork for
  scoring how well the candidate matches the role (as distinct from how well
  the role matches the candidate).
- Built and live-verified the tracker-mirror script against a real database
  end to end.
- Shipped local-first URL capture: a Chrome extension (minimal permissions,
  no-network content-security-policy) plus a CLI path, both writing a
  validated capture-artifact contract (frontmatter, content hashes, an
  explicit completion marker) that never leaves the local machine.
- Shipped the owner-present handoff skill for passing a qualified, confirmed
  opportunity to a separate downstream tailoring tool: standard and override
  authorization modes, append-only packet rules, and a no-cross-repo-write
  boundary.

## 2026-07-13 to 2026-07-14 -- Deterministic script layer

- Shipped zero-dependency scripts for ledger-diff, manifest emission, and
  output validation, with a committed fictional fixture tree so the framework
  can be tested without touching real pipeline data.
- Fixed a manifest-emission bug where rows with an unrecognized status were
  silently bucketed instead of failing closed -- a malformed mirror could
  otherwise have passed downstream as valid output.
- Added the `cross-agent-review` skill: a bounded protocol for reconciling
  findings when two coding agents review the same deliverable (verify before
  writing a finding, batch and rank findings, cap at two rounds, escalate to
  the owner only when neither agent can source an answer).

## 2026-07-08 -- Build handoff written; repo goes live

- Pushed to a private GitHub remote.
- Wrote the cross-agent build contract: a canonical rules file for the second
  coding agent, a staged workplan, a frozen artifact/line-grammar contract
  (verdict banner, ledger/run-log row formats, guard-hit log shape), and a
  provenance/component-status diagram.

## 2026-07-06 -- Phase A: foundation

- Initial scaffold shipped: the PRD, the never-commit-career-content boundary,
  the three core skills (`jd-intake`, `meeting-brief`, `debrief`), their
  matching templates, and rubric/deal-breaker skeletons -- deliberately
  uncalibrated, capping every verdict at EXPLORE until filled in.
- Rubric calibrated via owner interview: a two-axis scoring model
  (role-fits-you / you-fit-role), tiered lane-fit with a technical-builder
  trip-wire, and a 4-item hard deal-breaker gate (compensation floor,
  location/commute, industry exclusion, security-clearance requirement).
  Verdicts unlocked from the EXPLORE cap.
- Backtested the calibrated rubric against 9 past real roles, one per
  session, via a repeatable backtest-and-synthesis prompt pair; the synthesis
  pass confirmed a 9/9 verdict match against the owner's own judgment and
  closed the calibration round with no further edits.
- Design-specced four Phase B items: a per-module playbook container, the
  tracker-mirror architecture, a hardened scheduled-intake runtime, and the
  boundary for handing a qualified opportunity to a separate downstream
  tailoring tool.
