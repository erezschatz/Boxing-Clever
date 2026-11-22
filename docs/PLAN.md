# Plan

Phase 1, in order. One file per step in `tasks/`; each states the promise
from the user's point of view and the acceptance criteria that make it done.
Steps are done strictly in order unless a decision in `DECISIONS.md` says
otherwise. Everything below the marker line is compiled from `tasks/` by
`deno task record`: the steps (00–15 are phase 1; the unnumbered task files
follow in alphabetical order), their status, the milestones and what is not
in scope, the last two from `Milestone:` and `Not in scope:` lines in
decisions. Nothing in this file is edited by hand.

Status is derived: a task file without a `## What was done` section is open;
with one, done; listed in a compiled `CHANGELOG.md` release, shipped. A step
is done when every acceptance box is ticked, *What was done* is written, and
Erez has run it where it runs (browser, Atrium) — not just `deno test`.

Each step is sized so it ends with something runnable the same day. No
calendar estimates: this project moves in spare moments, and the form is
what keeps it from dropping out between them.

Out-of-order work that a decision placed in the sequence, as it stood on
2026-11-14 (later placements are stated in the decision that makes them):

- [Guarded bout delete](../tasks/guarded-bout-delete.md) (D23) — its API with 04, its dialogs with 08.
- [Merge asks before records move](../tasks/merge-asks-before-records-move.md) (D31) — its API with 04, its dialog with 08.
- [Contracted weight and missed weight](../tasks/contracted-weight-and-missed-weight.md) (D26) — before 10.
- [The class dropdown shows each limit](../tasks/class-limits-in-dropdown.md) (D46) — with the contracted weight.
- [A missed weight is noted quietly](../tasks/quiet-missed-weight.md) (D47) — after the contracted weight.
- [A belt is regular or interim](../tasks/title-kinds.md) (D42) — done with 08's follow-ups, before 10.
- [Open questions, 2026-11-03](../tasks/questions-2026-11-03.md) — the TD/T and 9/9 import answers before 10–11; the rest before the step each names.
- [Which TBRB list counts](../tasks/tbrb-rank-across-classes.md) — before 12.
- [The sheet's colours](../tasks/sheet-deduction-colours.md) — before 11.

<!-- Compiled from tasks/ by scripts/compile-record.mjs. Do not edit below this line by hand. -->

## Steps

- [00-skeleton](../tasks/00-skeleton.md) — 00 · Skeleton and documentation · done
- [01-toolchain-green](../tasks/01-toolchain-green.md) — 01 · Toolchain green · done
- [02-schema-and-db](../tasks/02-schema-and-db.md) — 02 · Schema, migrations, database modules · done
- [03-rules](../tasks/03-rules.md) — 03 · The rules · done
- [04-api-reference-data](../tasks/04-api-reference-data.md) — 04 · API: reference data · done
- [05-api-scorecard](../tasks/05-api-scorecard.md) — 05 · API: the scorecard · done
- [06-front-shell](../tasks/06-front-shell.md) — 06 · Front: shell and read-only pages · done
- [07-front-scorecard](../tasks/07-front-scorecard.md) — 07 · Front: the scorecard page · done
- [08-front-forms](../tasks/08-front-forms.md) — 08 · Front: forms · done
- [09-design-pass](../tasks/09-design-pass.md) — 09 · Design pass · done
- [10-import-v1](../tasks/10-import-v1.md) — 10 · Import: v1 databases
- [11-import-sheet](../tasks/11-import-sheet.md) — 11 · Import: the Numbers sheet
- [12-tbrb-current](../tasks/12-tbrb-current.md) — 12 · TBRB: current rankings
- [13-tbrb-history](../tasks/13-tbrb-history.md) — 13 · TBRB: history tool
- [14-deploy](../tasks/14-deploy.md) — 14 · Deploy
- [15-live-use](../tasks/15-live-use.md) — 15 · Live use and fixes
- [answers-2026-11-03](../tasks/answers-2026-11-03.md) — Answers to the open questions, 2026-11-03 · done
- [arrow-keys](../tasks/arrow-keys.md) — Up and Down step the number boxes · done
- [brand-icons](../tasks/brand-icons.md) — The grid mark as the app's icon · done
- [class-limits-in-dropdown](../tasks/class-limits-in-dropdown.md) — The class dropdown shows each limit · done
- [contracted-weight-and-missed-weight](../tasks/contracted-weight-and-missed-weight.md) — Contracted weight and missed weight · done
- [delete-finalised-bout](../tasks/delete-finalised-bout.md) — Deleting a finalised bout · done
- [fighter-card](../tasks/fighter-card.md) — The fighter card · done
- [guarded-bout-delete](../tasks/guarded-bout-delete.md) — Guarded bout delete · done
- [header-logo](../tasks/header-logo.md) — The logo in the header · done
- [header-to-design](../tasks/header-to-design.md) — The header to the design, and the End bout dialog's labels · done
- [kd-in-round-under-way](../tasks/kd-in-round-under-way.md) — A knockdown logged before its round is scored is kept · done
- [kept-result-is-stored](../tasks/kept-result-is-stored.md) — A kept result is stored, so a recompute keeps it · done
- [marquee-before-save](../tasks/marquee-before-save.md) — The scorecard's marquees before the first save, the titles at stake, and VS at the top · done
- [merge-asks-before-records-move](../tasks/merge-asks-before-records-move.md) — Merge asks before records move · done
- [questions-2026-11-03](../tasks/questions-2026-11-03.md) — Open questions, 2026-11-03 · done
- [quiet-missed-weight](../tasks/quiet-missed-weight.md) — A missed weight is noted quietly · done
- [restyle-dialogs](../tasks/restyle-dialogs.md) — The dialogs, restyled · done
- [restyle-event-card](../tasks/restyle-event-card.md) — The event card, restyled · done
- [restyle-events](../tasks/restyle-events.md) — The events page, restyled · done
- [restyle-fighters](../tasks/restyle-fighters.md) — The fighters page, restyled · done
- [restyle-scorecard](../tasks/restyle-scorecard.md) — The scorecard, restyled · done
- [retirement-is-a-tko](../tasks/retirement-is-a-tko.md) — A retirement is a TKO at 3:00, with its round scored · done
- [sheet-deduction-colours](../tasks/sheet-deduction-colours.md) — The sheet's colours: knockdown or foul · done
- [short-save-line](../tasks/short-save-line.md) — The scorecard's save line, short · done
- [sticky-header](../tasks/sticky-header.md) — The header stays at the top · done
- [stoppage-round](../tasks/stoppage-round.md) — A stoppage is offered the round after the last one scored · done
- [tbrb-rank-across-classes](../tasks/tbrb-rank-across-classes.md) — Which TBRB list counts for a bout
- [title-kinds](../tasks/title-kinds.md) — A belt is regular or interim · done
- [venues](../tasks/venues.md) — Venues: an event's place as a record of its own

## Milestones

- After 05: the data model is proven. A bout can be created, scored, stopped in round 2 with a knockdown, finalised, and both fighters' records move once and atomically — all over HTTP against a real database, with the snapshot intact. Nothing after this is worth building if this fails. (D49)
- After 08: the app can replace v1 for a fight night, standalone on the laptop. The design is still the programmer's own. (D49)
- After 11: the database holds every fight watched since Nov 2021. (D49)
- After 14: the chamber on Atrium is the one in use, with all the data in it. (D49)
- After 15: phase 1 complete; the project goes quiet. (D49)

## Not in scope

- What happens to v1 is not a step or a milestone here. Whether it keeps running, stops, or goes with its data kept is Erez's call, outside this plan, and nothing in it waits on that (D40). (D49)
- Mobile layout (D9). (D49)
- Public access (D2). (D49)
- Charts and trajectories. (D49)
- Service worker (D10). (D49)
- Playwright (D11). (D49)
- Automated TBRB history from archive.org. (D49)
- Other ranking bodies. (D49)
- Phase 2 is not planned here. (D49)
