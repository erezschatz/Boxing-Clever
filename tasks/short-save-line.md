# The scorecard's save line, short

## Context

Erez, 2026-11-20, with a screenshot of the scorecard after
[header-to-design](header-to-design.md): "Also the notification, that's
too much info and again, breaks the design". The save line beside the
scorecard's buttons ("Unsaved changes; round 1 is saved once both sides
are scored") was long enough that the header wrapped to two rows. In the
design (`docs/reference/design/Main.dc.html`) it is a few words, 13 px:
"Saved 21:42 · not final".

**Promise.** The header stays one row while scoring, and the save line
says in a word or two where the card stands.

**Acceptance.**
- [x] The bar's save line is its first words: "Unsaved changes", "Progress saved", "Not saved", "Cannot be saved"; the whole line is its tooltip
- [x] It stays on one line, small, red when the card cannot be saved, as before
- [x] What the page saves and when, and the whole line's wording (`status()`), are unchanged in the diff
- [x] A test shows the short line for each kind of status; `deno task test` and `deno task check` run green by Claude; seeing it in the header is Erez's

## Decisions

### 2026-11-20 · The save line in the header is its first words, the rest a tooltip

**Decision** — The bar shows `shortStatus(status())`, the line up to its first ";" or ":", one line at 0.8rem; the whole of `status()` is the span's `title`. The red of a card that cannot be saved stays. `status()` and what it says are unchanged.
**Rejected** — The whole line in the bar, which wraps the header (Erez: "too much info"). The detail on a line of its own under the header, which is a second bar again. The design's "Saved 21:42 · not final", which needs the time of the last save kept, new behaviour. Dropping the detail.
**Why** — The first words say where the card stands, which is what a glance while scoring needs. What follows says which rounds wait or why a save failed, which is wanted only when something is wrong, and the tooltip keeps it one hover away.

## Review · 2026-11-20

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found these as the record says:
- every line `status()` can give, each message the page sets among them,
  starts with a fixed prefix that has no ";" or ":", so the short line is
  never cut early or empty;
- the tooltip is the whole line;
- the red or grey class, `status()` and the saving are unchanged;
- the test diff adds lines only;
- D110 matches this file.

No findings. It noted that "Finalised" never shows in this span, because a
final card's bar has none, so the first acceptance line no longer names it.

## What was done

2026-11-20. The save line in the scorecard's bar is a word or two.

- **Helper** (`front/format.ts`): `shortStatus` gives a status line up to
  its first ";" or ":".
- **Scorecard** (`front/bout-page.ts`): the bar's status span shows
  `shortStatus(this.status())`, has the whole line as its `title`, and has
  the class `bp-status` beside its `error` or `muted`.
- **Styles** (`front/style.css`): `.bp-bar .bp-status` is 0.8rem and does
  not wrap.
- **Docs**: SPEC's scorecard line says the save line is short with the rest
  in its tooltip. `deno task record` compiled this file's decision into
  `docs/DECISIONS.md` as D110 and added the task to `docs/PLAN.md`.

Tests: `tests/front/shell.test.ts` adds a test of `shortStatus` for each
kind of status line. `git diff tests` adds lines only.

Verified 2026-11-20 by Claude:
- `deno task test` (220 passed), `deno task check` and `deno lint front`
  run.
- Not seen in a browser. The header staying one row while scoring is
  Erez's to check.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); no findings
