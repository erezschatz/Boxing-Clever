# Who brought a title in may be not recorded

## Context

From task 10's planning, 2026-11-22. v1 never stored who held a belt coming into a
fight, and its 86 title bouts carry 103 title lines under a title that is not vacant.
The importer cannot write them while `bout_title.holder_side` must be A, B or vacant.
Erez, asked whether to reject them or allow an unknown holder: "not recorded" (D127).
D127 says the migration, the rules, the API and the pages are changed before the
importer writes a title bout; this file is that work.

**Promise** — A title fight from the old app arrives with its belts on it even though
nobody wrote down who held them, the pages say so plainly, and I can fill the holder in
later from the bout form.

**Acceptance**

- [x] Claude: a migrated database keeps every title line as it was and then accepts a line with no holder (`tests/db/migrate.test.ts`)
- [x] Claude: `PATCH /api/bouts/:id` takes and answers a null holder, and still refuses a line with the field left out (`tests/api/bouts.test.ts`)
- [x] Claude: the rules give the title to a winner whatever the holder, and to nobody after a draw or no contest with the holder not recorded (`tests/rules/titles.test.ts`)
- [x] Claude: the event card and the fighter card say "holder not recorded" for such a line (`tests/front/shell.test.ts`)
- [x] Erez: in the browser, the bout form's dropdown for who brought a title in offers "Not recorded", saves it, and the event card and fighter card read "holder not recorded" (Erez, 2026-11-23: "Looking very good, all is in")

## Decisions

### 2026-11-22 · The holder change has a task file of its own

**Decision** — D127's migration and the changes that go with it are recorded here, not in `tasks/10-import-v1.md` as D127 said.
**Rejected** — A `## What was done` section in task 10 for this commit.
**Why** — A task file with a record is compiled as done (tasks/README.md), and task 10 has no importer yet. `tasks/retirement-is-a-tko.md` did the same for a change the import needed first.

### 2026-11-22 · After a draw with the holder not recorded, nobody is shown holding the title

**Decision** — `holderAfter` gives null for a draw or a no contest whose line has no holder, so the title is in nobody's list of titles held until a later finalised bout with it on the line says otherwise, or Erez fills the holder in.
**Rejected** — Leaving it with whoever the earlier watched bouts left it with, when that fighter is one of the two. Counting the line as vacant in the pages' wording.
**Why** — SPEC §8 lets the last finalised bout decide, and this one does not say whose belt it was. The earlier holder may have lost it off-screen and be the challenger here, so carrying it over would state something the app was not told. The pages say "holder not recorded", not "vacant", because the belt was not vacant.

### 2026-11-22 · The bout form offers "Not recorded" for any title line, and the holder becomes a dropdown

**Decision** — Who brought a title in has a fourth option in the bout form, "Not recorded", on every bout, and the API accepts null from any caller. With four options it is a dropdown, no longer a row of buttons. A title newly put on the line still starts as vacant, as before.
**Rejected** — Showing the option only on a line that already has no holder. Refusing null over HTTP, so only the importer could write it. Keeping the row of buttons with four on it, against Erez's rule of 2026-11-20 (buttons for two or three, a dropdown for more).
**Why** — `PATCH /api/bouts/:id` replaces the whole title list, so a form that could not send null back would force Erez to pick a holder for every belt on an imported bout before he could change anything else about it.

## Review · 2026-11-22

Read cold against the staged diff, before the commit, by a read-only Claude subagent (Explore) carrying out `docs/reviewer.md`. It found the four ticked acceptance boxes to hold, the other readers of `holder_side` (`boutView` in `server/api/card.ts`, `listTitleLinesForFighter`, `beltsOf`) to handle null, and the record to match the diff apart from one finding.

### The holder's choice had four buttons, against the "dropdown for more than three" rule

**Found** — `front/bout-titles.ts` passed four options to `choiceRow`, whose comment in `front/dialog.ts` records Erez's rule of 2026-11-20: buttons for two or three, a dropdown for more. SPEC's dialogs paragraph said "two or three options" and listed the four-option holder among them. No decision named the exception.

**Done when**

- [x] A title line in the bout form with four holder options → a dropdown
- [x] The SPEC dialogs paragraph → names the holder as a dropdown of four, and no row of buttons has more than three
- [x] The comment on `choiceRow` in `front/dialog.ts` → agrees with how many options it is given (two or three, as before)
- [x] The corner of fighter A and the weight unit → still rows of buttons, unchanged
- [x] Choosing A, B, Vacant or Not recorded for a line → that holder is set (`holderOf`, `tests/front/forms.test.ts`), and a newly added title still starts as vacant

**Not asked** — Hiding "Not recorded" on lines that already have a holder. Any change to the API, the rules or the migration.

## What was done

2026-11-22. A title line's holder may be null, meaning not recorded (D127).

- `server/migrations/008-holder-not-recorded.sql` rebuilds `bout_title` with `holder_side` nullable and copies every row as it is. Nothing refers to that table, so it is not one of the rebuilds that turn foreign keys off.
- `server/rules/titles.ts`: `TitleLine.holder_side` may be null. `holderAfter`'s code is unchanged: a winner takes the title, and a draw or no contest with no holder falls through to null. `server/db/bout-title.ts`: `HolderSide` includes null.
- `server/api/bouts.ts`: `holder_side` is nullable in the titles schema; the field itself is still required.
- `front/format.ts`: `holderText` names who brought a title in, "vacant", or "holder not recorded". `front/event-page.ts` and `front/fighter-page.ts` use it where each had its own expression, which printed "vacant" for anything that was not a side. `front/bout-titles.ts`: who brought a title in is now a dropdown of four (`holderChoices`, `holderOf`), the fourth "Not recorded"; it was a row of three buttons. `front/bout-form.ts`: the `Holder` type includes null. The scorecard's champion chip (`beltsOf`) needed no change: it lists the belts whose holder is that side.
- `docs/SPEC.md`: the data model row, Scoring §8, the bouts API row, the event card and the dialogs paragraph, which now names the holder as a dropdown.
- Tests: `tests/rules/titles.test.ts` (winner, draw, no contest, missed weight, and a draw after a bout that named a holder), `tests/api/bouts.test.ts` (PATCH and GET with null; a missing field is 400), `tests/db/migrate.test.ts` (migration 008; the two migration 007 tests now stop at version 7, since they asserted that a full migrate applied only 7), `tests/front/shell.test.ts` (`holderText`), `tests/front/forms.test.ts` (the four choices and the holder each gives).

Verified 2026-11-22 by Claude: `deno task test` 242 passed, 0 failed; `deno task check` clean. On a copy of the dev database in the scratchpad: `deno task migrate` applied 8, the four title lines read the same before and after, `PRAGMA foreign_key_check` empty; with the chamber served from that copy on port 8899, `PATCH /api/bouts/:id` with a null holder answered 200 with it, and `GET` read it back. `deno lint` reports two unused variables in `.claude/hooks/check-unit.test.mjs`, which this change does not touch. The review's one finding was answered before the commit: the holder is a dropdown. Not verified in the browser, the dropdown included; that box is Erez's.

Reviewed by: a read-only Claude subagent (Explore), which had not seen the work, on the staged diff before the dropdown fix; the fix itself was not read again
