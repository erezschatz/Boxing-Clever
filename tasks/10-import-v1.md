# 10 · Import: v1 databases

## Context

**Promise.** Everything I scored in the old app is in the new one, with the snapshots
intact, and I have a list of anything the importer could not place.

**Acceptance.**
- [ ] `server/import/` core: batch, transaction per batch, rejects table, idempotent re-run
- [ ] `scripts/import-v1.ts` reads the dumps described in IMPORT.md and maps per BOXING-CLEVER-V1.md
- [ ] Rejects report printed and stored: row, reason
- [ ] Tier-3: a fixture dump of a few bouts imports, re-imports without duplicates, and a malformed deduction string is rejected without losing the batch
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
