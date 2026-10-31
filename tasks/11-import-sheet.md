# 11 · Import: the Numbers sheet

## Context

**Promise.** Every fight in the sheet since November 2021 is in the database with the
scores, the records as I wrote them down that night, and who was champion —
and every row the importer could not read is listed for me to fix.

**Acceptance.**
- [ ] `scripts/import-sheet.ts` reads `data/import/sheet.csv` per IMPORT.md: event rows, bout rows, fighter rows, `(c)`, weights, records, `x`, stoppage markers, the decision spelling table, winner inference
- [ ] Rejects for every ambiguity named in IMPORT.md; nothing guessed
- [ ] Fighter aliases seeded from the sheet's spellings
- [ ] Tier-3: a fixture CSV of a dozen representative bouts (points win, KO with time, draw, title line, `(c)`, st-lbs-oz weight, typo record) imports and reads back correctly
- [ ] Verified by Erez on the full export; rejects reviewed and the source or aliases fixed until the list is acceptable
