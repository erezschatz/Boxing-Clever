# Which TBRB list counts for a bout

## Context

Raised 2026-11-03 while recording D25 and D26; the question is for Erez.
TBRB ranks fighters within one weight class. D25 settles *when*: the last
list before the fight. It leaves open *which class's list*:

- A fighter ranked in one class fights in another (a super middleweight
  champion moving up to light heavyweight). Is their standing for that bout
  their rank in the bout's class (unranked there), or their rank in the
  class they are ranked in (champion at super middleweight)?
- A bout at a contracted weight (D26) has no class. Which list counts?

**Promise.** Every bout shows each fighter's TBRB standing the way I would
read it for that fight, including fights between classes and at contracted
weights.

**Acceptance.**
- [x] Erez's answer recorded as a DECISIONS entry, and TBRB.md updated
- [ ] Rule implemented and tested where the as-of rank is computed (tasks 05, 12, 13)

## Decisions

### 2026-11-15 · A bout's TBRB standing comes from the bout's class only; a contracted-weight bout shows none

**Decision** — A fighter's standing for a bout is read only from the list of the bout's weight class: a super-middleweight champion fighting at light heavyweight is unranked for that fight. A bout at a contracted weight (D26) has no class to read, so it shows no TBRB standing for either fighter and stores none in the snapshot. Claude added that this isn't D25's rejected "unknown" standing: the lists are known, but no class applies. This answers the questions D32 and D45 left open. The code from task 05 already reads the rank this way (tested with this decision); tasks 12 and 13 must keep it.
**Rejected** — The fighter's rank in whatever class they are listed in, with that class named; for a contracted weight, also the lightest class whose limit is at or above the weight (Claude offered both options).
**Why** — Erez, 2026-11-15: the bout's class only, and no ranking at a contracted weight. Claude's reading: a ranking says where a fighter stands in a division, and a fight outside it, or at a weight that belongs to no division, isn't fought from that standing.
