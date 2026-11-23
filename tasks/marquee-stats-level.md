# The two sides' figures on one line

## Context

Erez, 2026-11-23, with a screenshot of the scorecard for Deontay Wilder v
Derek Chisora after the imports: "can you make both record/weight/colours be
on the same line, unlike in this". Wilder's name takes two lines at that
width and Chisora's one, so Chisora's nickname and his record, weight and
colours sat a line higher than Wilder's.

**Promise.** The record, weight and colours of the two fighters read across
the scorecard on one line.

**Acceptance.**
- [x] Each side's figures sit at the foot of its marquee, and the two marquees are one height, so a name on two lines or a nickname on one side only does not lift the other side's figures
- [x] Nothing else in the marquee moves: the corner line, the names' first line and VS stay level as before
- [x] A test holds the rule; `deno task test` and `deno task check` run green by Claude
- [ ] Erez: in the browser, on a bout where one name wraps and the other does not, the two sides' record, weight and colours are on one line

## Decisions

### 2026-11-23 · The figures are level at the foot of the marquees; what is between them and the name is not

**Decision** — Each side's record, TBRB rank, weight and colours are pushed to the foot of its marquee (`margin-top: auto` on `.bp-stats`; the two marquees already stretch to one height). The nickname, the belts and a missed-weight note stay directly under their own name, so with one name on two lines they are not level with the other side's.
**Rejected** — Laying both marquees on one grid with a row for each kind of line, which would level the nicknames and belts too: it moves a one-line name's nickname away from the name, and Erez asked for the figures. Keeping the name on one line by shrinking it: the name's size is the design's.
**Why** — It is the smallest change that does what was asked, and it leaves the marquee as designed in every case where both names take the same number of lines. When one side's figures wrap to two lines and the other's do not, their last lines are level, not their first.

## What was done

2026-11-23. `front/style.css`: `.bp-stats` takes `margin: auto 0 0` (its quarter-rem of space above kept as padding), with the reason beside it. No markup changed. `docs/SPEC.md` says the figures are on one line. `tests/front/shell.test.ts` holds the three rules the alignment rests on, as the sticky header's test does for its own. `deno task test`: 278 passed; `deno task check`, lint and format clean. Not seen in a browser by Claude; the last box is Erez's.

Reviewed by: a read-only Claude subagent (Explore), cold, on the staged diff, carrying out docs/reviewer.md. No findings. It traced the layout (the two marquees stretch to one height, the figures are each column's last child and take the free space above them, VS is placed by a fixed padding and does not move) and noted that the test holds the rules' text, not the layout, which is why the last box is Erez's.
