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

### 2026-11-15 · Claude Code is the only agent here; no Codex binding

**Decision** — Upgrade to the 2026-11-15 runbook (0.5.1) without its 4.10. Erez works here with Claude Code alone, so the instructions stay in `CLAUDE.md`, and there is no `AGENTS.md` and no `.codex/`. What 0.5.x adds for every repo is installed: `docs/reviewer.md` as the cold reader's brief, the new strict paragraph in `CLAUDE.md`, and the gate's `--codex` flag with its three tests. The flag stays in the script even though nothing here passes it.
**Rejected** — Installing 4.10 in advance (moving `CLAUDE.md` to `AGENTS.md`, adding `.codex/hooks.json` and the reader agent), since it would be a binding nobody runs and so could never be verified (Phase 6, step 8). Leaving the `--codex` code and its tests out of the script.
**Why** — Erez answered the runbook's agent question, which repos adopted before 0.5.0 were never asked, on 2026-11-15: Claude Code only. Keeping the script equal to Appendix A, plus this repo's block and D51, keeps the next upgrade a diff against the master and not a merge. If someone starts working here with Codex, that is a new decision superseding this one, and a re-run installs 4.10.

### 2026-11-19 · The compilers in scripts/ do not take the runbook's licence line yet

**Decision** — The 0.5.5 licence comment goes into the two hook files only. `scripts/compile-record.mjs` and `scripts/compile-changelog.mjs` stay as they were. That comment is the only change 0.5.5 makes to them, and they will take it the next time a scene changes them for a reason a test can show.

**Rejected** — Adding the line now together with a `tests/` change made only to satisfy the gate, which would be a test of nothing. Widening the `test` role so the change passes, which would loosen the gate for every later scene to fit one comment.

