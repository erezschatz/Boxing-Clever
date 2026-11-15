# 06 · Front: shell and read-only pages

## Context

**Promise.** I open the app at a real URL, see my events newest first, open one and see
its card, open the fighters list grouped by letter — and the back button
works.

**Acceptance.**
- [x] `front/index.html` with import map (lit-html pinned), `front/app.ts`, `front/component.ts` (the ~40-line base), `front/router.ts` (history API, routes from SPEC *Front end*)
- [x] Pages: `/`, `/events/:id`, `/fighters` read-only, matching v1's information (not its look)
- [x] One stylesheet, custom properties, light theme; no framework
- [x] Served by Deno in dev with on-request transpile; `deno task build` emits `front/dist/`
- [x] Verified by Erez in the browser, standalone; mounted (Atrium's session script injects cleanly) is checked with task 14

## What was done

2026-11-07. The shell and the three read-only pages, with real URLs (new
D33, D34).

Where things are:
- `front/index.html`: the import map pinning lit-html 3.3.3 on esm.sh (and
  `lit-html/` for its directives), the header with the two links, and
  `<main id="app">`. One script, `/app.js`. Atrium injects its session
  script before `</head>`, which is there for it.
- `front/component.ts`: `Store<T>` (a value with listeners) and
  `Component<T>` (a store, `view()`, `set(patch)` re-renders, `load()` for
  the fetch, `mount`/`unmount`), with lit-html's `html`, `nothing`, `ref`
  and `createRef` re-exported so pages import one file. ~60 lines with the
  store.
- `front/router.ts`: `matchRoute(pattern, path)` (pure), `startRouter`
  (history API, a delegated click handler that turns a plain click on a
  same-origin link into a navigation, `popstate`), `navigate(path)`. A page
  whose `mount` throws leaves "Could not load this page: <the API's error>".
- `front/api.ts`: `api<T>(path)` over fetch, `ApiError` from the server's
  `{error}`, `references()` for the fighter, class and title maps (D34). The
  wire shapes are `import type` from `server/db/*.ts` and
  `server/api/card.ts` (`BoutView`, newly exported), erased by the bundle.
- `front/format.ts`: `fighterName` (v1's `First "Nick" Last`), `recordText`
  (`W-L-D (N KOs)`, `, N NC` after), `initialOf` (Álvarez under A),
  `dateText` (a calendar date, never shifted by the time zone), `titleText`
  (v1's: the kind only when it is not Active), `resultText` (`Usyk · KO 9
  (2:52)`, `D`, `NC 3`, `draft`). The code goes on the page (SPEC §5); the
  label from `server/rules/decisions.ts` is the cell's tooltip.
- `front/events-page.ts`: newest first, folded by year, newest year open.
  `front/event-page.ts`: the card; each bout with both fighters, the corner
  as a red or blue dot when recorded, the record on the night once a
  snapshot exists, class, rounds, each title with who brought it (or
  vacant), and the result. `front/fighters-page.ts`: filed by the initial,
  sorted with `Intl.Collator` so "de la Hoya" sits under D before Dubois,
  the current record beside each. `front/app.ts`: the route table, the
  not-found page, and the header link marked `aria-current`.
- `front/style.css`: custom properties, light theme, ~190 lines.
- `server/static.ts`: `/app.js` is bundled on request with `BOXING_DEV`
  set (sourcemap inline), else read from `front/dist/app.js`, else a 500
  that says to run the build. `bundleFront()` is shared with
  `scripts/build.ts`, which `deno task build` runs (minified). `deno.json`
  gains `"unstable": ["bundle"]`, the two lit-html imports, `BOXING_DEV=1`
  on the dev task, and `front/app.ts` + `scripts/build.ts` in `check`.
- `server/api/events.ts` and `fighters.ts`: both bout lists answer
  `boutView` per bout (D34), so the card page has titles and results in one
  request.
- SPEC Architecture (`front/`), Front end, the two API rows and the Stack
  table; SETUP's tasks, `BOXING_DEV`, deployment, and a note that
  `Deno.bundle` is behind an unstable flag with esbuild as D7's fallback.
- The fourth box says "on-request transpile"; what runs is a bundle on
  request (D33). The box's text is the brief and stays; this is the
  reading.

Tests:
- `tests/front/shell.test.ts`: `/app.js` in dev mode is the bundle (JS
  type, bare `lit-html` imports, no `.ts` imports left, the route table and
  the rules inside); `index.html` pins the same lit-html as `deno.json`;
  `matchRoute` on the routes and on paths that do not fit; the formatters;
  `resultText` for a decision, a stoppage, a draw, a no-contest, a draft.
- `tests/api/events.test.ts` and `fighters.test.ts`: each listed bout
  equals `GET /api/bouts/:id`, titles and card included.

Run by Claude on the Mac, Deno 2.9.8: `deno task test` 128/128;
`deno task check`, `deno lint`, `deno fmt --check` clean; `deno task build`
wrote `front/dist/app.js` (9 KB minified), removed again afterwards.

Run by Claude in the desktop app's browser pane against the standalone
server (port 8897, `BOXING_DEV=1`, `$BOXING_DB` in the scratchpad), seeded
over HTTP with three events in 2024–2025, five fighters, two heavyweight
belts, Usyk v Dubois finalised KO 9 (2:52) with both belts on the line,
and a draft Álvarez v de la Hoya: `/` listed 2025 open and 2024 folded, the
year toggled; the Wembley link opened `/events/1` with both bouts, the
records on the night (Usyk 23-0-0 before the fight, 24-0-0 on the fighters
page after it), the corners, "WBC World (Oleksandr Usyk)" and "IBF World
(Daniel "Dynamite" Dubois)", "Oleksandr Usyk · KO 9 (2:52)" and "draft";
`/fighters` filed Á under A after a fix, de la Hoya under D before Dubois;
back went to the card and then to the list; `/events/999` said "event not
found" and `/nowhere` showed the not-found page. Without `BOXING_DEV` a
second server served the built file byte for byte, and the 500 message
once it was removed. No console errors but the two expected 404s.

The independent reader (a read-only subagent over the diff and this
section) found two bugs, fixed before the commit: the header link was never
marked on `/` (a string that could not be empty), and an error page was
written with `textContent`, which left lit-html unable to render the next
page into the same root; it now renders through lit-html, and clicking
Fighters from `/events/999` was checked in the browser pane afterwards.
Also from the reader: `format.ts` no longer shadows TypeScript's `Record`
(it uses `FightRecord` from the rules), `titleText` treats only `Active`
as the plain kind, the snapshot record on the card page is a plain helper,
the bundle entry goes through `fileURLToPath` so a path with a space works,
and the router leaves `/api/` links and keeps a link's hash. Not covered by
a test: the non-dev branch of `/app.js` (the built file, or the 500); it was
checked by hand, above.

Left open: the last box. Erez has not run it; the Atrium mount is task 14
(D16), so "mounted" there means the session script injects into this
`index.html`, which is unchanged in shape from task 01's.

2026-11-15: Erez confirmed that the mounted half of the browser check
belongs to task 14 (Deploy), whose *Mounted in Atrium* box now also names
the session-script check (D16). The standalone half stands from Erez's
checks of tasks 07–08 on 2026-11-07, which went through this shell and
its pages.

Reviewed by: a read-only Explore subagent, cold, against the diff (found it accurate; asked that 06's note say the standalone check came through 07–08 and that the session-script line is new in 14, and that the notes claim no more than Erez confirmed; done).
