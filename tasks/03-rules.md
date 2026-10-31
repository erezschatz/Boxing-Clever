# 03 · The rules

## Context

**Promise.** The scoring rules of this app — the 10-point round, deductions, the
stoppage rule, which decision means what, how a record moves — exist as
plain functions I can read in one file each, and a test states every rule.

**Acceptance.**
- [ ] `server/rules/scoring.ts`: round total, bout total, validation of a card against SPEC Scoring §1–4, including the no-gaps invariant
- [ ] `server/rules/decisions.ts`: the decision-type table (§5): codes, winner kind, display label — label derived from code, never the reverse
- [ ] `server/rules/records.ts`: given a result, the record deltas for both sides (§6), and their reversal
- [ ] `server/rules/weight.ts`: v1's six conversion functions with the same contracts (round-trips, two-decimal), ported behaviour-first
- [ ] `tests/rules/*.test.ts`: one test per statement; the KO-in-round-2-with-knockdown worked example passes exactly as SPEC states
- [ ] `server/rules/` imports nothing
