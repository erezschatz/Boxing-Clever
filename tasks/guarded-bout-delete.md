# Guarded bout delete

## Context

Asked by Erez, 2026-11-03 (D23), replacing the promise of
`tasks/delete-finalised-bout.md`. Built across task 04 (API) and task 08
(dialogs); those tasks' briefs predate it, so its boxes live here.

**Promise.** I can delete any fight, but never by accident: a draft asks me
once, a finalised fight asks twice and lets me choose whether the fighters'
records are reset, and deleting fights never takes the event with them.

**Acceptance.**
- [x] `DELETE /api/bouts/:id`: a draft bout is deleted; a finalised bout needs `?records=reverse` (both records lose the result in the same transaction) or `?records=keep`, else `409 {error}`; the event is never deleted
- [x] Tier-3 tests: reverse moves both records back exactly; keep leaves them; a finalised delete without a choice is `409` and deletes nothing; deleting an event's last bout leaves the event
- [ ] Event page: deleting a draft bout asks "are you sure"; deleting a finalised bout asks "this is a finalised fight, are you sure?", then shows what both fighters' records will become, with *delete and reset the records*, *delete and keep the records*, and *cancel* (back to the fight)
- [ ] Verified by Erez in the browser
