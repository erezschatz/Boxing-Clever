# 14 · Deploy and retire v1

## Context

**Promise.** The new app is the one I use, at its Atrium address, with all the data in
it; the old one is kept but no longer written to.

**Acceptance.**
- [ ] `scripts/deploy.sh` (pull, migrate, build, restart) per SETUP.md; run on the Atrium server
- [ ] Data cut over: final v1 dumps imported (task 10 re-run), rejects zero or accepted
- [ ] v1 pm2 processes stopped; repo noted read-only in BOXING-CLEVER-V1.md
- [ ] `CHANGELOG.md` compiled; version 2.0.0
- [ ] Verified by Erez: a fight scored on the deployed chamber
