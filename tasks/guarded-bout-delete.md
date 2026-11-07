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
- [x] Event page: deleting a draft bout asks "are you sure"; deleting a finalised bout asks "this is a finalised fight, are you sure?", then shows what both fighters' records will become, with *delete and reset the records*, *delete and keep the records*, and *cancel* (back to the fight)
- [ ] Verified by Erez in the browser

## What was done

2026-11-07, with task 08 (D37). The event page's dialogs, in
`front/bout-delete.ts`, opened from each bout row's "delete" in
`front/event-page.ts`. A draft asks "Delete … ? Its card goes with it" and
deletes on Delete (204). A finalised bout asks "This is a finalised fight
(…). Are you sure?". On "Yes, go on" it sends the delete with no choice,
takes the 409's `preview`, and shows both records now and if reset, with
*Delete and reset the records* (disabled, with the reason, when
`reverse_possible` is false), *Delete and keep the records* and *Cancel*.
It then says what was done: the records before and now. The page reads the
card again however the dialog closes. The preview types (`DeletePreview`,
`DeleteDone`) are now exported from `server/api/bouts.ts`, so the browser
reads the server's own shapes.

Checked by Claude in the desktop app's browser pane on a scratch database:
- A finalised KO (Usyk 23-0-0 (15 KOs), Fury 34-1-1) showed both
  questions, then "Now / If reset" with 22-0-0 (14 KOs) and 34-0-1.
- *Delete and reset* deleted the bout and set both records back; the event
  stayed, "No bouts on this card yet".
- A draft bout went after the single question.

Found and fixed during that run: the done step's table read "Now / Now"
(now "Before / Now"), and it still offered Cancel (a dialog that has done
its work now only closes). Not run in the pane: *Delete and keep*, and the
reverse-impossible case. The API tests (task 04) cover both on the server.

Left open: the last box. Erez has not run it.
