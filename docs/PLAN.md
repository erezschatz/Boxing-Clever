# Plan

Phase 1, in order. One file per step in `tasks/`; each states the promise
from the user's point of view and the acceptance criteria that make it done.
Steps are done strictly in order unless a decision in `DECISIONS.md` says
otherwise.

There is no status column. A task file without a `## What was done` section
is open; with one, done; listed in a compiled `CHANGELOG.md` release,
shipped. A step is done when every acceptance box is ticked, *What was done*
is written, and Erez has run it where it runs (browser, Atrium) — not just
`deno test`.

Each step is sized so it ends with something runnable the same day. No
calendar estimates: this project moves in spare moments, and the form is
what keeps it from dropping out between them.

| # | Step |
|---|------|
| 00 | [Skeleton and documentation](../tasks/00-skeleton.md) |
| 01 | [Toolchain green](../tasks/01-toolchain-green.md) — `deno task dev/test/check`, chamber boots standalone and under Atrium |
| 02 | [Schema, migrations, database modules](../tasks/02-schema-and-db.md) — all tables, seed, in-memory test harness |
| 03 | [The rules](../tasks/03-rules.md) — scoring, stoppage, decisions, record arithmetic as pure functions, with tier-1 tests |
| 04 | [API: reference data](../tasks/04-api-reference-data.md) — weight classes, fighters + merge, events, titles, bouts |
| 05 | [API: the scorecard](../tasks/05-api-scorecard.md) — save, finalise, snapshot, record update; tier-3 tests |
| 06 | [Front: shell and read-only pages](../tasks/06-front-shell.md) — router, base class, events list, event, fighters |
| 07 | [Front: the scorecard page](../tasks/07-front-scorecard.md) — v1 parity plus corners, champion and belts |
| 08 | [Front: forms](../tasks/08-front-forms.md) — fighter, event, bout, titles with holder side, deductions, decision |
| 09 | [Design pass](../tasks/09-design-pass.md) — Claude Design over all pages; fighter card redesign |
| 10 | [Import: v1 databases](../tasks/10-import-v1.md) — MySQL + Mongo dumps → new schema, rejects report |
| 11 | [Import: the Numbers sheet](../tasks/11-import-sheet.md) — CSV → staged import, rejects report, alias seeding |
| 12 | [TBRB: current rankings](../tasks/12-tbrb-current.md) — daily scrape, snapshots, diff, display on fighter and bout |
| 13 | [TBRB: history tool](../tasks/13-tbrb-history.md) — manual back-fill from archive pages |
| 14 | [Deploy and retire v1](../tasks/14-deploy.md) — mounted in Atrium, data cut over, v1 read-only |
| 15 | [Live use and fixes](../tasks/15-live-use.md) — a month of fights on the new app |

## Milestones

- **After 05:** the data model is proven. A bout can be created, scored,
  stopped in round 2 with a knockdown, finalised, and both fighters' records
  move once and atomically — all over HTTP against a real database, with the
  snapshot intact. Nothing after this is worth building if this fails.
- **After 08:** the app can replace v1 for a fight night, standalone on the
  laptop. The design is still the programmer's own.
- **After 11:** the database holds every fight watched since Nov 2021.
- **After 14:** v1 is retired; the chamber on Atrium is the one in use.
- **After 15:** phase 1 complete; the project goes quiet.

## Not in phase 1

Mobile layout (D9), public access (D2), charts and trajectories, service
worker (D10), Playwright (D11), automated TBRB history from archive.org,
other ranking bodies. Phase 2 is not planned here.
