# 07 · Front: the scorecard page

## Context

**Promise.** Fight night: I open a bout, type 10 and 9 down the card as rounds end,
focus moving on its own, see the running totals, save a draft if I step
away, and come back to it. Each column shows the fighter's corner colour,
whether they are champion, and which belts they brought.

**Acceptance.**
- [ ] `/bouts/:id` renders the two-column card from `GET /api/bouts/:id`; running totals via `rules/scoring` in the browser
- [ ] Points entry: integer 0–10, focus advances to the next round of the same side after entry; the row being scored and the next are visually marked (v1 behaviour)
- [ ] Deduction cell opens the deduction dialog (task 08 supplies the form; a stub here)
- [ ] Draft save on demand and on leaving the page; reload restores
- [ ] Header per side: name, nickname, corner colour, `(c)` and belt list from `bout_title`, TBRB rank as of the event date when a snapshot exists
- [ ] Imported rounds whose deduction is unknown carry a marker
- [ ] Verified by Erez on a real fight, standalone
