# Setup — machines, toolchain, deployment

Read only for toolchain or deployment problems.

## Machines

- Mac (`~/dev/Boxing-Clever-gh`) — primary development.
- Windows / WSL2 — secondary; same commands.
- Atrium server (Arch Linux; the DigitalOcean droplet for the public
  domain) — where the chamber is mounted. Backed up; the SQLite file lives
  in its backup set.
- Claude Code's cloud workspace — runs `deno test` and `deno check`; cannot
  open a browser or reach Atrium.

## Toolchain

| Tool | Version | Notes |
|---|---|---|
| Deno | **current stable, kept upgraded** — never pinned. Floor: 2.9 (2026-10-31: 2.9.7 on the Mac, 2.9.6 in the cloud) | `node:sqlite` needs ≥ 2.2. When an upgrade breaks something, raise the floor here and say what broke. The Unities hooks need `--allow-run=git,deno,/bin/sh --allow-read --allow-env` — see tasks/00 Notes |
| Atrium | `~/dev/Atrium` on the Mac | for mounted runs only; standalone runs do not need it |

No pnpm, no npm, and no Node for the app itself; Node is used only to run the
gate's own tests (`node --test`, runbook Appendix J). Dependencies are declared in
`deno.json` `imports`; Atrium's `import_map.json` must carry the same
entries at deploy (D1). `deno.lock` is not tracked, as in Atrium: the
import map there is the one resolution that matters.

## Tasks (`deno.json`)

```
deno task dev      # deno serve --watch on http://localhost:8890, data/boxing.db; BOXING_DEV=1 bundles /app.js per request
deno task test     # all tiers, in-memory SQLite; --allow-run=deno only for tests/record.test.ts, which runs the record compiler
deno task check    # type-check mod.ts, front/app.ts, scripts/build.ts and tests/
deno task build    # emit front/dist/app.js, the browser bundle served when BOXING_DEV is unset (D7, D33)
deno task migrate  # apply pending migrations to data/boxing.db (the server also does, on first use: D29)
deno task record   # compile docs/DECISIONS.md and docs/PLAN.md from tasks/; run before every commit
deno lint / deno fmt --check   # built-ins, not tasks; fmt covers code only (Markdown and the runbook's scripts excluded)
deno task hooks     # once per clone: git config core.hooksPath .githooks
deno task changelog -- <version>   # the only writer of CHANGELOG.md
deno task check-unit-test          # the gate's own tests (node --test)
```

Environment: `BOXING_DB` (path; default `data/boxing.db` in this repo,
resolved from the module, not the working directory, so it holds under
Atrium; `:memory:` in tests). `BOXING_DEV` (any value): `/app.js` is
bundled from `front/app.ts` on every request, so a reload shows the edit
(`deno serve --watch` restarts only on server changes); unset, `/app.js` is
`front/dist/app.js` or a 500 that says to run `deno task build`. The
standalone port is the `--port` in the `dev` task.

The bundler is `Deno.bundle`, behind `"unstable": ["bundle"]` in
`deno.json`, so it is the one part of the toolchain Deno may still change.
If an upgrade breaks it, pin esbuild instead (D7's fallback) and record it
here and in DECISIONS.

## Mounting in Atrium

```
ln -s ~/dev/Boxing-Clever-gh ~/dev/Atrium/chambers/boxing
```
`chambers.json`: `"boxing": { "path": "/chambers/boxing/" }` →
`https://boxing.<ATRIUM_DOMAIN>/`. Add this repo's `imports` to Atrium's
import map. Restart Atrium.

## TBRB daily scrape (task 12)

systemd user timer on the Atrium machine running
`deno task tbrb-daily` once a day; `loginctl enable-linger` is already set
for Atrium. Logs to the journal.

## Deployment

Pull on the server, `deno task migrate`, `deno task build` (writes
`front/dist/app.js`; Atrium's process serves it without `BOXING_DEV`), restart Atrium.
A `scripts/deploy.sh` doing exactly those four lines is task 14's
deliverable.
