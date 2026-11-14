# tasks/

How to work on a task — receiving it, finishing it, what the unit needs:
`docs/working-on-a-task.md`. This file is the format.

One file per task. Task files are the record; everything else (docs/DECISIONS.md,
docs/PLAN.md, CHANGELOG.md, boards, status) is compiled from them and never edited by
hand. A task file belongs to one scene — one piece of work, by one developer with
whatever agents, reviewers and hooks act for them — and everyone acting in that scene
writes in it. Two scenes never write the same file.

A task file is named `NN-<task description>.md` for a phase-1 step (00–15), a short
kebab-case description after the number. There is no work-item tracker. A task that is
not a numbered step (a bug found in live use, an idea, a decision from outside the work)
is named by its description alone; renaming it later is fine, because the changelog
compiler follows renames. The compiled plan lists the numbered steps first, then the
rest in alphabetical order.

A task file has:

- a title (H1);
- `## Context`: what was asked, by whom, where it came from — written when it arrived,
  not edited afterwards. It carries the **promise** (what the user gets, in the user's
  words, never implementation; it may be unverifiable) and the **acceptance** boxes. An
  acceptance box is a check: it names an actor who is the assignee of the task (or a
  script), a check that actor can perform, and a moment before the task closes. A box
  about the user, adoption or production ("the user replaced the old app", "running in
  production") is an outcome, not a check; it belongs in the promise or in a
  `Milestone:` line of a decision, and the gate refuses it;
- `## What was done`: appended in the same commit as the change it describes, once,
  never edited afterwards. A task may accumulate several such sections over several
  commits; each is a separate entry in the compiled changelog. It says where things are
  in the code and how it was verified ("verified 2026-11-02, standalone on the Mac").
  Its last line is `Reviewed by: <who>`: the reader that had not seen the work and read
  the diff against this section before it was committed. The gate refuses a new record
  without it (records written before 2026-11-14 have none and are left alone);
- `## Decisions`, when the work chose one thing over another: one entry per choice,
  appended in the same commit, never edited or removed once committed.

      ### 2026-11-14 · <title: the choice, in a few words>

      **Decision** — <what was chosen>
      **Rejected** — <what was not, by name>
      **Why** — <the reason a newcomer would need>

  No number: `docs/DECISIONS.md` is compiled from these entries (`deno task record`,
  before every commit) and the compiler numbers them (`D<n>`, from D48; D1–D47 were
  written by hand before 2026-11-14 and stay at the top of that file). Optional lines at
  the end of an entry, each on its own line: `Supersedes: D7` (the only way a decision
  is reversed); `Milestone: After 05: <outcome>` and `Not in scope: <thing>` (the only
  way a line gets into `docs/PLAN.md` — and it leaves when a later decision supersedes
  this one). A decision that comes from outside the work gets a small task file of its
  own.

- `## Review · <date>`, when the work is reviewed: written by the reviewer (Erez or a
  verifying agent) into this file. One `###` item per finding:

      ### <the finding, in a few words>

      **Found** — <where, and what happens now>

      **Done when**

      - [ ] <case> → <outcome>
      - [ ] <every other case of the same thing, including those that must not change> → <outcome>

      **Not asked** — <what the fix must not add: a schema change, an endpoint, a refactor>

  A *Done when* line is a state of the running program, never an instruction. The gate
  refuses an item without the three parts or a line without `→`. The answer to a round
  is a further `## What was done` section; anything the fix needed beyond the item is
  first a `## Decisions` entry.

The plan's steps are the task files themselves: adding a step is adding a file here.

Status is derived: no "what was done" → open; present → done; included in a compiled
release → shipped. There is no status field to keep in sync.

Outside input enters here and nowhere else. If it is not a task file, it did not arrive.
