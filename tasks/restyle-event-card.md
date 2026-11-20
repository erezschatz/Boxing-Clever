# The event card, restyled

## Context

Erez, 2026-11-20: "Event card next", after the events page. This is the
event card `/events/:id` restyled to `docs/reference/design/Event.dc.html`,
part of the third acceptance box of [09 · Design pass](09-design-pass.md)
alongside the scorecard and the events page. It is a task file of its own,
as they are (D68), so 09 stays open for the fighters page and for Erez's
check in the browser. In the same change, the events page loses the phone
layout restyle-events gave it, which D9 rules out (Erez was told
2026-11-20, and chose the event card next).

**Promise.** An event's card reads like a fight card: the place large, the
bouts in order with the two fighters facing each other, who won, and one
click to each scorecard.

**Acceptance.**
- [x] `/events/:id` shows the date and "Edit event", the location large, how many bouts there are, how many are still to score and how many are not final, and "Add bout" as the dark button
- [x] Each bout is one row: the order, side A with its corner square and record on the night, "VS", side B mirrored, the weight and rounds with the belts and who brought each, the result, and Edit and Delete
- [x] A missed weight is noted beside the record of the side that missed it; once there is a winner, the other side's name goes grey
- [x] What the page does is unchanged in the diff (the loads, the whole row opening the scorecard, the result link, and edit event, add bout, edit bout and delete bout opening their dialogs and reading again), read by Claude and the cold reader; seeing it in the browser is 09's last box, Erez's
- [x] The events page has no phone layout
- [x] The tier tests under `tests/` that were there before pass unchanged; `deno task test` and `deno task check` run green by Claude

## Decisions

### 2026-11-20 · The event card's rows set names without the nickname

**Decision** — A bout row shows each fighter's first and last name (`plainName`), set large in capitals, and the result and the belts' holders use the same names. The delete dialog's names keep `fighterName`, with the nickname.
**Rejected** — `fighterName` on the row, as before. The design's last name alone in the result.
**Why** — At the design's size, a nickname doubles the name's length and crowds the facing side. A last name alone is ambiguous on a card with brothers on it. The nickname is on the scorecard's marquee and the fighter card.

### 2026-11-20 · "Not final" goes under the result, and the counts come from the bouts

**Decision** — A row's result link says who won and how (`outcomeText`, which `resultText` now builds on), with "not final" on a line under it when the result is not final. A bout with no result shows "Score" as an outlined link, with no note. The head counts the bouts, those with no result ("to score") and those with a result not final (`cardCounts`), from the bouts the page already loads. A count of none is left out.
**Rejected** — "· not final" inside the link, as before. The design's "not scored yet" under "Score", which would be wrong for a bout scored in part.
**Why** — It is the design's row, and every figure is in the bouts the page has. `resultText` says the same as before, so the scorecard's band is unchanged.

### 2026-11-20 · The card stays a table, mirrored, with words in title case

**Decision** — The card is still a `table` (now `ec-card`), its columns the order, side A, "VS", side B (mirrored, its square after the name), weight · rounds · titles, the result, and Edit and Delete. The corner square has `role="img"` and says its corner, or "corner not recorded". The buttons read "Edit event", "Edit" and "Delete", as the design has them. The whole-row click, the result link and the four dialogs are as before.
**Rejected** — The design's rows of `div`s. Keeping "edit" and "delete" in lower case.
**Why** — A table keeps the columns and their headers for the screen reader. The words change case only; what each button opens is the same.

### 2026-11-20 · The events page loses its phone layout

**Decision** — The `max-width: 40rem` block restyle-events added to the events page is removed, and no restyled page has one.
**Rejected** — Keeping it.
**Why** — D9: laptop first, no mobile layout in phase 1. It went in with a line in that task's record but no decision, and Erez was told on 2026-11-20.

### 2026-11-20 · The styles the event card no longer uses go

**Decision** — With the card restyled, `.subtitle`, `table.card`'s rows, `.side`, `.corner` and the `table.list` `td.date`/`td.order` widths are removed from `front/style.css`; nothing renders them now. `.event-page` joins the shared `--ds-*` rule, `.muted`, `.visually-hidden` and the 80rem `main`; its own rules are `ec-`. `.record` and `.missed` stay for the forms and the scorecard, and the card's rows restyle them within `.event-page`.
**Rejected** — Leaving unused rules in the stylesheet.
**Why** — The stylesheet should hold what the pages render. Restyle-events had kept `td.date` for the pages still on it; none was.

## What was done

2026-11-20. The event card at `/events/:id`, restyled to
`docs/reference/design/Event.dc.html`; and the events page's phone layout
removed (D9).

- **Page** (`front/event-page.ts`): `view()` wraps the page in
  `.event-page` and renders:
  - a head with the date and "Edit event", the location as the large `h1`,
    the counts from `cardCounts`, and "Add bout" as the dark button;
  - the card as a table with seven columns: the order, side A, "VS"
    (hidden from the screen reader), side B mirrored, the weight ·
    rounds · titles, the result, and Edit and Delete;
  - "A row opens its scorecard." under it.

  The new `side()` gives a side its corner square (`role="img"`, saying the
  corner), its name large and greyed when the other side won, and its
  record on the night with the missed-weight note. The result is
  `outcomeText` as a link, with "not final" under it, or "Score" as an
  outlined link. `load()`, `editEvent()`, `editBout()`, `deleteBout()`, the
  whole-row `open` handler and the delete dialog's names (`fighterName`) are
  unchanged.
- **Helpers** (`front/format.ts`):
  - `outcomeText` gives who won and how; `resultText` now returns it with
    "· not final" added, saying the same as before;
  - `cardCounts` counts bouts, those with no result and those with a
    result not final;
  - `plainName` gives first and last name.
- **Styles** (`front/style.css`):
  - `.event-page` joins the shared `--ds-*` rule, `.muted`,
    `.visually-hidden` and the 80rem `main`.
  - Its own rules, `ec-`, are appended.
  - The events page's phone-width block is gone.
  - The rules nothing renders any more are gone: `.subtitle`, the
    `table.card` rows, `.side`, `.corner`, and `table.list`'s `td.date`
    and `td.order`.
- **Docs**: SPEC's `/events/:id` line describes the restyled card; `deno
  task record` compiled this file's decisions into `docs/DECISIONS.md` as D88–D92
  and added the task to `docs/PLAN.md`.

Tests: `tests/front/shell.test.ts` adds `outcomeText`, `plainName` and
`cardCounts`. `git diff tests` adds lines only; the `resultText` test
passes unchanged.

Verified 2026-11-20 by Claude:
- `deno task test` (214 passed), `deno task check` and `deno fmt --check`
  all run.
- Not seen in a browser. That the row click and the dialogs behave as
  before is shown by the code path, not by a run; Erez checks it in the
  browser with 09's last box.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); no findings
