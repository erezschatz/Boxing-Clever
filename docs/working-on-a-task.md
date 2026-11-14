# Working on a task

For the person at the keyboard. One developer, so this is short; the long form and the
reasons are `docs/UNITIES.md`.

## Receiving

A task is a file in `tasks/`; a phase-1 step carries its number (00–15), and
`docs/PLAN.md` lists them all, compiled from the files. Its `## Context` is the brief —
the promise and the acceptance boxes — and is not edited. Something new turning up (a
bug, an idea, a request) becomes its own task file on arrival, or a `## Decisions` entry
in a task file if it is a choice; nothing lives in chat.

## Doing

Work on `main` or a branch, it does not matter: **the commit is the scene.** A commit
that touches `server/`, `front/`, `scripts/` or `mod.ts` must also carry a change under
`tests/`, a doc line (`docs/`, `README.md` or `CLAUDE.md`), and a task file change. The
gate is `.claude/hooks/check-unit.mjs`; `git commit` refuses an incomplete scene and
Claude Code cannot end a turn on one. Turn the git hook on once per clone:

    deno task hooks

Run the gate yourself any time: `deno run --allow-run=git,deno,/bin/sh --allow-read
--allow-env .claude/hooks/check-unit.mjs --branch`.

`CHANGELOG.md`, `docs/DECISIONS.md` and `docs/PLAN.md` are never edited by hand; the
last two are compiled from the task files by `deno task record`, run before every
commit, and the gate refuses a commit that carries them out of date. They do not count
as the doc line. `docs/reference/` is binaries and does not count as docs either.

## Finishing

Tick the acceptance boxes that this commit satisfies. Where the work chose one thing over
another, add a `## Decisions` entry to the task file (`### YYYY-MM-DD · title`, then
**Decision** / **Rejected** / **Why**, no number). Append `## What was done` — dated,
where things are, how it was verified — last, because its presence is what marks the
task done. Before committing, have a reader who did not write it (a read-only subagent)
read the diff against that section; its last line names that reader
(`Reviewed by: …`), and the gate refuses a record without it. Then `deno task record`
and commit. If the scene cannot be finished in this sitting, revert it; do not commit
half of it.

## A review round

A review lands as `## Review · <date>` in the task's own file. Each item has **Found**
(where, what happens now), **Done when** (one box per case, `case → outcome`, including
the cases that must not change) and **Not asked** (what the fix must not add). An item
is done when every *Done when* line holds for the running program, not when its wording
is satisfied; a test for it exercises the behaviour, not the text of a source file.
Anything the fix needs beyond the item — a migration, an endpoint, another caller
changed — is a `## Decisions` entry before it is built, and what *Not asked* names is not
built without asking. After the last item, one pass over the whole diff of the round for
what the fixes themselves added or broke. The answer is a further `## What was done`.

## Releasing

    deno task changelog -- 2.0.0
    git commit --no-verify -m "Release 2.0.0"     # the one documented bypass

The compiler is the only writer of `CHANGELOG.md`; bump `version` in `deno.json` in the
same commit. Then deploy per `docs/SETUP.md`.

## Checklist

- [ ] test under `tests/` · doc line · task file, all in this commit
- [ ] a rejected alternative → `## Decisions` entry in the task file
- [ ] `## What was done` ends with `Reviewed by: …`
- [ ] `deno task record` run; `docs/DECISIONS.md` and `docs/PLAN.md` in the commit
- [ ] SPEC edited if behaviour or architecture changed
- [ ] `deno task test` and `deno task check` run, not assumed
- [ ] verified where it runs (browser / Atrium) by Erez, written into the record
