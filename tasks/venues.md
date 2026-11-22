# Venues: an event's place as a record of its own

## Context

Erez, 2026-11-20: "I think the way the location is formatted, so far I've
used a single string with arena, city, state/country, but there's no real
reason to not split it up, we can even save it separately and use it so
later I may want to see all venues in Las Vegas or in the UK I saw..."

Asked, he chose venues as records of their own over fields on each event,
and venue, city, region and country as a place's parts. He asked for it to
be built after his day of testing step 09 (2026-11-21), so this is open,
waiting on his word. It is best done before steps 10 and 11, whose imports
then write venues rather than one location string: the Numbers sheet
already writes venue, city and region in one cell (`docs/IMPORT.md`,
`Date/Location`).

Today an event is `date, location` (SPEC Data model); the location is shown
as typed (D84) on the events list, the event card and the scorecard's
crumb. Erez's dev database holds a few events typed "Venue, City, Country"
("O2 Arena, London, UK", "3 Arena, Dublin, Ireland").

**Promise.** Each place I have watched a fight at is written once, as a
venue in a city, region and country, so later I can see every night in Las
Vegas or in the UK.

**Acceptance.**
- [x] A `venue` table (name, city, region or null, country) and `event.venue_id` in place of `location`, by a migration that splits each stored location at its commas (first part the venue, last the country, the one before it the city, anything between the region) and refuses to guess where a location does not split that way, listing what it left
- [x] `server/db/venue.ts` with hand-written SQL, and the API: venues listed, added and edited; an event created and changed with `venue_id`; `GET` of an event or bout answers the venue's parts
- [x] The event form picks the venue from a search over name, city and country, as the bout form picks a fighter, or adds a new one with its four boxes
- [x] The events list, the event card and the scorecard's crumb show the place from the venue: the design's city over venue where it has it (`docs/reference/design/Events.dc.html`, `Event.dc.html`)
- [x] SPEC's data model, API and front-end lines say so; `docs/IMPORT.md` says how steps 10 and 11 write venues
- [x] Tests: the migration's split and its refusals on a fixture; the venue and event API over HTTP; the search over venues; `deno task test` and `deno task check` run green by Claude; seeing it is Erez's
- [x] Not in this task: a page or filter of events by venue, city or country (the reason for the split, built after it)

## Decisions

### 2026-11-20 · An event's place is a venue record, with a city, region and country

**Decision** — A `venue` table holds each place once: its name, city, region (a state or province, which may be empty) and country. An event points to one venue. The event form picks it by search or adds a new one. It is built after Erez's check of 09 and before 10, so both imports write venues.
**Rejected** — The place as one string, shown as typed (D84). Venue, city, region and country as fields on each event, which would spell one arena two ways on two nights. Venue, city and country with no region, which would drop the sheet's state ("Anaheim. CA").
**Why** — Erez, 2026-11-20: "we can even save it separately and use it so later I may want to see all venues in Las Vegas or in the UK I saw", and, asked, "Venues as records" with "Venue, city, region, country". A venue typed once groups every night there under one name; the country, always present, is what "everything I saw in the UK" filters on. D84 kept the location as typed only because the sheet's cells could not be split reliably for display; a split stored once, and checked by the migration and the import, settles that.
Supersedes: D84

### 2026-11-22 · The migration keeps an unsplit location's parts and leaves the rest empty, rather than listing it

**Decision** — Migration 007 splits each location at its commas: three parts are venue, city, country; four add the region; five or more keep the extra in the venue's name. Empty parts (",,", a leading comma) are dropped before counting. One with two parts keeps the venue and city and leaves the country `''`; one with one part keeps the name and leaves the city and country `''`; one with no part at all (empty, spaces, only commas) is an "Unknown venue" with the rest `''`. So every event keeps its id and gets a venue, and the migration always commits. The venue form fills them in, and the pages show such a venue's name large, saying nothing twice. The schema allows `''` in a city and a country; the API does not, and a PATCH that leaves one `''` is refused, so a venue the migration could not split is fixed whole.
**Rejected** — A migration that refuses an unsplit location and lists it (the acceptance as first written): migrations are plain SQL run when the chamber opens its database, where no one reads a list, and a refusal would stop the chamber. A script to run before the migration.
**Why** — Erez's dev database splits cleanly ("O2 Arena, London, UK", "3 Arena, Dublin, Ireland"); the rule is for what it may not, and an empty part is visible on the page and fixed once in the venue form.

