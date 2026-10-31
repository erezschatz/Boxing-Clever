# 01 · Toolchain green

## Context

**Promise.** I can run the chamber on my laptop with one command, see a page that says
Boxing Clever, and run the tests and the type-check with one command each.
Mounted in Atrium, the same page appears at `boxing.<domain>` behind the
login. Nothing else works yet, and that is fine.

**Acceptance.**
- [x] `deno task dev` serves `front/index.html` on :8890 and `/api/health` returns `{ok:true}`
- [x] `mod.ts` exports a `Chamber`; `server/static.ts` serves `front/` so the repo runs without Atrium (was: a stub of Atrium's helper; see SPEC *Atrium*)
- [x] ~~Symlinked into `~/dev/Atrium/chambers/boxing`, registered in `chambers.json`, reachable in the browser behind Atrium's login~~ — moved to task 14 (D16)
- [x] `deno task test` runs one trivial test green; `deno task check` passes; `deno fmt --check` and `deno lint` pass
- [x] Deno version policy in SETUP.md — *reworded 2026-10-31*: no pin; Deno is kept on current stable, SETUP records the floor
- [x] Verified by Erez on the Mac (standalone; mounted deferred, D16)

## What was done

2026-10-31. `mod.ts` is the chamber (`{domain, displayName, fetch}` over a
Hono app) with no `import.meta.main` block: `deno serve --watch` runs the
default export for development, which is also why Deno's "did you mean deno
serve" warning went away. `server/static.ts` serves `front/` with an
`index.html` fallback so the repo runs without Atrium checked out (SPEC
*Atrium* edited to match). Unregistered `/api/*` paths are 404 (in the spirit of D5, which
covers missing single resources) rather than falling through to the page;
the contract test states it.
`tests/health.test.ts` is the first tier-2 file, on `node:assert/strict`;
`@std/assert` was dropped (jsr.io is unreachable from Claude's workspace and
the built-in is enough). `deno fmt` covers code only; Markdown and the
runbook's verbatim scripts are excluded. `deno.lock` untracked, as in Atrium.
Deno version policy: current stable, floor 2.9, never pinned (SETUP).

Verified by Erez on the Mac, 2026-10-31, Deno 2.9.7: `deno task dev` serves
the placeholder and `/api/health`; `deno task test` 3/3; `deno task check`,
`deno lint`, `deno fmt --check` clean. Atrium mount deferred (D16).
