# A retirement is a TKO at 3:00, with its round scored

## Context

Raised 2026-11-15 by Erez's answers to `tasks/questions-2026-11-03.md` (the
decision there: a retirement is a TKO at 3:00 of the round it followed,
and that round is scored). To be built before task 10, so that the importers
map onto it.

**Promise** — When a corner pulls their fighter after round X, I enter it
the way it's announced, a TKO at 3:00 of round X, and I score round X,
because it was fought in full.

**Acceptance**

- [ ] The rules (`server/rules/`) score the result round of a `TKO` at 3:00 like any other round and end the card there; any other TKO keeps the 0–0 stoppage round; `RTD` is no longer a code; tier-1 tests cover a 3:00 TKO, a 2:15 TKO, and a 3:00 TKO whose round is 0–0 (refused)
- [ ] A migration turns stored `RTD` bouts into `TKO` at 3:00 and drops `RTD` from the allowed codes; Claude lists any migrated finalised bout whose round X is 0–0, for Erez to score by hand
- [ ] The scorecard asks for round X's score when the result is a TKO at 3:00; the decision dropdown no longer offers RTD
- [ ] SPEC *Rules* (§4, §6, the decision codes) and IMPORT.md say the same; tier-3 test: a 3:00 TKO finalises and adds to the winner's kos
- [ ] Verified by Erez in the browser
