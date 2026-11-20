# The header to the design, and the End bout dialog's labels

## Context

Erez, 2026-11-20, after the dialog restyle: "Two things, one, the end
dialog "broke", see attached. second, the top bar is not as designed, and
it's causing the scoring screen to be overflowing the screen."

The screenshot shows the End bout dialog with "Time" and its "(m:ss)" on
two lines, so the Time box sits lower than the Round box beside it: a
label is a column (the input under its words), and the hint was a second
item in that column. The header was 72 px of logo and padding (D100), and
the scorecard had its own bar of crumb and buttons under it (D78). The
design (`docs/reference/design/Main.dc.html`, `Events.dc.html`) has one
row 64 px high: the grid mark and "BOXING CLEVER" set in type, and on the
scorecard the crumb and the buttons in that same row.

**Promise.** The header is the design's one slim row, the scorecard loses
its second bar to it, and the End bout dialog's boxes line up.

**Acceptance.**
- [x] The header is one row at least 64 px high: the grid mark at 26 px and "Boxing Clever" in the display face's capitals, then Events and Fighters as before; the link is named "Boxing Clever"
- [x] On the scorecard, the crumb ("Events / place · date") and the buttons and save line are in the header's row in place of Events and Fighters, and the page has no bar of its own; leaving the page clears them and the sections come back
- [x] The bar's buttons, their order, words and handlers are unchanged in the diff
- [x] In the End bout dialog, "Round (if stopped)" and "Time (m:ss)" are each one line of small capitals, so the two boxes line up; the fighter form's "Weight (st lb oz)" likewise
- [x] `deno task test` and `deno task check` run green by Claude; the header's test is rewritten to the new decision; seeing it on the page is Erez's

## Decisions

### 2026-11-20 · The header is the design's: the grid mark and the name in type, 64 px high

**Decision** — The header's brand link holds `front/mark.png` (the grid mark, 56 px square for a 26 px box, cut tight around the grid from `docs/reference/brand/mark.png` with `sips`, as the favicon is) with an empty `alt`, then the words "Boxing Clever", set in the display face at 22 px, weight 800, in capitals; the link is named by the words. The header is one row at least 4rem high, wrapping on a narrow window. `front/logo.png` is removed; `docs/reference/brand/logo.png` stays.
**Rejected** — Erez's stacked logo at 72 px (D100). The same logo shrunk to fit 64 px, whose words blur. Keeping `front/logo.png` unused.
**Why** — Erez, 2026-11-20: "the top bar is not as designed, and it's causing the scoring screen to be overflowing the screen". The stacked logo made the header 91 px and the design's row is 64 px. The mark beside the name in type is the design's own header, made with Erez's mark, and it reads at that size.
Supersedes: D100

### 2026-11-20 · The scorecard's bar goes into the header's row

