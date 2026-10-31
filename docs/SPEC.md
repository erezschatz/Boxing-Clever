# Boxing Clever — Specification

Version 2.0.0-draft. An Atrium chamber: Deno + Hono on the server, lit-html in
the browser, one SQLite database. One user, scoring fights on a laptop while
watching them, and keeping every fight and fighter watched.

This is the *what* and the *how*. The *why* is in [DECISIONS.md](DECISIONS.md);
the order of work is in [PLAN.md](PLAN.md); the predecessor is described in
[BOXING-CLEVER-V1.md](BOXING-CLEVER-V1.md). When this file and the code
disagree, fix one of them in the same scene.

## Why this project exists

Version 1 (NestJS + React, MySQL + MongoDB) does the job and is in daily use.
It was started as a way to try a stack, and the stack is the problem: two
frameworks, two databases and ~470 packages to serve 28 endpoints and four
pages for one user. It also stopped short of what the data is for:

- the fighter card is crowded and unfriendly;
- a title fight does not say who the champion is, nor which belt each
  fighter brought to a title-for-title fight;
- TBRB rankings — the one ranking the user trusts — are absent;
- red and blue corners are not recorded;
- ~1,100 fights scored by hand in a Numbers sheet (Nov 2021 → Apr 2025) are
  not in the database.

Version 2 keeps v1's behaviour where it was right (the scorecard, the
pre-fight snapshot, the record update on finalise), fixes what was wrong (the
stoppage-round defects, record atomicity, 200-for-missing), moves to the
house platform, and adds the four features above plus the import. The
long-term reason for a relational database is the second purpose of the
app: one day, chart a fighter's trajectory *as witnessed* — record, weight,
ranking, results — across every fight watched.

## Scope

### Phase 1 (this repo, now)

Parity with v1 **plus**:

- Corners. Each bout records which fighter is red and which is blue.
- Champion and titles. A title bout records, per title, which side held it
  coming in (A, B, or vacant). The scorecard and fighter card show it.
- TBRB rankings. A daily scrape of tbrb.org stores dated snapshots; a bout
  shows each fighter's rank (or champion) *as of the fight*, and the fighter
  card shows the current one. Historical back-fill is a manual tool fed one
  archive page at a time (TBRB.md).
- Imports. v1's MySQL + MongoDB data, and the Numbers sheet, both through
  one staged importer with a rejects report (IMPORT.md).
- Fighter card redesign, and a design pass over the whole front end.
- Real URLs (deep links, back button) instead of v1's atom router.
- Server-side tests at three tiers (see Testing); the suite is green before
  v1 is retired.

### Explicitly out of phase 1

- Mobile / touch layout. The laptop is always at hand when watching (D9).
- Public access, more than one user, any permission model. Atrium's login is
  the only gate (D2).
- Charts, trajectories, statistics pages. Phase 2; the schema must not make
  them harder, nothing in phase 1 is done *for* them.
- Offline / service worker. v1's PWA shell is not carried (D10).
- Automated TBRB history back-fill from archive.org. Manual tool only.
- Browser end-to-end tests (Playwright). Parked (D11).
- Other ranking bodies (Ring, BoxRec).

## Atrium

The server is a chamber: `mod.ts` exports `{ domain: '', displayName:
'Boxing Clever', fetch }` satisfying Atrium's `Chamber` interface. `fetch` is a
Hono app's handler. Routes under `/api/*` are the API; everything else is
served by Atrium's `makeSpaHandler` from `front/`. Atrium owns auth (session
cookie on the Atrium domain), TLS, the process and the import map; the chamber
owns nothing of that. `if (import.meta.main)` boots the same handler on a
local port for development, with a stub for Atrium's static helper so the
repo runs without Atrium checked out.

Deployment: the repo is symlinked into Atrium's `chambers/` and registered in
`chambers.json`; its dependencies are added to Atrium's import map. One
process, one dependency list, one login.

## Architecture

```
browser (lit-html, fetch)  ──►  /api/*  Hono routes (server/api/)
                                   │        validate (zod) → call
                                   ▼
                            server/db/*  hand-written SQL over node:sqlite
                                   │
                            server/rules/*  pure functions: scoring, decisions,
                                            records, stoppage rule — no I/O
```

- `server/rules/` is imported by both `server/api/` and `front/` (the browser
  computes running totals with the same functions the server validates with).
  It has no imports of its own.
- `server/db/` is one module per table, each exporting plain functions that
  take a `Database` and parameters. Transactions are explicit
  (`db.exec('BEGIN')`/`COMMIT`) in the one module that needs them.
