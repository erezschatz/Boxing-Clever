# The events page, restyled

## Context

Erez, 2026-11-20: "restyle the events page to the design". This is the
events part of the third acceptance box of
[09 · Design pass](09-design-pass.md). It is built to
`docs/reference/design/Events.dc.html`. It is a task file of its own, as the
fighter card and the scorecard are (D68), so 09 stays open for the fighters
page and for Erez's check in the browser.

**Promise.** The front page is every night I have watched, folded by year,
in the same look as the scorecard: the year large, the nights under it, one
click to the card.

**Acceptance.**
- [x] `/` shows the large "Events" title, how many nights were watched since the first, and "New event" as the dark button
- [x] Each year is one row: the year large, a mark per event (filled when the year is open), the number of events and a chevron; it still folds and unfolds, with the newest year open
- [x] Each event is one link to its card: the day large and the month, then the location
- [x] What the page does is unchanged in the diff (the `/events` load, the folding, "New event" opening the form and then the new card), read by Claude and the cold reader; seeing it in the browser is 09's last box, Erez's
- [x] The tier tests under `tests/` that were there before pass unchanged; `deno task test` and `deno task check` run green by Claude

## Decisions

### 2026-11-20 · An events row shows the date and the location, not the main event or the bout counts

**Decision** — Each event's row gives the day, the month and the location. The design's main event ("Arce vs Okafor"), the number of bouts and how many are not final are not shown.
**Rejected** — Adding the main event and the counts to `GET /api/events` with this restyle.
**Why** — `/api/events` returns a date and a location, and this restyle is to change no behaviour (09). The design README leaves those columns as an open choice; they would be a change to the API with its own tests, a task of its own if Erez wants them.

### 2026-11-20 · The location is shown as typed, not split into city and venue

**Decision** — The location is one line, as it was typed, in the design's city style.
**Rejected** — The design's city over venue, split at a comma.
**Why** — Locations are not typed one way: the Numbers sheet has venue first and city second, split by `.` or `,` (IMPORT.md, `Date/Location`), so a split would put the venue where the city goes.

### 2026-11-20 · Each event is one link, the whole row

**Decision** — An event row is a single link to its card, holding the day and month (in a `time` element whose title is the full date) and the location; the list is an ordered list, newest first. Tab still stops once per event.
**Rejected** — The table, with the link on the location only.
**Why** — It is the design's row, and the whole row being the target is easier to hit. The year is in the row above, so the full date is in the `datetime` and the title, not on the row.

### 2026-11-20 · The page's figures come from the list it already loads

**Decision** — "N nights watched since Mon YYYY" counts the events and takes the month and year of the earliest (`watchedSince`). A year's marks are one square per event, filled while the year is open, hidden from the screen reader, which gets "N events". The month is three capitals from a fixed list (`dayAndMonth`).
**Rejected** — Counting on the server. The locale's short month name.
**Why** — Every event is a night watched (SPEC), and the page has every event. Some locales give September as "Sept".

### 2026-11-20 · The events page joins the shared look

**Decision** — `.events-page` joins `.fighter-card` and `.bout-page` on the `--ds-*` properties, and `main` widens to 80rem around it as around the scorecard. Its rules are scoped to `.events-page` (`ep-`). The shared `.group`, `.count`, `table.list` and `.page-head` rules stay for the fighters and event pages, which are not restyled yet. The site header is not part of this restyle.
**Rejected** — Restyling the shared rules, or the header, now.
**Why** — As for the scorecard (its "shared, scoped by page" decision): pages not yet restyled must not change. The header is on every page, so it belongs to a restyle of its own.

## Review · 2026-11-20

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It checked the following against HEAD and found them
as before:
- `load()`, `add()` and `toggle()`, byte for byte;
- the year button's `aria-expanded` and handler;
- the newest year open first;
- "Loading…" and "No events yet.".

It also found:
- the shared `.group`, `.count`, `table.list`, `td.date` and `.page-head`
  rules still there for the pages that use them;
- every custom property the new rules read defined for `.events-page`;
- the new rules scoped to the page;
- `dayAndMonth` and `watchedSince` right on the edges (one event, unsorted
  dates, none);
- the test diff only adding lines.

It found one thing.

### The record's Docs line leaves out DECISIONS and PLAN

**Found** — `## What was done`, the **Docs** bullet, named only SPEC's `/` line; the staged diff also adds D83–D87 to `docs/DECISIONS.md` and the task's line in `docs/PLAN.md`.

**Done when**

- [x] The record's Docs bullet → names SPEC's `/` line, D83–D87 in DECISIONS.md and the PLAN.md entry
- [x] Every other claim in `## What was done` → unchanged, each matching the diff

**Not asked** — No rewording of the decisions or the SPEC line, and no change to PLAN's status.

Answered in this change: the Docs bullet now names all three.

## What was done

2026-11-20. The events page at `/`, restyled to
`docs/reference/design/Events.dc.html`.

- **Page** (`front/events-page.ts`): `view()` wraps the page in
  `.events-page`. It renders:
  - a head with the large "Events" title, the `watchedSince` line, and "New
    event" as the dark button;
  - the years between heavy rules (`year()`): each a button with the same
    `aria-expanded` and `toggle`, holding the year, a mark per event, "N
    events" and a chevron;
  - under an open year, an ordered list of links (`list()`), each with the
    day and month in a `time` element and the location as typed.

  `load()`, `add()` and `toggle()` are unchanged: the same `/events` load,
  the newest year open, and "New event" opening the form and then the new
  card. Loading and "No events yet." say what they said before.
- **Helpers** (`front/format.ts`): `dayAndMonth` gives the row's day and
  three-capital month from a fixed list; `watchedSince` gives "N nights
  watched since Mon YYYY" from the earliest date, and '' with no events.
- **Styles** (`front/style.css`): `.events-page` joins the shared `--ds-*`
  rule, the `.muted` colour and the 80rem `main`. Its own rules, `ep-`, are
  appended at the end: the title, the dark button, the year rows, the marks,
  the chevron and arrow drawn as two borders, the event rows with a hover
  band, and a phone layout without the marks. The shared `.group`, `.count`,
  `table.list` and `.page-head` rules are untouched, for the pages still on
  them.
- **Docs**: SPEC's `/` line describes the restyled list; `deno task record`
  compiled this file's decisions into `docs/DECISIONS.md` as D83–D87 and
  added the task to `docs/PLAN.md`.

Tests: `tests/front/shell.test.ts` adds `dayAndMonth` and `watchedSince`.
`git diff tests` adds lines only.

Verified 2026-11-20 by Claude:
- `deno task test` (212 passed), `deno task check` and `deno fmt --check`
  all run.
- Not seen in a browser. That the folding and "New event" behave as before
  is shown by the code path, not by a run; Erez checks it in the browser with
  09's last box.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); its one finding is answered above
