# The fighters page, restyled

## Context

Erez, 2026-11-20: "restyle the fighters page to the design". This is the
fighters part of the third acceptance box of
[09 · Design pass](09-design-pass.md), after the scorecard, the events
page and the event card. It is built to
`docs/reference/design/Fighters.dc.html`. It is a task file of its own, as
they are (D68), so 09 stays open for Erez's check in the browser.

**Promise.** Everyone I have watched, filed by last name in the same look
as the rest: the letter large, the names in two columns, and one click to
each fighter's card.

**Acceptance.**
- [x] `/fighters` shows the large "Fighters" title, how many fighters there are, and "New fighter" as the dark button
- [x] Each letter is one section: the letter large with how many fighters are under it, folding and unfolding as before (every letter open at first); a folded letter lists its last names
- [x] Each fighter is a row in two columns: the last name large, the first name and nickname, the record, and Edit and Merge…; the name links to the fighter card
- [x] What the page does is unchanged in the diff (the `/fighters` load, the sort, the folding, and New fighter, Edit and Merge… opening their dialogs and reading again), read by Claude and the cold reader; seeing it in the browser is 09's last box, Erez's
- [x] The tier tests under `tests/` that were there before pass unchanged; `deno task test` and `deno task check` run green by Claude

## Decisions

### 2026-11-20 · Not in this restyle: the Find box and the letter rail

**Decision** — The design's Find box (filtering by any part of a name) and its rail of letters to jump to are not built. The page keeps the folding letters it had.
**Rejected** — Building them with the restyle.
**Why** — Both are new behaviour, and the restyle is to change none (09; D82 kept blind scoring out on the same ground). The rail's `#letter-X` links would also go through the router, which treats any link into the app as a navigation and would load the page again rather than scroll. Find stays an open choice in `docs/reference/design/README.md`.

### 2026-11-20 · A fighter's row sets the last name first, and the link keeps the full name

**Decision** — A row shows the last name large, then the first name, then the nickname in quotes and italics, then the record (`recordText`), and "Edit" and "Merge…". The link's accessible name is `fighterName` ("Tyson "The Gypsy King" Fury"), not the order it is set in. The rows are a list in two columns. A folded letter shows its last names, in order, after the letter.
**Rejected** — The table with `fighterName` as the link text. Hiding a folded letter's fighters entirely, as before.
**Why** — The list is filed by last name, so the last name leads, as in the design. A screen reader should hear the name as the rest of the app says it. The last names are already loaded, and they say who is under a folded letter.

### 2026-11-20 · The letter's button shows "fold" or "open" and its count

**Decision** — Each letter's button holds the letter large and "N fighters · fold" (or "· open" when folded), with the verb hidden from the screen reader, which has `aria-expanded`. Every letter starts open, as before.
**Rejected** — The ▸/▾ marks of the old groups.
**Why** — It is the design's button, and the state is said once to each reader.

### 2026-11-20 · With every page restyled, the old list rules go

**Decision** — `.fighters-page` joins the shared `--ds-*` rule, `.muted` and the 80rem `main`; its own rules are `fl-`. The `.group` rules, `.count`, `.page-head` and `td.row-actions` are removed from `front/style.css`: the fighters page was the last to use them. `table.list` and `.record` stay for the delete and merge dialogs and the forms.
**Rejected** — Leaving the unused rules.
**Why** — As for the event card (its "styles no longer used go" decision): the stylesheet holds what the pages render.

## What was done

2026-11-20. The fighters page at `/fighters`, restyled to
`docs/reference/design/Fighters.dc.html`.

- **Page** (`front/fighters-page.ts`): `view()` wraps the page in
  `.fighters-page` and renders:
  - a head with the large "Fighters" title, "N fighters, filed by last
    name", and "New fighter" as the dark button;
  - a section per letter (`letter()`): a button with the same
    `aria-expanded` and `toggle`, holding the letter large and "N fighters ·
    fold/open"; a folded letter lists its last names;
  - under an open letter, a two-column list (`list()`): each row a link to
    the fighter card named by `fighterName`, holding the last name large,
    the first name and the nickname, then the record and "Edit" and
    "Merge…".

  `load()`, `edit()`, `merge()`, `toggle()` and `sortedByName` are
  unchanged: the same `/fighters` load and sort, every letter open at first,
  and the dialogs reading the list again. Loading and "No fighters yet." are
  as before.
- **Helper** (`front/format.ts`): `fighterCount` gives "1 fighter" or "N
  fighters".
- **Styles** (`front/style.css`):
  - `.fighters-page` joins the shared `--ds-*` rule, `.muted` and the
    80rem `main`.
  - Its own rules, `fl-`, are appended.
  - `.group` and its button, `.count`, `.page-head` and `td.row-actions`
    are removed, the fighters page having been the last to use them.
- **Docs**: SPEC's `/fighters` line describes the restyled list; `deno task
  record` compiled this file's decisions into `docs/DECISIONS.md` as
  D93–D96 and added the task to `docs/PLAN.md`.

Tests: `tests/front/shell.test.ts` adds `fighterCount`. `git diff tests` adds
lines only.

Verified 2026-11-20 by Claude:
- `deno task test` (215 passed), `deno task check` and `deno fmt --check`
  all run.
- Not seen in a browser. That the folding and the three dialogs behave as
  before is shown by the code path, not by a run; Erez checks it in the
  browser with 09's last box.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); no findings