**Decision** — `front/index.html`'s header has an empty `#page-bar` after the sections. The bout page renders its bar (`bar()` in `front/bout-page.ts`) into it from its `render()` while it is mounted, and clears it in `unmount()`. A header holding a `.bp-bar` hides its own sections, and the crumb starts with "Events /" so that link stays. The rest of D78 stands: the crumb, then "Save progress", "End bout" and the save line, or "Final", "Change decision" and "Reopen scoring", in that order, and the hidden `h1`. The bar's rules are scoped to `.bp-bar` rather than `.bout-page`.
**Rejected** — The bar under the header, as D78 had it. A bar slot on every page through `Component` (the dialogs are components too, and would clear it). Moving the header into each page. The design's "/ Bout 9" at the crumb's end, and its save line before the buttons (new wording, and an order the scorecard's review kept).
**Why** — The design puts the crumb and the buttons in the header's row; two bars took about 90 px from the card while scoring. Rendering into the header from the page keeps the header in `index.html` for every other page and the bar's handlers in the bout page.
Supersedes: D78

### 2026-11-20 · A label's hint is on the label's line

**Decision** — Where a dialog label carries a hint ("Round (if stopped)", "Time (m:ss)", "Weight (st lb oz)"), its words and the hint are wrapped in one `<span class="label">`, drawn in the dialogs' small capitals with the hint in plain text, so the label is one line over its box.
**Rejected** — Aligning the dialog grid's items to their foot, which moves every other dialog's rows (the fighter search's matches, D44). Removing the hints.
**Why** — A label is a column, its words over its box; the hint was a second item in the column, on its own line, so Time's box sat lower than Round's. In the design the hint is in the label's line.

## Review · 2026-11-20

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found these as the record says:
- the bar's buttons, words, order and handlers unchanged;
- nothing rendering the bar after the page is left;
- every bar rule moved to `.bp-bar`;
- `header.top > nav` and the `:has` rule reaching only the sections;
- the label rule winning over the reset, with the hint staying plain;
- the test diff rewriting only the D100 test.

It found one thing.

### The section marking also reaches the scorecard's crumb

**Found** — `front/app.ts`, `markNavigation()` selected `header nav a`, which now also matches the crumb's `nav` in `#page-bar`, whose "Events" link is `/`. Only the router's order (marking before the bar renders) kept `aria-current` off it.

**Done when**

- [x] On `/bouts/:id` once the bar has rendered → no link in `.bp-bar .crumb` has `aria-current`
- [x] From one bout to another, or back to one → no crumb link has `aria-current`
- [x] On `/`, `/events/:id` and `/bouts/:id` the header's Events has `aria-current`, on `/fighters` and `/fighters/:id` Fighters does → unchanged
- [x] After leaving the scorecard → the sections show and are marked as before

**Not asked** — The crumb's words, the router's order, the bar's look or place.

Answered in this change: `markNavigation` selects `header.top > nav a`,
the header's own sections only, whatever the order of marking and
rendering. Shown by the selector, not seen in a browser.

## What was done

2026-11-20. The header to the design, the scorecard's bar in it, and the
End bout dialog's labels on one line.

- **Header** (`front/index.html`): the brand link holds `mark.png` and
  "Boxing Clever"; an empty `#page-bar` follows the sections.
  `front/mark.png` is new (56 px, cut as the favicon is, with `sips`);
  `front/logo.png` is removed.
- **Scorecard** (`front/bout-page.ts`): the bar's markup moves out of
  `view()` into `bar()`, unchanged but for the crumb, which becomes a
  `nav` starting "Events /". `render()` renders it into `#page-bar` while
  the page is mounted (`#shown`, set in `mount()`), and `unmount()` clears
  it.
- **Section marking** (`front/app.ts`): `markNavigation` selects
  `header.top > nav a`, so the crumb is never marked (from the review).
- **Labels** (`front/decision-form.ts`, `front/fighter-form.ts`): Round,
  Time and Weight wrap their words and hint in `<span class="label">`.
- **Styles** (`front/style.css`):
  - The header is a wrapping row, `min-height: 4rem`, with the mark at
    1.625rem and the name in `--ds-display` 800 capitals. The section
    rules are scoped to `header.top > nav`. `#page-bar` is `display:
    contents`, and the sections hide when it holds a `.bp-bar`.
  - The bar's rules are `.bp-bar` rather than `.bout-page`; it takes the
    rest of the row with no rule or padding of its own, and the crumb's
    links are muted.
  - `dialog.form label > .label` joins the small-capitals rule.
- **Docs**: SPEC's `front/` line names the mark and the slot, and its
  scorecard line puts the bar in the header's row. `deno task record`
  compiled this file's decisions into `docs/DECISIONS.md` as D106–D108
  (D106 supersedes D100, D107 supersedes D78) and added the task to
  `docs/PLAN.md`.

Tests: `tests/front/shell.test.ts`'s header test is rewritten to this
file's first decision, which supersedes the one it stated (D100): the
brand link holds `mark.png` with an empty `alt` and the words, the
sections are there, `#page-bar` is there, and the chamber serves
`mark.png` as an image. The rest of `git diff tests` is unchanged.

Verified 2026-11-20 by Claude:
- `deno task test` (218 passed), `deno task check`, `deno fmt --check` and
  `deno lint front` all run.
- Not seen in a browser. The header's height, the scorecard fitting the
  screen and the dialog's boxes lining up are Erez's to check.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); its one finding is answered above
