# 12 · TBRB: current rankings

## Context

**Promise.** Every day the app checks tbrb.org and keeps a dated copy whenever a class's
list changes. A fighter's card shows where they stand, a bout shows where
each fighter stood on the night, and names the board spells differently are
mine to link once.

**Acceptance.**
- [ ] `server/tbrb/parse.ts` pure over HTML; fixture of the live page in `tests/fixtures/`
- [ ] `scripts/tbrb-daily.ts`: diff against latest snapshot per class, store only on change, non-zero exit on an empty parse
- [ ] `GET /api/tbrb/current`, `GET /api/tbrb/fighters/:id`; unlinked-names admin page; linking creates the alias and retro-links
- [ ] As-of rank copied into the bout snapshot on finalise; shown on the scorecard header and the fighter card
- [ ] systemd user timer on the Atrium machine (SETUP.md)
- [ ] Verified by Erez: timer ran, a change was captured, a name linked
