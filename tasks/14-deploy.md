# 14 · Deploy

## Context

**Promise.** The new app is the one I use, at its Atrium address, with all the data in
it.

*Edited 2026-11-07 under D40:* what happens to v1 (kept running, unused,
deleted with its data kept, or anything else) is not part of this task or
of this rewrite's completion. The promise's clause on v1 and the box that
stopped its processes are removed.

**Acceptance.**
- [ ] Mounted in Atrium: symlinked into `chambers/boxing`, registered in `chambers.json`, `hono` and `zod` in Atrium's import map, reachable behind the login, Atrium's session script injecting cleanly (moved from tasks 01 and 06, D16)
- [ ] `scripts/deploy.sh` (pull, migrate, build, restart) per SETUP.md; run on the Atrium server
- [ ] Final data imported: the latest v1 dumps (task 10 re-run), rejects zero or accepted
- [ ] `CHANGELOG.md` compiled; version 2.0.0
- [ ] Verified by Erez: a fight scored on the deployed chamber
