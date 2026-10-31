# tasks/

How to work on a task — receiving it, finishing it, what the unit needs:
`docs/working-on-a-task.md`. This file is the format.

One file per task. Task files are the record; everything else (CHANGELOG.md, boards,
status) is compiled from them and never edited by hand.

A task file is named `NN-<task description>.md`: the step number from `docs/PLAN.md`,
then a short kebab-case description. There is no work-item tracker. A task that is not a
plan step (a bug found in live use, an idea) is named by its description alone and gets a
number when it is put in the plan; renaming it then is fine, because the changelog
compiler follows renames.

A task file has:

- a title (H1);
- `## Context`: the **Promise** — what the user gets, in the user's words, never
  implementation — and **Acceptance** checkboxes; written when it arrived and not
  edited afterwards (a change of mind is a new task or a decision);
- `## What was done`: appended in the same commit as the change it describes, once,
  never edited afterwards. A task may accumulate several such sections over several
  commits; each is a separate entry in the compiled changelog. It says where things are
  in the code and how it was verified ("verified 2026-11-02, standalone on the Mac").

Status is derived: no "what was done" → open; present → done; included in a compiled
release → shipped. There is no status field to keep in sync.

Outside input enters here and nowhere else. If it is not a task file, it did not arrive.
