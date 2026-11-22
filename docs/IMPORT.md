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
rounds*, 3,315 rows × 23 columns, Nov 2021 → 19 Apr 2025). Exported to CSV
by hand (D8) as `data/import/sheet.csv`, gitignored.

Layout, as measured on 2026-10-31:

| Column | Content | What was seen |
|---|---|---|
| `Date/Location` | one cell per event, blank on the event's other rows (merged cell) | 218 events. `DD/MM/YYYY` then venue, city, region, separated by `.` or `,` inconsistently: `13/11/2021. Honda Center. Anaheim. CA`, `22/02/2025, The Venue Riyadh Season, Riyadh, Saudi Arabia` |
| `Category/Title` | one cell per bout, on the row above the two fighter rows | 1,103 bouts. Either a weight class (`Heavyweight`, `Junior Lightweight` = Super Featherweight alternate name) or a title line (`WBO/WBA/IBF/WBC World Super Middleweight Championship`, `WBO European Super-Welterweight…`) — the class must then be parsed out of the title |
| `Boxer Name` | per fighter row | 2,211 rows. `(c)` suffix marks the champion coming in → `bout_title.holder_side` |
| `Colors` | `White/Black/Gold` | free text, kept as is |
| `Weight` | `125.4lbs`, `14st 4lbs`, `10st 12lbs 8oz`, `72kg`; typos `lba`, `lb`, `ox`, `N oz` | parse with `rules/weight.ts`; reject on failure |
| `Record` | `W(KO)-L-D`, `W-L-D`, `W(KO)-L`, `W(KO)-L-D-NC`, one `W(KO)N-L` typo | 2,015 of the first shape. This is the **as-of record** (SPEC §7) |
| `1` … `12` | points per round | `x` = round not scheduled (6,099 cells); a stoppage time (`2:44`) or `KO`/`TKO` in the stoppage round's cell; numbers otherwise. A value under 9 is a 9 less deductions the sheet never itemised; see D24 |
| `Total` | sum | checked against the parsed rounds; mismatch → reject |
| `Decision` | 30+ spellings | `UD MD SD DEC TKO KO RSC RTD RET NC TD DQ D DRAW ND TUD MTD TSD KBO`; digits (`0 1 2 3 72 80 99 2.5`) are judge-count or stray; `Z\`che` is a typo. Mapping table in `server/import/decisions.ts`; anything unmapped → reject |
| `Ref 1..3` | judges' totals, on 1,008 rows | optional |

Bout structure: a `Category/Title` row, then fighter A row, then fighter B
row, then a blank spacer. Which fighter won is **not a column**: it is
inferred from totals for points decisions and from which row carries the
`KO`/`TKO` cell for stoppages (the stopper's row has the marker; the
stopped fighter's row has the time). Draws by total equality and a draw
decision. When the inference is ambiguous → reject.

### What the sheet cannot give, and the one thing inferred

- Corners (not recorded before v2) → `corner_a` null.
- Deductions as such, which the sheet folds into the round's number. A
  side written below 9 is stored as points 9 with 9 − n one-point
  deductions (D24), so `10`/`8` becomes 10–9 with one deduction and `10`/`7`
  two. Their reason comes from the cell's text colour, which a CSV does not
  carry, so it is read from the `.numbers` file separately (D64):
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

  The colours come from `data/import/sheet-colours.csv` (gitignored), written
  once by a JavaScript for Automation script run on a copy of the `.numbers`
  file (D64): one line per coloured round cell, `row,round,colour,boxer`.
  `row` is the Numbers table row with the header as row 1, which is the line
  in `sheet.csv` exported with its header; `boxer` checks the match. The
  importer refuses to run without this file.

  Measured on 2026-11-16 (`tasks/sheet-deduction-colours.md`): of 424 round
  cells under 9, 22 are red, 10 are blue and 392 have no colour, and every
  coloured one is in a round with a 10. 15 red 9s each sit in a round with
  no 10 and an uncoloured other side, 14 against a 9 and one against an 8.
- Technical decisions and draws (`TD`, `T`): D22 scores their last round,
  but the sheet's stopped-round cell holds a time or a marker, and v1 did
  not store it → reject, from either source; Erez enters them by hand. v1's
  own `T` is not one of these: it is a draw over the distance (Source B).
- Corner retirements (`RTD`, `RET`): there is no RTD code. A retirement
  after round X becomes a `TKO` at 3:00 of round X, with round X scored
  (`tasks/retirement-is-a-tko.md`). Where the source has no score for round
  X (v1 stored it 0–0), the bout is rejected, like a TD.
- The exact weight class when only a title line is present and the class
  name inside it does not match a known class or alternate name → reject.
- A contracted weight (D26, D45). A `Category/Title` cell that is a weight
  rather than a class or a title line ("150lbs", "Catchweight 150 lbs", "10st
  10lbs") becomes the bout's `contracted_weight` in pounds, with no class.
  It is read by the same parser task 11 writes for the `Weight` column's
  forms (`rules/weight.ts` reads only a bare number and "S L O" stone, so
  that parser turns the sheet's spellings into one of those first). Since there is no catchweight
  class, "Catchweight" with no weight that can be read → reject. A title line
  is always a class, since a title is fought for at its class's limit.
- Missed weight. The sheet has no mark for it, and the `Weight` column is
  the fighter's figure, which D26 says not to judge by, so every imported
  bout has both sides unmarked. Erez marks the ones he remembers by hand.
- Fighters are matched by exact full name after trimming `(c)`; a new name
  creates a fighter and an alias. Duplicates created this way are what the
  merge feature is for.

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
5 Apr 2025 to 4 Apr 2026; the first three (5, 6 and 19 Apr 2025) are inside
the sheet's range, so task 11 will meet their bouts already imported. An
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
