# 00 · Skeleton and documentation

## Context

**Promise.** A repository that a fresh session — human or Claude — can open and
understand without this conversation: what the app is, what is decided, what
comes next, and how the old app did it.

**Acceptance.**
- [x] `CLAUDE.md`, `docs/SPEC.md`, `docs/DECISIONS.md` (D1–D15), `docs/PLAN.md`, `docs/SETUP.md`, `docs/BOXING-CLEVER-V1.md`, `docs/IMPORT.md`, `docs/TBRB.md`, `tasks/00`–`15`, `tasks/README.md`
- [x] `docs/UNITIES.md` (the runbook) planted and carried out: commit gate, `scripts/compile-changelog.mjs`, Claude Code bindings
- [x] `docs/reference/` holds v1's scorecard mock-ups and the Numbers sheet (binary, committed once)
- [x] `deno.json` with the tasks listed in SETUP.md (they may fail until 01)
- [x] Pushed to `github.com/erezschatz/Boxing-Clever`; `~/dev/Boxing-Clever-gh` is the clone

## Notes

Adoption record (runbook §4.3), written at kickoff on 2026-10-31:

- Staging: **strict** (D12). Both Claude Code bindings installed (`Stop`,
  `PreToolUse` on `git commit`) and the git pre-commit hook too, because
  commits also happen from a shell and an editor; `deno task hooks` turns it
  on per clone.
- The 3.7 CI gate is not installed: no CI exists and the staging is strict.
  Add it the day a CI appears.
- Roles: source = `server/`, `front/`, `scripts/`, `mod.ts`; test = `tests/`;
  doc = `docs/` except `docs/reference/`, plus `README.md` and `CLAUDE.md`;
  task = `tasks/*.md` except `README.md` and `_template.md`; shared =
  `CHANGELOG.md`. Release files = `CHANGELOG.md`, `deno.json`.
- Two deviations from the runbook's Appendix H, both forced by Deno 2.9's
  `node:child_process`: `execSync` needs full `--allow-env` (the narrow
  `--allow-env=TF_BUILD,UNITIES_SCENE` list is refused), and it spawns the
  shell by absolute path, so the run list is `--allow-run=git,deno,/bin/sh`
  (`sh` by name does not match). Still no `-A`.
- Verified in Claude's workspace on Deno 2.9.6 / Node 22: `--branch` on a
  clean tree prints nothing; a source-only probe is refused at `--staged`
  (exit 2) and by the real git hook; a complete scene commits; the compiler's
  dry run lists its record; `node --test .claude/hooks/check-unit.test.mjs`
  12/12.
- SPEC, DECISIONS and PLAN were created, not found (new project). No TODO
  files to migrate. `CHANGELOG.md` does not exist yet; the compiler creates it
  at the first release.
- `docs/UNITIES.md` is the copy Erez supplied on 2026-10-31; he noted later
  amendments exist that mostly concern the adapted staging. If a newer copy
  turns up, replace the file and re-run the runbook (it is idempotent).

## What was done

2026-10-31. Kickoff interview answered in conversation and written into
`docs/SPEC.md`, `docs/DECISIONS.md` (D1–D15) and `docs/PLAN.md`; the
predecessor studied in `~/dev/Boxing-Clever` and described in
`docs/BOXING-CLEVER-V1.md`; the Numbers sheet measured (218 events, 1,103
bouts, 2,211 fighter rows) and its shape written into `docs/IMPORT.md`;
Atrium's chamber contract read from `~/dev/Atrium` and written into SPEC.
The runbook was carried out for the strict staging — see Notes above for the
roles, the two Deno deviations and the verification output.

Commit `9785b17` is the skeleton. It carries source (`mod.ts`,
`scripts/compile-changelog.mjs`) with no change under `tests/`, which the gate
would refuse: it was made from a clone where the hook was not yet active, and
it is the adoption commit the runbook (§1.2) allows as one scene. The gate's
own tests live in `.claude/hooks/`, outside the `tests/` role, on purpose.

Remote: `github.com/erezschatz/Boxing-Clever` (created as `Boking-Clever`,
a typo, renamed the same day; D15 holds). Local clone
`~/dev/boxing-clever-gh`, hooks path set.

