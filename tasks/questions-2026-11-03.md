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
- [ ] **Deleting an event with finalised bouts.** SPEC's rule refuses it. Should it instead run D23's guarded flow, with reset or keep chosen for the records? *Interim: refused.* (D23)
- [ ] **"Keep the records" and the recompute.** Keeping the records leaves a result counted with no bout behind it, and `scripts/recompute-records.ts` (D13) rebuilds records from snapshots and bouts, so it would undo the keep. Is the recompute allowed to undo it, or must a kept result be stored (for example as a per-fighter adjustment)? *Interim: nothing stored; the recompute would undo it.* (D23, D13)
- [ ] **A 9/9 round in the sheet.** The round's winner was docked a point, but the sheet doesn't say who won the round. Reject, score it 10–9 to one side by some rule, or 10–10 less one point each? *Interim: rejected.* (D24)
- [ ] **TBRB on the day of the fight.** Does a list dated the fight day count, or only lists strictly before? *Interim: it counts.* (D25)
- [ ] **TBRB lists that are too old.** Across the history gap (April 2024 → now, until back-filled), the last list prior can be many months old. Is there an age past which the fighter shows as "no ranking available" rather than that list's rank? *Interim: no limit.* (D25)
- [ ] **RTD's round.** "Ended at 3:00 of round X": round X was fought in full and judged. Score round X normally and end the card there, or keep it 0–0 like a TKO? And should RTD stay its own code, or be entered as TKO? *Interim: like a TKO, round X 0–0, RTD kept as a code.* (D22)
- [ ] **Imported TD and T bouts.** Under D22 their last round is scored, but the sheet's stopped-round cell holds a time or a `KO`/`TKO` marker, and v1 stored it 0–0. Import them with that round 0–0 (so they fail §1 if re-saved), score it 10–10, or reject them? *Interim: undecided; tasks 10–11 must not import them until answered.* (D22, IMPORT.md)
