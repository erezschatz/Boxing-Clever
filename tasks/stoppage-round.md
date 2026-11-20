# A stoppage is offered the round after the last one scored

## Context

Erez, 2026-11-20: "When round 1 is scored, and I choose end bout and then
TKO/KO, I think round 2 should be automatically picked rather than round
1. If it's a corner retired, I'll update the round, but it's usually a
TKO/KO in the round".

The decision dialog filled a stoppage's round with the highest round with
anything typed (`lastTyped`). Rounds are scored when they end, so with
round 1 scored a stoppage came in round 2, and the dialog offered round 1.

**Promise.** Ending a bout by a stoppage, the round offered is the one the
fight was stopped in, as it usually is.

**Acceptance.**
- [x] Round 1 scored on both sides, End bout, KO or TKO → the round is 2
- [x] A round half typed, or a knockdown logged in a round after the last scored, → that round
- [x] Nothing typed → round 1; every round scored → the last scheduled round, never past it
- [x] A technical decision or technical draw (TD, T), which goes to the cards, is offered the last round typed, as before; UD and the other points decisions the last scheduled round, and NC nothing, as before
- [x] The round can still be typed over, and a bout with a stored result shows its own round, as before
- [x] `deno task test` and `deno task check` run green by Claude; the tests that were there before pass unchanged

## Decisions

### 2026-11-20 · A stoppage is offered the round after the last one scored, or the round under way

**Decision** — `stoppedRound` in `front/scorecard.ts` gives the round a stoppage is offered: the round after the last one scored on both sides, unless a later round already holds something (one side typed, or a deduction such as a knockdown logged in it), which is then the round; at least 1, at most the scheduled rounds. The bout page passes it to the decision dialog in place of `lastTyped`'s highest typed round. A TD or T keeps `lastTyped`'s round, the last round on the card: its ending is the cards, and that round is scored (D22). `lastTyped` is unchanged.
**Rejected** — The highest round with anything typed (what it was) for a stoppage. The new round for a TD or T, which would be a round with nothing on the card and refused as missing. The last round scored plus one alone, which would pass a knockdown logged in the stopped round and offer the round after it.
**Why** — Erez, 2026-11-20: "it's usually a TKO/KO in the round". A round is scored when it ends and a stopped round is not scored (D20), so the stoppage is in the round after the last scored. A knockdown is logged as it happens, so it marks the round under way. A corner retirement after round X is entered as round X at 3:00 (D55), and Erez types that over.

## Review · 2026-11-20

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found these as the record says:
- each case of `stoppedRound`, and the round it gives saving as a 0–0
  stoppage round through `finalCard` (D20);
- a typed or stored round shown first;
- the points decisions and NC unchanged;
- `lastTyped`'s other caller untouched;
- the test diff adding lines only;
- D111 matching this file.

It found two things.

### A technical decision or technical draw is now offered a round past the last one recorded

**Found** — `front/decision-form.ts`, `roundShown()` used the new round for every code whose round is needed, TD and T among them, whose ending is the cards and whose last round is scored (`cardEnd`, D22). Rounds 1–2 scored, TD: round 3 was offered and refused ("rounds 3–3 are missing").

**Done when**

- [x] Rounds 1–2 scored, TD or T → a round is offered that saves as offered
- [x] Round 3 half typed after 1–2, TD or T → the round offered matches what the card records
- [x] Round 1 scored, KO, TKO or DQ → round 2
- [x] UD, MD, SD, DEC, MT or D → the last scheduled round; NC → blank unless typed
- [x] A typed or stored round → shown first, for every code
- [x] Whether TD and T take the new rule → a decision says so

**Not asked** — `cardEnd`, `shapeForResult`, `validateCard`, new codes.

Answered in this change: the dialog is handed both rounds (`offered`:
`stopped` from `stoppedRound`, `typed` from `lastTyped`), and
`roundShown()` gives a TD or T the typed one. The decision says why. A
test drives `roundShown()` for KO, TKO, DQ, TD, T, UD, NC and a typed
round.

### Comments still say `lastTyped` is what the dialog offers

**Found** — `front/scorecard.ts`, `lastTyped`'s comment said the dialog offers its round; the earlier test's comment "the dialog offers round 1" sits beside `lastTyped`.

**Done when**

- [x] `lastTyped`'s comment → describes its uses now
- [x] The round-1 knockdown test → passes unchanged

**Not asked** — `lastTyped`'s behaviour or its caller.

Answered in this change: the comment names its two uses, whether
anything is typed and a TD's or T's round, which the dialog does offer, so
the earlier test's comment holds again. The test is unchanged.

## What was done

2026-11-20. End bout offers a stoppage the round it was most likely
stopped in.

- **Rule** (`front/scorecard.ts`): `stoppedRound(entries, deductions,
  scheduled)` is new.
- **Scorecard** (`front/bout-page.ts`): `decide()` passes the dialog
  `offered`: the `stopped` round (`stoppedRound`) and the `typed` one
  (`lastTyped`).
- **Dialog** (`front/decision-form.ts`): its constructor's `lastScored`
  becomes `offered`, and `roundShown()` gives a stoppage the stopped round
  and a TD or T the typed one (by `ending`). A typed round and a stored
  result's round come first, as before.
- **Comment** (`front/scorecard.ts`): `lastTyped`'s says what it is used
  for now.
- **Docs**: SPEC's decision dialog line says which round a stoppage is
  offered. `deno task record` compiled this file's decision into
  `docs/DECISIONS.md` and added the task to `docs/PLAN.md`.

Tests: `tests/front/forms.test.ts` adds a test of `stoppedRound`: round 1
scored gives 2, nothing typed 1, a knockdown in round 1 with nothing typed
1, a knockdown in round 2 after round 1 scored 2, a half-typed round 3 gives
3, and every round of four scored gives 4. A second test builds the
dialog and checks `roundShown()` for KO, TKO and DQ (the stopped round), TD
and T (the typed one), UD (the last scheduled), NC (blank) and a typed
round. `git diff tests` adds lines
only; the earlier test's comment "the dialog offers round 1" beside
`lastTyped` holds for `stoppedRound` too.

Verified 2026-11-20 by Claude:
- `deno task test` (222 passed), `deno task check` and `deno lint front`
  run.
- Not seen in a browser. That End bout shows round 2 after round 1 is
  scored is Erez's to check.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); its two findings are answered above
