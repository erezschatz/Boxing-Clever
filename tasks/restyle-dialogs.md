# The dialogs, restyled

## Context

Erez, 2026-11-20: "restyle the dialogs to the design. Buttons instead of
dropdowns is a case by case, if we have 2-3 buttons that's a good tradeoff.
over that it's not, but do the redesign first, I've no idea why that's of
all things was left out of the working."

The dialogs were left out because 09's third box names only the scorecard,
events and fighters pages, and each request named a page; no decision kept
them out. This task restyles every dialog to
`docs/reference/design/DialogsScoring.dc.html`, `DialogsData.dc.html` and
`DialogsGuard.dc.html`. It also settles the README's open choice on button
rows: a dropdown of two or three options becomes a row of buttons, and one
of more stays a dropdown (Erez's rule).

**Promise.** The dialogs look like the rest of the app, and a choice of two
or three is one click.

**Acceptance.**
- [x] Every dialog has the design's frame: a 2px ink border with square corners, the title in condensed capitals over a rule, the body, and the actions under a rule, the main action dark, Delete red, Cancel quiet; the page behind fades to paper grey
- [x] Inputs, dropdowns, labels, fieldsets, the fighter search list and the delete and merge tables are restyled to the design
- [x] The dropdowns of three options or fewer are rows of buttons, with `aria-pressed` on the chosen one: the corner of fighter A, who brought each title in, and the weight unit; the rest (class, title to add, deduction reason, decision code) stay dropdowns
- [x] What each dialog does is otherwise unchanged in the diff (its fields, handlers, dirty check, Escape and Cancel, and what it saves), read by Claude and the cold reader; seeing them in the browser is Erez's
- [x] The tier tests under `tests/` that were there before pass unchanged; `deno task test` and `deno task check` run green by Claude

## Decisions

### 2026-11-20 · A dropdown of two or three options becomes a row of buttons; more stays a dropdown

**Decision** — `choiceRow` in `front/dialog.ts` draws a choice as a row of buttons in a `role="group"` named for the choice, the chosen one `aria-pressed`. It is used for the three dropdowns with three options or fewer: the corner of fighter A (Red, Blue, Not recorded; red and blue with a swatch), who brought each title in (fighter A's name, fighter B's name, Vacant), and the weight unit (lbs, kg, st). The class, the title to add, the deduction reason (five) and the decision code (twelve) stay dropdowns. Pressing the button already chosen does nothing, as picking a dropdown's own option fires no change. The winner was already radio buttons and stays so.
**Rejected** — The design's button rows for the deduction reason, the decision code and the scheduled rounds (five choices). Keeping every dropdown.
**Why** — Erez, 2026-11-20: "if we have 2-3 buttons that's a good tradeoff. over that it's not". This settles that open choice in `docs/reference/design/README.md`. The scheduled rounds are typed into a box, not picked from a dropdown, so they are not in the rule. The title holder's buttons name the fighters without the nickname (`plainName`) to stay short, and the corner buttons drop "(B is blue)", which the swatch and the label say.

### 2026-11-20 · The dialog frame has three bands, and the actions keep their order

**Decision** — `DialogForm.view()` wraps the title in `.dialog-head` and the body and error in `.dialog-body` above the existing `.dialog-actions`. The actions keep their order: the form's own buttons, then Cancel. Each dialog's other buttons and its Escape and dirty behaviour are as they were. The reset choice in the delete dialog is marked `danger strong` so it is drawn solid red, and the keep choice red outlined, as in the design.
**Rejected** — The design's Cancel before the main action. The design's close (×) button in the title band.
**Why** — Moving Cancel first would change the Tab order of every form, and the × would add a second Cancel; the restyle is to the look. Escape and Cancel already close every dialog.

### 2026-11-20 · The dialogs' look is the shared one, laid over their layout rules

**Decision** — `dialog.form` joins the shared `--ds-*` rule, which gains `--ds-danger` (#A50D25, the design's delete colour). The design's look is one block of `dialog.form` rules at the end of `front/style.css`, after the dialogs' layout rules (`.grid`, `.names`, `.judge`, `.titles .line` and the like), which keep their structure. Labels and legends are small muted capitals, and what a label holds is reset to plain text. The old `dialog.deductions` rules, which no dialog had, are removed.
**Rejected** — Rewriting each dialog's layout rules in place. A second set of colours.
**Why** — The layout rules carry decisions of their own (the matches dropping over the row below, D44); laying the look over them changes no layout. One set of colours keeps the dialogs in step with the pages.

## Review · 2026-11-20

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found these as the record says:
- `view()` only adding the two wrappers;
- the actions and `cancel()`, `attempt()` and `open()` unchanged;
- `choiceRow` ignoring a press on the chosen option;
- the three rows setting the values the old dropdowns did;
- four dropdowns left, each of more than three options or the title
  picker;
- `dialog.deductions` unused;
- every custom property defined;
- the actions', body's, row's and pick buttons' rules winning as meant;
- the test diff only adding lines.

It found one thing.

### The label reset strips the small capitals from the fighter search label and the chosen fighter's name

**Found** — `front/style.css`, the reset `dialog.form .field *`: in the bout form, `<label>Fighter A` inside `div.field` was drawn plain, and the chosen fighter's name, a `<strong>` inside `.chosen`, lost its weight and capitals.

**Done when**

- [x] The bout form with no fighter chosen → "Fighter A" / "Fighter B" over the search are small muted capitals at weight 600 with 0.12em spacing, like "Corner of fighter A"
- [x] The bout form with a fighter chosen → the name is condensed capitals at weight 700; the record beside it stays plain small text and "change" stays quiet
- [x] The Unit and Corner labels, inputs, the row buttons, the search matches and the `label small` hints → as they were
- [x] Labels not inside `.field` → as they were

**Not asked** — A markup change to the bout form, new classes, a change to the dialogs' layout rules.

Answered in this change by two rules after the reset:
- `dialog.form .field > label` joins `.field > .label` (0,2,2 over the
  reset's 0,2,1), so a label directly in a `.field` has its capitals
  again; what it holds is still reset by `label *`.
- `dialog.form .chosen strong` sets the name's weight and capitals. The
  record keeps `.chosen .record` and "change" keeps `button.quiet`.

Not seen in a browser.

## What was done

2026-11-20. Every dialog restyled to `docs/reference/design/DialogsScoring.dc.html`,
`DialogsData.dc.html` and `DialogsGuard.dc.html`; the dropdowns of three
options or fewer are rows of buttons.

- **Frame** (`front/dialog.ts`): `view()` renders `.dialog-head` (the
  title), `.dialog-body` (the body and the error) and `.dialog-actions`,
  whose buttons and order are unchanged. `choiceRow` is new: a `role="group"`
  of buttons, the chosen one `aria-pressed`, a press on it ignored.
- **Button rows**:
  - `front/bout-form.ts`: the corner of fighter A;
  - `front/bout-titles.ts`: who brought each title in, named by
    `plainName`;
  - `front/fighter-form.ts`: the weight unit, through the same
    `changeUnit`; the unused `getUnitDisplayName` import is gone.
- **Delete dialog** (`front/bout-delete.ts`): the reset button adds the
  class `strong`.
- **Styles** (`front/style.css`):
  - `dialog.form` joins the shared `--ds-*` rule, and `--ds-danger` is
    added.
  - The dialog look is appended as one `dialog.form` block: the sheet and
    backdrop, the three bands, labels, inputs, dropdowns, checkboxes, the
    title lines, the button rows, the body's buttons, the fighter search
    list, the preview tables, and the actions (dark main, red outlined
    delete, solid red reset, quiet Cancel).
  - The unused `dialog.deductions` rules are removed.
- **Docs**: SPEC's dialog paragraph describes the frame and the button
  rows. `deno task record` compiled this file's decisions into
  `docs/DECISIONS.md` as D103–D105 and added the task to `docs/PLAN.md`.

Tests: `tests/front/forms.test.ts` adds a test that `choiceRow` presses the
chosen option, and that a press on another picks it while a press on the
chosen one does nothing. `git diff tests` adds lines only.

Verified 2026-11-20 by Claude:
- `deno task test` (218 passed), `deno task check`, `deno fmt --check` and
  `deno lint front` all run.
- Not seen in a browser. The look and the button rows are Erez's to check,
  with the bout, fighter, event, deduction, decision, delete and merge
  dialogs each opened once.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); its one finding is answered above
