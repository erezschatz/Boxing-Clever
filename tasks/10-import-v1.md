# 10 · Import: v1 databases

## Context

**Promise.** Everything I scored in the old app is in the new one, with the snapshots
intact, and I have a list of anything the importer could not place.

**Acceptance.**
- [x] `server/import/` core: batch, transaction per batch, rejects table, idempotent re-run
- [x] `scripts/import-v1.ts` reads the dumps described in IMPORT.md and maps per BOXING-CLEVER-V1.md
- [x] Rejects report printed and stored: row, reason
- [x] Tier-3: a fixture dump of a few bouts imports, re-imports without duplicates, and a malformed deduction string is rejected without losing the batch
- [ ] Verified by Erez against the real dumps; the rejects list reviewed

## Decisions

### 2026-11-22 · The real import runs into a fresh database; the test database is set aside, not deleted

**Decision** — Erez's dev database (`data/boxing.db`), which holds the events, bouts, fighters, titles and venues he made while testing tasks 07–09 and the venues, stays as it is until the importer is ready. The real run of the v1 import starts by stopping the chamber and renaming that file to `data/boxing-test-<date>.db`; the chamber then creates a fresh database (migrations, the weight classes) and the import runs into it. The test file is kept to look back at. The importer's tests run on their own fixtures, never on that file.
**Rejected** — Clearing the test data now, while Erez is still testing on it. Importing into the test database: its bouts would collide with v1's on the import's key (event date and fighter names) and be skipped as already there, its finalised bouts have already moved records that v1's fights would count again, and its titles and fighters would sit beside v1's for a merge by hand. Deleting the test file.
**Why** — Erez, 2026-11-22: the two events he scored for testing were also scored in the old app, "so nothing will be lost", and "Keep it for now, store the decision."

### 2026-11-22 · v1's cards are read as v1 wrote them, not as IMPORT.md described them

**Decision** — Measured on 2026-11-22 against v1's code and its 172 Mongo documents (29 events, 27 Jun 2025 to 4 Apr 2026), the mapping is:
- **Deductions.** v1 stored each deduction as its reason alone (`KnockDown`, `LowBlow`, `Holding`, `HeadButt`, `IllegalPunch`, `Other`) and no points. A deduction is one point where the side's `round_score` less its `total_score` equals the number of its deductions in that round; where it does not, the bout is rejected. `IllegalPunch` becomes `other` with the note `illegal punch`.
- **Stoppage round.** v1 dropped it, so a stopped card holds rounds 1 to N−1 for a result in round N. The importer adds round N at 0–0 (SPEC Scoring §4). A stopped card with rounds missing before N is rejected. A card with no rounds at all is imported as watched, not scored.
- **Winner.** v1 wrote `draw` only for `MT` and `T` and a side for everything else. The winner's kind comes from the decision type (§5); the side from v1 where the type has one.
- **Final or draft.** A document with a decision type is final, whatever its `is_draft` says, because v1 moved both records the first time a result was saved. A document with none is a draft.
- **Records.** v1's fighter rows already count every result, so each fighter arrives with v1's record as it stands and the finalised bouts are written without moving it again.
- **Empty values.** Judges' totals of 0–0 are no card. A result round of 0 is none. An empty time is none.
- **Every card passes the rules** that `PUT /api/bouts/:id/card` applies before it is written; one that fails is rejected with the rules' problems as the reason.
**Rejected** — Parsing `"<points> <reason>"`, which is what IMPORT.md said v1 stored and is not. Taking one point per deduction without checking it against the round's total. Importing a stopped card as v1 left it, which the rules would refuse the next time it is saved. Trusting `is_draft`, which would leave 26 fights out of the bouts but in the records.
**Why** — IMPORT.md's paragraph on v1 was written from the schema file. The front end that filled it shows what was really stored, and the data agrees: 71 deduction strings, all bare reasons, and the total matches the count in every round but two, both in bout 142.

### 2026-11-22 · v1's `T` is a draw over the distance and becomes `D`; a `TD` stays rejected

