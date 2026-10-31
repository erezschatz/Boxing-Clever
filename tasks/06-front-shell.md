# 06 · Front: shell and read-only pages

## Context

**Promise.** I open the app at a real URL, see my events newest first, open one and see
its card, open the fighters list grouped by letter — and the back button
works.

**Acceptance.**
- [ ] `front/index.html` with import map (lit-html pinned), `front/app.ts`, `front/component.ts` (the ~40-line base), `front/router.ts` (history API, routes from SPEC *Front end*)
- [ ] Pages: `/`, `/events/:id`, `/fighters` read-only, matching v1's information (not its look)
- [ ] One stylesheet, custom properties, light theme; no framework
- [ ] Served by Deno in dev with on-request transpile; `deno task build` emits `front/dist/`
- [ ] Verified by Erez in the browser, standalone and mounted (Atrium's session script injects cleanly)
