# A belt is regular or interim

## Context

Asked by Erez, 2026-11-07, after his first full fight on v2. He had entered
the IBO World title with the kind "Vacant", as v1's title form offered,
and the bout's holder was vacant too. His model (D42): vacancy is per
fight, never the belt's; the only real kind is interim ("active" is just a
title that is not interim); Silver, Diamond and the like are part of the
area, "World Silver". The new-title form should say this, since it did
not.

**Promise.** I enter a belt once, as body, area and whether it is the
interim one, and it keeps one history. Whether it was vacant is said by
each fight.

**Acceptance.**
- [x] A title is body, area, class and an interim flag, unique on the four; no free-text kind
- [x] The stored titles are converted: Active and Vacant become regular, Interim the flag, anything else the area; duplicates are merged and their bouts repointed
- [x] The API takes `interim`, refuses `status`; the pages show "WBC Interim World", "WBC World Silver"
- [x] The new-title form asks body, area, Interim, and says vacancy is per fight; the holder choice says "vacant (neither is champion)"
- [x] IMPORT.md maps v1's kinds the same way
- [x] Verified by Erez: his database migrated, and a title entered the new way

## What was done

2026-11-07 (D42).

Where things are:
- `server/migrations/003-title-kinds.sql` rebuilds `title` with
  `interim INTEGER NOT NULL DEFAULT 0 CHECK (interim IN (0, 1))` and
  `UNIQUE (sanctioning_body, area, weight_class_id, interim)`. It converts
  the old rows through two temporary tables (each row as it will be, and
  the id that keeps each belt), and repoints and deduplicates `bout_title`.
- `server/db/migrate.ts`: a file starting `-- migrate: rebuilds a
  referenced table` (`REBUILDS`) runs with foreign keys off around its
  transaction, checks `PRAGMA foreign_key_check` before committing, and
  turns foreign keys back on whatever happens.
- `server/db/title.ts` and `server/api/titles.ts`: the interim flag in
  place of `status`.
- `front/format.ts` `titleText`: "WBC World", "WBC Interim World", "WBC
  World Silver".
- `front/bout-form.ts`: the new-title fields (body, area with hints,
  Interim checkbox, a line that vacancy is per fight) and the holder label.
- SPEC *Data model*, IMPORT.md (v1's kinds), PLAN (this file), D42.

Tests:
- `tests/db/migrate.test.ts`, "migration 003": an old-shape database with
  Vacant, Active, Interim, Silver and a second kind of the same belt comes
  out as four titles. The IBO Vacant and Active rows become one, and a bout
  that listed both keeps its first. Every reference holds, and foreign keys
  are on again.
- "a rebuild that would leave a broken reference rolls back": nothing
  changes, and foreign keys stay on.
- `tests/api/catalog.test.ts`: regular unless said; interim is another
  title; Silver is an area; `status: 'Vacant'` is a 400.
- `tests/front/shell.test.ts`: `titleText` for the three shapes.
- The other tests that made titles now send `interim`.

`deno task test` 163/163; check, lint and fmt clean.

Run by Claude on a copy of Erez's `data/boxing.db` (scratchpad,
`deno task migrate` with `$BOXING_DB` set): "applied 3". The IBO title
became `IBO / World / 9 / interim 0`, the Carroll v Murphy bout still
lists it with holder `vacant`, `PRAGMA foreign_key_check` is empty, and
the new table definition is as above. Erez's own database is untouched
until he starts the app, which migrates it (D29).

Checked by Claude in the browser pane, serving that migrated copy:
- The event page read "IBO World (vacant)" for Carroll v Murphy.
- In Add bout, "+ New title" showed Body, Area, Interim and "Whether it is
  vacant is said per fight, by who holds it coming in, not here".
- WBC / World Silver added a title that came back on the line as "WBC
  World Silver", with the holder choice "vacant (neither is champion)".
  That title was in the copy only.

The independent reader (a read-only subagent over the staged diff; it read
`data/boxing.db` read-only, at version 2 with the one IBO title) found no
blocking bug. It found these edge cases, all fixed:
- Kinds other than the three were matched case-sensitively, so "Silver"
  and "silver" on one belt stayed two titles. Belts are now compared
  ignoring case and spacing.
- "Interim Silver" lost its interim flag.
- A blank area gave " Silver".
- A bout listing a belt's vacant row first and its named-holder row second
  kept "vacant". The row naming a holder now wins.
- `BEGIN` sat outside the `try`, so a failing `BEGIN` would have left
  foreign keys off. It is now inside, and the `finally` always runs.

New tests:
- `tests/db/migrate.test.ts` "migration 003 reads kinds as typed": any
  case, padding, "Interim Silver", a blank area, and a holder beating
  vacant.
- `tests/api/catalog.test.ts`: `interim` given as 1, "true" or null is a
  400.

`deno task test` 164/164; check, lint and fmt clean. Re-run on a fresh copy
of Erez's database: "applied 3", with the same result as above (IBO World,
regular, vacant for the Carroll fight, no broken references). Not covered
by a test: the new-title form's Interim checkbox and its wording, which
were checked in the pane.

Verified by Erez on 2026-11-15: his database migrated, and a title entered
the new way.

Reviewed by: a read-only Explore subagent, cold, against the diff (found it accurate; asked that 06's note say the standalone check came through 07–08 and that the session-script line is new in 14, and that the notes claim no more than Erez confirmed; done).