### 2026-11-22 · An event answers with its venue; venues are added and fixed, never deleted

**Decision** — `GET` of an event, of the list and of a write's answer gives the event's `venue_id` and `venue`, the venue's four parts (`eventView` in `server/api/events.ts`), so the pages need no second call. `/api/venues` lists, adds and edits venues; there is no delete, as events point to a venue, and no merge of two venues yet. A venue that does not exist is a 400 from the schema's foreign key (D30), the same four parts twice a 409 from its index.
**Rejected** — The pages fetching each venue. The venue's parts flattened into the event. A venue delete or merge, which nothing asks for yet.
**Why** — The pages show the place everywhere an event appears; one answer keeps them as simple as they were with the location string.

### 2026-11-22 · The place reads as the design sets it: the city large, the venue, region and country under it

**Decision** — `placeLines` gives the city, set large on the events list and the event card, and under it the venue then the region and country, "T-Mobile Arena · NV, USA", in the muted small style (`Events.dc.html`, `Event.dc.html`). The scorecard's crumb names the city, with the whole place (`venueText`) as its tooltip, as the design's crumb does. The event form shows a chosen venue's name strong and the rest beside it, with "change" and "edit venue".
**Rejected** — The location as one line (D84, superseded by D117). The venue large and the city under it.
**Why** — The design sets the city first and large; with the place stored in parts it can, which D84 said it could not.

### 2026-11-22 · The event and venue forms ask before discarding what was typed

**Decision** — The event form is dirty when its date or venue differs from the event's, or, for a new event, when a venue is chosen or a search typed; the venue form when any box differs. Cancel and Escape then ask first, as the fighter and bout forms do (D44).
**Rejected** — Leaving the event form without a dirty check, as it was.
**Why** — The event form now holds a search and a chosen venue, and the venue form four boxes; at ringside these take a moment to type, which is D44's reason.

### 2026-11-22 · A bout does not answer its venue; its page reads the event, which does

**Decision** — `GET /api/bouts/:id` is unchanged and carries `event_id` only. The scorecard already reads the bout's event (`/api/events/:id`), which answers the venue (D119). The acceptance's "`GET` of an event or bout answers the venue's parts" is met for the event; for the bout, through its event.
**Rejected** — Adding the venue to every bout's answer (`boutView`), which the event card's list of bouts and the fighter card's history would carry for nothing.
**Why** — The one page that shows a bout's place already makes that call; nothing else that reads a bout shows where it was.

