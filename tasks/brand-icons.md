# The grid mark as the app's icon

## Context

Erez, 2026-11-20: "I moved in the two files I created for "brand" of this,
the one titled "grid mark only" should go as the favicon and as the PWA
icon. The other is if we need something for a logo." The two files were
`Boxing Clever _ Grid Mark Only.png` and `Boxing Clever _ Scorecard
Grid.png`, both 4096 px square, at the root of the repo.

**Promise.** The tab, the home screen and an installed window show the
Boxing Clever grid mark, and the full logo is kept for when a page needs it.

**Acceptance.**
- [x] Claude makes the favicon, the apple-touch icon and the manifest's 192 and 512 icons from the grid mark, centred
- [x] `front/index.html` links the favicon, the apple-touch icon and `manifest.json`, and a test shows the chamber serves each as an image or JSON
- [x] Both originals are kept under `docs/reference/brand/`
- [x] `deno task test` and `deno task check` run green by Claude; seeing the icons in the tab and installing the app are Erez's

## Decisions

### 2026-11-20 · A manifest returns, for the installed window; no service worker

**Decision** — `front/manifest.json` names the app "Boxing Clever", opens standalone, and gives the grid mark at 192 and 512 px. Its `start_url` and `scope` are `./`, relative to the manifest, so an installed window opens wherever Atrium mounts the chamber. There is still no service worker, so nothing works offline.
**Rejected** — D10's "`sw.js` and manifest are not carried", for the manifest. A service worker with the manifest.
**Why** — Erez, 2026-11-20, asked for the mark "as the PWA icon", and D10 itself said a manifest could return if an installable window was wanted. D10's reason against a service worker (the app is online by nature and sits behind Atrium's login) still holds.
Supersedes: D10

### 2026-11-20 · The icons are the mark centred, cut from the original

**Decision** — The grid in `mark.png` sits above centre (its middle at 1906 px of 4096 down). The icons are cut square around the grid's middle. The 32 px favicon is cut tight (a 3000 px square), so the lines still read at that size. The apple-touch icon (180 px) and the manifest's icons (192, 512 px) keep a margin (a 3584 px square). They are PNGs made with macOS `sips`, kept in `front/` beside `style.css`.
**Rejected** — Scaling the original as it is. A `.ico` file. An SVG favicon.
**Why** — Off centre, the mark looks misplaced in a tab or on a home screen. A PNG favicon is read by every browser Erez uses. The original is a raster, so an SVG would be a redrawing.

### 2026-11-20 · The originals are kept in docs/reference/brand/

**Decision** — `Boxing Clever _ Grid Mark Only.png` becomes `docs/reference/brand/mark.png` and `Boxing Clever _ Scorecard Grid.png` becomes `docs/reference/brand/logo.png`. The logo (the mark over "BOXING CLEVER") is not used by any page yet.
**Rejected** — Leaving them at the root. Putting the logo in the header now.
**Why** — `docs/reference/` is where the design material lives. The header is not part of any restyle so far (D87); the logo waits for the restyle that takes it on.

## Review · 2026-11-20

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found these as the record says:
- the three links, and the files they point at, staged;
- the manifest valid, with its icons present;
- `server/static.ts` serving `.png` and `.json`, unchanged;
- the icon sizes, 32, 180, 192 and 512 px;
- D97–D99 compiled word for word;
- a test that fails if a link or a file is missing;
- the test diff only adding lines.

It found one thing.

### The no-service-worker line still cites the superseded D10

**Found** — D97 supersedes D10, but SPEC's out-of-scope line cited D10 for the service worker and "task brand-icons" for the manifest. PLAN's "Not in scope: Service worker (D10). (D49)" still cites D10. D97's Rejected quoted D10 as "no manifest", which are not D10's words.

**Done when**

- [x] SPEC's out-of-scope line → cites D97 for the service worker and the manifest
- [x] PLAN's not-in-scope service-worker line → cites a decision in force, or the record says on purpose why D10 stays
- [x] D97's Rejected → quotes D10's own words
- [x] Other lines that cite D10 → checked, and unchanged unless they rely on the no-manifest part

**Not asked** — Editing `docs/DECISIONS.md` or D49 by hand, a service worker, a change to `server/static.ts`.

Answered in this change:
- SPEC's line now reads "(D97, superseding D10)".
- D97's Rejected quotes D10: "`sw.js` and manifest are not carried".
- PLAN's line stays as compiled. It comes from D49, whose `Not in scope:`
  lines are the whole not-in-scope list. Only a decision superseding D49
  could change it, and that would have to carry every milestone and
  exclusion again. What the line says, no service worker, is still true
  under D97, and D10 is where the rule began.
- The only other citation of D10 is that same line, in D49's committed
  entry in `tasks/00-skeleton.md`, which is never edited.

## What was done

2026-11-20. The grid mark is the app's icon.

- **Icons** (`front/`): `favicon-32.png` cut tight around the grid, and
  `apple-touch-icon.png` (180 px), `icon-192.png` and `icon-512.png` with a
  margin, all centred on the grid and made with `sips` from
  `docs/reference/brand/mark.png`.
- **Manifest** (`front/manifest.json`): the name, `start_url` and `scope`
  `./`, standalone, white, and the 192 and 512 icons.
- **Page** (`front/index.html`): links the favicon, the apple-touch icon and
  the manifest. `server/static.ts` already served `.png` and `.json`, so it
  is unchanged.
- **Originals**: moved from the repo root to `docs/reference/brand/mark.png`
  and `docs/reference/brand/logo.png`.
- **Docs**: SPEC's out-of-scope line says the manifest is carried and the
  service worker is not, citing D97; its `front/` line lists the manifest and icons.
  `deno task record` compiled this file's decisions into
  `docs/DECISIONS.md` as D97–D99 (D97 supersedes D10) and added the task to
  `docs/PLAN.md`.

Tests: `tests/front/shell.test.ts` adds a test that `index.html` links the
icon, the apple-touch icon and the manifest, and that the chamber serves
the icons as `image/png` and the manifest as JSON, with its icons served
too. `git diff tests` adds lines only.

Verified 2026-11-20 by Claude:
- `deno task test` (216 passed), `deno task check` and `deno fmt --check`
  all run.
- The icons were looked at, scaled up, to see the grid centred.
- Not seen in a browser tab, and not installed; Erez checks both.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); its one finding is answered above
