# TBRB rankings

The Transnational Boxing Rankings Board publishes men's rankings at
`https://tbrb.org/mens-rankings` — one champion plus a top ten per weight
class, updated roughly weekly (Wednesdays). The site is barely maintained
and keeps monthly archives only from 2012 to October 2023. The user compiled
rankings by hand until April 2024 and gave up; the gap to today is to be
filled by hand from archive.org captures, once the tooling exists.

What the app wants from this: for every bout, each fighter's TBRB standing
*on the date of the fight* (champion / rank N / unranked), and on the
fighter card, their standing now and over time.

## Model

`tbrb_snapshot(snapshot_date, weight_class_id, rank, fighter_name,
fighter_id?)` — one row per listed name per snapshot. `rank` 0 is the
champion. A snapshot is the whole list for one class on one date.

The standing "as of" a date is the latest snapshot on or before that date.
A bout's as-of rank is copied into the bout's snapshot columns at finalise
(SPEC §7) so it survives later corrections to the snapshot table, and the
importer fills it for historical bouts from whatever snapshots exist.

Names link to fighters only through `fighter_alias` (D14). Unlinked names
are listed on a small admin page; linking one creates the alias and
retro-links every snapshot row with that name.

## Current rankings (task 12)

- `server/tbrb/scrape.ts`: fetch the page, parse the per-class lists into
  rows. Pure parse function over HTML text, tested against a saved copy of
  the page in `tests/fixtures/tbrb-YYYY-MM-DD.html` (refresh the fixture
  when the parser breaks; keep the old one as a regression).
- `scripts/tbrb-daily.ts`: run the scrape; if the parsed lists differ from
  the latest stored snapshot for a class, store a new snapshot dated today
  for that class. Identical lists store nothing. Run daily by a systemd
  user timer on the Atrium machine (SETUP.md); a day of downtime costs
  nothing because the next run catches the change.
- Failure (site down, markup changed → zero classes parsed) logs and exits
  non-zero; it never stores an empty snapshot.

## History tool (task 13)

`POST /api/tbrb/snapshots` with `{ date, html }` or a URL: the same parser
over a pasted archive page (tbrb.org's own monthly archives, or an
archive.org capture), stored under the given date. The user walks the gap
one page at a time. Automating the archive.org walk is explicitly out of
phase 1; the tool must make the manual walk a matter of minutes per page.

## Not stored

Women's rankings, pound-for-pound, the board's commentary. Other bodies.
