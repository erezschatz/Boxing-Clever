# A kept result is stored, so a recompute keeps it

## Context

Raised 2026-11-15 by Erez's answers to `tasks/questions-2026-11-03.md` (the
decision there: a kept result is stored as a per-fighter adjustment).
To be built before task 14.

**Promise** — When I delete a finalised fight and choose to keep the
records, they stay kept, even after the records are rebuilt.

**Acceptance**

- [x] A migration adds a per-fighter adjustment (won, lost, draws, nc, kos, the deleted bout's description and date), and `server/db/` gets one module for it
- [x] `DELETE /api/bouts/:id?records=keep` writes both fighters' adjustments in the delete's transaction; `reverse` writes none; tier-3 tests for both
- [x] A merge (D31) moves the duplicate's adjustments to the target; tier-3 test
- [x] SPEC *Data model* and *API* describe it, and say that `scripts/recompute-records.ts` (D13) adds each fighter's adjustments to what it rebuilds

## Decisions

### 2026-11-16 · A merge adds the duplicate's kept results to the target's record

**Decision** — A merge (D31) counts each of the duplicate's kept results like one of its finalised fights: added to the target's record, and its `record_adjustment` row moved to the target. The preview says how many (`kept_results`), and the merge dialog names them. Claude's choice, made while building the box that moves the adjustments.
**Rejected** — Moving the adjustment rows without adding them to the target's record, which is all the acceptance box asked for.
**Why** — The duplicate's typed-in record, which holds the kept result, is dropped by a merge (D28). Moving only the row would leave the result out of the target's stored record but in what a recompute rebuilds for it, so the two would disagree and a recompute would change the record. Adding it keeps them equal, as D31 does for finalised fights.

### 2026-11-16 · A kept result names the opponent, and a merge refuses two who met in a kept fight

**Decision** — Each `record_adjustment` row also stores the opponent (`opponent_id`). A merge is refused (`409`, "fought each other") when the duplicate and the target have a kept result between them, as it is refused when they have a bout between them. A merge repoints the duplicate as opponent too. Claude's choice, answering the cold reader's finding below.
**Rejected** — Leaving the opponent out, so that a merge could add the duplicate's side of a kept fight against the target to the target's record, which already counts the target's own side; skipping such rows in the merge instead of refusing, which would merge two fighters who fought each other.
**Why** — D31 already holds that two who met are two people. A deleted fight whose result was kept still happened, and the record still counts it, so the same rule applies. Without the opponent the merge cannot tell which kept results are against the target.

## What was done

2026-11-16. The table: `server/migrations/006-record-adjustment.sql` adds `record_adjustment` (fighter_id, won, lost, draws, nc, kos, bout_description, bout_date). Its reference to `fighter` has no cascade, so deleting a fighter who still has one is refused; a merge moves them first. `server/db/record-adjustment.ts` inserts, lists a fighter's (oldest fight first) and repoints them.

The delete: in `server/api/bouts.ts`, `DELETE /api/bouts/:id?records=keep` writes one row per fighter in the delete's transaction. Each row holds what the result added to that fighter's record (`recordDelta`, the same arithmetic as finalise), the description `<A> vs <B>, <decision code>` and the event's date. `?records=reverse`, a refused delete and a draft's delete write none. The answer to the delete is unchanged.

The merge: in `server/api/fighters.ts`, the preview adds the duplicate's kept results to `target.after` and counts them in `kept_results`, and POST moves the rows to the target in the merge's transaction (D61). `front/merge-form.ts` lists the kept results under *Moving* when there are any, and the line under the table names them among what is added to the record.

SPEC *Data model* has a `record_adjustment` row, and its `fighter` row says that `scripts/recompute-records.ts` adds each fighter's adjustments to what it rebuilds. SPEC *API* says the same for the keep delete, the merge preview and the merge. The script itself is not written yet (D13); nothing here runs it.

Tests:
- In `tests/api/delete.test.ts`: keep stores each side's counts for a UD, a KO (with the ko), a draw and an NC, with the description and the date. Keep also stores the result when a hand-corrected record makes reverse impossible. Reverse, a refused delete and a draft's delete store nothing.
- In `tests/api/merge.test.ts`: a duplicate's kept KO is in the preview (`kept_results` 1, `target.after` one more win and ko); after the merge it is in the target's record, and its row is the target's. A merge that fails at the last step leaves the row with the duplicate.
- `tests/api/fighters.test.ts`: the empty merge preview has `kept_results: 0`.
- `tests/db/migrate.test.ts`: `record_adjustment` is among the tables a fresh database gets; the 005 test now migrates only to 005.

`deno task test` 195/195, `deno test -A` 427/427, `deno task check`, `deno fmt --check` and `deno task build` clean. `deno lint` reports two unused variables in `.claude/hooks/check-unit.test.mjs`, which this change doesn't touch. Not checked by Claude in the browser: the merge dialog's new line.

Reviewed by: a read-only Explore subagent, cold, against the staged diff, carrying out docs/reviewer.md (found the record matching the diff and all four boxes holding; found that a merge could count both sides of a kept fight between the duplicate and the target, the item below).

## Review · 2026-11-16

### A merge counts both sides of a kept fight between the two fighters

**Found** — `server/api/fighters.ts`, `mergePlan`, refuses a merge only when the two have a bout between them. A fight between them deleted with `?records=keep` leaves no bout, so the merge is allowed. D61 then adds the duplicate's kept side to the target's record, which already counts the target's side. A `record_adjustment` row has no opponent, so the merge can't tell them apart.

**Done when**

- [x] Merge preview or POST where the duplicate has a kept result from a fight against the target → `409` "fought each other", nothing moves, no record changes
- [x] Merge where the duplicate's kept results are all from fights against third fighters → the results are added to the target's record and the rows move, as now
- [x] Merge where the two have a bout that still exists between them → `409`, as now
- [x] Merge where a fight between the two was deleted with `?records=reverse` (no adjustment row) → behaves as it does today
- [x] `DELETE /api/bouts/:id?records=keep` → each fighter's row also identifies the opponent, and the counts, description and date are unchanged

**Not asked** — Showing kept results in a fighter's bout history, writing `scripts/recompute-records.ts`, or any change to how reverse works.

## What was done

2026-11-16, answering the review above (D62). `record_adjustment` has an `opponent_id` (migration 006, not yet run anywhere, so it was changed in place), and the keep delete writes each fighter's opponent. `server/db/record-adjustment.ts` gains `countAdjustmentsBetween`; `repointAdjustments` now moves the duplicate both as fighter and as opponent. `mergePlan` in `server/api/fighters.ts` refuses with the existing "fought each other" `409` when either a bout or a kept result is between the two, for GET and POST alike. SPEC's `record_adjustment` row and merge row say so.

Tests: `tests/api/delete.test.ts` checks the opponent on every kept row. `tests/api/merge.test.ts` adds three tests: two who met in a kept fight can't be merged either way round, and nothing changes; a fight between them deleted with reverse doesn't stop the merge; merging the opponent of a kept fight repoints the other fighter's row, so the target and that fighter then count as having met. The earlier merge tests (third-fighter kept results added and moved; a bout between them refused) still pass unchanged.

`deno test -A` 430/430, `deno task check` and `deno fmt --check` clean.


Reviewed by: a second read-only Explore subagent, cold, against the staged diff, carrying out docs/reviewer.md. It found the record matching the diff and all five *Done when* lines holding in the code and tests. It noted that the reverse case is tested only through the GET preview, and POST runs the same check.
