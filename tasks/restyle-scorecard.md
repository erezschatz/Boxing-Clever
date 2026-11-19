# The scorecard, restyled

## Context

Erez, 2026-11-19: "restyle the scorecard page to the design". This is the
scorecard part of the third acceptance box of
[09 · Design pass](09-design-pass.md). It is built to
`docs/reference/design/Main.dc.html`, `Finished.dc.html` and
`Marquees.dc.html`, with the columns mirrored as Erez chose on the canvas.
It is a task file of its own, as the fighter card is (D68), so 09 stays open
for the events and fighters pages and for Erez's check in the browser.

**Promise.** The scorecard is the largest, calmest thing in the app: big
boxes to type into, the two fighters' marquees above them, and nothing that
gets in the way while I watch.

**Acceptance.**
- [x] `/bouts/:id` shows each side's marquee above the card, with the corner, name, nickname, champion and belts brought in, a missed weight, and the record, TBRB rank, weight and colours on the night
- [x] The card is mirrored: total · ded · points | round | points · ded · total, with each side's corner colour over its columns and the round being scored marked
- [x] What typing, focus moving across and down, deductions, saving, End bout, Change decision and Reopen scoring hang on is unchanged in the diff (handlers, the boxes' `data-round`/`data-side`/`aria-label`, `focusNext`, the button words), read by Claude and the cold reader; seeing them work in the browser is 09's last box, Erez's
- [x] A finalised card shows the result, the three judges' cards and mine
- [x] The tier tests under `tests/` that were there before pass unchanged; `deno task test` and `deno task check` run green by Claude

## Decisions

### 2026-11-19 · The scorecard's columns are mirrored around the round

**Decision** — Side A reads total · ded · points, the round number sits in the middle, and side B reads points · ded · total. The two points boxes of a round sit side by side. Focus still moves across, then down, by `nextBox` (D39), which looks boxes up by round and side, not by position.
**Rejected** — v1's order, points · ded · total on both sides, with the round number first.
**Why** — Erez, 2026-11-19, on the design canvas: "Keep it mirrored". A round's 10 and 9 read next to each other. One thing does move: Tab from side A's points box now reaches side B's points box first, because A's deduction button comes before its points box.

### 2026-11-19 · The fighters' headers become marquees above the card

**Decision** — Each side's header leaves the table and becomes a marquee above it. The corner, with a "Champion" chip when the side brought a belt in, comes first. Then the name and nickname, the belts by name, and a missed weight noted quietly (D47). Then the record (`recordText`'s "22-1-0 (16 KOs)") and TBRB rank (`rankText`) on the night, and the weight and colours from the snapshot. The corner colour stays on each side's column header, as a bar over its three columns.
**Rejected** — The design's "16 KO" and "No. 2". Keeping the header inside the table.
**Why** — The app says a record and a rank one way everywhere (`format.ts`), and the fighter card already does. The weight and colours are in the snapshot, and Erez describes the marquees as where the fighters' stats at the start of the fight sit. The record, rank, weight and colours appear only once the first save has taken the snapshot, as before.

### 2026-11-19 · The page's actions move to a bar at the top

**Decision** — The crumb back to the event, then "Save progress", "End bout" and the save line (or "Change decision" and "Reopen scoring" once final) sit in one bar above the marquees. The buttons, their words and their order, and so the Tab order, are unchanged. A finalised card adds a "Final" label before its buttons. The page's `h1`, both names, becomes visually hidden, because the marquees show the names large; screen readers still get it.
**Rejected** — Leaving them under the card.
**Why** — With twelve 64px rows the card is taller than the window. A button under it would be off-screen while scoring.

### 2026-11-19 · A deduction says why, in words as well as colour

**Decision** — A deduction box shows `−N`, then "KD" in blue when any of that spot's deductions is a knockdown, and "FOUL" in red when any is another reason. The "?" of a reason assumed on import stays. `deductionKinds` in `front/scorecard.ts` says which.
**Rejected** — Colour alone. The reason's full name.
**Why** — It matches the Numbers sheet (D63) and the design, and the words carry it without the colour. The full reason is in the dialog the box opens.

### 2026-11-19 · A finalised card shows the judges

**Decision** — Once final, a black band under the marquees gives the result (`resultText`, with `resultLabel` as its tooltip), each judge's card that was typed, and my card from the running totals when a round was scored.
**Rejected** — The result in the subtitle only, as before.
**Why** — The judges' cards are kept with the result (D41), and the page never showed them. Seeing mine beside theirs is the point of the finished card.

### 2026-11-19 · The design's look is shared, scoped by page

**Decision** — The design's colours move from `.fighter-card` into one set of custom properties (`--ds-*`), given to `.fighter-card` and `.bout-page`. Each restyled page adds its class to that rule. The scorecard's old rules in `front/style.css` give way to rules scoped to `.bout-page`. `main` widens to 80rem only when it holds a `.bout-page`. There is still no webfont (D72).
**Rejected** — Changing `:root` and `main` for every page now. A second copy of the colours.
**Why** — The events and fighters pages are not restyled yet and must not change. One set of properties keeps the restyled pages in step.

