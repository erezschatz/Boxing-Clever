# 11 · Import: the Numbers sheet

## Context

**Promise.** Every fight in the sheet since November 2021 is in the database with the
scores, the records as I wrote them down that night, and who was champion —
and every row the importer could not read is listed for me to fix.

**Acceptance.**
- [x] `scripts/import-sheet.ts` reads `data/import/sheet.csv` per IMPORT.md: event rows, bout rows, fighter rows, `(c)`, weights, records, `x`, stoppage markers, the decision spelling table, winner inference
- [x] Rejects for every ambiguity named in IMPORT.md; nothing guessed
- [x] Fighter aliases seeded from the sheet's spellings
- [x] Tier-3: a fixture CSV of a dozen representative bouts (points win, KO with time, draw, title line, `(c)`, st-lbs-oz weight, typo record) imports and reads back correctly
- [ ] Verified by Erez on the full export; rejects reviewed and the source or aliases fixed until the list is acceptable

## Decisions

### 2026-11-23 · The sheet's two files are written by a script from a copy of the Numbers file

**Decision** — `scripts/sheet-export.jxa.js`, JavaScript for Automation run with `osascript`, opens a copy of `docs/reference/boxing.numbers` in Numbers and writes `data/import/sheet.csv` and `data/import/sheet-colours.csv`. `sheet.csv` is Numbers' own CSV export of the table, so the CSV stays the source of every value; the colours are read as D64 says. The export is no longer done by hand, and can be run again whenever the sheet is corrected.
**Rejected** — Erez exporting by hand (D8's wording), which leaves the colours to a second step and makes each correction of the sheet two steps. Writing the CSV from the cells' displayed values, which was tried first: Numbers repeats a merged cell's value on every row it covers, so the category and date came out on the fighters' rows too.
**Why** — Erez, 2026-11-23, asked whether Claude may export both files itself, opening Numbers on a copy: "Yes, export them". The script's output is byte for byte the files that were measured. It adds no dependency; D8's reasons against a parser library stand.
Supersedes: D8

### 2026-11-23 · The winner is the row with the Decision cell, and the judges' cards check it

**Decision** — The row that carries the `Decision` cell is the winner's. Where the sheet has all three judges' totals for the bout, they must give the same winner, or the bout is rejected. A points decision typed on both rows is settled by the judges' cards, and rejected when there are none; a stoppage typed on both rows is the row's that carries the stoppage's cell. A draw or a no-contest may be on either row or both. The sheet's own totals are not asked.
**Rejected** — Inferring the winner from the totals (IMPORT.md until now). Requiring the totals to agree with the Decision row, which Erez accepted on 2026-11-23 as Claude proposed it, before it was measured: in 466 points decisions with the cell on one row, the winner's total is lower in 41 and level in 39, because the rounds are Erez's own card and not the judges'. That check would have refused 80 bouts for being scored against the official result.
**Why** — Measured on the export: the cell is on one row in 1,039 of 1,105 bouts; where three judges are given they give that row the win in 419 of 420 (among them 326 UD at 3–0, 51 MD at 2–0 with one level, 40 SD at 2–1). Erez accepted the row as the winner; replacing the totals check with the judges is Claude's, and is his to overrule.

### 2026-11-23 · A stoppage is read from the cell that holds its time or marker, on the winner's row

**Decision** — After a stoppage the winner's row has the time (`2:44`), or `KO`/`TKO` where none was noted, in the cell of the round it ended in, and the other row has `x`. That round is stored 0–0 with the time, or with no time. `RSC` is a `TKO`. A retirement (`RTD`, `RET`) has no such cell: it is a `TKO` at 3:00 of the last round scored (D55). Rejected to the list: a `KO`, `TKO` or `DQ` with no such cell (18 bouts), a time on the row that does not carry the decision (5), a retirement with a time in a round (2), and cells that are not rounds, then the stoppage, then `x` (7).
**Rejected** — IMPORT.md's reading until now, the marker on the stopper's row and the time on the stopped fighter's: no bout in the sheet has both. Reading a `TKO` with no time cell as stopped in the first `x` round, or as a retirement: the sheet does not say which, and the card's shape differs between them.
**Why** — As measured: of 523 stopped bouts, one row has the time or marker and the other `x` in every one, and that row carries the Decision cell in 507.

### 2026-11-23 · Digits and missing decisions, as Erez ruled

**Decision** — `3` on one row and `0` on the other is a unanimous decision for the 3. Any other digits in the `Decision` column, a bout with no decision, and a spelling outside the table in `server/import/sheet-card.ts` (`KBO`, `ND`, ``Z`che``) are rejected to the list. `D` and `DRAW` are a draw (`D`); the sheet does not tell a majority draw apart.
**Rejected** — Reading `2`/`1` as a split decision (it could be a majority one). A `DEC` for a bout with no decision, the winner by the totals.
**Why** — Erez, 2026-11-23: "Yes, all five" to the readings proposed, this one among them. 19 bouts have no decision and 5 have other digits.

### 2026-11-23 · A name is read without its marks, and the marks say who held which belt

**Decision** — `(c)`, a bracket and `#N` are taken out of a `Boxer Name` before it is matched. `#N` and a bracketed number are a ranking and are not kept. A bracket of letters (`(WBC/WBA/WBO)`) names the bodies whose belts the fighter came in holding. Who held each belt of a title line: nobody when the line marks that belt vacant; the fighter whose bracket names its body; else the one fighter marked `(c)`; else not recorded (D127).
**Rejected** — Every title line with no `(c)` as vacant. Holder not recorded on every belt of a unification, which was proposed before the brackets were seen.
**Why** — Erez, 2026-11-23: "Yes, all five". 251 rows carry a bracket or a ranking. Of 499 title bouts, 279 have one `(c)`, 129 none and a vacant belt, 91 neither, and none has `(c)` on both. Not kept: the ranking is TBRB's or a body's, the sheet does not say which, and task 13 back-fills TBRB's.

### 2026-11-23 · A belt is filed under the body and area a table gives its spelling

**Decision** — A title line is the class and the belts written before it, split at `/`, `&`, `,` and `. `. `server/import/sheet-belts.ts` maps each spelling the sheet uses (98 after case, hyphens, "vacant", "interim" and the women's `W` are taken out) to a sanctioning body and an area; a spelling not in it rejects the bout. A body alone takes the area of the next belt on the line that is written as a world body and its area (`WBC World`, `WBC International`, not `NABF`), or "World" when the line says world after the class, and is rejected otherwise. "Interim" and "Vacant" are read per belt. An eliminator and a tournament bout are the class alone, with no title. A class is matched by its name, its "Junior" name, or one of four older names (Strawweight, Light Welterweight, Light Middleweight, Junior Heavyweight).
**Rejected** — Splitting a spelling into body and area by rule (first word the body), which files `Commonwealth` and `British` under no body and `NABO` apart from `WBO NABO`. The table in this task file, as first offered to Erez: it has to be in the code to be used, and two copies would drift.
**Why** — Erez, 2026-11-23: "Yes, all five". The table's right-hand side is Claude's reading (CBC for Commonwealth, BBBOFC for British and English and the area titles, EBU for European, ANBF for Australian, WBC for NABF, WBO for NABO, IBF for USBA; `WBA Super World` as the WBA World title and `WBA Normal World` as "World Regular"; areas spelled as the titles v1 brought in spell them) and is Erez's to correct in that file. 5 title lines are rejected as written.

### 2026-11-23 · Fighters from the sheet: matched on the whole name, and the record of their latest night

**Decision** — A sheet name is matched against the whole name of the fighters here, ignoring case, and exactly against their aliases (D14). A name that matches nobody makes a fighter: the first word is the first name and the rest the last. Every spelling the sheet uses becomes an alias of its fighter. A new fighter's record, weight and colours are those the sheet wrote for their latest night, and that night's result is added when its bout is written, as D137 does for v1. A night whose record or weight cannot be read is passed over for this, so one bad cell rejects its own bout and not the fighter's others. A fighter who was here already keeps their record: the result is added only while the fighter's record is still exactly the one the sheet wrote going into that bout. A record with no bracket (`1-0-0`) has no knockouts.
**Rejected** — Matching on first and last name as v1's import does, which misses a fighter the app splits differently. Adding every sheet result to the record, which D132 did and D137 corrected. Marking which fighters the sheet created, to know whose record is the sheet's on a later run: a column for one import. Refusing the 109 records with no bracket: 93 of them are `0-…`.
**Why** — Proposed to Erez on 2026-11-23 beside the five readings and not ruled on separately; his to overrule. A fighter v1 brought in has a later record than any in the sheet. Known limits: a fighter all of whose v1 bouts were rejected is made by the sheet with the sheet's record, and a later v1 run adds only its latest result to it; a fighter here already whose record happens to equal the sheet's going into their latest sheet bout (a 0-0-0 made in the app) has that result added; and a bout fixed after a later night was imported adds nothing, since the record has moved on.

### 2026-11-23 · A bout v1 brought in gets its record on the night from the sheet

**Decision** — A sheet bout found here already (same day, same two fighters) is left as it is: v1 holds the card. Where a side of that bout has no record on the night and the sheet's cells for that fighter can be read, they are written as that side's snapshot; a side that has one keeps it; the `no_snapshot` mark is taken off once both sides have one. Otherwise D138 stands: a marked bout takes no snapshot from a save of its card.
**Rejected** — Leaving v1's 34 marked bouts without a record for good (D138 as written). Replacing v1's card with the sheet's.
**Why** — D138 marked those bouts because the record on a night long past cannot be worked back from today's; the sheet wrote it down that night. BOXING-CLEVER-V1.md already said the sheet wins for the snapshot and v1 for the card. Only the card of 19 April 2025 is in both (4 bouts, 3 of them without a snapshot).
Supersedes: D138

### 2026-11-23 · A place is split as it is written, and the ones that come out wrong are corrected in the app

**Decision** — The sheet's locations are split at `.` and `,` as migration 007 and v1's import split theirs (D117, D129), and a bout's place within its card is its place under its date cell. A location with fewer than three parts is rejected. One with three or more is imported as split, including those whose parts are not venue, city and country: on this export the countries `Nevada`, `Las Vegas`, `CN`, `C` and `Québec`, a venue whose name holds a full stop (`James L. Knight Center`), and the UK written `UK`, `England`, `Wales`, `Northern Ireland` and `North Ireland`. Erez corrects those in the sheet or in the venue form.
**Rejected** — A table of countries, rejecting a last part that is not in it: it would settle `UK` against `England` for Erez, and reject every country not thought of. Splitting at commas only where there is one, which was tried on the three locations that mix the two and gets a different one of them wrong.
**Why** — IMPORT.md's rule is that a location which does not give a venue, a city and a country is refused, never guessed; which words are a country is not something the split can know. The wrong ones are few and are listed in IMPORT.md.

### 2026-11-23 · The sheet's 240 undated bouts are left out

**Decision** — The first 240 bouts of the sheet (lines 2–720 of the export), which stand under no `Date/Location` cell, are not imported. They stay on the rejects list of every run, and no date is added to the sheet for them.
**Rejected** — Erez adding dates to the Numbers file and exporting again (offered, not chosen). Importing them under an event with no date, or a date worked out from the fighters' records: a bout belongs to an event on a day, and nothing is guessed.
**Why** — Erez, 2026-11-23, asked whether those bouts have dates he can add or should stay out: "Leave them out".

## What was done

2026-11-23. The Numbers sheet's import is built: `deno task import-sheet` reads `data/import/sheet.csv` and `data/import/sheet-colours.csv`, both written by `scripts/sheet-export.jxa.js` from a copy of the Numbers file, and writes one batch.

- **Readers**, pure, one per kind of cell: `server/import/sheet-rows.ts` (the CSV, the bouts, the date cell), `sheet-fighter.ts` (name, record, weight), `sheet-category.ts` with the belt table in `sheet-belts.ts` (class, contracted weight, title line), `sheet-card.ts` (rounds, deductions from the colours, stoppage, decision, judges, winner). The card passes `validateCard` or the bout is rejected with the rules' own message.
- **Writer**: `server/import/sheet.ts`. What the two imports share (the batch with a savepoint per bout, the event at a place, writing a card) moved from `v1.ts` to `server/import/batch.ts`; v1's tests pass unchanged.
- **Database**: `findFighterByFullName` and `unmarkNoSnapshot`. No migration.
- **Docs**: IMPORT.md's Source A is rewritten from the export as measured (it had the stoppage cells and the winner wrong, and did not know about the 240 undated bouts, the older fights, or the names' brackets); SPEC §7 and the `bout` row for the snapshot the sheet supplies; BOXING-CLEVER-V1.md and IMPORT.md on the overlap, which is one card, not three events.
- **Tests**: `tests/import/sheet.test.ts`, 22 tests, tier 1 for each reader and tier 3 over `tests/fixtures/sheet` (eleven bouts and a stray row: 7 written, 5 rejected), the records, a second run, a corrected row coming in on a third, and a v1 bout getting its snapshot. `deno task test`: 277 passed. `deno task check`, lint and format: clean.

Run by Claude against the real export on a copy of the database as v1's import left it (never `data/boxing.db`): 1,105 bouts read, 741 written, 4 already there (3 given their record on the night), 360 rejected; a second run wrote none. 240 of the rejects are the first 240 bouts of the sheet, which stand under no date; the other 120 are listed by reason in IMPORT.md. The copy then held 1,288 fighters, 235 events, 173 venues and 274 titles, and the foreign-key check was empty. The export script was run for real and its two files are identical to the ones measured.

Before commit, a cold reader found eight things (`## Review` below). All are fixed in this change, with tests, and the fixes were not read again by it. The run against the real export was repeated after them, with the same counts.

Not done, and Erez's: the run into the real database and the rejects (the last acceptance box); the belt table's right-hand side; dates for the 240 undated bouts, which only the sheet can give.

Reviewed by: a read-only Claude subagent (Explore), cold, on the staged diff before the fixes below, carrying out docs/reviewer.md. It found the card reading, the rollback of a rejected bout, the second run, v1's refactor and the counts to hold, and raised the eight findings in the review section.

## Review · 2026-11-23

### Card order is not the sheet's order once a bout above is rejected

**Found** — `server/import/sheet.ts` numbered a bout with the event's next free place, so a bout below a rejected one moved up, and the rejected one came in last when fixed.

**Done when**

- [x] A card where every bout is written → card orders 1…n down the sheet
- [x] A bout rejected above others → those below keep their place under the date cell, with a gap
- [x] A bout fixed and written on a later run → takes its place under the date cell
- [x] Two date cells for the same day and venue → one event, each bout numbered under its own cell (the places decision says so)
- [x] v1's import → card orders unchanged

**Not asked** — renumbering v1's bouts or bouts Erez has reordered in the app.

### A bad record or weight on a fighter's latest night rejects every one of their bouts

**Found** — a new fighter's record came from their latest row, and an unreadable cell there rejected every bout they were in.

**Done when**

- [x] A fighter with several bouts and an unreadable record on the latest one → the other bouts are written, and the latest is rejected with the record's reason
- [x] The same with an unreadable weight on the latest night → the same
- [x] An unreadable record on the bout's own row → that bout rejected

**Not asked** — guessing a record from another night.

### Aliases are matched with exact case; the decision says case is ignored

**Found** — `findFighterIdByAlias` is an exact match, and the decision and IMPORT.md said aliases ignore case.

**Done when**

- [x] The decision and IMPORT.md → say aliases match exactly, per D14
- [x] An exact alias match → its fighter
- [x] A whole-name match in any case → that fighter

**Not asked** — fuzzy matching.

### A v1 bout with half a snapshot keeps its `no_snapshot` mark

**Found** — the sheet filled a v1 bout's snapshot only when both sides were empty, and an unreadable weight in that branch rejected a bout that was already here.

**Done when**

- [x] A v1 bout marked `no_snapshot` with neither side → both sides from the sheet and the mark off
- [x] Marked, with one side filled → the missing side from the sheet, v1's side kept, the mark off, and the bout listed
- [x] Not marked and with a snapshot → untouched
- [x] Already here, with a sheet cell that cannot be read → counted as already here, that side left without

**Not asked** — replacing v1's card.

### A body alone borrows a regional area from another body's belt

**Found** — `WBA/NABF Heavyweight Title` filed the WBA belt under "WBA NABF", because NABF is filed under the WBC.

**Done when**

- [x] `WBO/WBA/IBF/WBC World …` → four World belts
- [x] `WBA/NABF` → rejected
- [x] `WBA/WBC International` → both International
- [x] `WBA/Commonwealth` → rejected
- [x] A body alone followed by world after the class → World

**Not asked** — changing the right-hand side of the belt table.

### The reject reason says "no judges' cards" when the cards are there

**Found** — a stoppage typed on both rows was rejected for having no judges' cards, which do not decide a stoppage.

**Done when**

- [x] A stoppage with the decision on both rows → the row with the stoppage's cell won; with no such cell, rejected for that
- [x] A distance decision on both rows with three cards → settled by the cards
- [x] A distance decision on both rows without cards → rejected

**Not asked** — inferring the winner from Erez's totals.

### The record and comments don't match the fixture and the script name

**Found** — "twelve bouts" where the fixture has eleven and a stray row; `scripts/sheet-export.js` for `sheet-export.jxa.js`; and the 5 bouts with other digits missing from IMPORT.md's breakdown.

**Done when**

- [x] The record, the test comment and the fixture → the same counts
- [x] The script's comment → names the real export script
- [x] IMPORT.md's reject breakdown → says the digit rejects are among the undated (lines 5, 14, 17, 74, 77)

**Not asked** — re-running the real import.

### No decision entry for importing known-wrong places

**Found** — IMPORT.md listed places that come in wrong and are not rejected, with no decision behind it.

**Done when**

- [x] A dated entry under `## Decisions` → records importing places as split, with the rejected alternatives
- [x] A place with a full stop inside a name → split there, as the decision says, and named in it

**Not asked** — changing the venue model.

