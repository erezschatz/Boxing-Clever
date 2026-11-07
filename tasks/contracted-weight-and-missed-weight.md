# Contracted weight and missed weight

## Context

Asked by Erez, 2026-11-03, in answer to "catchweight bouts" (D26). There is
no catchweight class: some bouts are fought at a contracted weight that is
not a class limit, and either both fighters come in above it, or one makes
it and the other does not. Missing weight should be marked and highlighted.
Must land before the imports (tasks 10–11), which meet such bouts.

**Promise.** When a fight is at a contracted weight I can enter that weight
instead of a class, and when a fighter misses weight I can mark it, and the
mark stands out wherever the fight is shown.

**Acceptance.**
- [x] A migration lets a bout carry a contracted weight (lbs) instead of a weight class; one of the two is required
- [x] Each side of a bout can be marked as having missed weight; neither, either, or both
- [x] SPEC *Data model* and *API* describe both; `POST/PATCH /api/bouts` accept them
- [ ] The scorecard and the fighter's history show the contracted weight and highlight a missed weight
- [x] Tier-3 tests: a contracted-weight bout round-trips; a bout with neither class nor weight is refused; the missed-weight marks round-trip per side
- [x] The importers map the sheet's and v1's bouts onto this (noted in IMPORT.md)

## What was done

2026-11-07 (D26, D45; the class dropdown's limits are D46 and
`tasks/class-limits-in-dropdown.md`).

Where things are:
- `server/migrations/004-contracted-weight.sql` rebuilds `bout` (it starts
  with the rebuild line, so `migrate.ts` turns foreign keys off around it
  and checks every reference before committing). `weight_class_id` may
  now be null. The new columns are `contracted_weight REAL CHECK (> 0)`,
  in pounds, and `missed_weight_a`/`missed_weight_b`, each `INTEGER NOT
  NULL DEFAULT 0` and 0 or 1. `CHECK ((weight_class_id IS NULL) <>
  (contracted_weight IS NULL))` makes it exactly one of the two. Every
  existing bout keeps its class and gets no mark; the three bout indexes
  are made again.
- `server/db/bout.ts`: `BoutFields` carries the three new columns, written
  by `insertBout` and `updateBout`.
- `server/api/bouts.ts`: POST takes `weight_class_id` or
  `contracted_weight` (the other null or left out; neither or both is a
  400) and `missed_weight_a`/`_b` as true/false, false when left out. PATCH
  checks the bout as it would stand, so moving between a class and a
  contracted weight sends both, one null.
- `server/api/card.ts`: the snapshot's TBRB rank is null for a bout with no
  class (D45).
- `front/format.ts`: `boutWeightText` ("Flyweight", or "Contracted at
  150.5 lbs") and `missedWeight`. `classText` is D46.
- `front/entry.ts`: `readBoutWeight` turns the form's choice into the two
  fields. `titlesOffClass` takes a null class, and then every title is off
  it.
- `front/bout-form.ts`: the "Weight" dropdown lists the classes and
  "Contracted weight (no class)", which opens a box for the lbs. A
  "Missed weight" fieldset has a tick per fighter. With a contracted
  weight no title is offered, "+ New title" is hidden, a new title begun
  for the class is dropped on switching, and a title left on the line is
  refused on Save. The titles part moved to `front/bout-titles.ts`, since
  the form had grown to 486 lines; it is now 375. The move changed nothing
  else in it.
- `front/bout-page.ts` and `front/side-head.ts`: the scorecard's subtitle
  says the class or the contracted weight, and a side that missed weight
  shows a "MISSED WEIGHT" tag under its name. `front/event-page.ts` (the
  card) shows the same tag beside the name, and the class or the
  contracted weight in the class column. `front/style.css`: `.missed`.
- SPEC *Data model*, *Scoring* §7, *API* and *Front end*; IMPORT.md, for
  both sources; D45; PLAN.

Not done here: the fighter's history page. `/fighters/:id` does not exist
yet; task 09 builds it. Its API, `GET /api/fighters/:id/bouts`, already
answers both fields (tested), and SPEC *Front end* now says the fighter
card shows them as the scorecard does, through `boutWeightText` and
`missedWeight`. That acceptance box is left open for 09 to close. The
importers are tasks 10 and 11; IMPORT.md says how they map onto this.

Tests:
- `tests/api/weights.test.ts` (tier 3, new). A contracted-weight bout
  round-trips through POST, GET, the event's bouts, the fighter's bouts and
  a finalise. Neither, both, 0, a negative and a string are refused on
  POST, and on PATCH nothing changes. A bout moves to a contracted weight
  and back. The marks go neither, B, A, both, and back to B only; other
  PATCHes leave them; 1, "yes" and null are refused. A contracted-weight
  snapshot has a null TBRB rank even with a heavyweight list on file.
- `tests/db/migrate.test.ts` "migration 004": a finalised bout with its
  snapshot, a knockdown round and a belt, and a draft, come through with
  every column equal plus the three new ones. Rounds, deductions and belts
  are kept, no reference is broken, foreign keys are on, the indexes are
  back, deleting still cascades, and a bout with no class or weight is
  refused. The two migration 003 tests that ran every migration now
  migrate only to 003.
- `tests/db/tables.test.ts`: the schema refuses neither, both, a weight of
  0 and a mark of 2 or null.
- `tests/front/forms.test.ts`: `readBoutWeight`, "0.001" included, and
  `titlesOffClass` with no class. `tests/front/shell.test.ts`: `boutWeightText`, `missedWeight`
  and `classText`.

`deno task test` 183/183; `deno task check`, `deno lint` and `deno fmt
--check` clean; `deno task build` makes `front/dist/app.js`.

Run by Claude on a copy of Erez's `data/boxing.db` in the scratchpad
(`BOXING_DB` set, `deno task migrate`): "applied 4". The one bout kept
class 9, 12 rounds and its snapshot, with no contracted weight and both
marks 0. Its 24 round rows and 1 belt were kept, and `PRAGMA
foreign_key_check` was empty. Erez's own database is untouched until the
app is started on it, which migrates it (D29).

The independent reader (a read-only subagent over the staged diff) found
no server bug and these, all fixed before the commit:
- A new title begun for the class stayed open after switching to a
  contracted weight, and "Add title" would have saved it under the class
  no longer chosen. It is now dropped on the switch and never shown at a
  contracted weight.
- "0.001" lbs rounded to 0 and reached the server; the form now refuses
  it with its own message.
- IMPORT.md said `rules/weight.ts` reads "150lbs" and "10st 10lbs"; it
  does not, and the line now says task 11's parser does.
- The record claimed both migration 003 tests were pinned to 003; the
  second now is.
Left as it is: `front/entry.ts` is 461 lines and `front/bout-page.ts` 474,
over the ~400 split point; splitting either is its own change.

Not checked by Claude: anything in the browser. The bout form's weight
dropdown and box, the missed-weight ticks, and the tag on the scorecard
and the card are Erez's to try.

