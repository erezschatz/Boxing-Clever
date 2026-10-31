# Imports — v1 databases and the Numbers sheet

Two sources, one importer (`server/import/`), one audit trail
(`import_batch`, `import_reject`). An import is **staged**: it parses
everything, writes what it can inside one transaction per batch, and reports
every row it could not place with the row's text and the reason. Nothing is
silently skipped and nothing is guessed. The user fixes the source or the
aliases and re-runs; a re-run of the same batch is idempotent (keyed on
source + event date + fighter names).

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
| `1` … `12` | points per round | `x` = round not scheduled (6,099 cells); a stoppage time (`2:44`) or `KO`/`TKO` in the stoppage round's cell; numbers otherwise. An `8` or `7` is the round total *after* a deduction the sheet never itemised — stored as written, see "what the sheet cannot give" |
| `Total` | sum | checked against the parsed rounds; mismatch → reject |
| `Decision` | 30+ spellings | `UD MD SD DEC TKO KO RSC RTD RET NC TD DQ D DRAW ND TUD MTD TSD KBO`; digits (`0 1 2 3 72 80 99 2.5`) are judge-count or stray; `Z\`che` is a typo. Mapping table in `server/import/decisions.ts`; anything unmapped → reject |
| `Ref 1..3` | judges' totals, on 1,008 rows | optional |

Bout structure: a `Category/Title` row, then fighter A row, then fighter B
row, then a blank spacer. Which fighter won is **not a column**: it is
inferred from totals for points decisions and from which row carries the
`KO`/`TKO` cell for stoppages (the stopper's row has the marker; the
stopped fighter's row has the time). Draws by total equality and a draw
decision. When the inference is ambiguous → reject.

### What the sheet cannot give and is not invented

- Corners (not recorded before v2) → `corner_a` null.
- Deductions as such: a round written `8` is stored as points `8`,
  deductions none. The round total is right; the reason is unknown and
  stays unknown. The scorecard shows imported rounds with a marker.
- The exact weight class when only a title line is present and the class
  name inside it does not match a known class or alternate name → reject.
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
are imported as unscored bouts. Fighters are matched to sheet-imported
fighters by exact name; both may exist and are merged by the user.

## Order

v1 first (task 10), then the sheet (task 11): v1 is smaller and structured,
and exercises the importer before the messy source. Both batches are
re-runnable; the audit table says which batch wrote which row.