**Why** — The gate counts `scripts/` as source and wants a test with any source change (D50 put the compiler's test under `tests/`). A comment changes no behaviour, so nothing honest can test it. The comment is the author's own licence notice on code he wrote, so leaving it out loses nothing.

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

## What was done

2026-11-15. The Unities runbook upgraded to the master copy dated 2026-11-15 (0.5.1) and carried out again. The staging stays strict, and the agent question is answered: Claude Code only (D52).

- `docs/UNITIES.md` is replaced byte for byte (was 2026-11-11 · 0.4.0).
- `.claude/hooks/check-unit.mjs`: the `--codex` flag from Appendix A. It is taken out of the arguments before the mode and base are read, and an adapted `Stop` under Codex continues the turn once (`decision: "block"`) where Claude Code gets `additionalContext`. `AGENTS.md` joins `README.md` and `CLAUDE.md` in the `doc` role. The per-repo block (roles, `docs/reference/` exclusion, Deno commands) and the D51 deviation are unchanged.
- `.claude/hooks/check-unit.test.mjs`: the three Codex tests from Appendix J are appended unchanged.
- `docs/reviewer.md` is new: the reader's brief from Appendix G (three questions, and findings in the review-item shape).
- `CLAUDE.md`: the Unities paragraph is now the 0.5.1 strict text from Appendix E. The reading is part of the unit, and the reader is a read-only subagent, never the author, carrying out `docs/reviewer.md`. `docs/working-on-a-task.md` *Finishing* opens with the four as one unit and says who the reader is, that what it finds goes into the task file, and that the gate checks the `Reviewed by:` line but not the reading.
- `docs/DECISIONS.md` recompiled (D52); `docs/PLAN.md` unchanged in content.

Not installed: 4.10 (no `AGENTS.md`, no `.codex/`), per D52. `.claude/settings.json`, `.githooks/pre-commit` and the compilers are unchanged; the runbook changed none of them.

Verified in Claude's workspace: `node --test .claude/hooks/check-unit.test.mjs` 36/36; `deno task test` 186/186; `deno task check` clean; `compile-record --check` exits 0. Nothing in the app changed, so there is nothing for Erez to run in the browser.

Reviewed by: a read-only Explore subagent, cold, against the staged diff and `docs/reviewer.md`. It found one item, recorded below and fixed in this change. It confirmed `docs/UNITIES.md` is identical to the master, and that the script, the tests and `docs/reviewer.md` match Appendices A, J and G.

## Review · 2026-11-15

### The record says *Finishing* matches CLAUDE.md, but it leaves out "one unit"

**Found** — The record said `docs/working-on-a-task.md` *Finishing* "says the same" as the new `CLAUDE.md` paragraph. *Finishing* had the reader and `docs/reviewer.md`, but never said that code, test, document and review are one unit (runbook 4.8, item 3).

**Done when**

- [x] `docs/working-on-a-task.md` *Finishing* → says that code, test, document and review are one unit, so the cold reading is part of a complete scene
- [x] `docs/working-on-a-task.md` *Finishing*, on who the reader is, `docs/reviewer.md`, the `Reviewed by:` line, `deno task record` and reverting an unfinished scene → reads as it did in the staged diff
- [x] The 2026-11-15 record's line about *Finishing* → claims only what *Finishing* says
- [x] `CLAUDE.md` → its Unities paragraph is Appendix E strict, with only `deno task` for `npm run` and Erez for `<who>`, as staged

**Not asked** — The adapted-only wording of 4.8; the Codex sentence in 4.8 item 2; any change to D52.

## What was done

2026-11-19. The Unities runbook upgraded to the master copy dated 2026-11-19 (0.5.5) and carried out again. The staging stays strict (D12) and Claude Code is still the only agent (D52); nothing was asked again.

- `docs/UNITIES.md` is replaced byte for byte (was 2026-11-15 · 0.5.1).
- `.claude/hooks/check-unit.mjs`: `--pr` now takes the target, not a base. It refuses a target the checkout does not know (exit 2) instead of skipping it as one that has not adopted, finds the merge base of target and `HEAD` itself, and stops with an error when there is none. `--pr` no longer reads stdin, so a caller that leaves a pipe open does not hang it. The per-repo block and the D51 deviation are unchanged. Nothing here calls `--pr` (no CI), so the changed argument breaks no caller.
- `.claude/hooks/check-unit.test.mjs`: Appendix J's three new tests, appended unchanged: an unknown target is an error; what the target did after the branch forked is not the PR's doing; a PR with no common history stops.
- The licence line (MIT, unities) is added as the second line of `check-unit.mjs` and `check-unit.test.mjs`; the runbook now counts it as part of the fixed text. It is not added to `scripts/compile-record.mjs` or `scripts/compile-changelog.mjs`, whose only change in 0.5.5 it is (D66).

Each hook file was brought up by applying the difference between the 0.5.1 and 0.5.5 copies of its appendix as a patch to the installed file, so this repo's adaptations stay as they were; both applied cleanly.

Not installed: the runbook's new 4.11 installs nothing (it is what each binding enforces and the limits), and its CI change concerns the adapted staging's pipeline, which this repo does not have. `scripts/`, `CLAUDE.md`, `docs/reviewer.md`, `.claude/settings.json`, `.githooks/pre-commit` and `docs/PLAN.md` are unchanged; Appendices E and G did not change. `docs/DECISIONS.md` is recompiled for D66.

Verified in Claude's workspace: `node --test .claude/hooks/check-unit.test.mjs` 39/39; `deno task test` 198/198; `deno task check` clean; `compile-record --check` exits 0. Nothing in the app changed, so there is nothing for Erez to run in the browser.

Reviewed by: a read-only Explore subagent, cold, against the staged diff and `docs/reviewer.md`, re-read after the scripts went back to HEAD and D66 was added. It found one item, recorded below and fixed in this change. It confirmed `docs/UNITIES.md` is identical to the master, that the hook changes are exactly the 0.5.1 → 0.5.5 change to Appendices A and J, that Appendices F and K change only by the licence line, that the `docs/DECISIONS.md` diff is D66 alone, and that nothing calls `--pr`.

## Review · 2026-11-19

### The record cites D1 for the strict staging; D1 is the Atrium chamber

**Found** — The 2026-11-19 record's first paragraph said "The staging stays strict and Claude Code is still the only agent (D1, D52)". D1 is "An Atrium chamber, not a standalone server"; the strict staging is D12.

**Done when**

- [x] The 2026-11-19 record's reference for "the staging stays strict" → names D12
- [x] The same record's reference for "Claude Code is still the only agent" → still names D52
- [x] The record's D66 reference (licence line kept out of `scripts/`) → still names D66
- [x] The 2026-11-14 and 2026-11-15 records → unchanged

**Not asked** — Any change to D1, D12, D52 or D66, or to the earlier records.
