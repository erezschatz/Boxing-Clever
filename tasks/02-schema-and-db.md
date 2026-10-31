# 02 · Schema, migrations, database modules

## Context

**Promise.** The database exists with every table the spec names, the 18 weight classes
in it, and the tests can spin up a fresh in-memory copy in a millisecond.

**Acceptance.**
- [ ] `server/migrations/001-schema.sql` creates every table in SPEC *Data model* with the constraints stated there (uniques, checks on `corner_a`, `side`, `holder_side`, `winner`, `decision_type`, points 0–10)
- [ ] `server/migrations/002-weight-classes.sql` seeds the 18 classes
- [ ] `server/db/migrate.ts`: `schema_version` table, applies pending files in order inside a transaction, idempotent; `deno task migrate` runs it
- [ ] `server/db/<table>.ts` for each table: plain functions over a `Database`, parameterised SQL, no string building
- [ ] `tests/helpers/db.ts` opens `:memory:`, migrates, returns the handle; a tier-3 smoke test proves a round trip
- [ ] Verified: `deno task migrate` on the Mac produces `data/boxing.db`
