# 02 · Schema, migrations, database modules

## Context

**Promise.** The database exists with every table the spec names, the 18 weight classes
in it, and the tests can spin up a fresh in-memory copy in a millisecond.

**Acceptance.**
- [x] `server/migrations/001-schema.sql` creates every table in SPEC *Data model* with the constraints stated there (uniques, checks on `corner_a`, `side`, `holder_side`, `winner`, `decision_type`, points 0–10)
- [x] `server/migrations/002-weight-classes.sql` seeds the 18 classes
- [x] `server/db/migrate.ts`: `schema_version` table, applies pending files in order inside a transaction, idempotent; `deno task migrate` runs it
- [x] `server/db/<table>.ts` for each table: plain functions over a `Database`, parameterised SQL, no string building
- [x] `tests/helpers/db.ts` opens `:memory:`, migrates, returns the handle; a tier-3 smoke test proves a round trip
- [x] Verified: `deno task migrate` on the Mac produces `data/boxing.db`

## What was done

2026-11-02. `server/migrations/001-schema.sql` creates the twelve tables of
SPEC *Data model* with the checks box 1 names. `002-weight-classes.sql`
seeds the 18 classes in v1's seed order with explicit ids 1–18. v1's seed
had no ids, so the importer matches classes by name. Heavyweight's limit is
null and kg is computed from lbs (D17).

The schema also refuses shapes no valid card could have (D18):
- weight units outside `lbs`/`kg`/`st`;
- negative record counts and negative TBRB ranks;
- `scheduled_rounds` outside 1–15, and `result_round` below 1;
- deduction points outside 1–10;
- an import source other than `v1`/`sheet`;
- invalid ISO dates on `event.date` and `tbrb_snapshot.snapshot_date`
  (`date IS date(date)`, because a CHECK passes on NULL);
- a decision type without a winner, or a winner without one;
- a finalised bout without a result;
- the same fighter on both sides;
- a deduction in a round with no `round_score` row for that side
  (a composite foreign key).

`corner_a` is nullable for imports, which do not record corners (SPEC
edited). An alias is unique across fighters (new D19). A TBRB name appears
once per class per date. Bouts cascade from events, and a bout's card and
titles from the bout. A fighter with bouts cannot be deleted. TBRB rows lose
their link when their fighter is deleted. `title.status` is unchecked text,
as in v1 (Active, Interim, Silver, Diamond); who held the belt is
`bout_title.holder_side`.

`server/db/connection.ts` opens the file with `PRAGMA foreign_keys = ON`. It
resolves the default `data/boxing.db` from the module, not the working
directory (SETUP edited). `server/db/migrate.ts` applies each pending file
together with its `schema_version` row in one transaction per file, so a
failed file leaves the previous version. That is box 3's "inside a
transaction"; SPEC *Architecture* now says it per file. The runner takes its
migration list as a parameter, so the rollback is tested without disk.

There is one module per table under `server/db/`. Each has insert and list,
plus get, whole-row update and delete where the API reads or changes one row.
SPEC *Architecture* and *Data model* now name the modules, the snapshot,
result and judge column names, and the constraints split (D18). Left for
later:
- snapshot writes, finalise and merge (tasks 04–05);
- an import-batch column on `bout`, which tasks 10–11 add in their own
  migration if the audit trail needs one;
- deleting a finalised bout, which leaves records out of step; filed as
  `tasks/delete-finalised-bout.md`.

Tests:
- `tests/helpers/db.ts` gives a migrated `:memory:` database.
- `tests/db/migrate.test.ts`: every SPEC table present, a re-run is a no-op,
  a failed file is rolled back, and the seed's names, order, ids, kg and
  Heavyweight.
- `tests/db/tables.test.ts`: round trips (including the rows of the SPEC
  KO-in-round-2 card, though not its finalise), exact-only alias lookup, and
  each refusal above.

Run by Claude on the Mac, Deno 2.9.8: `deno task test` 19/19, and `deno task
check`, `deno lint` and `deno fmt --check` clean. Claude also ran `deno task
migrate` twice: the first run applied 1 and 2 to `data/boxing.db`, the
second applied nothing.

Verified by Erez on the Mac, 2026-11-02: after removing `data/boxing.db`,
`deno task migrate` printed `applied 1, 2`, and `sqlite3 data/boxing.db
.tables` lists the twelve SPEC tables plus `schema_version`.
