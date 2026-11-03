# Contracted weight and missed weight

## Context

Asked by Erez, 2026-11-03, in answer to "catchweight bouts" (D26). There is
no catchweight class: some bouts are fought at a contracted weight that is
not a class limit, and either both fighters come in above it, or one makes
it and the other does not. Missing weight should be marked and highlighted.
Must land before the imports (tasks 10–11), which meet such bouts.

**Promise.** When a fight is at a contracted weight I can enter that weight
instead of a class, and when a fighter misses weight I can mark it, and the
mark stands out wherever the fight is shown.

**Acceptance.**
- [ ] A migration lets a bout carry a contracted weight (lbs) instead of a weight class; one of the two is required
- [ ] Each side of a bout can be marked as having missed weight; neither, either, or both
- [ ] SPEC *Data model* and *API* describe both; `POST/PATCH /api/bouts` accept them
- [ ] The scorecard and the fighter's history show the contracted weight and highlight a missed weight
- [ ] Tier-3 tests: a contracted-weight bout round-trips; a bout with neither class nor weight is refused; the missed-weight marks round-trip per side
- [ ] The importers map the sheet's and v1's bouts onto this (noted in IMPORT.md)