Verified: a fresh read of the repo answers what the app is (SPEC), what was
decided (DECISIONS), what comes next (PLAN → tasks/01). Erez has not yet run
anything on his machine; that is task 01.

## What was done

2026-11-02. `.githooks/pre-commit` had been committed as mode 100644 in
`9785b17`, so git ignored it in this clone ("not set as executable"). Since
then only Claude Code's `PreToolUse` gate has checked commits. Commits from a
shell or an editor were not checked. The test in the Notes above ran in
Claude's workspace, where the bit must have been set on disk without being
recorded in git. The file is now 100755 in the index. Verified on the Mac
with `git hook run pre-commit`: a staged source-only probe to `mod.ts` is
refused with exit 2 ("no test change; no doc change; no task change"), and
the mode change alone passes with exit 0. The probe was reverted.

## Decisions

### 2026-11-14 · Decisions and the plan are compiled from the task files

**Decision** — Upgrade to the 2026-11-11 runbook (0.4.0). `docs/DECISIONS.md` and `docs/PLAN.md` are compiled by `scripts/compile-record.mjs` (`deno task record`) before every commit; a decision is written under `## Decisions` in the task file of the work that made it. D1–D47 stay above the marker as the file's hand-written head, with their numbers. The plan's hand-written step table gives way to the compiled steps; its out-of-order list stays, frozen, in the plan's introduction, and later placements are stated in the decision that makes them. This upgrade is recorded here in task 00, the task that carried out the first adoption.
**Rejected** — Keeping both files hand-written (the old runbook); moving D1–D47 into task files and renumbering them; turning the out-of-order list into decision lines, which the compiler has no section for; a separate `tasks/unities-0.4.md`.
**Why** — One record: status and decisions are derived from the task files and cannot drift from them. Old numbers are cited all over the code and docs (`D26`, `D47`), so they must not move. The strict staging is unchanged; a commit is also the merge, so it carries the compiled files. Recorded 2026-11-14.

### 2026-11-14 · The plan as it stood

**Decision** — The milestones and the not-in-scope list of `docs/PLAN.md` as they stood on 2026-11-14, copied as written so the compiled plan carries them. The D40 paragraph on v1 is carried as a not-in-scope line.
**Rejected** — Rewording them in the move.
**Why** — The upgrade converts the plan's form, not its content.
Milestone: After 05: the data model is proven. A bout can be created, scored, stopped in round 2 with a knockdown, finalised, and both fighters' records move once and atomically — all over HTTP against a real database, with the snapshot intact. Nothing after this is worth building if this fails.
Milestone: After 08: the app can replace v1 for a fight night, standalone on the laptop. The design is still the programmer's own.
Milestone: After 11: the database holds every fight watched since Nov 2021.
Milestone: After 14: the chamber on Atrium is the one in use, with all the data in it.
Milestone: After 15: phase 1 complete; the project goes quiet.
Not in scope: What happens to v1 is not a step or a milestone here. Whether it keeps running, stops, or goes with its data kept is Erez's call, outside this plan, and nothing in it waits on that (D40).
Not in scope: Mobile layout (D9).
Not in scope: Public access (D2).
Not in scope: Charts and trajectories.
Not in scope: Service worker (D10).
Not in scope: Playwright (D11).
Not in scope: Automated TBRB history from archive.org.
Not in scope: Other ranking bodies.
Not in scope: Phase 2 is not planned here.

### 2026-11-14 · The record compiler gets a test under tests/, and the test task may run deno

**Decision** — `tests/record.test.ts` runs `scripts/compile-record.mjs --check` against a fixture in `tests/fixtures/record/` shaped like this repo (a hand-written head ending at `### D47`) and asserts that the first decision from a task file is `D48` and that the plan derives each step's status. `deno task test` gains `--allow-run=deno`, and nothing broader.
**Rejected** — Committing the upgrade with `--no-verify` as an adoption exemption (as `9785b17` was); widening the test task to `--allow-write` so the test could compile into a temporary directory.
**Why** — `scripts/` is source here, so the gate asks for a change under `tests/`; the gate's own tests live in `.claude/hooks/` and do not count. The one thing about the compiler that is specific to this repo is that it must read the hand-written `### D<n>` head and continue from it; that is worth a test of its own, and a fixture checked with `--check` needs only read and run.

