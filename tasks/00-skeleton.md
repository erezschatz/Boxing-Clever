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

### 2026-11-19 · The compilers take the licence line, and this one commit goes past the gate

**Decision** — `scripts/compile-record.mjs` and `scripts/compile-changelog.mjs` take the runbook's licence line as their second line, as the hook files did. The change has no test and no doc line. Erez commits it himself with `--no-verify`, once. The gate itself is unchanged.

**Rejected** — Keeping D66, which held the line back for want of a test that a comment cannot have. Teaching the gate that a comment-only diff is not a source change, which would add a local deviation to the gate for one comment.

**Why** — A licence comment changes no behaviour, so a test of it would test nothing, and no doc describes it. The gate wants both with any `scripts/` change, and the compiled `docs/DECISIONS.md` does not count as a doc. Bypassing the gate once, by Erez's own hand, costs less than changing the gate for every later scene.

Supersedes: D66

### 2026-11-28 · The gate and the compilers are the plugin's files; this repo's values are in unities.json

**Decision** — Upgrade to the 2026-11-22 runbook (0.6.5) by its 5.5. `.claude/hooks/check-unit.mjs`, `.claude/hooks/check-unit.test.mjs`, `scripts/compile-record.mjs` and `scripts/compile-changelog.mjs` are byte-for-byte copies of the plugin's files, with their hashes in `.claude/hooks/unities.manifest.json`. What was this repo's block in the gate (staging, roles, required roles, base, release files, the Deno invocation of the compilers) is `.claude/hooks/unities.json`. The local `isNew` in the gate and the local test that pinned it are dropped, not carried into the copy.

**Rejected** — Carrying `isNew` into the new copy, which the gate's manifest check would refuse as a planted file edited in place. Raising it as a task in the plugin's repository, since the master already does what D51 asked, by another rule: a section is the scene's unless the base held it word for word. Staying on 0.5.5 with hand-patched copies.

**Why** — D51 said the fix belonged in the master, and it is there now. The old and the new gate were run on the same three scenes in scratch clones of this repo (a source-only probe; a hand-edited `CHANGELOG.md`; a record with no reader appended to this file, which holds earlier records without one) and gave the same refusals, the last naming one record and not the earlier ones. With no local change left, the next upgrade is a copy and not a patch.

Supersedes: D51

### 2026-11-28 · The gate runs both compilers with one Deno invocation

**Decision** — `run` in `.claude/hooks/unities.json` is `deno run --allow-run=git,/bin/sh --allow-read --allow-env`. The gate uses it for the changelog compiler's dry run and for `compile-record.mjs --check` alike, so the record check, which the old copy ran with `--allow-read` alone, now runs with the same line. That line is the old gate's changelog invocation less `--allow-write=CHANGELOG.md`: the gate only ever asks the changelog compiler for a dry run, which writes nothing, so the gate's calls no longer carry a write permission at all. `deno task record` and `deno task changelog` keep their own, narrower lines.

**Rejected** — Leaving `run` out, which makes the gate call the compilers with `node` and so makes every commit here depend on Node. Editing the planted gate to keep two invocations, which the manifest check refuses.

**Why** — The configuration has one `run` for both calls, and it must be enough for the wider of the two. The changelog compiler needs git, and Deno 2.9's `execSync` needs `/bin/sh` and full `--allow-env` (this file's Notes). The record compiler reads `tasks/`, the two compiled files and the configuration and does nothing with the extra permissions. Still no `-A`, and `tests/unities-config.test.ts` says so.

### 2026-11-28 · This scene's test is of the configuration, not of the scripts

**Decision** — `tests/unities-config.test.ts` reads `.claude/hooks/unities.json` and states what it must mean here: the staging is strict; `server/`, `front/`, `scripts/` and `mod.ts` are source; `tests/`, the docs and the task files play their roles; `docs/reference/`, `tasks/README.md`, `tasks/_template.md` and the gate's own files play none, and every path it names is held to exactly its roles, because the gate tests each role on its own and a source path that also matched `test` would be its own test; a release touches `CHANGELOG.md` and `deno.json` only; the compilers are run by Deno without `-A`. It also checks each planted script against its hash in the manifest.

**Rejected** — A test of `"plan": false`, the one setting the record compiler reads, which this repo does not use. Re-testing the gate's behaviour under `tests/`, which the gate's own 84 tests do and which would be a second copy to keep.