**Decision** — v1's decision list labels `T` "Draw", and its 7 `T` bouts are cards that went the distance. Here `T` is a technical draw and `D` a draw, so v1's `T` is imported as `D`. A `TD` from either source, and a `T` from the sheet, are still rejected to the list for Erez to enter by hand with the last round scored.
**Rejected** — Mapping v1's codes as they are, which D53 then rejects as technical draws.
**Why** — The same letter means two things in the two apps. D53 was decided on IMPORT.md's word that "v1 already stored codes", before anyone read v1's list.
Supersedes: D53

### 2026-11-22 · Who brought a title in may be not recorded

**Decision** — `bout_title.holder_side` may be null, meaning not recorded, as `corner_a` is for an imported bout. v1 never stored who held a belt coming in, so its title bouts arrive with the holder null, except under a title v1 called Vacant, which arrives `vacant` (D42). Erez fills the holders in by hand in the bout form afterwards. A migration lifts the NOT NULL, and the rules, the API and the pages that read the holder are changed with it, in this task, before the importer writes a title bout.
**Rejected** — Rejecting every title bout from v1 (about 82 title rows). Guessing the holder from fighter A, or from an earlier bout's winner.
**Why** — Erez, 2026-11-22: "not recorded".

### 2026-11-22 · A v1 bout with no snapshot is imported with none

**Decision** — 36 of v1's documents (bouts 1–38, saved November and December 2025) were written before v1 kept the fighters' record, weight and colours in the document. They are imported with the as-of snapshot empty. Their scheduled rounds, class and event come from MySQL.
**Rejected** — SPEC §7's rule for a finalised bout with no snapshot, the fighter's record today less this bout's result: for a fight a year old that is the wrong record, stated as the record on the night.
**Why** — Erez agreed, 2026-11-22. Nothing is guessed (IMPORT.md). Still to settle while building: `card.ts` applies that §7 rule the next time such a card is saved in the app, which would fill the snapshot with the wrong record; the importer must not leave that open.

### 2026-11-22 · A location ending in a US state is in the USA

**Decision** — When the last part of a location is a two-letter US state code (`Honda Center, Anaheim, CA`), that part is the venue's region and its country is `USA`. This holds for both imports. Any other location is split as IMPORT.md says, and one that does not give a venue, a city and a country is rejected.
**Rejected** — Rejecting them for Erez to retype (12 of v1's 28 locations, and most of the sheet's 218). Leaving it for task 11, as IMPORT.md did: v1 has them too.
**Why** — Erez, 2026-11-22: "I followed the American convention of not stating the country, you can assume all those are indeed the US". The spelling `USA` is Claude's.

### 2026-11-22 · The import is a script; there is no import endpoint

