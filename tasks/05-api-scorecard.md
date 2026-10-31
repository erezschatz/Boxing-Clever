# 05 · API: the scorecard

## Context

**Promise.** I can save a card mid-bout and come back to it, finalise it with a
decision, and both fighters' records move exactly once. The card remembers
what each fighter's record, weight and rank were on the night, forever.
Milestone: nothing after this is worth building if this fails.

**Acceptance.**
- [ ] `PUT /api/bouts/:id/card` validates the card with `rules/scoring` (400 on a gap, points outside 0–10, rounds past the stoppage)
- [ ] First save of any kind takes the as-of snapshot (SPEC §7); later saves never change it
- [ ] Finalise (`is_draft:false` with a result) applies the record deltas in the same transaction as the card write; re-finalising identical data is a no-op; changing the result reverses and re-applies
- [ ] `GET /api/bouts/:id` returns the card, totals computed by the rules, and the snapshot
- [ ] Tier-3 tests: snapshot immutability; record moves once; edit reverses; the stoppage example persisted and read back; a failed write mid-transaction leaves both fighters untouched
- [ ] Verified by Erez: a real bout scored over HTTP end to end
