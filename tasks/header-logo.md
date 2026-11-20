# The logo in the header

## Context

Erez, 2026-11-20: "put the logo in the header", after the grid mark became
the app's icon ([brand-icons](brand-icons.md)). The logo is
`docs/reference/brand/logo.png`: the grid mark over "BOXING CLEVER". The
header is on every page, which is why no page restyle took it on (D87); this
task does, to the header of `docs/reference/design/Events.dc.html` with
Erez's logo in place of the design's mark and word.

**Promise.** Every page carries the Boxing Clever logo at the top, and the
header matches the restyled pages.

**Acceptance.**
- [x] The header on every page shows the logo, linking to the events list, with "Boxing Clever" as its text for the screen reader
- [x] The header is restyled to the design: a full-width rule under it, its content as wide as the restyled pages, Events and Fighters beside the logo, the current section in ink and underlined
- [x] The section marking (`aria-current`, `markNavigation` in `front/app.ts`) is unchanged in the diff
- [x] A test shows `index.html` puts the logo in the header and the chamber serves it; `deno task test` and `deno task check` run green by Claude; seeing it on the page is Erez's

## Decisions

### 2026-11-20 · The header shows Erez's logo, 72 px high, in place of the design's mark and word

**Decision** — The header's brand link is `front/logo.png`, Erez's logo (the grid mark over "BOXING CLEVER"), with `alt="Boxing Clever"`. It is shown 72 px high (4.5rem) and stored at twice that, 87 × 144 px, cut tight from `docs/reference/brand/logo.png` and made with `sips`. The header grows to fit it.
**Rejected** — The design's 26 px mark with "BOXING CLEVER" set as text beside it. The logo at the design's 64 px header height or less.
**Why** — Erez asked for the logo. Its words sit under the mark, so it needs about 72 px for them to read; smaller, they blur.

### 2026-11-20 · The header takes the design's look and the shared colours

**Decision** — `header.top` joins the shared `--ds-*` rule. Its rule runs the full width of the window, and its content lines up with the pages' content. The section links are muted, and the current one is ink, semibold, and underlined by a 2 px rule at the header's foot. The links, their order and `markNavigation` are unchanged.
**Rejected** — Keeping the header at the old 60rem measure. Its old colours.
**Why** — All four pages are restyled, so the header was the last part of every page in the old look; D87 left it out of the page restyles only because it is on every page.

### 2026-11-20 · Every page is 80rem wide

**Decision** — `--measure`, the width of `main`, becomes 80rem for every page, and the per-page `main:has(...)` widening goes. The header's padding reads `--measure`, so the logo sits at the left edge of every page's content. The rest of D81 stands: the `--ds-*` colours are shared, each page's rules are scoped by its class, and there is no webfont (D72).
**Rejected** — D81's "`main` widens to 80rem only when it holds a `.bout-page`", carried by each restyle since. Excepting the fighter card and the not-found page from the header's alignment.
**Why** — The cold read found the logo out of line with the fighter card and the not-found page, which were still at 60rem. The design's content width is 1280 px on every page (`docs/reference/design/README.md`), the fighter card included, and its rules are fluid; D81 kept 60rem only so pages not yet restyled would not change, and all of them are now restyled.
Supersedes: D81

## Review · 2026-11-20

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found these as the record says:
- the logo's size and alt text;
- the nav links byte for byte;
- `front/app.ts` unchanged, its `aria-current` styled;
- every custom property the header reads defined;
- the nav's rules outranking the global `a` rules;
- a test that fails if the logo or a link is missing;
- the test diff only adding lines.

It found one thing.

### The header's content does not line up with the fighter card page

**Found** — `front/style.css` padded the header to an 80rem column, but only the bout, events, event and fighters pages widened `main` to 80rem. On the fighter card and the not-found page `main` stayed at `--measure`, 60rem, so on a wide window the logo sat left of their content.

**Done when**

- [x] Events, event, bout and fighters pages at 1600 px wide → the logo's left edge lines up with the content's
- [x] Fighter card at 1600 px → the logo lines up with the card's left edge, or a decision excepts it
- [x] Not-found page at 1600 px → it lines up with the content, or a decision excepts it
- [x] Any page under 80rem wide → the header and the content both sit 1.5rem from the edge

**Not asked** — Widening the fighter card's layout, or changing `--measure` for pages not restyled.

Answered in this change by "Every page is 80rem wide", which supersedes
D81: `--measure` is 80rem for every page, and the header's padding is
computed from it. The reader's "not asked" is overridden on purpose: the
fighter card is restyled, its design is 1280 px wide, and its rules are
fluid. The not-found page is the one page with no design, and it widens
too. The alignment is shown by the arithmetic: `main` is `--measure` wide,
centred, with 1.5rem padding, and the header's padding is
`max(1.5rem, (100% − --measure) / 2 + 1.5rem)`. It is not seen in a
browser.

## What was done

2026-11-20. Erez's logo is in the header, and the header is restyled.

- **Logo** (`front/logo.png`): cut tight around the logo's content in
  `docs/reference/brand/logo.png`, scaled to 87 × 144 px with `sips`.
- **Header** (`front/index.html`): the brand link holds the logo image,
  `alt="Boxing Clever"`, 43 × 72; the nav is unchanged.
- **Styles** (`front/style.css`): the `header.top` rules are rewritten (full-width
  rule, content aligned to 80rem, the logo 4.5rem high, the current section
  underlined), and `header.top` joins the shared `--ds-*` rule.
  `--measure` is 80rem, and the per-page `main:has(...)` widening is
  removed.
  `front/app.ts` is unchanged.
- **Docs**: SPEC's `front/` line names the logo in the header. `deno task
  record` compiled this file's decisions into `docs/DECISIONS.md` as D100–D102 (D102 supersedes D81)
  and added the task to `docs/PLAN.md`.

Tests: `tests/front/shell.test.ts` adds a test that the header holds the
logo with its alt text beside the two section links, and that the chamber
serves `logo.png` as an image. `git diff tests` adds lines only.

Verified 2026-11-20 by Claude:
- `deno task test` (217 passed), `deno task check` and `deno fmt --check`
  all run.
- The logo image was looked at, at its stored size.
- Not seen on the page; Erez checks it in the browser.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); its one finding is answered above