### 2026-11-19 · Not in this restyle: blind scoring

**Decision** — The design's option to hide every total until the end is not built.
**Rejected** — Building it with the restyle.
**Why** — It is new behaviour, and the restyle is to change none. It stays an open choice in `docs/reference/design/README.md`.

## Review · 2026-11-19

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It checked the following against HEAD and found
them as before:
- every handler on the inputs, the deduction buttons and the bar;
- the leaving saves;
- the input attributes and `focusNext`;
- the `scoring`/`next` marks and the status text.

It also found:
- no other page or dialog using a removed class;
- every CSS property defined;
- the `.fc-` rules the same apart from the rename;
- the test diff only adding lines.

It found one thing.

### The finalised bar swaps the order of its two buttons, and no decision records it

**Found** — `front/bout-page.ts`, `view()`'s bar: a finalised card put "Reopen scoring" before "Change decision", the reverse of HEAD, so Tab reached Reopen first; on a draft card the status line moved before the buttons. The bar's decision said the buttons were unchanged, and the hidden `h1` had no decision.

**Done when**

- [x] A finalised card: the bar's buttons are in the order a `## Decisions` entry gives (the design's Reopen · Change decision, or HEAD's Change decision · Reopen), and Tab follows that order → recorded or restored
- [x] A draft card: "Save progress" then "End bout", in that Tab order, with the status line next to them → unchanged
- [x] The button words "Save progress"/"Saving…", "End bout", "Change decision", "Reopen scoring", and the `status()` text → unchanged

**Not asked** — No new handler, no change to `decide`/`reopen`/`save`, and no restyle of the other pages.

Answered in this change by restoring HEAD's order: "Change decision" then "Reopen scoring", and "Save progress", "End bout", then the status line. The bar's decision now says the order is kept, and it names the "Final" label and the hidden `h1`.

## What was done

2026-11-19. The scorecard at `/bouts/:id`, restyled to
`docs/reference/design/Main.dc.html`, `Finished.dc.html` and
`Marquees.dc.html`.

- **Page** (`front/bout-page.ts`): `view()` now renders:
  - a top bar, with the crumb, then the buttons in the same words and
    order: "Save progress", "End bout" and the save line, or a "Final"
    label, "Change decision" and "Reopen scoring";
  - a hidden `h1` with both names, for the screen reader;
  - the class and rounds;
  - the two marquees with "vs" between them;
  - the result band once final;
  - the card in a scrolling box.

  The table is mirrored. `sideCells` returns a side's total, deduction and
  points cells, reversed for side B, and the round number moves into a
  middle column. The header row has the same mirrored heads, with each
  side's corner as a coloured bar over its three. The footer has the big
  totals at the outer edges.

  Every handler, every input's `data-round`/`data-side`/`aria-label`, the
  `scoring` and `next` row marks, and `focusNext` (which finds boxes by
  data attribute within the table) are unchanged. A deduction box adds
  "KD" and "FOUL" spans after `−N`. The file is 501 lines; it was 474
  before, already over the ~400 guideline, and the result band went to
  `side-head.ts` rather than add to it.
- **Marquee and result band** (`front/side-head.ts`): `sideHead` builds the
  marquee: the corner square and name, a "Champion" chip when a belt was
  brought in, the first and last name, the nickname, the belts, the missed
  weight note, and the record, TBRB rank, weight and colours from the
  snapshot. `resultBand` builds the black band: `resultText` with
  `resultLabel` as its title, each judge whose card was typed, and "My
  card" when any round has points.
- **Helpers**:
  - `deductionKinds` in `front/scorecard.ts`;
  - `weightOnTheNight` in `front/format.ts`: lbs and kg to two decimals,
    stone as "8 st 10 lb", with the ounces when there are any.
- **Styles** (`front/style.css`):
  - The scorecard's old rules are gone: `.crumb`, `table.scorecard`, the
    side head, `input.points`, `button.deduction` and `.actions`. The
    global `.assumed` colour stays, for the deduction dialog.
  - The fighter card's colours became one shared set, `--ds-*`, on
    `.fighter-card, .bout-page`; the card's own rules read the renamed
    properties.
  - New rules are scoped to `.bout-page`, and `main` widens to 80rem only
    around one.
  - The other pages' rules are untouched.
- **Docs**: SPEC's scorecard paragraph describes the mirrored card, the
  marquees, the top bar, the deduction marks and the result band.

Tests: `tests/front/scorecard.test.ts` adds `deductionKinds`, and
`tests/front/shell.test.ts` adds `weightOnTheNight`. `git diff tests` has no
removed or changed line, so the tier tests that were there before are as
they were.

Verified 2026-11-19 by Claude:
- `deno task test` (210 passed), `deno task check`, `deno fmt --check` and
  `deno lint` (only the two earlier errors in
  `.claude/hooks/check-unit.test.mjs`) all run.
- Not seen in a browser. That typing, focus, saving and End bout behave as
  before is shown by the code path, not by a run; Erez checks it in the
  browser with 09's last box.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-19); its one finding is answered above
