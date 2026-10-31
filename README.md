# Boxing Clever

A boxing scorecard for one viewer, and the database of every fight and
fighter they have watched. Version 2: an [Atrium](https://github.com/erezschatz)
chamber on Deno + Hono + lit-html with a single SQLite file.

Scoring is deliberately simple — 10 or 9 in a box per round, deductions in
the next box, a decision at the end — and the data is what it is for: every
card records what each fighter's record, weight, titles and TBRB ranking were
*on the night*, so a career can later be read back as witnessed.

The old version (NestJS + React, MySQL + MongoDB) is still in use while this
one is built; see `docs/BOXING-CLEVER-V1.md`.

## Start here

- `CLAUDE.md` — how to work in this repo.
- `docs/SPEC.md` — what it is. `docs/DECISIONS.md` — why. `docs/PLAN.md` —
  what comes next, with one file per step in `tasks/`.
- `docs/SETUP.md` — running it.

```
deno task dev     # http://localhost:8890
deno task test
```
