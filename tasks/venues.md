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
- [ ] A `venue` table (name, city, region or null, country) and `event.venue_id` in place of `location`, by a migration that splits each stored location at its commas (first part the venue, last the country, the one before it the city, anything between the region) and refuses to guess where a location does not split that way, listing what it left
- [ ] `server/db/venue.ts` with hand-written SQL, and the API: venues listed, added and edited; an event created and changed with `venue_id`; `GET` of an event or bout answers the venue's parts
- [ ] The event form picks the venue from a search over name, city and country, as the bout form picks a fighter, or adds a new one with its four boxes
- [ ] The events list, the event card and the scorecard's crumb show the place from the venue: the design's city over venue where it has it (`docs/reference/design/Events.dc.html`, `Event.dc.html`)
- [ ] SPEC's data model, API and front-end lines say so; `docs/IMPORT.md` says how steps 10 and 11 write venues
- [ ] Tests: the migration's split and its refusals on a fixture; the venue and event API over HTTP; the search over venues; `deno task test` and `deno task check` run green by Claude; seeing it is Erez's
- [ ] Not in this task: a page or filter of events by venue, city or country (the reason for the split, built after it)

## Decisions

### 2026-11-20 · An event's place is a venue record, with a city, region and country

**Decision** — A `venue` table holds each place once: its name, city, region (a state or province, which may be empty) and country. An event points to one venue. The event form picks it by search or adds a new one. It is built after Erez's check of 09 and before 10, so both imports write venues.
**Rejected** — The place as one string, shown as typed (D84). Venue, city, region and country as fields on each event, which would spell one arena two ways on two nights. Venue, city and country with no region, which would drop the sheet's state ("Anaheim. CA").
**Why** — Erez, 2026-11-20: "we can even save it separately and use it so later I may want to see all venues in Las Vegas or in the UK I saw", and, asked, "Venues as records" with "Venue, city, region, country". A venue typed once groups every night there under one name; the country, always present, is what "everything I saw in the UK" filters on. D84 kept the location as typed only because the sheet's cells could not be split reliably for display; a split stored once, and checked by the migration and the import, settles that.
Supersedes: D84