- `server/migrations/NNN-name.sql` are applied by `server/db/migrate.ts`
  (~40 lines: a `schema_version` table, apply in order, inside a transaction).
- `front/` is static ESM: `index.html` with an import map, `app.ts`
  compiled on the fly by Deno in dev and emitted once at deploy (D7).

## Data model

SQLite, one file, `data/boxing.db` (gitignored). Dates are ISO text. Money,
none. All ids are `INTEGER PRIMARY KEY`.

| Table | Holds | Notes |
|---|---|---|
| `weight_class` | the 18 classes: name, alternate name, lbs, kg | seeded by migration 001 |
| `fighter` | first/last name, nickname, colors, weight + unit, **current** record (won, lost, draws, nc, kos) | the record is derived data that is stored: updated transactionally on finalise, recomputable by `scripts/recompute-records.ts` |
| `fighter_alias` | fighter_id, alias text | names as TBRB and the sheet spell them; merge keeps aliases |
| `event` | date, location | |
| `bout` | event_id, card_order, weight_class_id, scheduled_rounds, fighter_a_id, fighter_b_id, **corner_a** (`red`/`blue`), a/b **as-of snapshot** (record ×5, weight, unit, colors, tbrb_rank), result (decision_type, winner `A`/`B`/`draw`/`none`, round, time), judges ×3 ×2, is_draft | the snapshot is what v1's Mongo document was for and is kept on purpose (D4) |
| `round_score` | bout_id, round_no, side, points | one row per fighter per round actually scored; the stoppage round has points `0` (see Scoring) |
| `deduction` | bout_id, round_no, side, points, reason | reasons: knockdown, low blow, holding, headbutt, other — a free text alongside |
| `title` | sanctioning_body, area, weight_class_id, status | unique on the four |
| `bout_title` | bout_id, title_id, holder_side (`A`/`B`/`vacant`) | champion and title-for-title fall out of this |
| `tbrb_snapshot` | snapshot_date, weight_class_id, rank (0 = champion), fighter_name, fighter_id (nullable) | one row per ranked name per snapshot; resolution to `fighter_id` by alias, never fuzzy (TBRB.md) |
| `import_batch`, `import_reject` | source, started_at, counts; row text + reason | the staged importer's audit trail (IMPORT.md) |

What is *not* a table: a `violation_type` lookup — reasons are a checked
string; a `judge` table — three ring-side cards per bout is the whole model.

## Scoring (the rules — `server/rules/`)

These are the statements the tier-1 tests make. v1's CLAUDE.md is their
origin; the three stoppage defects there are fixed by construction here.

1. A scored round is 10 points to the winner and 9 to the loser; 10–10 is
   allowed; 10–8 and lower are entered as deductions, not as points. Points
   are integers 0–10.
2. A round total is `points − Σ deductions` for that side and round.
3. A bout total is the sum of round totals over recorded rounds.
4. **Stoppage rule.** Rounds completed before the stoppage are scored
   normally. The stoppage round is recorded with points `0` for both sides,
   carrying only the deductions that happened in it (a knockdown then a stop
   reads points 0, total −1 — *not* a 10–8 round). Rounds after the stoppage
   are not recorded. There are no gaps: every round up to and including the
   stoppage round has a row for both sides.
5. Decision types: `UD` `MD` `SD` `DEC` (unspecified points win), `KO` `TKO`
   `RTD` `TD` `DQ` `NC` `MT` `T` (majority/technical draw) `D` (draw).
   Winner is a side for the first group and for KO/TKO/RTD/TD/DQ; `draw` for
   MT/T/D; `none` for NC. The wire carries the code, never a display label.
6. **Record update on finalise**, once and atomically: KO/TKO/RTD → winner
   won+1 kos+1, loser lost+1; other wins → won+1 / lost+1; draws → both
   draws+1; NC → both nc+1. Re-saving a finalised bout does not double count;
   editing the result of a finalised bout reverses the old increment and
   applies the new in one transaction.
7. **As-of snapshot.** On finalise (and on first save as draft) the bout
   stores both fighters' record, weight, colors and TBRB rank as they stand.
   The snapshot never changes afterwards; the fighter row does.

## API

