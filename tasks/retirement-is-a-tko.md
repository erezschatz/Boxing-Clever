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

- [x] The rules (`server/rules/`) score the result round of a `TKO` at 3:00 like any other round and end the card there; any other TKO keeps the 0–0 stoppage round; `RTD` is no longer a code; tier-1 tests cover a 3:00 TKO, a 2:15 TKO, and a 3:00 TKO whose round is 0–0 (refused)
- [x] A migration turns stored `RTD` bouts into `TKO` at 3:00 and drops `RTD` from the allowed codes; Claude lists any migrated finalised bout whose round X is 0–0, for Erez to score by hand
- [x] The scorecard asks for round X's score when the result is a TKO at 3:00; the decision dropdown no longer offers RTD
- [x] SPEC *Rules* (§4, §6, the decision codes) and IMPORT.md say the same; tier-3 test: a 3:00 TKO finalises and adds to the winner's kos
- [ ] Verified by Erez in the browser

## Decisions

### 2026-11-15 · Migration 005 rebuilds the bout table to drop RTD from its check

**Decision** — `server/migrations/005-retirement-is-a-tko.sql` rebuilds `bout`, as 004 did, so that its `decision_type` check no longer lists `'RTD'`, and converts the stored RTDs in the same copy.
**Rejected** — Converting the rows with an `UPDATE` and leaving `'RTD'` in the check, which would avoid a rebuild but let the database take a code the rules no longer know.
**Why** — SQLite can't change a check in place. The schema states what the app accepts, as it does for every other code (§5), so the rebuild is worth its cost, and 004 already showed the way.

## What was done

2026-11-15. The rules: `RTD` is gone from `server/rules/decisions.ts`, which leaves twelve codes; KO and TKO are the knockouts (§6). In `server/rules/scoring.ts`, `cardEnd` asks `isRetirement`: a `TKO` whose time is exactly `3:00` ends the card in its round, but that round is scored (10–9, 9–10 or 10–10), not 0–0. Every other stoppage keeps its 0–0 round, including a TKO with another time or none, and a KO at 3:00. `shapeForResult` and `validateCard` both go through `cardEnd`, so the API and the scorecard's "End bout" (`finalCard` in `front/scorecard.ts`) follow without changes of their own: a 3:00 TKO whose round is half typed or missing is refused with the usual message, and one typed in full is kept as typed.

The migration: `server/migrations/005-retirement-is-a-tko.sql` rebuilds `bout` as 004 left it, minus `'RTD'` in the decision check, turning each stored `RTD` into a `TKO` with its time set to `3:00` and its round kept. Erez's database (`data/boxing.db`, read-only query) has no RTD bout, so there is no migrated card with a 0–0 round to list. A v1 or sheet import with a 0–0 round would be rejected (D55, IMPORT.md).

The front end: the decision dropdown is built from `DECISION_TYPES`, so it no longer offers RTD. With TKO chosen, the decision dialog (`front/decision-form.ts`) says on one muted line that a corner retirement after round X is round X at 3:00, and round X is scored.

SPEC *Scoring* §4, §5 and §6 drop RTD and give the 3:00 TKO's shape, and SPEC's `round_score` row agrees. SPEC *Front end* names the dialog's line. The comments in `server/rules/decisions.ts` and `server/db/round-score.ts` say the same. IMPORT.md already said this (D55).

Tests:
- Tier 1, in `tests/rules/scoring.test.ts`: a 3:00 TKO with its round scored or even is valid; one with that round 0–0 is refused; one with rounds after it or missing before it is refused; an unscored one is valid; the shaper keeps the round. A 2:15 TKO, a TKO with no time and a KO at 3:00 keep the 0–0 round.
- `tests/rules/decisions.test.ts` and `tests/rules/records.test.ts` lose RTD.
- In `tests/front/forms.test.ts`: End bout on a 3:00 TKO refuses a half-typed round 3, then sends rounds 1–3 as typed; the API takes it, and Usyk's kos go up by one.
- In `tests/db/migrate.test.ts`: migration 005 turns an RTD into a TKO at 3:00 in round 7, with its rounds still attached; a TKO at a contracted weight and a draft come through unchanged; RTD is refused afterwards. The 004 test now migrates only to 004.

`deno task test` 190/190, `deno task check`, `deno fmt --check`, `deno lint` and `deno task build` clean. Not checked by Claude in the browser: the dialog's line, and a retirement entered and finalised there.

Reviewed by: a read-only Explore subagent, cold, against the staged diff (found the record accurate, the migration copying all 41 columns in order, and no code assuming every stoppage round is 0–0; asked that SPEC §4 and the `round_score` row carry the 3:00 TKO exception and that the rebuild get a decision entry; done, with the stale comment in `server/db/round-score.ts`).
