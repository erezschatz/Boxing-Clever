# Working on a task

For the person at the keyboard. One developer, so this is short; the long form and the
reasons are `docs/UNITIES.md`.

## Receiving

A task is a file in `tasks/`, numbered by its step in `docs/PLAN.md`. Its `## Context`
is the brief — the promise and the acceptance boxes — and is not edited. Something new
turning up (a bug, an idea, a request) becomes its own task file on arrival, or a
decision entry if it is a choice; nothing lives in chat.

## Doing

Work on `main` or a branch, it does not matter: **the commit is the scene.** A commit
that touches `server/`, `front/`, `scripts/` or `mod.ts` must also carry a change under
`tests/`, a doc line (`docs/`, `README.md` or `CLAUDE.md`), and a task file change. The
gate is `.claude/hooks/check-unit.mjs`; `git commit` refuses an incomplete scene and
Claude Code cannot end a turn on one. Turn the git hook on once per clone:

    deno task hooks

Run the gate yourself any time: `deno run --allow-run=git,deno,/bin/sh --allow-read
--allow-env .claude/hooks/check-unit.mjs --branch`.

`CHANGELOG.md` is never edited by hand. `docs/reference/` is binaries and does not count
as docs.

## Finishing

Tick the acceptance boxes that this commit satisfies. Append `## What was done` — dated,
where things are, how it was verified — last, because its presence is what marks the
task done. Before committing, have a reader who did not write it (a read-only subagent)
read the diff against that section. If the scene cannot be finished in this sitting,
revert it; do not commit half of it.

## Releasing

    deno task changelog -- 2.0.0
    git commit --no-verify -m "Release 2.0.0"     # the one documented bypass

The compiler is the only writer of `CHANGELOG.md`; bump `version` in `deno.json` in the
same commit. Then deploy per `docs/SETUP.md`.

## Checklist

- [ ] test under `tests/` · doc line · task file, all in this commit
- [ ] a rejected alternative → `docs/DECISIONS.md` entry
- [ ] SPEC edited if behaviour or architecture changed
- [ ] `deno task test` and `deno task check` run, not assumed
- [ ] verified where it runs (browser / Atrium) by Erez, written into the record
