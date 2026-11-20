# The header stays at the top

## Context

Erez, 2026-11-20, looking at the scorecard after
[header-to-design](header-to-design.md): "Better, but the top should at
least be sticky". The scorecard's crumb, "Save progress" and "End bout"
are in the header's row (D107), and an eight-round card is taller than his
laptop's window, so scrolling down to score took them off the screen.

**Promise.** Scoring the last rounds, the save and End bout are still in
reach without scrolling back up.

**Acceptance.**
- [x] The header stays at the top of the window as the page scrolls, on every page, white so nothing shows through it, and an open dialog is drawn over it
- [x] Moving focus to a score box, or scrolling to one, stops it below the header, not under it
- [x] A test shows the stylesheet makes the header sticky and pads the scroll; `deno task test` and `deno task check` run green by Claude; seeing it scroll is Erez's

## Decisions

### 2026-11-20 · The header is sticky on every page, and scrolling stops below it

**Decision** — `header.top` is `position: sticky` at the top of the window, white, with `z-index: 10` over the page; dialogs are in the browser's top layer and stay over it. `html` has `scroll-padding-top: 5rem`, so the focus moving down the card (D39) or a link to a part of a page stops below the header's 4rem.
**Rejected** — Sticky only on the scorecard. A fixed header with the page padded to clear it. Sticking only the scorecard's bar.
**Why** — Erez asked for it with the scorecard in front of him. Every page has the same header, and one that stays on some pages and scrolls away on others would be a difference to remember for nothing; at 64 px (D106) it costs little. Sticky keeps the header in the page's flow, so nothing has to be padded to clear it. Without the scroll padding, a box the focus goes back up to (Shift+Tab) or a link scrolls to would stop under the header. The padding is for the header's one row; a header wrapped to two rows is a narrow window, which the app does not lay out for (D9), so the padding is not made to measure it.

## Review · 2026-11-20

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found these as the record says:
- nothing in the stylesheet stops the header sticking (no overflow or
  height on an ancestor);
- nothing drawn over it but the dialogs, which open with `showModal()` in
  the top layer;
- D109 matching the task file;
- the test diff adding lines only.

It noted that the focus moving down the card puts the next box at the
window's foot, so the padding matters going back up; the decision's Why now
says so. It found one thing.

### The 5rem scroll padding is too small once the header wraps

**Found** — `front/style.css`: the header wraps (`flex-wrap`, `min-height: 4rem`), and on a window too narrow for the brand, crumb and buttons in one row it is 8rem or more, while `scroll-padding-top` stays 5rem, so a box scrolled to can stop under it.

**Done when**

- [x] Scorecard on a window wide enough for one header row, focus moved up to a score box → it stops below the header's rule
- [x] Scorecard on a window narrow enough to wrap the header → it stops below the header, or a decision excepts it
- [x] The other pages at both widths → the header stays at the top
- [x] An open dialog at either width → drawn over the header
- [x] Moving down the card with Enter (D39) → focus order unchanged

**Not asked** — A fixed header, padding on `main`, a script measuring the header.

Answered in this change by the decision's Why: the wrapped header is a
narrow window, which D9 leaves without a layout, and the padding is for
the one row. At a laptop's width the scorecard's header is one row once
its save line is short ([short-save-line](short-save-line.md), the next
change). Not seen in a browser.

## What was done

2026-11-20. The header stays at the top of the window.

- **Styles** (`front/style.css`): `header.top` gains `position: sticky`,
  `top: 0`, `z-index: 10` and a white background. `html` gains
  `scroll-padding-top: 5rem`.
- **Docs**: `deno task record` compiled this file's decision into
  `docs/DECISIONS.md` as D109 and added the task to `docs/PLAN.md`. SPEC's `front/` line says the header is sticky.

Tests: `tests/front/shell.test.ts` adds a test that the header's rule is
sticky at the top with a white background and that `html` pads the scroll.
`git diff tests` adds lines only.

Verified 2026-11-20 by Claude:
- `deno task test` (219 passed) and `deno task check` run.
- Not seen in a browser. That it stays put while scoring, and that the
  focus moving down the card stops below it, are Erez's to check.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); its one finding is answered above