### 2026-11-14 · A record is new when its body is, not its heading

**Decision** — `check-unit.mjs` counts a `## What was done` or `## Review` section as added by the scene when one of its body lines is added (`isNew`), not when its heading line is. A test in `.claude/hooks/check-unit.test.mjs` pins it: appending a record to a file that already holds an unreviewed one asks only the new one for a reader.
**Rejected** — Appendix A as written, which matches the heading line; adding `Reviewed by:` lines to the two 00 records of 2026-10-31 and 2026-11-02, which nobody read cold.
**Why** — Every `## What was done` heading reads the same, so appending one made each earlier record in the file count as new and be refused for want of a reader. Every task here with an earlier record would hit it on its next record. This is a local deviation from the 0.4.0 master; the fix belongs in the master too.

## What was done

2026-11-14. The Unities runbook upgraded to the master copy dated 2026-11-11 (0.4.0) and carried out again; the staging stays strict. `docs/UNITIES.md` is replaced byte for byte; the old copy had no date line.

- `.claude/hooks/check-unit.mjs` is Appendix A with this repo's block carried over (roles, `REQUIRED`, `RELEASE_FILES`, the Deno changelog command) plus `retired: /^$/` (no tombstones: adopted as a new project) and a `RECORD_CHECK` that runs the record compiler through Deno, like everything else here. New checks: acceptance boxes naming an outcome are refused (every existing task file was scanned and passes); a `## What was done` section a commit adds must end with `Reviewed by:`; review items need **Found** / **Done when** (`case → outcome`) / **Not asked**; `docs/DECISIONS.md` and `docs/PLAN.md` must equal the compiler's output and their hand-written heads are locked.
  The compiled files no longer count as a commit's doc change. One local deviation: a record is recognised as new by its body, not its heading (D51).
- `.claude/hooks/check-unit.test.mjs` is Appendix J with this repo's paths; the three tests about retired files are left out, since there are none, and one test added for D51.
- `scripts/compile-record.mjs` is new (Appendix K) with `deno task record`; `scripts/compile-changelog.mjs` now drops the `Reviewed by:` line from the changelog (Appendix F). Both compilers are excluded from `deno fmt`.
- `docs/DECISIONS.md`: D1–D47 stay as they were, as the hand-written head; only its intro paragraph changed, to say where new decisions are written. The four decisions above compile as D48–D51.
- `docs/PLAN.md`: the step table is gone (every row had its task file; the one-line summary each row carried is dropped, since each task's promise and acceptance say the same) and the steps are compiled with derived status; the milestones, the not-in-phase-1 list and the D40 paragraph on v1 moved, as written, into "The plan as it stood" (D49). The out-of-order list stays in the intro, frozen as of today; the intro now says what is compiled.
- `CLAUDE.md`: the strict Unities paragraph of the new runbook (decisions in task files, compiled record, review items) and *Read first* items 2 and 3 say DECISIONS and PLAN are read, never written. `tasks/README.md` and `tasks/_template.md` follow Appendix D, keeping the `NN-` naming and no tracker. `docs/working-on-a-task.md` gains decisions in the task file, the `Reviewed by:` line, `deno task record` and a section on review rounds. `docs/SETUP.md` lists `deno task record` and why `deno task test` now has `--allow-run=deno`.
- `tests/record.test.ts` with its fixture `tests/fixtures/record/` (D50).

Unchanged: `.claude/settings.json` (`Stop` and `PreToolUse` already call the script with the right permissions), `.githooks/pre-commit`. No CI, so no `--pr` gate, as before. No `CHANGELOG.md` and no tag yet.

Verified in Claude's workspace (Deno 2.9, Node 22): `node --test .claude/hooks/check-unit.test.mjs` 33/33; `deno task test` 186/186; `deno task check` clean; `compile-record --check` exits 0; `--branch` on a clean tree prints nothing; a staged source-only probe under `server/` is refused with exit 2 and was removed. Nothing in the app changed, so there is nothing for Erez to run in the browser; the next real commit is the first one the new gate judges.

Reviewed by: a read-only Explore subagent, cold, against the staged diff (found the record accurate; asked that the dropped step summaries and the doc-role change be stated, done; D51 came after its reading, from the Stop hook).