**Decision** — `scripts/import-v1.ts` (and task 11's script) call `server/import/` directly. `POST /api/imports/:source` is taken out of SPEC's API table and is not built.
**Rejected** — The endpoint SPEC listed, alone or beside the script.
**Why** — The dumps are files on the machine, run a handful of times by the developer, with a report to read in the terminal. An endpoint would need an upload and a page for a one-time job. Erez agreed, 2026-11-22.

### 2026-11-22 · v1's MySQL tables are dumped as tab-separated files

**Decision** — Each MySQL table is dumped with `mysql --batch` to `data/import/v1/<table>.tsv`, a header line and one row per line. Mongo stays `mongoexport --jsonArray`.
**Rejected** — `mysqldump --complete-insert`, as IMPORT.md had it, which needs a parser for SQL INSERT statements. A MySQL driver to read the live database, which is a dependency for a one-time step (D8's reason).
**Why** — A tab-separated file is read with a split. Claude's choice; Erez takes the dumps.

### 2026-11-22 · A fighter's record is v1's row plus the results v1 never counted (supersedes D125 in part)

**Decision** — v1 began moving records on a result on 2026-05-30 (its commit 1630ec2). Before that a result changed nothing in the fighter table, so the row still holds the record Erez typed before the fight. A fighter therefore arrives with v1's row plus the result of each of their bouts whose document was last saved before 2026-05-30, counted by SPEC Scoring §6. A result saved on or after that day is already in the row and is not counted again. This replaces the *Records* line of D125, which said v1's rows count every result; the rest of D125 stands, and so does "a document with a decision type is final", whose reason is now that the result is a result, not that v1 counted it.
**Rejected** — Copying v1's rows as they are, which leaves 119 results out of the records: Brian Norman Jr. would arrive 28–0 after the loss to Haney that is in his bouts. Rebuilding every record from the latest snapshot plus results since (D13's recompute rule), which gives the same answer where there is a snapshot and has none to start from for the 36 bouts without one.
**Why** — Measured on the dumps, 2026-11-22: 119 documents were last saved before 2026-05-30 and 53 were created on or after it, with none between. Of the fighters with one bout, all 146 sides in the first group have a row equal to the document's pre-fight record, and all 96 in the second a row equal to that record plus the result. No exception either way. Claude's finding and rule; Erez accepted it, 2026-11-22.

### 2026-11-22 · Two v1 fighters with the same name are one fighter

**Decision** — Names are compared trimmed and without regard to case. v1 rows with the same first and last name become one fighter, and every bout of theirs points to it. The row kept is the one whose latest bout is the latest, by event date and card order: its nickname, weight, colours and record are the fighter's, with the results v1 never counted added from that row's own bouts only. The other row's typed record is dropped, as a merge drops the duplicate's (D28). The report names each fold. Today that is one pair: Brian Norman Jr., ids 71 (27–0, one bout) and 215 (28–0, one later bout), who arrives 28–1.
**Rejected** — Erez merging them in v1 before the dump. Rejecting both rows' bouts. Importing two fighters with one name, which the exact-name match of a re-run or of the sheet's import could not tell apart.
**Why** — Erez, 2026-11-22: "Importer handles it". The later row was typed when the earlier fight was already history, so it already counts it; adding the earlier row's results again would count that fight twice.

### 2026-11-22 · A fighter arrives with the record going into their latest v1 bout, and that bout's result is added once

**Decision** — v1's row for a fighter is the record typed for their latest bout: the record going into it where the document was last saved before 2026-05-30, and that record with the result counted where it was saved after. A fighter is created with the record going into their latest v1 bout, which is the row, less that bout's result where v1 had counted it. The result is added when the importer writes that bout as final, in this batch or a later one. No earlier bout adds anything. Where the latest bout is rejected or unscored the record stays as it went in, so a bout Erez then enters by hand is counted once.
**Rejected** — D132's rule, the row plus the result of every bout saved before 2026-05-30. It is right for a fighter with one bout and wrong for the 17 with more: Naoya Inoue's row, 31–0, is the record typed for his third bout here, so adding all three results gives 34–0 where he is 32–0. Rebuilding from the latest snapshot, which the oldest documents do not have.
**Why** — Found on the dumps while building, 2026-11-22: for each of the 17 fighters with more than one bout, the row equals the latest bout's snapshot where that document was saved before the day, and the snapshot plus the result where after. On a scratch database the import leaves Inoue 32–0, Saul Alvarez 63–3–2, Norman 28–1, and a second run changes nothing. Claude's finding; Erez accepted D132 on the one-bout evidence and has not seen this one.
Supersedes: D132

### 2026-11-22 · A v1 bout with a card and no snapshot is marked, and no later save takes one (supersedes D32 in part)

**Decision** — Migration 009 adds `bout.no_snapshot` (0/1, 0 for every bout made in the app). The import sets it on a bout that arrives with a card and no record on the night. `PUT /api/bouts/:id/card` takes the as-of snapshot of a side that has none unless the bout is marked, whether it is saved as a draft or as final. SPEC Scoring §7 says so.
**Rejected** — §7's rule until now (D32): snapshot a finalised bout that has none with today's record less its own result. Telling these bouts apart without a column, as "final with no snapshot", which was built first: the reader of the diff showed that one such bout reopened as a draft is then an ordinary draft with no snapshot, and its next save takes today's record.
**Why** — This is the point D128 left open. The 34 bouts concerned are a year old, and today's record less one result is not the record on that night; the first correction of such a card in the app would have written it as if it were. The unscored bout with no document is not marked: nothing was ever saved for it, so its first save here is its first save, as for a bout made in the app.

### 2026-11-22 · A fighter whose v1 record cannot hold the result v1 counted has their bouts rejected

**Decision** — Where taking the latest bout's counted result off v1's row would leave a number below zero, the importer does not make the fighter, and each bout of theirs goes on the rejects list with that reason.
**Rejected** — Stopping at zero. Using the row as it is and adding nothing.
**Why** — It means the row was changed by hand after v1 counted the result, and then nothing says what the record going into the bout was. None of v1's fighters is in this state today (96 of 96 checked on the dumps); the refusal is there so that a later dump cannot bring one in quietly.

## Review · 2026-11-22

Read cold against the staged diff, before the commit, by a read-only Claude subagent (Explore) carrying out `docs/reviewer.md`. It found the four ticked acceptance boxes to hold (the script's box by reading: it is type-checked, and no test runs it), the record logic to give the right record in every case it traced (one bout, several, a rejected or unscored latest bout, two rows of one name, a second run, a fix brought in later), the savepoints to leave nothing behind, and the keys neither to duplicate nor to skip wrongly. Three findings.

### An imported final bout with no snapshot got today's record once it had been saved as a draft

**Found** — `server/api/card.ts` decided whether to take the snapshot from `is_draft` as the row stood before the save. One of v1's final bouts with no snapshot, saved once as a draft, was then a draft with no snapshot, and its next save took today's record: the value D138 rejected.

**Done when**

- [x] imported final bout with no snapshot, card saved as final again → snapshot stays null, records counted once
- [x] imported final bout with no snapshot, saved as draft, then saved again as draft or as final → snapshot stays null (`tests/api/card.test.ts`)
- [x] imported draft from a v1 document with no snapshot, first save → none: it is marked like any v1 bout with a card and no snapshot (D138)
- [x] bout made in the app, first save as draft or as final → snapshot taken from the record before this result
- [x] draft whose fighter was replaced, next save → that side retaken, the other side kept (D32)
- [x] final bout that has a snapshot, saved again in any state → snapshot unchanged

**Not asked** — A new column marking imported bouts, which D138 as first written had rejected; any change to the §6 record arithmetic. The column was added all the same, and D138 was rewritten to choose it before it was committed: without one the second line above cannot hold.

### Importer refusals that no decision or record named

**Found** — `server/import/v1.ts` refused a bout whose v1 title row was of another class than the bout's, and refused every bout of a fighter whose row could not hold the result v1 counted. Neither was in the record or a decision.

**Done when**

- [x] v1 bout with a title row of another class → imported, the title's class as v1 has it; the refusal is gone
- [x] fighter whose row cannot hold the latest result v1 counted → not made, and each of their bouts rejected with that reason (D139)
- [x] title row of the bout's own class, and a row that holds the result → imported as before

**Not asked** — Any other new refusal rules; changes to the D137 arithmetic.

### Two v1 title rows of one belt on a bout: the importer kept the first, migration 003 keeps the non-vacant

**Found** — `server/import/v1.ts` kept the first listed of two v1 rows that map to one title, so the holder (`vacant` or null) depended on the order of the rows in `bout_title`.

**Done when**

- [x] bout listing a Vacant and an Active row of one belt, in either order → one title line with holder null (`tests/import/v1.test.ts`, the Vacant row first)
- [x] bout listing two rows of one belt, both non-vacant → one line, holder null
- [x] bout listing one row per belt → one line per belt, vacant under Vacant, else null

**Not asked** — Guessing a holder (D127).

## What was done

2026-11-22. The v1 importer, run by `deno task import-v1`. Erez's box, the run against the real dumps into a fresh database (D124) and the reading of the rejects list, is still open.

- `server/import/v1.ts`: `importV1(db, dumps, now)` writes one batch in one transaction. For each row of v1's `bout_detail`, in fight order, it finds or makes the venue, event, the two fighters and the titles, writes the bout with its snapshot, card, result and judges, and counts it written; a bout already here (same day, same two fighters, either way round) is counted as already here and left alone. Each bout runs inside a savepoint, so one that is refused, by the importer or by the database, goes on the rejects list (`import_reject`, and the report) and takes back whatever it had begun. `parseTsv` reads `mysql --batch` output. Fighters with one name are folded onto the row with the latest bout (D133), and the report names each fold. Records follow D137 (below).
- `server/import/v1-card.ts` (pure): a v1 document read as a card per D125 and D126, then passed through `validateCard`, the rules `PUT /card` applies. It also strips the leading zero from a time typed "01:10", which the rules read as m:ss.
- `server/import/place.ts` (pure): a location read as a venue, with a US state naming the USA whatever its case (D129). It takes the separators as an argument, for the sheet's full stops in task 11.
- `scripts/import-v1.ts` and the `import-v1` task in `deno.json`; the script is added to `deno task check`.
- Lookups added to the database modules, for the import to find what is already there: `findVenue`, `findEvent`, `findFighterByName`, `findTitle`, `findBoutOnDay`.
- `server/migrations/009-no-snapshot.sql` adds `bout.no_snapshot`; `markNoSnapshot` in `server/db/bout.ts` sets it, and the import does so for a bout with a card and no snapshot. `server/api/card.ts` takes no snapshot of a marked bout, at any save (D138); `snapshotOf` loses its "result off" argument. SPEC Scoring §7 and the data model say so.
- Titles follow migration 003 (D42): a v1 title's class is taken as v1 has it, and two v1 rows of one belt on a bout are one line, the row that is not "Vacant" deciding the holder.
- Three decisions made by the work: D137, which replaces D132's record rule, wrong for fighters with more than one bout; D138; and D139, the refusal of a fighter whose row cannot hold the result v1 counted.
- `docs/IMPORT.md`: how to run it, where the code is, the keys a second run finds things by, and the record rule. `docs/SPEC.md`: §7.
- Tests: `tests/import/v1.test.ts` (a document as a card; and, from the fixture dump of seven bouts in `tests/fixtures/v1/`, what a batch leaves: bouts, cards, places, titles and holders, fighters and their records, three rejects that do not lose the batch, a second run that writes nothing, and a third that brings in a bout fixed in the dump), `tests/import/place.test.ts`, `tests/api/card.test.ts`, whose test of the old §7 rule now states D138 through final, draft and final saves, and `tests/db/migrate.test.ts` (migration 009; the migration 008 test now stops at version 8).

Verified 2026-11-22 by Claude: `deno task test` 255 passed, 0 failed; `deno task check` and `deno lint server front scripts tests` clean. Run against the real dumps into a fresh database in the scratchpad, never `data/boxing.db`: 173 bouts read, 154 written, 19 rejected; 288 fighters, 35 events, 31 venues, 84 titles, 105 title lines of which 90 have no holder recorded, 35 bouts without a snapshot, 34 of them marked `no_snapshot` and the other the one unscored bout (175, no document); `PRAGMA foreign_key_check` empty; a second run wrote 0, found 154 already here and rejected the same 19. The 19: three technical decisions (17, 25, 83); six decisions with fewer rounds than scheduled (49, 87, 158, 159, 168, 170); two stoppages with rounds missing (98, 99); a TKO with no round (141); two times that are not m:ss ("3:09" on 104, "3" on 160); two cards with a round the rules refuse (142, 165); and the three bouts at "Utilita Arena Newcastle, England" (136, 137, 138). Not seen by the importer, because they split into three parts: "Videotron Centre, Québec City, Québec" arrives with Québec as its country, and "Guadalajara, Jalisco, Mexico" with Guadalajara as the venue and Jalisco as the city.

The review below was answered before the commit, and the import was run again on a fresh scratch database after the fixes, with the same counts.

Reviewed by: a read-only Claude subagent (Explore), which had not seen the work, on the staged diff before the fixes to its three findings; the fixes themselves were not read again
