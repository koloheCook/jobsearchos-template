# jobSearchOS Phase B check-in + WP-6 (Claude)

Fresh chat, no prior context needed. Codex owns the Phase B build (WP-1 through
WP-5); this session's job is to check what has landed, verify it against spec
before trusting it, and run the one card that only Claude can do.

Read, in order:
1. CLAUDE.md and DEVLOG.md (top entries) for current state.
2. codex-workplan.md -- the card queue and current Status field per card.
3. PRD.md section 6's Phase B specs (6.B1-6.B8) and section 4.7 -- what each
   card is supposed to implement.

Do this, in order:
1. Check your GitHub repo for open or merged PRs from
   Codex since the last check-in. For anything merged to main, read the actual
   diff -- do not trust the PR description alone -- and verify it meets its
   card's DoD against the PRD section it implements. Update codex-workplan.md's
   Status field to match reality.
2. If WP-3 (guard hooks) has landed on main: run WP-6, the one Claude-only card.
   Confirm each hook fires on its matcher in this live session -- Write|Edit
   triggers no-invented-metric.sh, scribe-check.sh, and grammar-lint.sh; a Skill
   invocation triggers verdict-gate.sh -- and that a line lands in
   .claude/metrics/guard-hits.jsonl per fire. Record the result (pass/fail per
   hook) in codex-workplan.md and DEVLOG.
3. If WP-3 has not landed yet: report status only. WP-6 stays blocked; do not
   improvise a partial check.
4. If anything merged looks like drift from its PRD spec (wrong file shape,
   missing a stated constraint, scope beyond the card), flag it explicitly
   rather than accepting it silently -- do not fix it yourself unless asked.

Output: one DEVLOG entry summarizing what was checked and what WP-6 found (or
why it was skipped); codex-workplan.md statuses current; a one-line status back
to the owner on what's done, what's still open, and whether WP-7 (scheduled
runtime pick) or WP-8 (owner inputs) are now unblocked.
