# jobSearchOS Phase B build session (Codex)

WP-0 is done: the repo is live on your own private GitHub remote,
`main` has the full history. codex-workplan.md's Codex-side cards (WP-1 through WP-5)
are unblocked. Work in the primary local tree so validate-output.mjs can run against
the real landing/opportunities data, not just fixtures.

Read, in order:
1. codex-workplan.md -- the card queue and current Status field per card.
2. PRD.md section 4.7 (artifact line grammar + naming contract) and section 6's
   Phase B specs 6.B1-6.B8 -- each card's spec.
3. DEVLOG.md top entry for current state.

Work order: WP-1 (deterministic scripts + committed test data) first -- WP-5 depends
on it. WP-2, WP-3, WP-4 do not depend on WP-1 and can be built in any order once
WP-1 is underway. Do not start WP-5 until WP-1 is merged to main.

Per card:
- Branch `codex/wp-<n>-<slug>`.
- Build to the card's DoD exactly; do not add scope beyond the spec.
- Run the card's verification steps plus AGENTS.md's verification block
  (node --check, node --test scripts/, node scripts/validate-output.mjs).
- Update the card's Status field in codex-workplan.md when you open the PR
  (open -> in progress -> PR opened). Do not merge to main yourself; stop for
  review. Confirm any "merged" claim only against the primary clone's actual
  main branch, never a satellite clone.

Hard rules, restated: never commit opportunities/, landing/ content (except
_ledger.md and _runs.md), or data/. The Notion tracker is read-only even through
your own connection -- writes stay human + Role Clipper. No secrets in the repo;
NOTION_API_KEY comes from the environment only. No em dashes. Do not touch
rubric/fit-rubric.md or rubric/deal-breakers.md (owner-calibrated, backtest-
validated 9/9) -- WP-4's jd-match-rubric.md fork is a new file, not an edit to
those.

Output: a PR per completed card (or per logical group if WP-2/3/4 land together),
codex-workplan.md statuses current, and a short summary of what is ready for
review and what (if anything) is blocked.
