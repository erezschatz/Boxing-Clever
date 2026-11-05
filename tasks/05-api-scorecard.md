# 05 · API: the scorecard

## Context

**Promise.** I can save a card mid-bout and come back to it, finalise it with a
decision, and both fighters' records move exactly once. The card remembers
what each fighter's record, weight and rank were on the night, forever.
Milestone: nothing after this is worth building if this fails.

**Acceptance.**
- [x] `PUT /api/bouts/:id/card` validates the card with `rules/scoring` (400 on a gap, points outside 0–10, rounds past the stoppage)
- [x] First save of any kind takes the as-of snapshot (SPEC §7); later saves never change it
- [x] Finalise (`is_draft:false` with a result) applies the record deltas in the same transaction as the card write; re-finalising identical data is a no-op; changing the result reverses and re-applies
- [x] `GET /api/bouts/:id` returns the card, totals computed by the rules, and the snapshot
- [x] Tier-3 tests: snapshot immutability; record moves once; edit reverses; the stoppage example persisted and read back; a failed write mid-transaction leaves both fighters untouched
- [ ] Verified by Erez: a real bout scored over HTTP end to end

## What was done

2026-11-05. The scorecard API, with the snapshot and the record moving once
(new D32).

Where things are:
- `server/api/card.ts` holds three things:
  - `cardSchema`: the shape, strict, with `totals` refused.
  - `PUT /api/bouts/:id/card`. It checks the shape with zod and then the
    whole card with `validateCard` (`400 {error, problems}`). It works
    out the record change with `recordChange(counted, toCount)`: what the
    record holds for the bout now, and what it must hold after. A change
    that would take a record below zero is `409`. Then one transaction:
    - the snapshot, if this is the first save, taken before the result
      is counted;
    - the round rows replaced (their deductions go with them), and the
      deductions written;
    - the result and draft flag, and the judges;
    - both records, if the change moves anything.
  - `readCard` and `boutView`: the bout as the API answers it, which is
    the row, `titles` and `card`. `card` is in PUT's shape, plus
    `totals` from `roundTotal` and `boutTotal`. GET, PATCH and POST of a
    bout all answer this now; `boutJson` moved here from `bouts.ts` and
    became `boutView`.
- `server/api/bouts.ts`, PATCH:
  - a new `scheduled_rounds` is checked against the saved card with the
    rules, and is `400` if the card no longer fits. This closes the item
    task 04 left for this task;
  - a draft whose fighter is replaced has that side's snapshot cleared,
    and it is taken again at the next save (D32).
- `server/api/app.ts` mounts `cardRoutes` under `/api/bouts`, beside the
  bout routes. In the PUT body, `deductions`, `judges` and a deduction's
  `note` may be left out (none, all null, null).
- The snapshot is written one side at a time (`setSideSnapshot`). After a
  draft's fighter A is replaced, the next save retakes A only, and B keeps
  the snapshot it had even if Fury's record moved in between. The
  independent review found this; the first version retook both sides.
- A bout already finalised but with no snapshot is snapshotted with its own
  result taken off first (`recordChange(counted, null)`), so the snapshot
  is the record before the fight. Nothing creates such a bout yet; the
  imports (tasks 10–11) will (D32).
- `server/db/bout.ts`: `setSideSnapshot`, `clearSnapshot` and `setJudges`.
  `setBoutResult` came from task 04.
- `server/db/tbrb-snapshot.ts`: `rankAsOf`, the rank on a class's last
  list on or before a date, or null (D25). The snapshot reads it from the
  bout's own class for now (D32, interim). Which class's list counts is
  still Erez's question in `tasks/tbrb-rank-across-classes.md`, so that
  file's boxes stay open.
- SPEC §7 and *API* (PUT card, GET bout, PATCH) state the above.

Tests:
- `tests/api/card.test.ts`:
  - tier 2: a draft saved and read back with totals; four cards the rules
    refuse (gap, points, a round after the stoppage, winner), each `400`
    with that rule and nothing saved; bad shapes and a missing bout; the
    judges.
  - tier 3: the SPEC stoppage example (KO in 2 with a knockdown: round 2
    at 0 / −1, totals 10–8) stored and read back. The snapshot is taken
    at the first save and unchanged by a fighter edit, a later save and
    the finalise. Its TBRB rank is from the last list on or before the
    fight. The record moves once, and saving the same result again moves
    nothing. An edit (UD A → KO B) reverses and re-applies, and going back
    to draft takes the result off. A trigger failing the record step
    leaves card, snapshot and records untouched. A reverse that a hand
    correction already removed is `409`. PATCH `scheduled_rounds` must
    fit the card. A replaced fighter's snapshot is retaken.
- `tests/helpers/api.ts`: `finaliseByHand` is gone. `finalise` PUTs an
  unscored card (valid with any result, D20) over HTTP, so the merge and
  delete tests now finalise the way the app does.
- Also in `card.test.ts`: finalising without a result is `400` (rule
  `finalise`) and nothing moves. The fighter-replaced test now moves
  Fury's record before the next save. An imported-style finalised bout
  (set up through the db modules) is snapshotted as before its result and
  not counted twice.
- Checks that the tests can fail, each made by breaking the code, running
  `card.test.ts`, then putting the code back. Retaking the snapshot on every
  save failed the snapshot test. Retaking side B along with A failed the
  fighter-replaced test. Not taking an import's own result off failed the
  import test.

Left for the imports: `readCard` fills a missing side's round row with 0.
PUT always writes both sides, but an importer that wrote one side only
would get a card that reads `x–0` and fails if PUT back. Tasks 10–11 must
write both sides.

Run by Claude on the Mac, Deno 2.9.8: `deno task test` 123/123, and
`deno task check`, `deno lint` and `deno fmt --check` clean.

Run by Claude against the standalone server (`deno serve` on port 8897,
`$BOXING_DB` in its scratchpad), 2026-11-05, Usyk (21-0, 14 KOs) v Dubois
(21-2, 20 KOs), all over HTTP:
- A draft of five rounds, with Usyk knocked down in round 5, answered
  totals 47–47 with the snapshot taken (Usyk 21-0).
- Finalised as KO 9 at 2:52: totals 77–74, Usyk 22-0 (15 KOs), Dubois
  21-3. The snapshot was unchanged.
- The same finalise sent again: 200, and the records did not move.
- A card with a round after a round-2 KO: `400` with the after-stoppage
  problem.

The last box, a real bout scored over HTTP end to end, is the run above,
made by Claude; Erez has not run it.
