# Merge asks before records move

## Context

Asked by Erez, 2026-11-05 (D31), choosing option 2 from the question D28
left open. After a merge, the duplicate's finalised fights belong to the
target, but the target's record never counted them. A later delete with
"reset the records" would then take off results the target never had.
Built across task 04 (API) and task 08 (dialog). This file holds the boxes
for both.

**Promise.** When I merge a duplicate fighter, I'm shown what will happen
to the real fighter's record before anything changes. It only changes if I
approve, and afterwards I'm told what was done. That way a fight that moved
in a merge can later be deleted with its result reset correctly.

**Acceptance.**
- [x] The duplicate's finalised fights add their results to the target's record on merge, once; the duplicate's typed-in record is still dropped (D28)
- [x] `GET /api/fighters/:id/merge/:targetId` previews it: target record before and after, the duplicate's dropped record, bouts (finalised), aliases and TBRB rows moving
- [x] `POST` needs `?records=add`, else `409` with the preview and nothing changes; it answers with what was done
- [x] The guarded bout delete does the same: its `409` carries the before/after preview, and a finalised delete answers with what it did
- [x] Tier-3 tests: refused without approval, nothing moved; approved merge counts the result; a later reverse returns the target exactly to where it was
- [x] Fighters page (task 08): the merge dialog shows the preview and asks for approval, then says what was done
- [ ] Verified by Erez

## What was done

2026-11-07, with task 08 (D37). The merge dialog, in
`front/merge-form.ts`, opened from "merge…" on each row of `/fighters`. The
row's fighter is the duplicate. You search for the real fighter, and
picking one fetches `GET /fighters/:id/merge/:targetId`. The dialog shows
the target's record before → after, the duplicate's typed-in record marked
dropped, what moves (fights with how many finalised, aliases, TBRB rows),
and "Nothing changes until you approve". *Merge and add the results* posts
`?records=add`, and the dialog then says what was done, with only Close.
*Pick another* goes back to the search. The fighters list is read again
however the dialog closes. `MergePreview` is exported from
`server/api/fighters.ts` for the browser.

Checked by Claude in the desktop app's browser pane on a scratch database:
"O. Usyk" (3-0-0, no fights) merged into Oleksandr Usyk. The preview
showed 22-0-0 → 22-0-0, "3-0-0 (0 KOs) (dropped)", and 0 fights, aliases
and rankings. After approval the list held one Usyk. Not run in the pane:
a merge whose duplicate has finalised fights, so that the record moves.
The API tests (task 04) cover that on the server.

Left open: the last box. Erez has not run it.
