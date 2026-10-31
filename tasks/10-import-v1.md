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
