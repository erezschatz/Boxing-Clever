# Up and Down step the number boxes

## Context

Erez, 2026-11-20: "it seems the boxes are all text and not numerical, I
don't care for the arrows, but I like using the arrow up/down to move the
number in the input".

The number boxes are text boxes with `inputmode="numeric"`, so they have
no spinner, and the arrow keys only move the caret. A number box would
step with the arrows but bring the spinner, and it would break the score
box: its value reads empty while what is typed is not a number,
`maxlength` does not apply, and selecting what is in it is not allowed in
every browser.

**Promise.** Up and Down change the number in a box, with no spinner.

**Acceptance.**
- [x] In a score box, Up and Down step between 10 and 9, an empty box starting at 10 and a lone 1 (a 10 being typed) going up to 10; focus stays in the box; a finalised card's boxes do not change
- [x] In the dialogs, Up and Down step by one: the scheduled rounds (1 to 15, an empty box starting at 12), a deduction's points (1 to 10), the round a bout ended in (1 to the scheduled rounds), the judges' totals (0 to ten a round, an empty box starting at the most), and a fighter's record counts (from 0)
- [x] A box holding something that is not a whole number (a time, a weight) is left as typed, and the weights and the time are not stepped
- [x] A stepped value goes through the box's own handler, as if typed: the totals, the cards' decision (D41) and the dirty check follow it
- [x] With Shift, Alt, Cmd or Ctrl held, or while composing, the arrows keep the browser's meaning
- [x] The boxes stay text, with no spinner
- [x] A test shows the stepping and its limits; `deno task test` and `deno task check` run green by Claude; pressing the keys is Erez's

## Decisions

### 2026-11-20 · Up and Down step the number boxes, which stay text

**Decision** — `stepped` in `front/entry.ts` steps a whole number by one within a minimum and a maximum, an empty box starting at a given value, and leaves anything else alone. `arrowStep` in `front/dialog.ts` makes a keydown handler from it for a dialog's box: it sets the new value and fires the box's `input` event, so the box's own handler takes it as if typed. The score boxes have their own, `step()` in `front/bout-page.ts`, which steps between 9 and 10 (`steppedPoints`, where a lone 1, a 10 being typed (D35), goes up to 10) and sets the points without moving focus, where a typed 9 or 10 moves it on (D39). The limits are the rules': 1 to 15 scheduled rounds (`MAX_ROUNDS`), deductions of 1 to 10, the round within the scheduled ones, ten points a round. An empty scheduled rounds box starts at 12 and an empty judge's box at the most a card can give, so the arrows go down from the usual. The weights and the time are not stepped. Only the bare arrows step (`stepKey`): with a modifier held or while composing they keep the browser's meaning (selecting, moving the caret).
**Rejected** — `type="number"` with its spinner hidden: the score box's typing rules (a lone 1 waiting for 10, D35) read the text as typed, which a number box does not give while it is invalid, and `maxlength` and selecting the box do not apply to it. Stepping a score box through its input handler, which would move focus away on every press. Stepping the weights, whose stone form ("10 7") is not a number.
**Why** — Erez, 2026-11-20: "I don't care for the arrows, but I like using the arrow up/down to move the number in the input". Keeping the boxes as text keeps every rule about typing in them as it is.

## Review · 2026-11-20

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found these as the record says:
- each box's limits matching the rules (`MAX_ROUNDS`, deductions 1–10, the
  round within the scheduled ones, a judge's total within the server's);
- each stepped value going through the box's own handler, the round from
  `roundShown()` and the judges through `judged()` (D41);
- no clash with the fighter search's keys, Enter or Escape;
- `step()` keeping focus and leaving a finalised card;
- the test diff adding lines only;
- D112 matching this file.

It found two things.

### A lone "1" in a score box steps to 9 on Up

**Found** — `front/bout-page.ts`, `step()`: a lone 1 is a 10 being typed (D35), but `stepped` held it to the minimum, so Up gave 9.

**Done when**

- [x] "1", Up → 10
- [x] "1", Down → 9
- [x] "0"–"8", Up or Down → 9
- [x] "10" Down → 9; "9" Up → 10; "10" Up and "9" Down stay; empty → 10
- [x] A finalised card's boxes → unchanged; focus stays in every case

**Not asked** — Typing a lone 1 (D35), `focusNext`, the dialogs' limits.

Answered in this change by `steppedPoints` in `front/entry.ts`, which
`step()` uses: a lone 1 goes to 10 on Up and 9 on Down, the rest as
`stepped` between 9 and 10. Tested.

### Modifier+arrow is taken too

**Found** — `arrowStep` and the scorecard's `keydown` acted on the key alone, so Shift+Up (select) or Cmd/Alt+Up (caret to the start) stepped the number.

**Done when**

- [x] Up or Down with no modifier, in every stepped box → steps
- [x] With Shift, Alt, Cmd or Ctrl → the browser's meaning, value unchanged
- [x] While composing → the browser's meaning

**Not asked** — Stepping by ten with Shift, other keys.

Answered in this change by `stepKey` in `front/entry.ts`, which both
handlers use: 0 with a modifier or while composing. Tested; the decision
says so.

## What was done

2026-11-20. Up and Down step the number boxes.

- **Rule** (`front/entry.ts`): `stepped(text, by, { min, max, start })`;
  `steppedPoints(text, by)` for a score box; `stepKey(event)`, the step of
  a bare Up or Down, 0 otherwise.
- **Dialogs** (`front/dialog.ts`): `arrowStep(limits)`, a keydown handler
  that steps a box that is not read-only on a bare arrow (`stepKey`) and
  fires its `input` event. It is
  on:
  - `front/bout-form.ts`: scheduled rounds (1 to `MAX_ROUNDS`, start 12);
  - `front/deduction-form.ts`: points (1 to 10);
  - `front/decision-form.ts`: the round (1 to the scheduled rounds; read
    only for a points decision, so not stepped) and the six judges' totals
    (0 to ten a round, start at the most);
  - `front/fighter-form.ts`: the five record counts (from 0).
- **Scorecard** (`front/bout-page.ts`): `keydown` sends a bare Up or Down
  (`stepKey`) to the new `step()`, which steps a points box between 9 and
  10 (`steppedPoints`: empty → 10, a lone 1 up to 10),
  sets the points and keeps focus, and does nothing on a finalised card.
- **Docs**: SPEC's scorecard paragraph says Up and Down step the score
  boxes and the dialogs' number boxes, which stay text. `deno task record`
  compiled this file's decision into `docs/DECISIONS.md` and added the task
  to `docs/PLAN.md`.

Tests: `tests/front/forms.test.ts` adds a test of `stepped`: one up and
down, held at the limits, an empty box at its start, the score box between
9 and 10, a judge's total from 120, and a time or a decimal left alone;
and a test of `steppedPoints` (a lone 1 included) and of `stepKey` (bare
arrows step, any modifier or composing does not).
`git diff tests` adds lines only.

Verified 2026-11-20 by Claude:
- `deno task test` (224 passed), `deno task check` and `deno lint front`
  run.
- Not seen in a browser. Pressing the keys in each box is Erez's.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); its two findings are answered above