**Why** — `scripts/` is source here, so the scene needs a change under `tests/` (D50). What this scene changes that is the repo's own is where its values live; a typo in a regular expression in the JSON would silently change what counts as a complete scene, and nothing else would notice. The hash check is the same comparison the gate makes, but the gate makes it only when a scene touches a planted file; the test makes it on every `deno task test`.

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

## What was done

2026-11-19. The licence line from the 0.5.5 runbook is the second line of `scripts/compile-record.mjs` and `scripts/compile-changelog.mjs`. With it, both files equal Appendices F and K once this repo's own adaptations are set aside. Nothing else in them changed, and there is no test, because a comment has no behaviour to test. Erez commits this with `--no-verify`, since the gate wants a `tests/` change and a doc change with any `scripts/` change, and gets neither here. That is the decision above, which supersedes D66; `docs/DECISIONS.md` is recompiled and gains it as D67, whose `Supersedes: D66` line is the link; D66's own entry is unchanged.

Verified in Claude's workspace: `deno task record` then `compile-record --check` exits 0; `deno task test` 198/198; `deno task check` clean; `node --test .claude/hooks/check-unit.test.mjs` 39/39. Nothing in the app changed.

Reviewed by: a read-only Explore subagent, cold, against the staged diff and `docs/reviewer.md`, re-read after D67 gained the doc line. No findings: the licence line equals line 2 of Appendices F and K, D67 sits under `## Decisions` with `Supersedes: D66` and D66 unchanged, and `compile-record --check` exits 0.

## What was done

2026-11-28. The Unities runbook upgraded to the master copy dated 2026-11-22 (0.6.5) and carried out again, by its 5.5: the scripts stop being copies of listings with this repo's values written into them and become the plugin's files, with the values in one configuration file. The staging stays strict (D12) and Claude Code is still the only agent (D52); neither was asked again. Erez approved the report on 2026-11-28 before anything was written.

- `docs/UNITIES.md` is replaced byte for byte (was 2026-11-19 · 0.5.5).
- `.claude/hooks/check-unit.mjs`, `.claude/hooks/check-unit.test.mjs`, `scripts/compile-record.mjs` and `scripts/compile-changelog.mjs` are replaced by the files in the plugin's `files/` folder, unedited. `.claude/hooks/unities.manifest.json` is new: the plugin's version and the hash of each of the four. The gate now refuses a scene that touches one of them when it differs from its hash.
- `.claude/hooks/unities.json` is new and holds what the old gate's per-repo block held: `scene` `commit`; the six role rules (source `server/`, `front/`, `scripts/`, `mod.ts`; test `tests/`; doc `docs/` except `docs/reference/`, with `README.md`, `CLAUDE.md`, `AGENTS.md`; task files; `CHANGELOG.md` shared; nothing retired); `required` test, doc, task; `base` `origin/main`; `releaseFiles` `CHANGELOG.md` and `deno.json`; and `run`, the Deno invocation the gate uses for both compilers (second decision above). `run` is the one value not carried as it was: the old block's changelog line also had `--allow-write=CHANGELOG.md`, which `run` leaves out because the gate's dry run never writes, and the old record check had `--allow-read` alone. No `changelog.recorded` and no `plan`: the old compilers equalled their 0.5.5 listings, so both defaults hold.
- Local changes found against the 0.5.5 listings: one, the `isNew` rule of D51 with its test, dropped because the master now covers the case (first decision above, superseding D51). The other differences in the old test file were this repo's fixture values and the order of the Codex tests, which the new file, carrying its own fixture, makes moot.
- `tests/unities-config.test.ts` is new (third decision above). `docs/working-on-a-task.md` says the scripts are the plugin's and never edited here, where the repo's values are, and that the gate run from a shell is given no stdin.

Unchanged: `.claude/settings.json`, `.githooks/pre-commit` and the tasks in `deno.json` (the invocations and their permissions are as they were), `CLAUDE.md`, `tasks/README.md`, `tasks/_template.md` and `docs/reviewer.md` (Appendices D, E and G give the same text as before). `docs/DECISIONS.md` is recompiled for the three decisions; `docs/PLAN.md` is recompiled and does not change.

Old gate against new, each in a scratch clone of this repo at `1681c1f`, `--staged`, strict:

