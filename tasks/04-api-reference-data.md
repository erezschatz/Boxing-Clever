# 04 · API: reference data

## Context

**Promise.** Over HTTP I can create and list fighters, events, titles and bouts, fix a
duplicate fighter by merging it, and every missing id is a 404.

**Acceptance.**
- [x] Endpoints from SPEC *API* for weight classes, fighters (incl. merge and `/bouts`), events (incl. `/bouts`), titles, bouts (create, read, patch incl. corners and titles with holder side, delete)
- [x] zod schema per resource in `server/api/<resource>.ts`; 400 with issues on failure
- [x] 404 `{error}` on every single-resource miss (D5)
- [x] Merge is one transaction: bouts on both sides, aliases, TBRB rows repointed, duplicate deleted — or nothing
- [x] Tier-2: one test per endpoint via `app.request()`; tier-3: merge all-or-nothing, event delete refused when a bout is finalised
- [x] Verified by Erez with the standalone server and `curl`/the browser's devtools

## What was done

2026-11-04. The reference-data API, plus the API half of the guarded
bout delete (D23, `tasks/guarded-bout-delete.md`, whose first two boxes
this ticks; its dialogs are task 08, so that file stays open).

Where things are:
- `server/api/app.ts`: `createApp(db)` mounts the resources, the health
  route, the `/api/*` 404 and the front end. It takes the database as a
  function. `mod.ts` passes one that opens `data/boxing.db` (or
  `$BOXING_DB`) on first use and migrates it (new D29). It creates `data/`
  if needed, and caches the handle only after the migration succeeds. Importing the
  chamber still opens nothing.
- `server/api/http.ts`: what the resources share. `pathId` (a malformed
  id is a 404), `readBody` (zod, `400 {error, issues}`, a non-JSON body
  included) and `constraintResponse`. The last maps the schema's refusals
  in one place: a foreign key, CHECK or NOT NULL is 400 `{error, detail}`,
  a UNIQUE or primary key is 409, and anything else, a trigger's RAISE
  included, is 500 (new D30).
- One file per resource, each with its strict zod schema:
  `weight-classes.ts`, `titles.ts`, `events.ts`, `fighters.ts`, `bouts.ts`.
  - Fighters take the record they arrive with, and PATCH can correct it,
    as in v1 (new D28).
  - Merge (`:id` into `:targetId`) repoints bouts on both sides, aliases
    and TBRB rows, then deletes the duplicate, in one transaction. The
    target keeps its own record, as in v1. Merging two fighters who fought
    each other is 409, and merging a fighter into itself is 400 (D28, D30).
  - A bout is answered with its `titles` (`{title_id, holder_side}`)
    beside the row. A PATCH that sends `titles` replaces the list. A
    bout without `card_order` goes last on its card. A finalised bout's
    fighters cannot be changed (409, D30).
  - Bout DELETE: a draft goes. A finalised bout needs `?records=reverse`,
    which takes the §6 delta back off both records in the same
    transaction, or `?records=keep`; otherwise 409 and nothing changes.
    A reverse that would take a hand-corrected record below zero is 409.
    The event always stays.
  - Event DELETE is 409 while any of its bouts is finalised.
