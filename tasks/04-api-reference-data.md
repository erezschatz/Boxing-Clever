# 04 · API: reference data

## Context

**Promise.** Over HTTP I can create and list fighters, events, titles and bouts, fix a
duplicate fighter by merging it, and every missing id is a 404.

**Acceptance.**
- [ ] Endpoints from SPEC *API* for weight classes, fighters (incl. merge and `/bouts`), events (incl. `/bouts`), titles, bouts (create, read, patch incl. corners and titles with holder side, delete)
- [ ] zod schema per resource in `server/api/<resource>.ts`; 400 with issues on failure
- [ ] 404 `{error}` on every single-resource miss (D5)
- [ ] Merge is one transaction: bouts on both sides, aliases, TBRB rows repointed, duplicate deleted — or nothing
- [ ] Tier-2: one test per endpoint via `app.request()`; tier-3: merge all-or-nothing, event delete refused when a bout is finalised
- [ ] Verified by Erez with the standalone server and `curl`/the browser's devtools
