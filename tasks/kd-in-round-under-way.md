# A knockdown logged before its round is scored is kept

## Context

Erez, 2026-11-20: "I scored a knockdown for fighter in the second round,
which ended the bout, the KD vanished. I want those to remain if
possible". Asked how, he chose "Store it in the draft".

What happened, from his dev database: bout 4 is a TKO in round 2 at 0:20,
round 2 0–0, no deduction. A deduction may only be in a recorded round
(§4; the schema's foreign key, D18), so the draft holding round 1 and a
knockdown in round 2 was refused whole. Going back to the event card sent
that refused save, coming forward reloaded the card from the server
without the knockdown, and End bout saved what was loaded. End bout
without leaving the page did keep it.

**Promise.** A knockdown logged as it happens survives a save, leaving the
page and a reload, and is on the card when the bout is ended in that
round.

**Acceptance.**
- [x] Round 1 scored, a knockdown in round 2: the draft is saved, with round 2 stored 0–0 under way and the knockdown in it
- [x] Reloading that card: the knockdown is there, round 2's boxes are empty, and the page counts one scored round
- [x] Round 2 half typed: held back as before, the knockdown still saved; round 2 scored: it replaces the round under way
- [x] Ending the bout in round 2: the stoppage round is 0–0 with the knockdown
- [x] A finalised card, a draft with a result (a reopened card), a 0–0 round with no deduction, and a stored round cleared under its deduction are refused or kept as before
- [x] The tests that were there before pass unchanged; new tests state the rule and the whole sequence over HTTP; `deno task test` and `deno task check` run green by Claude

## Decisions

### 2026-11-20 · A draft may end in a round under way, 0–0, holding a deduction logged before it was scored

**Decision** — `isUnderWay` in `server/rules/scoring.ts`: a draft with no result may end in a round recorded 0–0 when at least one deduction is in it. `validateCard` accepts that round, which the 0–0 rule (§1) otherwise refuses, and the schema's foreign key (D18) holds because the round has its rows. The page sends it (`draftToSave`) when a deduction is in the round after the last one scored, the server has not held that round scored, and the card has no result. It loads its boxes empty (`entriesOf`) and is not counted as a stored round (`scoredRounds`, used for the page's count of what the server holds, D35). Scoring the round replaces it; ending the bout in it makes it the §4 stoppage round, 0–0 already. The server's totals count its deduction, as the scorecard's running totals already did; the fighter card's "My card" (`myCardFor`) says nothing for a card whose only row is a round under way, as for any card with no round scored.
**Rejected** — Keeping the knockdown in the browser's storage until its round is scored (Erez chose the server). Dropping D18's foreign key so a deduction could stand without its round. A 0–0 round under way with no deduction, or anywhere but last, or on a card with a result. Sending a stored round cleared under its deduction as under way, which would quietly undo a scored round (D35 refuses it and says why).
**Why** — Erez, 2026-11-20: "I want those to remain if possible", and, of the two ways offered, "Store it in the draft". A knockdown is logged as it happens, before its round is scored, and a draft is the card as it stands; refusing it whole lost the knockdown on leaving the page. The 0–0 row is how the card already writes a round with no points and deductions in it, the stoppage round (§4).

## Review · 2026-11-20

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found these as the record says:
- the rule refusing a finalised card, a draft with a result, a 0–0 round
  with no deduction or not last, and a gap;
- the records (§6), the snapshot (§7), `cardCounts` and the bout PATCH
  unaffected;
- `#stored` counting scored rounds in all three places, and each case it
  walked (half typed, scored, the knockdown removed, a second one, one in
  round 3 with round 2 empty refused as before, a stored round cleared
  under its deduction refused);
- a reload ending in round 2 through `stoppedRound` and `finalCard`;
- a reopened stoppage card unchanged;
- the test diff adding lines only;
- D116 matching this file.

It found two things.

### The fighter page's "My card" now counts a round under way, and can show a negative total

**Found** — `server/api/card.ts`'s totals run over every stored row, the round under way included, and `myCardFor` (`front/format.ts`), shown on the fighter card for drafts too, showed them whenever a row was stored: "10–8" with round 1 scored and a knockdown in round 2, and "0–-1" for a knockdown in round 1 with nothing scored.