JSON over `/api`. Missing resource → `404` with `{ error }` (v1 returned 200
and an empty body; D5). Validation failure → `400` with zod's issues. Every
list endpoint returns an array; every single endpoint the object.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/weight-classes` | |
| GET/POST | `/api/fighters` | |
| GET/PATCH | `/api/fighters/:id` | |
| POST | `/api/fighters/:id/merge/:targetId` | transactional; aliases carried |
| GET | `/api/fighters/:id/bouts` | history as witnessed, with as-of snapshots |
| GET/POST | `/api/events` | |
| GET/PATCH/DELETE | `/api/events/:id` | delete refuses if any bout is finalised |
| GET | `/api/events/:id/bouts` | ordered by card_order |
| POST | `/api/bouts` | |
| GET/PATCH/DELETE | `/api/bouts/:id` | PATCH covers corners, titles with holder side, scheduled rounds |
| PUT | `/api/bouts/:id/card` | the whole scorecard: rounds, deductions, result, judges, is_draft; validated by the rules; finalise = `is_draft:false` with a result |
| GET/POST | `/api/titles` | |
| GET | `/api/tbrb/current` | latest snapshot, grouped by weight class |
| GET | `/api/tbrb/fighters/:id` | that fighter's rank history |
| POST | `/api/tbrb/snapshots` | manual back-fill: a dated page's parsed rows |
| POST | `/api/imports/:source` | staged import; returns batch id and rejects |

## Front end

lit-html templates, a hand-written `Component` base of ~40 lines (observe a
store, re-render on change, `ref()` for focus), and a URL router. Pages:

- `/` events list (newest first, collapsible by year as in v1)
- `/events/:id` the card: bouts in order, add/edit bout, corners, titles
- `/bouts/:id` **the scorecard** — the heart of the app. Two columns
  (A left, B right), per round: points · deductions · total; grand totals;
  focus moves down the card as rounds are entered; deductions open a small
  dialog; "End bout" opens the decision dialog (type, winner, round, time,
  three judges). Champion marker and belt list under each name; corner
  colour on the column header; TBRB rank as of the event date.
- `/fighters` grouped by last-name initial, record as W-L-D (N KOs); merge
- `/fighters/:id` the **fighter card** (redesigned): name, nickname,
  colors, current record, current TBRB rank per class, titles held, the
  list of their fights as witnessed with the as-of record beside each.

No CSS framework. One stylesheet, custom properties, light theme only.
Native `<dialog>` for modals (v1 already did this).

## Stack — rote libraries only

A library is acceptable when it solves a rote, already-solved part and does
not impose an application architecture. Every row is also a row in Atrium's
import map.

| Concern | Choice | Replaces | Why it is rote |
|---|---|---|---|
| Runtime | Deno 2.x | Node + pnpm + tsc + vite | Atrium's runtime; TS, test runner, fmt, lint, SQLite built in |
| HTTP routing | Hono | NestJS | Atrium's chamber convention; a `fetch` handler, nothing else |
| Validation | zod | class-validator + class-transformer | one schema per resource is also its TS type |
| Database | `node:sqlite` (Deno built-in) | TypeORM + MySQL + Mongoose + MongoDB | one file, in-memory for tests, zero infrastructure (D3, D4) |
| Templates | lit-html (pinned, from esm.sh) | React + Jotai + Bootstrap | templates only; no component framework (D6) |
| Tests | `Deno.test` + `@std/assert` | — | built in |
| Numbers sheet | none — Numbers exports CSV, the importer reads CSV | numbers-parser | no dependency for a one-time step (D8) |

Not in the list and not wanted: an ORM or query builder, a state library, a
CSS framework, a bundler (D7), Playwright (D11).

## Testing

Three tiers, all run by `deno test`, all green before a step is done:

1. **Rules** — `server/rules/*` as pure functions. The scoring statements
   above, one test per statement, including the stoppage rule worked example
   (KO in round 2 with a knockdown → rounds 1 and 2 recorded, round 2 at
   0 / −1).
2. **HTTP contract** — one test per endpoint via `app.request()` against an
   in-memory database: status, shape, 404 and 400 behaviour.
3. **State across requests** — what a sequence leaves behind: snapshot taken
   on first save and unchanged after; record moves once on finalise and not
   again; result edit reverses and re-applies; merge repoints bouts, aliases
   and TBRB rows or nothing at all; importer rejects a bad row without
   losing the batch.

Not written: tests of Hono wiring, of SQL text, of lit-html output. Browser
journeys are checked by the programmer until D11 is revisited.

## Versioning

`version` in `deno.json`. Bumped when a scene is meant to be deployed to
Atrium; `CHANGELOG.md` is compiled at that moment from the task files.
