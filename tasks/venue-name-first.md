# The venue's name first, the city under it

## Context

Erez, 2026-11-22, with screenshots of the event card ("LONDON", then "O2
Arena · UK") and the scorecard's crumb ("Events / London · 4 Apr 2026"),
after [venues](venues.md): "It's working, the question is whether it
should show "London"? I would use the Arena name and the city, rather
than the city."

**Promise.** A night reads by where it was: the arena first, then the
city.

**Acceptance.**
- [x] The event card's title is the venue's name, with the city, region and country under it ("O2 Arena" over "London, UK")
- [x] Each row of the events list likewise: the venue's name large, the city, region and country under it
- [x] The scorecard's crumb names the venue and its city ("O2 Arena, London"), the whole place its tooltip
- [x] A venue the migration left with empty parts shows what it has, nothing empty
- [x] A test states the lines and the crumb; `deno task test` and `deno task check` run green by Claude; seeing it is Erez's

## Decisions

### 2026-11-22 · The venue's name is set large, with its city, region and country under it

**Decision** — `placeLines` gives the venue's name, set large on the event card and the events list, and under it the city, region and country in one muted line ("Las Vegas, NV, USA"). `venueAndCity` gives the crumb's "O2 Arena, London"; `venueText`, the whole place, stays its tooltip. Empty parts are left out, and a line with nothing in it is not drawn. The rest of D120 stands: the event form shows a chosen venue's name strong and the rest beside it, with "change" and "edit venue".
**Rejected** — The city large and the venue under it, as the design sets it (D120). The venue alone in the crumb.
**Why** — Erez, 2026-11-22: "I would use the Arena name and the city, rather than the city." A night is remembered by the arena; London alone says little when the O2 and Wembley are both there.
Supersedes: D120

## Review · 2026-11-22

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found these as the record says:
- the event card, the events list and the crumb set as the boxes say;
- the old fields and class names gone, the renamed classes keeping their
  rules;
- both helpers right for each of D118's cases;
- only D120's test rewritten;
- D123 matching this file.

It found three things.

### The events list keeps an empty place line

**Found** — `front/events-page.ts`: the `.ep-place` span was drawn when `where` was `''`, adding the flex gap under the name; the event card leaves its line out.

**Done when**

- [x] A list row for a venue with city and country `''` → the name alone, no place element
- [x] A list row for a venue with only the country `''` → the name over "London"
- [x] A list row for a full venue → the name over "Las Vegas, NV, USA"
- [x] The event card for each → unchanged

**Not asked** — Placeholder text for a missing part.

Answered in this change: the list draws `.ep-place` only when there is a
place line, as the card does. Not seen in a browser.

### D123 supersedes D120 whole, including its event-form clause

**Found** — D120 also said how the event form shows a chosen venue; D123 superseded it without restating that.

**Done when**

- [x] `docs/DECISIONS.md` → a live decision states how the event form shows a chosen venue
- [x] D123 → replaces only D120's list, card and crumb parts

**Not asked** — A change to the event form.

Answered in this change: D123 says the rest of D120 stands and restates
the event form's clause.

### The record's "half empty" case is not the case the test has

**Found** — The test had only a venue with city and country both `''`, not one with only the country `''`.

**Done when**

- [x] The record names the cases the test covers, or the test adds a two-part venue → the name over "London", `venueAndCity` "O2 Arena, London"

**Not asked** — Tests that render the pages.

Answered in this change: the test adds the two-part venue, and the record
names the cases.

## What was done

2026-11-22. The venue's name leads wherever a night's place is shown.

- **Helpers** (`front/format.ts`): `placeLines` answers `{name, where}`,
  the venue's name and its city, region and country; `venueAndCity` is
  new.
- **Pages**: `front/event-page.ts` (the title, and `.ec-place` under it),
  `front/events-page.ts` (`.ep-name` over `.ep-place`, drawn only when
  there is a place line), `front/bout-page.ts`
  (the crumb is `venueAndCity`).
- **Styles** (`front/style.css`): the classes renamed to what they now hold,
  `.ep-name`, `.ep-place` and `.ec-place`, with the same looks.
- **Docs**: SPEC's events list, event card and scorecard lines. `deno task
  record` compiled this file's decision into `docs/DECISIONS.md` as D123 and added
  the task to `docs/PLAN.md`.

Tests: `tests/front/shell.test.ts`'s place test is rewritten to this
file's decision, which supersedes the one it stated (D120): the name and
the line under it, and `venueAndCity`, for a venue with a region, one
without, one with only the country empty (two parts) and one with the city
and country empty (one part), as the migration may leave them (D118).

Verified 2026-11-22 by Claude:
- `deno task test` (238 passed), `deno task check` and `deno lint front`
  run.
- Not seen in a browser. A long venue name set large on the event card
  ("Madison Square Garden") wraps to more lines than a city did; how it
  reads is Erez's to see.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-22); its three findings are answered above
