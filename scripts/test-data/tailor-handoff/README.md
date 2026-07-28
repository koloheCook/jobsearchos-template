# TAILOR-1 fictional smoke fixtures

Use invented companies and JD text only. These are manual smoke scenarios for the
owner-present skills, not ledger or manifest fixtures.

1. **Standard:** a fictional assessment has `Confirmed: PURSUE by owner 2026-07-15` and
   `Gate: RESOLVED-PASS`. The jobSearchOS packet must use `Mode: standard`; CCv2.7 Stage
   0 must create its own matching packet, `jd.md`, `0_jd-analysis.md`, and
   `0_notebooklm-prompts.md`.
2. **Override:** a fictional EXPLORE assessment has `Gate: UNRESOLVED`. The owner gives a
   dated rationale and names the unresolved fact. Both packets must use
   `Mode: owner-override` and carry the same authorization.
3. **Reject:** an unconfirmed PURSUE, malformed assessment, or PASS produces no packet
   without an explicit owner override. A mismatched CCv2.7 target folder fails closed.

The eventual owner-controlled smoke test uses a real local opportunity but reports only
paths, modes, commands, exit codes, and validator results.
