---
name: debrief
description: Same-day post-call debrief scored against the meeting brief's objectives. Use when the owner says "debrief", "just got off a call", or finished any interview or networking conversation. Produces one named coaching problem and three dated next moves.
---

# debrief

The objective read after a call: what happened vs what the owner wanted to happen,
one coaching problem, dated next moves. Run it the same day while the owner's read
is fresh; if it is not the same day, say that the tone-memory window has closed and
proceed on notes only.

## Steps
1. Locate the meeting's `brief.md`; load its objectives. If no brief exists, say so
   (that is itself a process miss), collect objectives retroactively, and proceed.
2. Collect the owner's raw notes/recollection (transcript ingestion is not built; do not ask
   for a recording). Interview the owner briefly if the notes are thin: what was
   said about next steps, any objection raised, anything that surprised them.
3. Write `meetings/<date>_<slug>/debrief.md` per `templates/debrief.md`:
   - Objectives scorecard: hit / not / partial, with the evidence moment.
   - What went well: quoted evidence only, no generic praise.
   - **ONE named coaching problem.** Pick the one that decides the thread, not
     five. If an objection was handed to the owner, check the classic failure from
     the source pattern: did they reinforce it instead of dismantling it?
   - Risk flags; then Next 3 moves, each with a date.
   - Overweighting check (imported failure mode): re-read the coaching problem and
     confirm it reflects the call's overall weight, not one vivid moment; the owner
     is the correction and can overrule the read.
4. Close with the follow-up norm, verbatim: "Draft the follow-up yourself first; I
   polish after. Send before <next move 1's date>." Never offer to write the first
   draft (PRD principle 4).
5. Remind the owner to update the tracker row's next step + date (writes stay
   human).

## Bounds
- In-session only. No em dashes. Contact referenced by first name/role only in
  committed-path outputs; full details stay inside the opportunity folder.