## Review · 2026-11-22

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`), which ran the migration on fixtures. It found these
as the record says:
- the rebuild keeping `bout`'s foreign key to `event`, `foreign_key_check`
  clean, NULL regions matched through `coalesce`;
- the 400 and 409 paths, `eventView`'s venue always there;
- the event form's search, choosing, adding, editing, `dirty()` and its
  `load()` run by `open()`;
- the changed tests keeping their assertions;
- no reader of `location` left in code;
- D118–D121 matching this file.

It found these.

### Migration 007 fails or drops events on empty comma parts

**Found** — `server/migrations/007-venues.sql`: empty parts were filtered out but the numbering kept their gaps, so `", London, UK"`, `"O2,, London, UK"` or `"A,,B"` looked up a missing part and failed NOT NULL, stopping the chamber; a location with no part at all had no split row, and its event was dropped (a rollback with bouts, lost without).

**Done when**

- [x] `, London, UK` → one event at a venue D118 names, and the migration commits
- [x] `O2,, London, UK` and `O2, London,, UK` → `O2`, `London`, no region, `UK`
- [x] `A,,B` → name `A`, city `B`, no NOT NULL failure
- [x] `,,,D,E` → a venue with a name, and the migration commits
- [x] `''`, spaces or only commas, with or without bouts → the event survives with a named venue, the count unchanged
- [x] 1 to 6 parts, trailing commas, spacing, a place twice → as the first test states
- [x] every event → the same id after, bouts on it, `foreign_key_check` clean

**Not asked** — A script before the migration, a list of refusals, the runner.

Answered in this change: the parts are renumbered with no gaps
(`row_number()`) before the split, and an event with no part gets an
"Unknown venue". D118 says both. `tests/db/migrate.test.ts` adds a test of
eight such locations, one of them under a bout. `", London, UK"` becomes
venue "London", city "UK", no country: two parts, which D118 leaves for
the venue form.

### Acceptance box 2 is ticked, but `GET` of a bout does not answer the venue

**Found** — `server/api/bouts.ts` and `card.ts` are unchanged; D119 covers only the event.

**Done when**

- [x] `GET /api/bouts/:id` → answers the venue, or a decision narrows box 2 and says why
- [x] Event answers → `venue` as now

**Not asked** — Changing the bout page's fetches.

Answered in this change by the decision "A bout does not answer its venue;
its page reads the event, which does".

### Box 1 and box 6 do not hold as written

**Found** — Box 1 says the migration refuses and lists, box 6 tests "its refusals"; D118 keeps `''` instead, and the boxes do not say so.

**Done when**

- [x] Boxes 1 and 6 as ticked → the record says they are met as D118 restates them
- [x] The migration on any stored location → commits

**Not asked** — Editing the Context section.

Answered here: boxes 1 and 6 are ticked as D118 restates them. The
migration keeps what a location has and leaves the rest `''`, listing
nothing, and the tests cover its split and what it keeps rather than
refusals. With the first finding answered, it commits on any location.

### A venue fixed from the event form shows stale after Cancel

**Found** — `front/event-page.ts`, `editEvent` updated the page only when the event was saved, so a venue fixed in the form and the event then cancelled showed the old place until a reload.

**Done when**

- [x] Edit venue, save, Cancel the event form → the page shows the fix
- [x] Edit venue, save, save the event → the fix, as now
- [x] Events list: new event, add a venue, Cancel → no event, the list unchanged

**Not asked** — A new endpoint, `DialogForm`.

Answered in this change: `editEvent` reads the page again whatever the
form answers, as `editBout` does. The events list was already right: it
reads only after a saved event. Not seen in a browser.

### Smaller items

**Found** — The design README still said `/api/events` returns a location; `findVenue` had no caller; a PATCH of a venue the migration left `''` kept it `''`; the `venueId` helper's comment was wrong; IMPORT.md said the imports reject "as migration 007 did", which keeps instead.

**Done when**

- [x] The design README's open-choices line → describes the venue split as it now is
- [x] `findVenue` → has a caller and a test, or is gone
- [x] PATCH of a half-empty venue sending only another part → 400, or D118 says it may stay `''`
- [x] The `venueId` comment → matches the helper

**Not asked** — A venue delete or merge.

Answered in this change: the README line names the venue and D117;
`findVenue` is gone; `PATCH /api/venues/:id` checks the venue as it will
stand with the full schema, so a part left empty is a 400, which D118 now
says and `tests/api/venues.test.ts` tests; the helper's comment and
IMPORT.md's wording are fixed.

## What was done

2026-11-22. An event's place is a venue record, typed once.

- **Schema** (`server/migrations/007-venues.sql`, a rebuild of `event`): the
  `venue` table (name, city, region or null, country), unique on the four
  parts (`venue_place`, region compared as `''` when null); each location
  split at its commas into a venue, one per place; `event` rebuilt with
  `venue_id` in place of `location`, and an index on it.
- **Database** (`server/db/venue.ts`, new): insert, get, list by country,
  city and name, update. `server/db/event.ts`:
  `EventFields` is `{date, venue_id}`.
- **API** (`server/api/venues.ts`, new, mounted at `/api/venues` in
  `server/api/app.ts`): list, add, get, edit; an empty region is null; an
  edit is checked as the venue will stand, so no part is left empty.
  `server/api/events.ts`: the schema takes `venue_id`; every answer is
  `eventView`, the event with its `venue`; `EventView` is exported for the
  front.
- **Front**:
  - `front/api.ts`: `Event` is the server's `EventView`; `Venue` is
    exported.
  - `front/format.ts`: `placeLines` and `venueText`.
  - `front/entry.ts`: `findVenues`, by every word in any part.
  - `front/event-form.ts`: the venue found by search, arrows and Enter or
    a click to choose, Enter with no match or "New venue" to add; a chosen
    venue shown with "change" and "edit venue"; the venues loaded when the
    dialog opens; a dirty check.
  - `front/venue-form.ts`, new: a venue's four boxes, adding or fixing,
    with a dirty check.
  - `front/events-page.ts`, `front/event-page.ts`: the city large and the
    venue line under it; the event page reads again after the event form
    closes, saved or not. `front/bout-page.ts`: the crumb names the city,
    the whole place its tooltip.
  - `front/style.css`: `.ep-where` holds `.ep-city` and `.ep-venue`;
    `.ec-venue` under the event card's title.
- **Docs**: `docs/reference/design/README.md`'s events-list open choice no
  longer says the API answers a location. SPEC's data model (`event`, `venue`), API (`/api/events`,
  `/api/venues`), the events list and event card lines, and the forms
  paragraph; `docs/IMPORT.md` gains "Places: venues", how steps 10 and 11
  write venues, leaving the sheet's US states to task 11. `deno task
  record` compiled this file's new decisions into `docs/DECISIONS.md`
  as D118–D122 and added the task's status to `docs/PLAN.md`.

Tests:
- New: `tests/db/migrate.test.ts` runs migration 007 over seven locations
  (three, four and five parts, spacing, a place typed twice, two parts and
  one) and checks each event's venue, the count, the bout still on its
  event, the foreign keys, and that `location` is gone;
  a second migration test runs eight locations with empty parts or none,
  one under a bout, and checks each event keeps its id and a named venue;
  `tests/api/venues.test.ts` (adding and listing, the required parts and a
  409 for a place twice, a fix shown on the event, an event moved to
  another venue and a missing one refused, a half-empty venue fixed whole); `tests/front/shell.test.ts`
  (`placeLines`, `venueText`); `tests/front/forms.test.ts` (`findVenues`).
- Changed with the contract, which D117 supersedes: every test that made an
  event with a `location` string now makes a venue first and passes its
  id: `tests/helpers/api.ts` (`venueId`, used by `usykFury`),
  `tests/api/merge.test.ts`, `tests/api/fighters.test.ts`,
  `tests/db/tables.test.ts`, `tests/db/migrate.test.ts` (and `venue` in its
  list of tables). Their assertions are unchanged.
  `tests/api/events.test.ts` states the new contract: the event answers
  with its venue, and a missing venue, a `location` string or an unknown
  venue is refused.

Verified 2026-11-22 by Claude:
- `deno task test` (238 passed), `deno task check`, `deno lint front` and
  `deno fmt --check` run.
- Migration 007 run on a copy of Erez's dev database with six awkward
  locations added, and the eight edge cases on an empty database: each
  split as the tests state, every event kept, the O2 typed twice one
  venue, `PRAGMA foreign_key_check` clean. Erez's own database is
  untouched; the chamber applies the migration when it next opens it.
- Not seen in a browser. Adding an event with a new venue, choosing an
  existing one, fixing a venue, and the events list, event card and crumb
  are Erez's to check.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-22); its findings are answered above
