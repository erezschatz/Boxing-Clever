# A kept result is stored, so a recompute keeps it

## Context

Raised 2026-11-15 by Erez's answers to `tasks/questions-2026-11-03.md` (the
decision there: a kept result is stored as a per-fighter adjustment).
To be built before task 14.

**Promise** — When I delete a finalised fight and choose to keep the
records, they stay kept, even after the records are rebuilt.

**Acceptance**

- [ ] A migration adds a per-fighter adjustment (won, lost, draws, nc, kos, the deleted bout's description and date), and `server/db/` gets one module for it
- [ ] `DELETE /api/bouts/:id?records=keep` writes both fighters' adjustments in the delete's transaction; `reverse` writes none; tier-3 tests for both
- [ ] A merge (D31) moves the duplicate's adjustments to the target; tier-3 test
- [ ] SPEC *Data model* and *API* describe it, and say that `scripts/recompute-records.ts` (D13) adds each fighter's adjustments to what it rebuilds
