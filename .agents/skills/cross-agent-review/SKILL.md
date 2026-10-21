---
name: cross-agent-review
description: Reconcile a design or correctness disagreement between Claude and Codex on the same deliverable with a bounded number of evidence-backed rounds instead of open-ended chat relay. Use when the owner is manually relaying findings between a Claude session and a Codex session on the same PR/card, when a Claude review of Codex's work (or vice versa) surfaces a finding worth a second opinion, or when the owner says "check this with Codex" / "get Codex's take" / "cross-review this."
---

# cross-agent-review

Formalizes the relay pattern that emerged organically during development:
Claude reviews Codex's PR, writes findings, the owner manually pastes them to
Codex, Codex responds, the owner pastes the response back. That pattern works but
is expensive in owner time and in dropped-context risk if run ad hoc. This skill
bounds it: findings must be evidence-backed and batched, rounds are capped, and
every round ends with something written to a durable artifact, not just left in
chat.

## When to invoke this vs. just answering

This is NOT for routine solo review -- most `/code-review` findings resolve
without ever needing the other agent. Invoke this only when a finding meets one of:
- It contradicts something the other agent already built or asserted as verified.
- It requires a judgment call neither agent has sourced authority to make alone
  (ambiguous spec, unsourced convention, owner-only fact).
- The other agent's cross-review previously proposed something that needs a second
  independent check before landing in code.

If a finding doesn't meet one of these, resolve it solo and move on. Escalating
routine findings is exactly the overhead this skill exists to cut down.

## Round discipline

1. **Verify before you write the finding, not after.** Reproduce the claim
   empirically (run the command, read the actual file, check the actual git
   state) before it goes in a packet. A finding that turns out wrong after the
   other agent takes it on faith costs more than the round it saved. (This
   session: two of my own findings were wrong in ways tests didn't catch --
   `unknown`-bucketing hid bad data, and a rename of `scripts/index.js` broke the
   verification command it was supposed to fix. Both would have been caught by
   this rule.)
2. **Batch everything you have, ranked by importance, in one packet.** Not one
   question at a time. State what you verified and how, not just the claim.
3. **Ask the other agent to verify independently, not just agree.** "Confirm or
   refute with your own check" beats "does this look right to you."
4. **Give every finding an explicit disposition**, not a bare "sounds good":
   adopt / reject / withdraw / owner-decision, each with the reasoning, each
   citing what was actually run or read.
5. **Route to the owner, don't let either agent win by assertion**, when a
   disposition depends on a fact neither agent can source (an unwritten
   convention, a business decision, an ambiguous spec passage with no
   authoritative reading). Name the exact evidence gap when you do; see this
   session's Q2 (`byStage` vocabulary) for the shape of a correctly-escalated
   item -- both agents traced the claim to its source, found no authority for it,
   and stopped rather than picking a default.
6. **Cap it at two rounds before flagging fatigue to the owner.** If a
   disagreement survives two full packet exchanges, that itself is information --
   say so explicitly rather than starting a third round unprompted.

## Where dispositions land

Every settled disposition goes on the artifact whoever executes it will actually
open -- the task card, the spec section, the skill file -- not only in a chat
message or a DEVLOG entry. The pattern: a rule agreed in a cross-review is written
directly on the artifact that implements it, not just narrated in DEVLOG. DEVLOG
still gets the narrative (what was decided and why) but the implementing artifact is
what a future session actually opens.

## Handoff artifact

When a round of cross-agent work concludes (or a session closes with the other
agent's next session still pending), write the handoff as a dated file in
`prompts/<topic>_<YYYY_MM_DD>.md`, matching this project's existing convention.
The handoff must describe **actual current repo state**, verified at write time
(branch, merge status, what's pushed vs. local-only) -- not the state as of when
the round started. Re-run `git status` / `git log` immediately before writing it;
state goes stale fast across a multi-round session. A handoff prompt describing a
branch as "unmerged, don't push" after it has in fact been merged sends the next
session chasing state that no longer exists.

## Bounds

- This skill does not grant either agent authority it doesn't already have --
  AGENTS.md's ground rules (career-content boundaries, manual-forever items, the
  PURSUE gate) apply unchanged inside a cross-agent round.
- Not a substitute for the owner's own review of anything gated on owner
  confirmation (PRD principle 1). A clean cross-agent reconciliation is not
  owner sign-off.
- Both agents' skill surfaces need this file to actually see it: it lives in
  `.claude/skills/` and is mirrored to `.agents/skills/` for Codex on next open,
  per this project's existing skill-mirroring pattern (confirmed 2026-07-14 --
  Codex also has its own global `~/.codex/skills/`, separate from this mirror).
