# Clearance-gate deal-breaker fixtures (fictional)

Regression fixtures for deal-breaker #4 in `rubric/deal-breakers.md`, broadened 2026-07-27 to
catch conditional / future clearance requirements (not only an active clearance). Fictional
companies and JD text only (AGENTS.md ground rule 1: no real third-party names, no verbatim
real JD text). Expected outcomes are the intake's deal-breaker gate (jd-intake step 2d), not
the two-axis fit scores. These lock the gate so the gap cannot silently reopen.

## FIXTURE 1 -- conditional clearance requirement (the trigger class): expect FAIL -> PASS
Fictional role: "Halcyon Systems -- Senior Program Manager, Public Sector Delivery".
JD names a conditional/future clearance: "The successful candidate may be expected to obtain
and hold a U.S. Top Secret security clearance." No other exclusion; comp and location clean.
Expected: deal-breaker #4 RESOLVED-FAIL (the owner holds no clearances; a conditional / future
clearance requirement now fails, not only an active one). Verdict PASS, before any PURSUE or
TAILOR-1 chip. The owner may still override in writing per the gate procedure.

## FIXTURE 2 -- hard / active clearance requirement: expect FAIL -> PASS
Fictional role: "Halcyon Systems -- Program Manager, Classified Programs".
JD: "Requires an active U.S. Secret clearance at time of hire."
Expected: deal-breaker #4 RESOLVED-FAIL, verdict PASS. Already caught by the pre-2026-07-27
wording; kept so the hard case cannot regress.

## FIXTURE 3 -- negation, no clearance: expect RESOLVED-PASS (false-positive guardrail)
Fictional role: "Meridian Labs -- Data Operations Manager".
JD: "This role does not require a security clearance." Comp, location, and industry otherwise
clean.
Expected: deal-breaker #4 RESOLVED-PASS. The broadened gate must NOT fire on a negation of a
clearance requirement.

## FIXTURE 4 -- export-control notice, no clearance named: expect RESOLVED-PASS on #4
Fictional role: "Meridian Labs -- Research Program Manager".
JD: "Access to certain technology may require U.S.-person status or export-control
authorization." No security clearance is named.
Expected: deal-breaker #4 RESOLVED-PASS. Export-control / U.S.-person authorization is a
separate consideration, flagged on its own, and is not the clearance gate (matches how the
live reflection assessment already treats it).
