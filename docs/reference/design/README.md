# Design reference (task 09)

The output of the Claude Design pass over the front end, 2026-11-19. This is
the reference task 09 builds to. It is a picture of the intended look, not
code to lift: the pages are built in lit-html and `front/style.css` as
SPEC's Front end says, and behaviour stays as the spec and DECISIONS have it.

The live canvas, which can be opened, played and commented on:
<https://claude.ai/artifact/8RVPAYGyKWXFvuvTdLZtRX> (private to Erez).

The `.dc.html` files here are its artboards, copied as published. They
need the canvas's runtime (`support.js`) to render, so they do not open
on their own; read them for exact sizes and colours, and view them on the
canvas. `canvas.json` is the canvas's index: where each artboard sits.

## Artboards

| File | Page | SPEC |
|---|---|---|
| `Main.dc.html` | Scorecard while scoring (types and totals work in Play) | `/bouts/:id` |
| `Finished.dc.html` | Scorecard finalised, read-only, with the result | `/bouts/:id` |
| `Marquees.dc.html` | The fighter header above each half, four states | `/bouts/:id` |
| `Fighter.dc.html` | Fighter card | `/fighters/:id` |
| `Events.dc.html` | Events list, folded by year | `/` |
| `Event.dc.html` | Event card, bouts in order | `/events/:id` |
| `Fighters.dc.html` | Fighters list, filed by initial | `/fighters` |
| `DialogsScoring.dc.html` | Deduction, End bout | `deduction-form.ts`, `decision-form.ts` |
| `DialogsData.dc.html` | Bout, fighter, event | `bout-form.ts`, `fighter-form.ts`, `event-form.ts` |
| `DialogsGuard.dc.html` | Delete a bout (both steps), merge | `bout-delete.ts`, `merge-form.ts` |

## The look

Taken from the logo (`docs/reference/logo-grid.png`): white paper, black
ink, heavy condensed capitals, and red and blue that mean the corners and
nothing else. The scorecard is the largest thing in the app; everything
around it is quiet.

| Token | Value | Used for |
|---|---|---|
| paper | `#FFFFFF` | page ground |
| ink | `#111111` | text, rules, primary buttons |
| muted | `#6A6760` | secondary text, labels (5.6:1 on white) |
| line | `#E6E3DC` | row rules |
| border | `#CFCBC2` | inputs, secondary buttons |
| band | `#F5F3EE` | current round, row hover |
| backdrop | `#F0EEE9` | behind an open dialog |
| red | `#C8102E` | red corner; a foul (FOUL) |
| blue | `#1554B8` | blue corner; a knockdown (KD) |
| danger | `#A50D25` | delete buttons only |

Type: Barlow Condensed (600–800) for names, numbers and headings, set in
capitals; Inter (400–600) for everything else. Numbers use tabular figures.
Both are Google Fonts; the stack would need them, or a local copy, as SPEC's
Stack table decides.

Sizes worth keeping: score boxes 64px high with 44px digits; grand totals
64px; fighter names 76px on the scorecard, 128px on the fighter card; page
titles 112px. Content width 1280px. Rules: 3px black around the scorecard
and between groups, 1px `line` between rows. No rounded corners, no shadows.

## Open choices

These came up in the design pass and are not decided. Each needs an entry
under `## Decisions` in task 09 (or a superseding one) before it is built:

- **Scorecard columns mirrored**: total · ded · points | round | points ·
  ded · total, points beside the round (Erez, 2026-11-19: keep mirrored).
  v1's card had the same order on both sides.
- **Blind scoring**: an option that hides every total until the end.
- **Record and rank wording**: the scorecard marquees say "16 KO" and
  "No. 2"; the fighter card uses the app's own "23-1-0 (16 KOs)" and
  "TBRB #2". One has to give.
- **Events list rows** show the main event and how many bouts are scored or
  not final. `/api/events` returns the date and the venue, but not the main
  event or the counts. The city / venue split is settled: an event's place
  is a venue with a city, region and country (D117, task venues).
- **Fighters Find box**: filter by any part of a name. New behaviour.
- **Fighter card**: "won 2 May 2026 · 1 defence" under titles held would
  have to be worked out from fights watched; colours drawn as swatches need
  colours stored in a form a page can read (today it is free text).
- **Dialogs**: button rows in place of dropdowns for deduction reason,
  decision code, corner, rounds and title holder.

Fighters, events and records in the artboards are invented placeholders.