**Done when**

- [x] A draft holding only a round under way → "My card" shows "—" on both rows
- [x] Rounds scored plus a round under way → what the decision says, and the task file says which
- [x] A finalised card, a reopened card, a draft with no round under way → as before

**Not asked** — `readCard`'s totals as the scorecard uses them.

Answered in this change: `myCardFor` does not count a round under way
(`isUnderWay`) as a scored round, so a card holding only that shows "—";
with rounds scored it shows the totals with the knockdown, as the scorecard
does, which the decision now says. Tested in `tests/front/shell.test.ts`.

### The record says the whole sequence is tested over HTTP, but two steps never reach the server

**Found** — `tests/front/scorecard.test.ts`: the half-typed and the scored round-2 drafts were checked as `draftToSave`'s output only; `tests/rules/scoring.test.ts` had no case for a lone round 1 under way or one after a gap.

**Done when**

- [x] The half-typed draft sent → 200, reload shows round 2 under way with the knockdown
- [x] The 10–9 draft sent → 200, reload shows round 2 at 10–9 with the knockdown, `scoredRounds` 2
- [x] Rounds 1 and 3, round 3 at 0–0 with a deduction → `no-gaps`
- [x] Only round 1 at 0–0 with a knockdown → accepted

**Not asked** — The rule, `draftToSave`.

Answered in this change: the sequence test sends both drafts and reloads
after each, then puts round 2 back under way for the stoppage; the rules
test adds the lone round 1 and the gap. The gap is checked through the
rules, not over HTTP.

## What was done

2026-11-20. A knockdown logged before its round is scored is saved with
that round under way.

- **Rule** (`server/rules/scoring.ts`): `isUnderWay(card, round, last)`,
  exported; `validateCard` accepts such a round in place of a scored one.
- **Page's bookkeeping** (`front/scorecard.ts`):
  - `scoredRounds(card)`: the stored rounds less a round under way.
  - `entriesOf` fills only the scored rounds, so a round under way loads
    empty.
  - `draftToSave` adds round n+1 at 0–0 when a deduction is in it, n+1 is
    past what the server holds scored and within the schedule, and the card
    has no result. Its default `stored` is `scoredRounds`.
- **Scorecard** (`front/bout-page.ts`): the count of stored rounds is
  `scoredRounds` of the card loaded or sent, not its length.
- **Fighter card** (`front/format.ts`): `myCardFor` does not count a round
  under way as scored (from the review).
- **Docs**: SPEC §4 allows a draft's round under way; SPEC's scorecard
  paragraph says the save keeps such a deduction. `deno task record`
  compiled this file's decision into `docs/DECISIONS.md` as D116 and added
  the task to `docs/PLAN.md`.

Tests: `tests/rules/scoring.test.ts` adds that a draft may end 0–0 with a
deduction, and not mid-card, not without a deduction in it, not with a
result, not finalised. `tests/front/scorecard.test.ts` adds the sequence
over HTTP: round 1 scored and a knockdown in round 2 saved; reloaded with
the knockdown, round 2 empty, one round counted; round 2 half typed, sent
and reloaded still under way with the knockdown; round 2 scored, 10–8
refused and 10–9 sent and reloaded with the knockdown and two rounds
counted; and, back under way, a KO in round 2 stored with the knockdown.
The rules test adds a lone round 1 under way (accepted) and one after a
gap (refused). `tests/front/shell.test.ts` adds that "My card" says
nothing for a card holding only a round under way and counts the
knockdown once rounds are scored. `git diff tests`
adds lines only; the earlier tests, including "a 0–0 round mid-card is
not a valid state … nor in a draft" and "a draft with a deduction … the
typed rounds no longer fit is not sent", pass unchanged.

Verified 2026-11-20 by Claude:
- `deno task test` (229 passed), `deno task check`, `deno lint front` and
  `deno fmt --check` run.
- Not seen in a browser. Logging a knockdown, leaving and coming back, and
  ending the bout in that round are Erez's to check.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); its two findings are answered above
