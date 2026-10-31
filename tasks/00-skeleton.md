# 00 · Skeleton and documentation

## Context

**Promise.** A repository that a fresh session — human or Claude — can open and
understand without this conversation: what the app is, what is decided, what
comes next, and how the old app did it.

**Acceptance.**
- [ ] `CLAUDE.md`, `docs/SPEC.md`, `docs/DECISIONS.md` (D1–D15), `docs/PLAN.md`, `docs/SETUP.md`, `docs/BOXING-CLEVER-V1.md`, `docs/IMPORT.md`, `docs/TBRB.md`, `tasks/00`–`15`, `tasks/README.md`
- [ ] `docs/UNITIES.md` (the runbook) planted and carried out: commit gate, `scripts/compile-changelog.mjs`, Claude Code bindings
- [ ] `docs/reference/` holds v1's scorecard mock-ups and the Numbers sheet (binary, committed once)
- [ ] `deno.json` with the tasks listed in SETUP.md (they may fail until 01)
- [ ] Pushed to `github.com/erezschatz/Boxing-Clever`; `~/dev/Boxing-Clever-gh` is the clone

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
