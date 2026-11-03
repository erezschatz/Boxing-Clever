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
- [ ] Look at the sheet's under-9 cells in Numbers: is there a consistent colour scheme, and how many cells use it
- [ ] If there is: a way to carry the colour into the import without a standing dependency (a second CSV, a one-off column, or a new decision superseding D8), chosen in DECISIONS
- [ ] If there is not: this task closes with that finding, and D24's knockdown default stands
