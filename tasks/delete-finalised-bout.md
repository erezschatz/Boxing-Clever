# Deleting a finalised bout

## Context

Found 2026-11-02 by the review of task 02. A finalised bout has moved both
fighters' stored records (SPEC Scoring §6, D13). SPEC says `DELETE
/api/events/:id` refuses when any bout is finalised, but it states no rule
for `DELETE /api/bouts/:id`, and the schema lets a bout go (directly, or by
cascade from its event) without reversing that increment. Then the stored
record drifts out of step with the bouts until `scripts/recompute-records.ts`
runs.

**Promise.** Deleting a bout I already finalised never leaves a fighter's
record counting a fight that is no longer there.

**Acceptance.**
- [x] SPEC states what `DELETE /api/bouts/:id` does with a finalised bout: ~~refuse, or reverse the record in the same transaction~~ — *answered 2026-11-03 by D23*: the user chooses reverse or keep, after two confirmations
- [x] ~~A tier-3 test states it~~ — moved to `tasks/guarded-bout-delete.md`
- [x] ~~Settled before or within task 04 (bouts API) or task 05 (finalise)~~ — settled by D23 before task 04

## What was done

2026-11-03. Answered by Erez and recorded as D23, which supersedes this
task's promise: a finalised bout can be deleted with its result kept in
the records, because the user may choose that. SPEC *API* and *Front end*
state the flow. The building and its tests continue in
`tasks/guarded-bout-delete.md`; this task closes here.

