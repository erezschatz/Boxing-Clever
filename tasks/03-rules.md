# 03 · The rules

## Context

**Promise.** The scoring rules of this app — the 10-point round, deductions, the
stoppage rule, which decision means what, how a record moves — exist as
plain functions I can read in one file each, and a test states every rule.

**Acceptance.**
- [x] `server/rules/scoring.ts`: round total, bout total, validation of a card against SPEC Scoring §1–4, including the no-gaps invariant
- [x] `server/rules/decisions.ts`: the decision-type table (§5): codes, winner kind, display label — label derived from code, never the reverse
- [x] `server/rules/records.ts`: given a result, the record deltas for both sides (§6), and their reversal
- [x] `server/rules/weight.ts`: v1's six conversion functions with the same contracts (round-trips, two-decimal), ported behaviour-first
- [x] `tests/rules/*.test.ts`: one test per statement; the KO-in-round-2-with-knockdown worked example passes exactly as SPEC states
- [x] `server/rules/` imports nothing

## What was done

2026-11-03. Four pure modules under `server/rules/`, each citing the SPEC
section it implements:

- `decisions.ts`: the §5 table. For each of the 13 codes it holds the label,
  the winner kind (side, draw, none), the ending (stoppage, distance, either;
  new D20) and whether it counts as a KO. `decisionLabel` derives the label
  from the code, and nothing maps a label back to a code. `winnerFits`
  checks a winner against the code. `Side`, `Winner` and `DecisionType` live
  here now, and `server/db/` imports them, as it does `DeductionReason` and
  `WeightUnit`, instead of declaring its own.
- `scoring.ts`: `roundTotal` (§2) and `boutTotal` (§3) for the browser and
  the server alike. `validateCard` returns every problem as
  `{ rule, message }`:
  - a scored round is exactly the numbers 10–9, 9–10 or 10–10 (§1);
  - the rounds, in any order, are 1…n with no gaps or repeats and none
    beyond the schedule;
  - a stoppage's result round is 0–0, is the last round, and is recorded;
  - a distance decision, or an NC that was not stopped, scores every
    scheduled round;
  - deductions are 1–10 whole points, in a recorded round, with a known
    reason;
  - the winner fits the code, and the result round and the m:ss time fit
    the schedule and the round;
  - a finalised card has a result.

  A card with no rounds is valid with any result, including a stoppage with
  no round (D20). Nothing compares the totals with the decision.
- `records.ts`: `recordDelta` gives the §6 deltas for both sides and throws
  on an outcome that breaks §5. `reverseDelta` and `recordChange(before,
  after)` together cover finalise, a re-save that moves nothing, an edit that
  reverses and re-applies as one delta, and going back to draft.
  `applyDelta` and `isNoChange` serve task 05 and the recompute script. The
  record type is `FightRecord`, so it does not shadow TypeScript's
  `Record<K, V>`.
- `weight.ts`: v1's six functions under v1's names, ported test-first, with
  v1's `Number()` reading of stone parts and its pass-through for an unknown
  unit. There are two intended changes (D21): the exact pound, and
  unreadable stone input returns null instead of 0.

  It was compared once against v1's own file, from a throwaway script that
  is not kept because it needs the v1 checkout: 81,019 calls (sweep in D21).
  The only differences are kg conversions, by one cent, in 568 of them.
  `weight.test.ts` pins one of them (96.3 kg → 212.31 lbs; v1 gave 212.3).

The acceptance box "`server/rules/` imports nothing" is read as "nothing
outside the folder": `scoring.ts` and `records.ts` import `decisions.ts`.
SPEC *Architecture* now says so instead of "no imports of its own", and §5
says which card shape each code implies.

Left for later:
- IMPORT.md stores the sheet's 8- and 7-point rounds as written, and §1
  refuses them. Task 11 decides whether the importer validates with a
  relaxed rule or writes those rounds directly. Until then, any later
  `PUT /card` of such an imported bout would be refused.
- A `Card` round holds both sides, so a one-sided `round_score` row cannot
  be expressed. Task 05's mapping from rows to a `Card` must refuse such a
  row rather than fill in the missing side.

Tests under `tests/rules/` (49):
- `decisions.test.ts` (7) and `records.test.ts` (9) cover §5 and §6, one
  statement per test.
- `scoring.test.ts` (22) covers §1–4. The KO-in-round-2 worked example
  passes as SPEC states: rounds 1 and 2 are recorded, round 2 is points 0 /
  total −1, and the bout totals are 10–8. v1's three stoppage defects each
  have a test, and so do the NC shapes and mixes.
- `weight.test.ts` (10).
- `pure.test.ts` (1) fails if a rules file imports anything outside the
  folder, whether by `from`, a bare `import 'x'` or a dynamic `import('x')`,
  or touches `Deno.*` or `fetch`. Each of the four forms was planted in
  `weight.ts`, caught, and removed.

A reader that had not seen the work reviewed the diff against this record.
Its findings are fixed above: the NC shapes, unscored stoppages, string
points, round order, the import forms the purity test missed, v1 parity in
the stone parser and for unknown units, a test pinning the exact pound, and
the counts.

Run by Claude on the Mac, Deno 2.9.8: `deno task test` 68/68 (49 rules, 16
db, 3 health), and `deno task check`, `deno lint` and `deno fmt --check`
clean. Nothing here runs in the browser yet; the front end first uses these
functions in task 07.
