# Boxing Clever v1 — the predecessor

v1 is the NestJS + React app this repo replaces. It is the reference for
*behaviour* ("what did the old app do when…") and for the data to import;
none of its code is ported line by line.

## Where it is

- Repo: `ssh://git@phorge.erezschatz.net:2222/source/Boxing-Clever.git`
  (branch `boxing`). Local clone: `~/dev/Boxing-Clever`. **Read-only from
  this project.**
- Still in daily use, served by pm2 (`ecosystem.config.cjs`): API on :8888,
  front on :9012, MySQL `boxing` and MongoDB `boxing-scores` on localhost.
- Its `CLAUDE.md` is thorough and worth reading once. Its
  `docs/cutting-weight.html` was a dependency audit and diet (Part I,
  executed Sept 2026) with an unexecuted plan for an in-place port (Part II)
  and a test plan (Part III). Only Part III's *content* carries over — the
  tier model and the stoppage rule — as SPEC.md's Scoring and Testing.
- `docs/reference/` here holds copies of its scorecard mock-ups
  (`new-card.png`, `Boxing-Scorecards.jpg`) and the logo grid.

## History

Express + React → NestJS + React (to try the stack) → **v2, this repo**
(Atrium chamber, Deno + Hono + lit-html, SQLite). The dual MySQL + Mongo
design was likewise chosen to try dual databases (D4).

## What v1 got right (carry over the behaviour)

| Behaviour | Where in v1 | Lands in |
|---|---|---|
| Scorecard: two columns, points · deds · total per round, focus moves down after entry | `front/src/components/RoundRow.tsx`, `BoutPage.tsx` | task 07 |
| Deduction dialog per round with reason and points | `Modals/DeductionForm.tsx` | task 08 |
| Decision dialog: type, winner, round, time, three judges' cards | `Modals/DecisionModal.tsx` | task 08 |
| Draft save mid-bout, reload restores the card | `utils/api.ts` (`is_draft`), `BoutScoreService.upsert` | task 05, 07 |
| Pre-fight snapshot of both fighters denormalised into the score document | `BoutScoreService.enrichBoutScoreData` | `bout` as-of columns (D4), task 05 |
| Record update on first finalise only; KO/TKO count kos | `BoutScoreService.updateFighterStats` | `rules/records.ts`, task 05 — made transactional |
| Fighter merge repointing bouts and rankings in one transaction | `FighterService.merge` (raw SQL already) | task 04, plus aliases |
| Fighters grouped by last-name initial, W-L-D (N KOs, N NC) | `FighterList.tsx` | task 06 |
| Events list collapsible, newest first; new-event row first | `EventList.tsx` | task 06 |
| Weight entry in lbs / kg / st-lbs-oz with conversion | `utils/weightConversion.ts` (pure, six functions) | `rules/weight.ts`, task 03 — port the behaviour, write the tests first |
| Native `<dialog>` modals | `components/Modal.tsx` | task 06 |
| 18 weight classes seeded | `server/src/weight-class/data.sql` | migration 001 |

## What v1 got wrong (fixed by construction, not ported)

- **Stoppage round** (three defects in `DecisionModal.handleSave`): the
  stoppage round was dropped (`maxRound = officialRound - 1`), a legitimate
  `0` was rewritten to `10` (`score || 10`), and a clean 0–0 stoppage round
  was skipped. SPEC Scoring §4 states the rule; tier-1 tests enforce it.
- **Decision type recovered from the display label** ("Unanimous Decision"
  → `UD`). The wire carries the code (SPEC §5).
- **Record increments not transactional** — four separate `increment()`
  calls. One transaction (SPEC §6).
- **Missing resource → 200 with empty body.** 404 (D5).
- **Router with no URLs.** Real URLs (task 06).
- **Mobile navbar never worked** (Bootstrap JS never loaded). Not relevant:
  no Bootstrap (SPEC Front end).
- **TBRB module was a placeholder**: a CRUD table and an hourly cron whose
  body was a `console.log`, and the cron was never registered. Nothing to
  port; TBRB.md starts over.
- **No tests.** Zero files.

## v1 data to import (task 10)

MySQL `boxing`: `event`, `fighter`, `weight_class`, `title`, `bout_detail`,
`bout_title`, `tbrb_ranking` (expected empty). MongoDB `boxing-scores`,
collection `boutscores`: one document per scored bout with `bout_id`,
denormalised `event`, `weight_class`, `titles`, `fighters.fighterA/B`
(with `record`), `scheduled_rounds`, `rounds[]` (`fighterA/B.round_score`,
`total_score`, `deductions[]` as strings), `bout_totals`, `result`
(`time`, `round`, `decision.{type,winner}`, `judges_scores.ref_1..3`),
`is_draft`. v1 data starts where the sheet ends (Nov 2025 schema; fights
from ~mid 2025). Bouts present in both sources: the sheet wins for the
record snapshot, v1 for the scorecard — see IMPORT.md.

Note v1's `deductions` are strings; the importer parses `"<points> <reason>"`
and rejects what it cannot.
