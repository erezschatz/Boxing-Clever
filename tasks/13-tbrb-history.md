# 13 · TBRB: history tool

## Context

**Promise.** I can paste a past rankings page — from tbrb.org's archive or an
archive.org capture — give it its date, and the app files it as if it had
scraped it then. Walking the 2023–2026 gap is minutes per page, not an
evening.

**Acceptance.**
- [ ] `POST /api/tbrb/snapshots` with `{date, html|url}` through the same parser
- [ ] A small page to paste/submit and see what was parsed before committing it
- [ ] Historical bouts' snapshot rank back-filled by a script from the snapshots that now exist
- [ ] Verified by Erez on at least three archive pages across the gap
