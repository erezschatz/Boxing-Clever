# Imports — v1 databases and the Numbers sheet

Two sources, one importer (`server/import/`), one audit trail
(`import_batch`, `import_reject`). An import is **staged**: it parses
everything, writes what it can inside one transaction per batch, and reports
every row it could not place with the row's text and the reason. Nothing is
silently skipped and nothing is guessed, with one marked exception: the
reason of a deduction the sheet folds into a round (D24). The user fixes the
source or the aliases and re-runs; a re-run of the same batch is idempotent,
keyed on event date + fighter names. The source is the batch being run,
not a column on the row (D27).

## Source A — the Numbers sheet (task 11)

`docs/reference/boxing.numbers` (3.5 MB; sheet *Matches*, table *Up to 12
rounds*, 3,315 rows × 23 columns). Two files are written from a copy of it by
`scripts/sheet-export.jxa.js`, which opens Numbers (task 11's decisions):
`data/import/sheet.csv`, the table as Numbers itself exports it to CSV, and
`data/import/sheet-colours.csv` (below). Both are gitignored.

```
cp docs/reference/boxing.numbers /tmp/boxing-copy.numbers
osascript -l JavaScript scripts/sheet-export.jxa.js /tmp/boxing-copy.numbers "$PWD/data/import"
deno task import-sheet
```

Stop the chamber first and copy `data/boxing.db` aside: this batch goes into
the database v1's import filled. The script prints the counts, the v1 bouts
it gave a record on the night, and every reject with its line in `sheet.csv`
and the reason. Running it again writes nothing twice; a row fixed in the
sheet and exported again comes in on the next run.

Layout, as measured on the export of 2026-11-23:

| Column | Content | What was seen |
|---|---|---|
| `Date/Location` | one cell per event, on the category row of its first bout | 217 cells. `DD/MM/YYYY` then venue, city, region, separated by `.` or `,` inconsistently: `13/11/2021. Honda Center. Anaheim. CA`, `22/02/2025, The Venue Riyadh Season, Riyadh, Saudi Arabia`. **The first 240 bouts (lines 2–720) stand under no date cell.** 20 events are older fights (1996–98, 2011, 2015, 2018, 2019); one date is `07/06/1014`; one is `25/05/2025`, after the sheet's last night (19 Apr 2025) |
| `Category/Title` | one cell per bout, on the row above the two fighter rows | 1,102 cells for 1,105 bouts (the first three have none). A weight class (`Heavyweight`, `Junior Lightweight`, `W Featherweight` for a women's bout), a contracted weight (`Catchweight (150)`, `179lbs catchweight`), or a title line (534 of them, 433 distinct): `WBO/WBA/IBF/WBC World Super Middleweight Championship`, `Vacant WBO Intercontinental Lightweight Title`, `Commonwealth/Vacant British/Vacant WBO Intercontinental Super Bantamweight Title`. 35 are eliminators |
| `Boxer Name` | per fighter row | 2,210 rows, 1,677 distinct names. `(c)` marks the champion coming in (284 rows). 251 rows carry more: `Canelo Alvarez (WBC/WBA/WBO) #1`, `Jack Cattarall #5`, `George Kambosos Jr. (8)` |
| `Colors` | `White/Black/Gold` | free text, kept as is |
| `Weight` | `125.4lbs`, `14st 4lbs`, `10st 12lbs 8oz`, `18st 6oz`, `16st`, `72kg`; typos `lba`, `lb`, `ox` | 7 are blank |
| `Record` | `W(KO)-L-D`, `W(KO)-L`, `W(KO)-L-D-NC`; `W-L-D` with no bracket on 109 rows, 93 of them `0-…` | the **as-of record** (SPEC §7). 4 blank, 3 that are none of these |
| `1` … `12` | points per round | blank after the scheduled distance; `x` for a scheduled round not fought (6,099 cells); a stoppage time (`2:44`, 504 cells) or `KO`/`TKO` (19) in the round it ended in; numbers otherwise. A value under 9 (424 cells) is a 9 less deductions the sheet never itemised; see D24 |
| `Total` | sum | checked against the rounds; one row does not add up |
| `Decision` | on one row of the bout in 1,039 bouts, on both in 42, on neither in 24 | `UD MD SD DEC TKO KO RSC RTD RET NC TD DQ D DRAW ND TUD MTD TSD KBO`, digits (`3`/`0`, `2`/`1`, the totals again), ``Z`che`` |
| `Ref 1..3` | judges' totals, on 1,008 rows | optional |

Bout structure: a `Category/Title` row, then fighter A's row, then fighter
B's row, then a blank one.

How each cell is read (`server/import/sheet-*.ts`, one pure module per kind
of cell; task 11's decisions). A cell that is none of the shapes below
rejects its bout; nothing is guessed, with the one marked exception of D24.

- **Who won.** The winner's row carries the `Decision` cell. The sheet's own
  rounds are Erez's card and often go the other way (in 80 of 466 points
  decisions his total for the winner is lower or level), so the totals are
  not asked. Where the sheet has all three judges' totals they must give the
  same winner, or the bout is rejected; a decision typed on both rows is
  settled by them, and rejected without them; a stoppage typed on both rows
  is the row's that carries the stoppage's cell. A draw or a no-contest may
  be on either row or both.
- **The decision.** `UD MD SD DEC KO TKO DQ NC` are the app's codes. `RSC`
  is a `TKO`. `D` and `DRAW` are `D`. `3` on one row and `0` on the other is
  a `UD` for the 3. `TD`, `TUD`, `TSD`, `MTD` are rejected for Erez to enter
  by hand with the last round scored (D53). Anything else, and no decision at
  all, is rejected.
- **A stoppage.** The winner's row has the time, or `KO`/`TKO` when no time
  was noted, in the cell of the round it ended in, and the other row has `x`
  there. That round is stored 0–0 (SPEC Scoring §4) with the time, or with
  none. A `KO`, `TKO` or `DQ` with no such cell is rejected, since the sheet
  does not say in which round. A time on the loser's row is rejected.
- **A corner retirement** (`RTD`, `RET`): there is no RTD code. It is a `TKO`
  at 3:00 of the last round scored (D55), which is where both rows turn to
  `x`.
- **Scheduled rounds**: the cells that are not blank, which the two rows must
  agree on.
- **Deductions**, which the sheet folds into the round's number. A side
  written below 9 is stored as points 9 with 9 − n one-point deductions
  (D24), so `10`/`8` becomes 10–9 with one deduction and `10`/`7` two. Their
  reason comes from the cell's text colour, which a CSV does not carry, so
  it is read from the `.numbers` file separately (D64):
  - **red** text: a foul. Each point is a deduction with reason `other`
    and the note `foul (red in the sheet)`;
  - **blue** text: a knockdown, as Erez marked it;
  - **no colour**: `knockdown`, the one inference (about 95% of them, per
    Erez), noted `reason assumed (import)` so the scorecard marks it (D24).

  That is for a round that has a 10, where the cell's base is 9. Colour on a
  10, on a 9 in such a round, or on an `x` means nothing and is ignored, and
  so is a row's green background, which highlights the whole row (D63).
  A round with no 10 on either side (`9`/`9`, or `9`/`8`: the winner was
  docked) is read from the colour too (D65). If exactly one side is red,
  that side won it: points 10 less one foul deduction per point below 10,
  and the other side 9 as above. With neither side or both red, it does not
  say who won → reject; Erez fixes the sheet or enters the round by hand.

  The colours come from `data/import/sheet-colours.csv`: one line per
  coloured round cell, `row,round,colour,boxer`. `row` is the Numbers table
  row with the header as row 1, which is the line in `sheet.csv`; `boxer` is
  that row's `Boxer Name`, and the import stops before writing anything if
  the two files disagree on it. There is no run without this file. In the
  sheet as read: 39 red cells and 16 blue; of 424 round cells under 9, 22
  are red, 10 blue and 392 have no colour, and 15 red 9s each sit in a round
  with no 10 and an uncoloured other side.
- **The category.** A class by its name, its "Junior" name or an older name
  (`Light Middleweight`); the women's `W` is dropped. A weight
  (`Catchweight (150)`, `179lbs catchweight`) is the bout's
  `contracted_weight` in pounds, with no class (D26, D45); "Catchweight"
  with no weight is rejected. An eliminator or a tournament bout is its
  class alone, for no title.
- **A title line** is the class and the belts written before it, split at
  `/`, `&`, `,` and `. `. Each belt's spelling is looked up in
  `server/import/sheet-belts.ts`, which gives the sanctioning body and area
  the title is filed under (`WBC Silver` → WBC, World Silver;
  `Commonwealth` → CBC, Commonwealth); a spelling not in that table rejects
  the bout. "Interim" and "Vacant" are read per belt. A body alone (`WBO/
  WBA/IBF/WBC World`) takes the area of the next belt on the line that is
  written as a world body and its area (`WBC World`, `WBC International`;
  not `NABF`, which is filed under the WBC but is not written so), or
  "World" when the line says world after the class; otherwise the bout is
  rejected.
- **Who held a belt** (`bout_title.holder_side`): nobody when the line marks
  it vacant; the fighter whose name carries the body in brackets
  (`(WBC/WBA)`); else the one fighter marked `(c)`; else not recorded
  (D127). In the sheet, of 499 title bouts 279 have one `(c)`, 129 none and
  a vacant belt, 91 neither; none has `(c)` on both.
- **A name** is what is left when `(c)`, the brackets and `#N` are taken
  out. `#N` and a bracketed number are a ranking, which is not kept.
- **A record** with no bracket has no knockouts. **A weight** is kept in
  pounds with the unit it was written in (D36); an empty one is no weight.
- **The place** is split as below ("Places"), at `.` and `,`.

What the importer writes:

- **Fighters** are matched on the whole name, ignoring case, against the
  fighters here, and exactly against their aliases (D14); `Juan Carlos
  Abreu` is the same however the app splits him between its two boxes. A name that matches nobody
  makes a fighter, the first word the first name and the rest the last, and
  every spelling the sheet uses becomes an alias (D14, D19). Two spellings
  of one man (`Canelo Alvarez` and v1's `Saul Alvarez`, `Olexandr Usyk` and
  `Oleksandr Usyk`) are two fighters, which is what the merge is for.
- **A new fighter's record** is the one the sheet wrote for their latest
  night, and that night's result is added when its bout is written, as D137
  does for v1. A night whose record or weight cannot be read is passed over
  for this, so a slip in one cell rejects that bout and not the fighter's
  others. A fighter who was here already keeps their record: the
  result is added only while the record is still the one the sheet wrote.
- **A bout already here** (same day, same two fighters) is v1's, and stays
  as it is: v1 holds the card. Where a side of it has no record on the
  night (D128) and the sheet's cells for that fighter can be read, they
  become that side's snapshot; a side that has one keeps it. The
  `no_snapshot` mark comes off once both sides have one. Only the card of 19 April 2025 is in both sources (4
  bouts).
- Corners are not recorded (`corner_a` null), and no side is marked as
  having missed weight: the sheet has no mark for it, and the `Weight`
  column is the fighter's figure, which D26 says not to judge by.
- A bout's place on its card is its place under the date cell, kept when a
  bout above it is rejected, so that one comes in at its place later.

On the export of 2026-11-23, into a copy of the database after v1's import:
1,105 bouts read, 741 written, 4 already there (3 of them given their record
on the night), 360 rejected. 240 of the rejects are the bouts with no date
above them, which are left out for good (task 11's decisions). The rest: no decision (19), a stoppage with no cell (18), a place
that does not give a venue, a city and a country (14), a points decision on both
rows and no judges (17), a round with no 10 and no red (9), cells out of
order (7), technical decisions (7), the date `07/06/1014` (5), a stoppage on
the other row (5), rounds the rules refuse (5), title lines (5), records
(3), a retirement with a time in a round (2), a decision the import does not
know (2), a time that is no time, and a total that does not add up. The 5
bouts with other digits for a decision are among the undated. Places that import without being rejected and are wrong,
because their parts are not venue, city, country: the countries `Nevada`,
`Las Vegas`, `CN`, `C` and `Québec`; and the UK is `UK`, `England`, `Wales`,
`Northern Ireland` and `North Ireland` as typed.

## Source B — v1 databases (task 10)

Dumps taken on the v1 machine, gitignored under `data/import/v1/`:

```
for t in event fighter weight_class title bout_detail bout_title; do
  mysql --batch -u boxing -p boxing -e "SELECT * FROM $t" > $t.tsv
done
mongoexport --db boxing-scores --collection boutscores --jsonArray > v1-mongo.json
```

One tab-separated file per MySQL table, with its header line (task 10's
decisions). The import is a script, `scripts/import-v1.ts`; there is no
import endpoint. With the chamber stopped:

```
deno task import-v1            # into BOXING_DB, or data/boxing.db
```

It prints the batch's counts, each fighter folded and each bout rejected
with its reason, and stores the same in `import_batch` and
`import_reject`. The code is `server/import/`: `v1.ts` writes the batch,
`v1-card.ts` reads a document as a card, `place.ts` reads a location. An
event is found again by its day and venue, a bout by its day and its two
fighters, a fighter by name, a title by its four parts, so a second run
writes only what the first could not. Each bout is written inside a
savepoint: one the importer or the database refuses goes on the list and
takes back whatever it had begun, a new fighter included.

The mapping, as measured on 2026-11-22 against v1's code and its 172
documents (29 events, 27 Jun 2025 → 4 Apr 2026; task 10's decisions):

- **Snapshot.** The document's `fighters.*.record`, `weight` and `colors`
  become the bout's as-of snapshot. 36 documents (bouts 1–38, saved Nov–Dec
  2025) predate v1 keeping them; those bouts arrive with no snapshot and
  marked `no_snapshot`, so that no later save of the card takes one (D138),
  and their scheduled rounds, class and event come from MySQL.
- **Rounds.** `rounds[]` become `round_score` rows. v1 dropped the stoppage
  round, so a stopped card holds rounds 1 to N−1 for a result in round N and
  the importer adds round N at 0–0 (SPEC Scoring §4). A stopped card with
  rounds missing before N is rejected; one with no rounds at all is a bout
  watched and not scored.
- **Deductions.** v1 stored the reason alone (`KnockDown`, `LowBlow`,
  `Holding`, `HeadButt`, `IllegalPunch`, `Other`), never the points. Each is
  one point where the side's `round_score` less its `total_score` equals
  the number of its deductions in that round; otherwise the bout is
  rejected. `IllegalPunch` becomes `other`, noted `illegal punch`.
- **Result.** v1's codes are taken as they are, except `T`, which v1
  labelled "Draw" and used for a draw over the distance: it becomes `D`. A
  `TD` is rejected (below). The winner's kind comes from the decision type,
  since v1 wrote `draw` only for `MT` and `T`. Judges' totals of 0–0, a
  result round of 0 and an empty time are none.
- **Final or draft.** A document with a decision type is final whatever its
  `is_draft` says: v1 moved the records the first time a result was saved.
  One with none is a draft. A bout with no document is an unscored bout.
- **Records.** v1 moved records on a result only from 2026-05-30, and its
  row for a fighter is the record typed for their latest bout: before that
  day the record going into it, after it that record with the result
  counted. So a fighter arrives with the record they had going into their
  latest v1 bout (v1's row, less that bout's result where v1 had counted
  it), and that one result is added when the importer writes the bout as
  final. An earlier bout's result is in the row already and is not added
  again; a latest bout that is rejected adds nothing, so entering it by
  hand counts it once. A fighter whose row does not hold the result v1
  counted (taking it off would go below zero) has their bouts rejected.
- **Who fought.** MySQL says, not Mongo: `bout_detail.id` is the key that
  Mongo's `bout_id` matches (`bout_detail.bout_id` is only the bout's number
  on its card), and in 14 documents a fighter id names a row a v1 merge
  has since deleted, while MySQL was repointed.
- **Fighters.** Names are trimmed (two carry a trailing space). v1 rows
  with the same name, compared without case, are one fighter: the row with
  the latest bout is kept and the other's typed record dropped. One pair
  today, Brian Norman Jr.
- **Every card passes the rules** `PUT /api/bouts/:id/card` applies before
  it is written; one that fails is rejected with the rules' problems.

The MySQL side, as dumped on 2026-11-22: 173 bouts on 37 events, 323
fighters (every one of them in a bout), 101 titles that become 98 belts
under the mapping below, and 120 title rows on 86 bouts, 17 under a Vacant
title and 103 with the holder not recorded. Every reference resolves. One
bout has no document. Events 1–8 (34 bouts) are in no Mongo document, so
their dates and places come from `event.tsv` alone. The 37 events run from
5 Apr 2025 to 4 Apr 2026. The sheet's last night is 19 Apr 2025 and it has
that card only (4 bouts), not the two before it, so task 11 meets those four
already imported. An
event's `date` is a date and a time of day, as MySQL printed it in the
machine's own time; the date part is the fight day, and it agrees with
Mongo's for all 29 events Mongo has. Three days have two events each, at
different places.

v1 had the 18 classes and no contracted
weight, so every v1 bout arrives with its class (matched by name) and no
`contracted_weight`; a fight Erez knows was at a contracted weight is
changed by hand afterwards in the bout form. v1 had no missed-weight mark,
so both sides arrive unmarked (D26, D45). Fighters are matched to sheet-imported
fighters by exact name; both may exist and are merged by the user.

v1's title kinds (its form offered Active, Vacant, Interim, Silver,
Diamond) map as migration 003 does (D42):
- Active and Vacant become the regular belt. A v1 bout under a "Vacant"
  title has holder `vacant`. v1 never stored who brought a belt in, so
  under any other title the holder arrives not recorded (null), and Erez
  fills it in by hand in the bout form (task 10's decisions).
- Interim becomes the interim flag; "Interim Silver" is the flag plus
  "World Silver".
- Any other kind joins the area: Silver becomes "World Silver".
- Rows that come out the same belt, ignoring case and spacing, are one
  title.

## Places: venues (D117)

An event points to a venue (name, city, region, country; task venues).
Both imports turn a location string into a venue, split as migration 007
split the locations typed before it: at the separators (`,` and, for the sheet, `.`), the first part the
venue, the last the country, the one before it the city and anything
between the region; a venue with the same four parts is reused, so the
same arena typed on two nights is one place. Erez wrote American places
the American way, ending with the state and no country (`Honda Center.
Anaheim. CA`): when the last part is a two-letter US state code it is the
region, and the country is `USA` (task 10's decisions). A location that does not give a venue, a city and a country
is rejected to the batch's list rather than guessed.

## Order

The real run starts from an empty database: stop the chamber, rename
`data/boxing.db` (Erez's test data) to `data/boxing-test-<date>.db`, and
let the chamber create a fresh one before the first batch (task 10's
decisions). v1 first (task 10), then the sheet (task 11): v1 is smaller and structured,
and exercises the importer before the messy source. Both batches are
re-runnable. The audit trail is per batch (counts and rejects); rows are
not linked to the batch that wrote them, because which source a bout came
from does not matter (D27).
