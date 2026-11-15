# Open questions, 2026-11-03

## Context

Raised 2026-11-03 by recording Erez's answers of the same day
(`tasks/answers-2026-11-03.md`) and the review of that record. Each is for
Erez; each answer becomes a DECISIONS entry (or edits the one named) and
the box is ticked. Until answered, the interim rule stated with each
applies.

**Promise.** Nothing I said in conversation is left half-applied: every
consequence of the answers that still needs my call is asked here, with
what the app does in the meantime.

**Acceptance.**
- [x] **Deleting an event with finalised bouts.** SPEC's rule refuses it. Should it instead run D23's guarded flow, with reset or keep chosen for the records? *Interim: refused.* (D23)
- [x] **"Keep the records" and the recompute.** Keeping the records leaves a result counted with no bout behind it, and `scripts/recompute-records.ts` (D13) rebuilds records from snapshots and bouts, so it would undo the keep. Is the recompute allowed to undo it, or must a kept result be stored (for example as a per-fighter adjustment)? *Interim: nothing stored; the recompute would undo it.* (D23, D13)
- [x] **A 9/9 round in the sheet.** The round's winner was docked a point, but the sheet doesn't say who won the round. Reject, score it 10–9 to one side by some rule, or 10–10 less one point each? *Interim: rejected.* (D24)
- [x] **TBRB on the day of the fight.** Does a list dated the fight day count, or only lists strictly before? *Interim: it counts.* (D25)
- [x] **TBRB lists that are too old.** Across the history gap (April 2024 → now, until back-filled), the last list prior can be many months old. Is there an age past which the fighter shows as "no ranking available" rather than that list's rank? *Interim: no limit.* (D25)
- [x] **RTD's round.** "Ended at 3:00 of round X": round X was fought in full and judged. Score round X normally and end the card there, or keep it 0–0 like a TKO? And should RTD stay its own code, or be entered as TKO? *Interim: like a TKO, round X 0–0, RTD kept as a code.* (D22)
- [x] **Imported TD and T bouts.** Under D22 their last round is scored, but the sheet's stopped-round cell holds a time or a `KO`/`TKO` marker, and v1 stored it 0–0. Import them with that round 0–0 (so they fail §1 if re-saved), score it 10–10, or reject them? *Interim: undecided; tasks 10–11 must not import them until answered.* (D22, IMPORT.md)

## Decisions

### 2026-11-15 · Imported TD and T bouts are rejected to the list

**Decision** — A `TD` or `T` bout from the sheet or from v1 is not imported. It goes on the rejects report, and Erez enters it by hand with its last round scored as D22 requires. This answers the question D22 and IMPORT.md left open.
**Rejected** — Importing that round as 10–10 with a note (it passes §1 but guesses a score); importing it 0–0 as v1 stored it (the card then fails §1 if it is ever saved again).
**Why** — Erez, 2026-11-15: reject to the list. Claude's reason: the sheet's cell for that round holds a time or a `KO`/`TKO` marker, not a score, so anything imported would be invented, and IMPORT.md promises that nothing is guessed.

### 2026-11-15 · A 9/9 round in the sheet is rejected to the list

**Decision** — A sheet round with no 10 on either side (`9`/`9`) is rejected to the list. Erez fixes the sheet or enters that round by hand. D24's knockdown default for rounds under 9 is unchanged. This answers the question D24 left open.
**Rejected** — Scoring it 10–10 less one point each (it passes §1 but changes who won the round); scoring it 10–9 to one side by some rule.
**Why** — Erez, 2026-11-15: reject to the list. Claude's reason: the sheet doesn't say which side won the round, and that can't be read from anything else.

### 2026-11-15 · A retirement is a TKO at 3:00 of the round it followed, and that round is scored (supersedes D20 and D22 in part)