- `server/db/`:
  - `connection.ts`: `transaction()`.
  - `fighter.ts`: `setFighterRecord`.
  - `bout.ts`: `nextCardOrder`, `setBoutResult` (the result columns,
    ready for task 05's finalise), `repointBoutFighter`,
    `countBoutsBetween`, `countFinalisedBouts`.
  - `fighter-alias.ts`: `repointAliases`.
  - `tbrb-snapshot.ts`: `repointTbrbRows` and `listTbrbRowsForFighter`.
    For now only the merge test reads the second one; task 12's
    `/api/tbrb/fighters/:id` is meant to use it.
- SPEC *Architecture*, *Data model* (fighter) and *API* state the above.
  SETUP's migrate line points at D29.

Tests (`tests/helpers/api.ts` calls `createApp` over an in-memory
database through `app.request()`):
- tier 2, one or more per endpoint, with their 404s and 400s:
  `tests/api/catalog.test.ts` (weight classes, titles),
  `events.test.ts`, `fighters.test.ts` and `bouts.test.ts`;
- tier 3: `tests/api/merge.test.ts` covers the repoints, and all-or-nothing
  when a trigger makes the last step fail. `tests/api/delete.test.ts`
  covers reverse (SD, KO with its ko, draw), keep, no choice (409),
  reverse below zero, an event's last bout leaving the event, an event
  with a finalised bout refused, and a finalised bout's fighters frozen.

There is no finalise yet (task 05), so the tier-3 tests finalise with
`finaliseByHand` in the helper. It sets the result and applies
`recordDelta` to both records, as finalise will.

Left for later:
- `GET /api/fighters/:id/bouts` and `/events/:id/bouts` return bout rows
  only, with no event or opponent names. Task 06 decides whether the
  fighter card needs them joined.
- PATCHing `scheduled_rounds` below the rounds already recorded is not
  checked against the card. Task 05, which owns the card.
- Contracted weight and missed weight (D26) are not in the bout body yet.
  That is `tasks/contracted-weight-and-missed-weight.md`, before task 10.
- A merged-in finalised bout, deleted later with `?records=reverse`,
  takes a result the target never counted (D28, open for Erez; until he
  rules, use `?records=keep` for such a bout).
- The merge test's fault-injecting trigger is SQL written in a test. It is
  test-only setup, not app SQL, so it stays out of `server/db/`.
- No alias endpoints. The importers and task 12's linking create aliases.

Run by Claude on the Mac, Deno 2.9.8: `deno task test` 104/104, and
`deno task check`, `deno lint` and `deno fmt --check` clean. Smoke run,
also by Claude: `deno serve` on a fresh `$BOXING_DB` in its scratchpad
migrated the file on the first request, then served
`/api/weight-classes`, a `POST /api/events` and a 404.

Verified by Erez on the Mac, 2026-11-05: `deno task dev` started with no
errors, and `curl localhost:8890/api/weight-classes` returned the 18
classes in seed order, with Heavyweight's lbs and kg null. That was the
only endpoint he exercised by hand; the rest stand on the tests.

## What was done

2026-11-05. The merge now carries the duplicate's finalised results to the
target, shown first and approved (D31, superseding D28 in part, from
Erez's choice of option 2). This builds the API boxes of
`tasks/merge-asks-before-records-move.md`. Its dialog is task 08's, so that
file stays open.

- `server/rules/records.ts`: `resultsAdded` sums what a set of finalised
  fights added to one fighter, each by the side fought on. `isNegative`
  is there for the below-zero check.
- `server/api/fighters.ts`: `mergePlan` checks the merge (404, 400 into
  itself, 409 if they fought each other) and builds the preview:
  - the target's record before and after;
  - the duplicate's record, which is dropped;
  - how many bouts (finalised among them), aliases and TBRB rows move.

  `GET /:id/merge/:targetId` returns the preview. Every `POST` needs
  `?records=add`, even when no finalised fight moves, because the
  duplicate's record is still dropped. Without it the answer is 409 with
  the preview and nothing changes. With approval, one transaction repoints
  everything, sets the target's record to the preview's `after` and
  deletes the duplicate. The answer is the preview, carried out. It
  replaces the target fighter that POST answered before; nothing in
  `front/` calls merge yet.
- `server/api/bouts.ts`: the finalised delete builds the same kind of
  preview: both fighters' records before and after a reverse, and
  `reverse_possible`. The 409s (no choice, or a reverse below zero) carry
  it. A finalised delete now answers `200` with `deleted`, the choice
  (`records`) and both records before and after; a draft delete stays
  `204`. `?records=keep` now also runs in the transaction. The
  `DecisionType`/`Winner` casts became non-null assertions on columns the
  schema sets for every finalised bout.
- The approval is not tied to the preview the user saw. If the duplicate
  gains a finalised fight in between, the POST counts it too (D31: not a
  real window for one user).
- SPEC *API*, new D31, PLAN's out-of-order list.

Tests:
- `tests/rules/records.test.ts`: `resultsAdded` over both sides and every
  result kind.
- `tests/api/merge.test.ts`: refused without approval (`''` and
  `?records=yes`) with the preview, nothing moved; an approved merge of a
  KO win adds won and kos to the target, and deleting that fight with
  reverse returns the target exactly to where it was.
- `tests/api/fighters.test.ts`: the GET preview, field by field, for a
  duplicate with no fights, and a POST without approval refused with that
  same preview. The preview with a finalised fight is checked through the
  409 in `merge.test.ts`.
- `tests/api/merge.test.ts`'s all-or-nothing test now includes a finalised
  fight, so it also checks that the target's record is rolled back.
- `tests/api/delete.test.ts`: the 409's preview, the 200's before/after
  for reverse and keep, and `reverse_possible: false` below zero.

Run by Claude on the Mac, Deno 2.9.8: `deno task test` 108/108, and
`deno task check`, `deno lint` and `deno fmt --check` clean.

Run by Claude against the standalone server (`deno serve` on port 8897,
`$BOXING_DB` in its scratchpad), 2026-11-05:
- Setup over HTTP: the duplicate Aleksandr Usyk (0-0), Oleksandr Usyk
  (21-0, 14 KOs), Dubois and a bout between the duplicate and Dubois. A
  scratch script then finalised it as a KO win for the duplicate, through
  `finaliseByHand`, since there is no finalise endpoint until task 05.
- The GET preview showed the target going from 21-0 (14) to 22-0 (15),
  with `finalised_bouts: 1`.
- POST without approval was 409 with that preview. With `?records=add` it
  was 200, the target was 22-0 (15) and the duplicate a 404.
- Deleting the bout without a choice was 409 with the before/after
  preview for both fighters. With `?records=reverse` it was 200: Usyk was
  back at 21-0 (14), Dubois at 21-2, and the event was still there.

Verified by Erez on the Mac, 2026-11-05, with `deno task dev` and curl, on
two fighters with no fights between them. The POST without approval was
409 with the preview: `record_dropped` 21-0, the target 21-0 before and
after, all counts 0. With `?records=add` it was 200 with the same summary.
