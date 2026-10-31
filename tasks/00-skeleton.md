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
