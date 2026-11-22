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
