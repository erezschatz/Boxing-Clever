# 01 · Toolchain green

## Context

**Promise.** I can run the chamber on my laptop with one command, see a page that says
Boxing Clever, and run the tests and the type-check with one command each.
Mounted in Atrium, the same page appears at `boxing.<domain>` behind the
login. Nothing else works yet, and that is fine.

**Acceptance.**
- [ ] `deno task dev` serves `front/index.html` on :8890 and `/api/health` returns `{ok:true}`
- [ ] `mod.ts` exports a `Chamber`; the standalone block in `mod.ts` stubs Atrium's static helper so the repo runs without Atrium
- [ ] Symlinked into `~/dev/Atrium/chambers/boxing`, registered in `chambers.json`, reachable in the browser behind Atrium's login
- [ ] `deno task test` runs one trivial test green; `deno task check` passes; `deno task fmt --check` and `deno task lint` pass
- [ ] Exact Deno version pinned in SETUP.md
- [ ] Verified by Erez on the Mac (standalone and mounted)