**Decision** — There is no `RTD` code. A corner retirement after round X is entered as a `TKO` at 3:00 of round X, and a TKO at 3:00 has its result round scored (10–9, 9–10 or 10–10) like any other round and ends the card there. Any other TKO keeps D20's 0–0 stoppage round. The importers map v1's and the sheet's `RTD` and `RET` to that shape. Claude added three things to Erez's answer: `RET` (the sheet's other spelling) maps the same way; an imported retirement with no score for round X (v1 stored it 0–0) is rejected to the list, as D53 does for a TD; and the work goes under `tasks/retirement-is-a-tko.md`, before task 10, so the importers map onto it.
**Rejected** — Keeping RTD as a code of its own; keeping round X 0–0 as D22's interim had it; entering a retirement as a TKO in round X+1 at 0:00, which would have kept the rules free of a special case (offered, and not chosen).
**Why** — Erez, 2026-11-15, choosing from the options put to him: score round X, fold RTD into TKO, and enter it as a TKO at 3:00 of round X. The question gave the reason: round X was fought in full and judged. Claude's reading of the rule: a 3:00 TKO is the one stoppage whose round was completed, so it is the one that is scored. This replaces D20's "this holds whichever round convention is used for an RTD" and D22's interim "an RTD is treated like a TKO: its result round is 0–0".
Supersedes: D20, D22

### 2026-11-15 · An event with finalised bouts still can't be deleted

**Decision** — SPEC's rule stands: `DELETE /api/events/:id` answers `409` while any of its bouts is finalised. To delete such an event, each finalised fight is deleted through D23's guarded flow first, then the event.
**Rejected** — Running D23's guarded flow from the event, with one reset-or-keep choice for all its finalised bouts.
**Why** — Erez, 2026-11-15: keep refusing. The option put to him said it is rare, and that the fights can be deleted first, each through its own guarded flow. This answers the question D23 left open.

### 2026-11-15 · A kept result is stored as a per-fighter adjustment

**Decision** — "Delete and keep the records" (D23) stores the kept result as a per-fighter adjustment. `scripts/recompute-records.ts` (D13), when it is written, adds each fighter's adjustments to what it rebuilds, so a kept result survives a recompute. This answers the question D23 left open. Claude added the shape, for `tasks/kept-result-is-stored.md` to build before task 14: the adjustment's five counts (won, lost, draws, nc, kos), written in the delete's transaction, and moved to the target by a merge (D31).
**Rejected** — Storing nothing and letting a recompute undo the keep (the interim).
**Why** — Erez, 2026-11-15: store an adjustment. Claude's reason: a keep is a deliberate choice made in a guarded dialog, and a rare maintenance script shouldn't quietly reverse it.

### 2026-11-15 · A TBRB list dated the fight day counts, and no list is too old

**Decision** — D25's interim becomes the rule: a bout's standing is read from the last list dated on or before the fight date, however old that list is. This answers the two questions D25 left open.
**Rejected** — Only lists strictly before the fight day; an age limit (six months was the one offered) past which the fighter shows as "no ranking available".
**Why** — Erez, 2026-11-15: same day counts, no limit. Claude's note: the gap from April 2024 is then closed by back-filling the history (task 13), not by hiding old lists.

## What was done

2026-11-15. Erez answered all seven questions. Each answer is a decision above, and every box is ticked. `docs/IMPORT.md` now says that TD and T bouts and 9/9 rounds are rejected, that `RTD` and `RET` map to a TKO at 3:00 with that round scored, and that one with no score for that round is rejected. `docs/TBRB.md` states the same-day, no-limit rule. Two answers change the app, and each has a task file of its own with what to build: `tasks/retirement-is-a-tko.md` and `tasks/kept-result-is-stored.md`. The event-delete answer changes nothing, since SPEC already refuses.

The TBRB answers, here and in `tasks/tbrb-rank-across-classes.md` (D59), describe what the code already does, so only comments changed: `server/api/card.ts` (`snapshotOf`), `server/db/tbrb-snapshot.ts` (`rankAsOf`) and `server/api/events.ts` (the event delete) now cite D56, D58 and D59 instead of the open questions. SPEC §7 says the same instead of "for now". A new tier-3 test in `tests/api/weights.test.ts` pins the rank at first save: a rank in another class is unranked, an old list counts, a list dated the fight day counts, and a later list doesn't. `deno task test` 187/187, `deno task check`, `deno fmt --check` and `deno lint` clean. Nothing here needs checking in the browser. `deno task record` compiled D53–D59 into `docs/DECISIONS.md` and the two new tasks into `docs/PLAN.md`, which marks this file done. PLAN's hand-written head still lists this file among the out-of-order work; it can't be edited by hand, and a later decision about placement will replace it. The first box of `tasks/tbrb-rank-across-classes.md` is ticked; its second stays open for tasks 12 and 13.

Reviewed by: a read-only Explore subagent, cold, against the staged diff (found the decisions faithful to Erez's answers; asked that Claude's own additions and reasons be marked as Claude's, that each answer name the decision whose question it closes, that SPEC §7's "for now" go, and that this record name the compiled files; done. It also noted that D23, D24, D25, D32 and D45 still read "open": they are append-only, and the new entries now point back to them).