- a source-only probe (`server/_unities_probe`) → both exit 2, "no test change; no doc change; no task change";
- `CHANGELOG.md` written by hand → both exit 2, "shared file edited directly: CHANGELOG.md";
- a complete scene whose record, appended to this file, has no `Reviewed by:` line → both exit 2 with that one refusal, for the new record only.

They agree on all three. No complete scene was passed through the old gate; the new one passed this commit.

Verified in Claude's workspace (Deno, and Node for the gate's tests): the probe is refused by the new gate in the repo itself and by `.githooks/pre-commit`; a line appended to `scripts/compile-record.mjs` in a temporary index is refused as "planted file edited" and the file restored; `compile-record --check` exits 0; `deno task changelog --dry-run` compiles; `.claude/settings.json` parses with `Stop` and `PreToolUse`; `node --test .claude/hooks/check-unit.test.mjs` 84 tests, 83 pass, 1 skipped (the manifest test that runs only in the plugin's own repository); `deno task test` 292/292; `deno task check` clean. `deno lint` reports 5 problems, all in the two planted hook files (2 before this change, in the same files); they are not fixed here because the files are not edited here. Nothing in the app changed, so there is nothing for Erez to run in the browser. The fresh-session test of Phase 6 step 3 was not run.

Reviewed by: a read-only Explore subagent, cold, against the staged diff, the plugin's master files and `docs/reviewer.md`. It found two items, recorded below and fixed in this change. It confirmed by `cmp` and `shasum` that the runbook, the four scripts and the manifest equal the plugin's files and their hashes; that every value in `unities.json` other than `run` equals the old block's; that the old compilers equalled Appendices F and K; that Appendices D, E and G did not change; and that D12, D50, D51 and D52 say what they are cited for. It ran `deno task test` (292 pass) and `compile-record --check` (exit 0) itself. It took on trust the scratch-clone comparison, the hook and manifest probes, the changelog dry run and the `node --test` count.

## Review · 2026-11-28

### The record says `run` carries the old values "value for value", but `--allow-write=CHANGELOG.md` was dropped

**Found** — The old gate called the changelog compiler with `--allow-write=CHANGELOG.md`; `run` in `.claude/hooks/unities.json` is the same line without it. Nothing breaks, because the gate only asks for a dry run and the compiler exits before writing. But the record said the configuration holds the old block "value for value", and the second decision said the record check "now runs with the changelog compiler's permissions", when the shared line is narrower than the old changelog call.

**Done when**

- [x] The 2026-11-28 record → names `--allow-write=CHANGELOG.md` as the one value of the old block that is not in `run`, and says the dry run never writes
- [x] The second 2026-11-28 decision → says the shared `run` is the old changelog line less `--allow-write=CHANGELOG.md`
- [x] Every other value carried over (scene, the six rules, required, base, releaseFiles) → still equals the old block, and the record's wording for them is unchanged
- [x] `compile-record.mjs --check` after the task file is edited and recompiled → exits 0

**Not asked** — Adding `--allow-write` to `run`. Editing any planted file.

### The config test maps a path to its first matching role, but the gate matches every role on its own

**Found** — `roleOf` in `tests/unities-config.test.ts` returned the first role whose rule matched. The gate tests each role separately, so a `test` or `doc` rule widened to match a source path would still pass the test while the gate counted a source change as its own test or doc line. The test also named only two of the gate's four files under `.claude/hooks/` as playing no role.

**Done when**

- [x] A `test` rule that also matches `server/rules/score.ts` → `tests/unities-config.test.ts` fails
- [x] A `doc` or `task` rule that also matches a listed source path (`mod.ts`, `front/app.ts`) → it fails
- [x] A `source` rule that also matches `tests/rules.test.ts`, `docs/SPEC.md` or `tasks/03-rules.md` → it fails
- [x] Each listed source, test, doc, task and shared path against the current `unities.json` → matches exactly one role, and the test passes
- [x] `.claude/hooks/check-unit.test.mjs` and `.claude/hooks/unities.manifest.json` → asserted to match no role, beside the other no-role paths
- [x] The current `unities.json` → `deno task test` stays green

**Not asked** — Re-testing the gate's own behaviour under `tests/`. Editing the planted gate or its tests.

Both answered in this same change: `roleOf` is `rolesOf`, every assertion holds a path to exactly its roles, and the first five boxes of the second item were each tried by widening the rule in `unities.json`, seeing the test fail, and restoring the file.
