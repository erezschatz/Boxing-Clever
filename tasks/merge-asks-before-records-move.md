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
- [ ] Fighters page (task 08): the merge dialog shows the preview and asks for approval, then says what was done
- [ ] Verified by Erez
