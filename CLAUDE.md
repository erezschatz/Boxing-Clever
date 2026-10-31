# CLAUDE.md — working in this repo

Boxing Clever is a boxing scorecard and a database of every fight its one user
has watched. This repo is the second version: an [Atrium](docs/SPEC.md#atrium)
chamber on Deno, Hono and lit-html, with one SQLite database. One developer,
one user, scoring on a laptop while watching. This file is how to work here;
what the app is lives in `docs/`.

## Read first, in this order

1. `docs/SPEC.md` — what the app is, scope, data model, API, stack. The contract.
2. `docs/DECISIONS.md` — why things are the way they are, and what was rejected.
   **Do not re-open a decision listed there without saying so explicitly**;
   propose a new entry instead of quietly doing it differently.
3. `docs/PLAN.md` — the ordered steps. Status is not written there; it is
   derived from the task files (see *The Unities*). Then the current step's
   file in `tasks/`.
4. `docs/BOXING-CLEVER-V1.md` when the question is "how did the old app do
   this?" — the predecessor lives in `~/dev/Boxing-Clever` and is still in use.
5. `docs/IMPORT.md` when touching the two data imports (v1 databases, the
   Numbers sheet). `docs/TBRB.md` when touching rankings.
6. `docs/SETUP.md` only for toolchain or deployment problems.

A new session with no memory of previous ones must be able to pick up from
these files alone. If something needed to continue the work is not in them, the
previous session failed the discipline below — fix the gap first.

## The Unities

The work, its record and its location are the same thing at the same time. Every commit
that changes source also carries its test, its doc line and a `## What was done` section
appended to the task file in `tasks/`. This is enforced, not requested: a Stop hook
refuses to end a turn with a half-recorded change, and `git commit` refuses an incomplete
scene (`.claude/hooks/check-unit.mjs`). `CHANGELOG.md` is compiled from task records at
release (`deno task changelog -- <version>`) and is never edited by hand. If a change cannot
be completed with its record in this sitting, revert it; do not leave it for later.
Any choice with a rejected alternative gets a dated entry in `docs/DECISIONS.md`; a listed
decision is not reopened quietly but by a new entry. Before committing, have a reader that
has not seen the work check that the task record describes the diff. The agent does not
claim a build is green or a feature works where it runs; Erez does. The developer's side
of all this is `docs/working-on-a-task.md`.

Status lives in exactly one place: a task file with no `## What was done`
section is open; with one, done; listed in a compiled release, shipped.
`PLAN.md` has no status column on purpose. The runbook that installed the
gates is `docs/UNITIES.md`; it is a migration, not a standing rule.

## Code rules

- TypeScript that a strong Node developer reads without pause. If a construct
  would be unreadable to such a developer in week one of Deno, write it the
  plain way. No decorators, no DI container, no class hierarchies for routing.
- Folder budget, and that is the budget: `server/` (`api/`, `db/`, `rules/`,
  `migrations/`, `tbrb/`, `import/`), `front/`, `tests/`, `scripts/`, `docs/`,
  `tasks/`. No `domain/`, `services/`, `utils/` grab-bags.
- One file per resource / page / rule set; split at ~400 lines.
- `server/rules/` is pure: no I/O, no Hono, no SQLite imports. The scoring
  rules are the subject matter of the app and must be testable with nothing
  running.
- SQL is written by hand in `server/db/`, one module per table, parameterised
  always. No query builder, no ORM (D3).
- Comments explain *why*. Every boxing rule encoded in code cites the spec
  section it implements.
- No new dependency without a row in the Stack table in `docs/SPEC.md` saying
  what it replaces and why it is rote. The chamber's dependencies also go in
  Atrium's import map at deploy time (D1), so every addition is paid twice.
- Tests state intended behaviour, never current behaviour. Test the
  boundaries (rules in, rules out; HTTP in, HTTP out; what a sequence of
  requests leaves in the database), never the parts. No test may import Hono
  internals or assert on SQL text.
- Never write to `~/dev/Boxing-Clever` (v1). It is read-only reference.

## Division of labour

The programmer holds the helm, the LLM has the oars. Claude implements the
current step, runs `deno test` and `deno check` in its own environment and
reports the result; those claims are only made when actually run. Erez runs the
chamber standalone on his machine, exercises it in the browser, mounts it in
Atrium, and says what happened. Claude does not claim the app works in the
browser or on the Atrium server; Erez does. Design passes (task 09) are run by
Erez in Claude Design and the result is handed back as reference material.
