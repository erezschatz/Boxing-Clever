# The sheet's colours: knockdown or foul

## Context

From Erez, 2026-11-03, on importing the Numbers sheet's 8- and 7-point
rounds (D24): "I believe I tried coloring these to differentiate knockdown
and point deducted for violation". D24 imports every such deduction as a
knockdown unless the colour can tell them apart. D8 has the sheet read from
a CSV export, which carries no colour.

**Promise.** Imported deductions say knockdown or foul the way I marked them
in the sheet, if I marked them; otherwise knockdown.

**Acceptance.**
- [x] Look at the sheet's under-9 cells in Numbers: is there a consistent colour scheme, and how many cells use it
- [x] If there is: a way to carry the colour into the import without a standing dependency (a second CSV, a one-off column, or a new decision superseding D8), chosen in DECISIONS
- [ ] If there is not: this task closes with that finding, and D24's knockdown default stands

## Decisions

### 2026-11-16 · The sheet's text colour gives a deduction's reason: red a foul, blue or none a knockdown

**Decision** — In a round that has a 10, a cell under 9 has base 9 (D24), and the cell's text colour gives the reason for each point below it. Red text is a foul. Blue text is a knockdown. No colour keeps D24's knockdown default, with its `reason assumed (import)` note. Claude added the rest:
- A foul's deduction has reason `other` and the note `foul (red in the sheet)`, since the sheet doesn't say which foul.
- A blue knockdown has no "assumed" note, since Erez marked it.
- Every point in a red 7 counts as a foul, since one cell's points can't be split between reasons.
- Colour on a 10, a 9 in a round that has a 10, or an `x` means nothing and is ignored. So is a row's green background, which covers all 23 columns of a row and highlights it.

A round with no 10 is D65's.
**Rejected** — Importing every deduction as a knockdown and dropping the colour (D24's fallback, which applied only if there was no scheme); reading blue as a foul or as no information.
**Why** — Erez, 2026-11-16: red text was a foul, no colour a knockdown. Asked about the blue cells the read turned up, he said blue was a knockdown. This fills the case D24 left open ("if the colours turn out to tell a knockdown from a foul").

### 2026-11-16 · The colours are read once from the .numbers file by a JavaScript for Automation script, beside the CSV

**Decision** — The colours come from a one-off JavaScript for Automation script, run with `osascript` on macOS with Numbers installed, against a copy of `docs/reference/boxing.numbers`. It writes `data/import/sheet-colours.csv` (gitignored, like `sheet.csv`) with one line per coloured round cell: `row,round,colour,boxer`.
- `row` is the Numbers table row, counting the header as row 1, which is the line number in `sheet.csv` when it is exported with its header.
- `colour` is `red` or `blue`.
- `boxer` is the cell's `Boxer Name`, so the importer can check that the row landed on the same fighter.

The CSV stays the source of every value, so D8 stands. Task 11 builds the script beside the importer. The importer refuses to run without the colours file, because without it every foul would quietly become an assumed knockdown.

Erez approved reading the colours this way on 2026-11-16 ("Yes, read them", to: may I read them with a one-off script, opening Numbers). The file, its format, the row matching and the refusal are Claude's.
**Rejected** — Erez adding a column to the sheet by hand before the export (offered, not chosen); parsing `.numbers` directly (D8); exporting to `.xlsx` and reading it with a parser library, a dependency; falling back to D24 for every cell when the colours file is missing.
**Why** — It adds no dependency and needs no hand marking, and it runs once, like the CSV export. It was already run once, on 2026-11-16, for the counts in `tasks/sheet-deduction-colours.md` and `docs/IMPORT.md`.

### 2026-11-16 · A round with no 10 and one side in red is that side's round, less a foul

**Decision** — A sheet round with no 10 on either side, and exactly one side's cell in red text, is imported as the red side's round: points 10, less one foul deduction per point below 10. The other side is 9 less its deductions, with their reason from D63. A round with no 10 and neither side red, or both red, is still rejected to the list. Claude added three parts to Erez's answer, which was about 9–9: the reject when both or neither side is red, the 10-based arithmetic, and the `9`/`8` case (Ryan Garcia's red 9 against Devin Haney's uncoloured 8 in round 7), which follows the same reading.
**Rejected** — Keeping D54's rejection for every round with no 10 (offered, not chosen).
**Why** — Erez, 2026-11-16: import them. Claude's reason: the red marks who was docked, and so who won the round, which D54 said the sheet couldn't tell. In the sheet as read, 15 rounds come in this way, as counted in `tasks/sheet-deduction-colours.md` and `docs/IMPORT.md`.
Supersedes: D54

## What was done

2026-11-16. Erez said how he coloured the sheet: red text for a foul deduction, no colour for a knockdown. Claude read the colours from a copy of `docs/reference/boxing.numbers` (sheet *Matches*, table *Up to 12 rounds*, columns `1`–`12`) with JavaScript for Automation through `osascript`, opening Numbers. The original file was not opened or changed.

What the sheet holds:
- **Cells under 9:** 424 in all.
  - 22 have red text and 10 have blue text, in two shades, all between table rows 1647 and 1886. The table isn't in date order, so the rows give no period.
  - 392 have no text colour. 27 of these sit in rows with a green background across all 23 columns, a row highlight unrelated to deductions.
  - Every one of the 32 coloured cells is in a round whose other side has a 10.
- **Red 9s:** 15, each in a round with no 10. 14 are against a 9 and one is against an 8 (Garcia–Haney, round 7). In all 15 the other side has no colour, so each comes in under D65.
- **Other colour:**
  - One bout (row 1835, Sakaria Lukas) has a blue 8 in round 1 and a red 8 in round 7, so blue isn't another shade of red.
  - 2 red and 4 blue `x` cells sit in stopped fighters' rows.
  - One round (rows 2102–2103, round 2) has a blue 10 and a blue 9.
  - No red 9 sits in a round that has a 10.

Erez answered the two questions this raised: blue is a knockdown, and a red 9–9 imports as the red side's round. The decisions above record the scheme (D63), the way task 11 reads it (D64), and the no-10 rule (D65), which supersedes D54. `docs/IMPORT.md` says the same, with the counts and the colours file's format. The third acceptance box (no scheme) does not apply. Nothing in the app changed; the script and the importer's use of it are built and tested with task 11.

Before commit, a cold reader raised five findings, and all were fixed in the entries above:
- D63 said colour on a 9 is ignored while D65 reads red 9s. D63 now says which 9s it ignores.
- The 15-round count rested on facts not stated. The record now states the colour of every opposing cell.
- D64 named AppleScript in its title and JavaScript for Automation in its body, and pointed at counts that don't follow it once compiled. It is renamed, and it points at the counts.
- Task 11 had no colours file to read. D64 now names the file, its format, the row matching and the missing-file refusal.
- Some of Claude's additions were unmarked. They are marked now.

A second reader found that D65 pointed at a section `docs/DECISIONS.md` doesn't have; it now names the files. "Early 2024" was dropped, since the table's rows are not in date order.

Reviewed by: two read-only Explore subagents, cold, against the staged diff, carrying out docs/reviewer.md. The first found the counts consistent and D63–D65 in line with D8, D24 and D54, and raised the five findings above. The second confirmed the fixes and the three files' agreement, and raised D65's pointer and this record's order.
