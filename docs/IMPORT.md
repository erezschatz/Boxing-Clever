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
  two. Their reason is the one inference: `knockdown` (about 95% of them,
  per Erez), noted `reason assumed (import)` so the scorecard marks it.
  Whether the sheet's cell colours tell a knockdown from a foul, and can be
  read, is `tasks/sheet-deduction-colours.md`. A round with no 10 on either
  side (`9`/`9`: the winner was docked) does not say who won it → reject,
  until `tasks/questions-2026-11-03.md` answers it.
- Technical decisions and draws (`TD`, `T`): D22 scores their last round,
  but the sheet's stopped-round cell holds a time or a marker, and v1 stored
  it 0–0. Not imported until `tasks/questions-2026-11-03.md` answers it.
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
mysqldump --no-create-info --complete-insert boxing > v1-mysql.sql   # or per-table CSV
mongoexport --db boxing-scores --collection boutscores --jsonArray > v1-mongo.json
```

Mapping is direct (BOXING-CLEVER-V1.md lists the shapes). The Mongo
document's `fighters.*.record` and `weight`/`colors` become the bout's
as-of snapshot; `rounds[]` become `round_score` rows and `deductions[]`
strings are parsed as `"<points> <reason>"` or rejected; `result.decision`
is mapped by code (v1 already stored codes). Bouts with no Mongo document
are imported as unscored bouts. v1 had the 18 classes and no contracted
weight, so every v1 bout arrives with its class (matched by name) and no
`contracted_weight`; a fight Erez knows was at a contracted weight is
changed by hand afterwards in the bout form. v1 had no missed-weight mark,
so both sides arrive unmarked (D26, D45). Fighters are matched to sheet-imported
fighters by exact name; both may exist and are merged by the user.

v1's title kinds (its form offered Active, Vacant, Interim, Silver,
Diamond) map as migration 003 does (D42):
- Active and Vacant become the regular belt. A v1 bout under a "Vacant"
  title has holder `vacant`, unless v1 names a holder.
- Interim becomes the interim flag; "Interim Silver" is the flag plus
  "World Silver".
- Any other kind joins the area: Silver becomes "World Silver".
- Rows that come out the same belt, ignoring case and spacing, are one
  title.

## Order

v1 first (task 10), then the sheet (task 11): v1 is smaller and structured,
and exercises the importer before the messy source. Both batches are
re-runnable. The audit trail is per batch (counts and rejects); rows are
not linked to the batch that wrote them, because which source a bout came
from does not matter (D27).
