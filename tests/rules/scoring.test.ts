// Tier 1: SPEC Scoring §1–4 and the card checks that follow from §5. One
// test per statement; the KO-in-round-2 worked example exactly as SPEC states.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import {
  boutTotal,
  type Card,
  type CardDeduction,
  type CardRound,
  type Result,
  roundTotal,
  validateCard,
} from '../../server/rules/scoring.ts';

const r = (round_no: number, a: number, b: number): CardRound => ({ round_no, a, b });
const kd = (round_no: number, side: 'A' | 'B'): CardDeduction => ({
  round_no,
  side,
  points: 1,
  reason: 'knockdown',
});
const result = (
  decision_type: Result['decision_type'],
  winner: Result['winner'],
  round: number | null = null,
  time: string | null = null,
): Result => ({
  decision_type,
  winner,
  round,
  time,
});

function card(over: Partial<Card> = {}): Card {
  return {
    scheduled_rounds: 12,
    rounds: [],
    deductions: [],
    result: null,
    is_draft: true,
    ...over,
  };
}

// The rule names a card breaks; [] means it is valid.
const broken = (c: Card) => [...new Set(validateCard(c).map((p) => p.rule))].sort();

const twelveRounds = Array.from({ length: 12 }, (_, i) => r(i + 1, 10, 9));

Deno.test('§1: a scored round is 10–9, 9–10 or 10–10', () => {
  deepStrictEqual(broken(card({ rounds: [r(1, 10, 9), r(2, 9, 10), r(3, 10, 10)] })), []);
});

Deno.test('§1: 10–8 and lower are not points; they are deductions', () => {
  deepStrictEqual(broken(card({ rounds: [r(1, 10, 8)] })), ['points']);
  deepStrictEqual(broken(card({ rounds: [r(1, 9, 9)] })), ['points']);
  deepStrictEqual(broken(card({ rounds: [r(1, 11, 9)] })), ['points']);
  deepStrictEqual(broken(card({ rounds: [r(1, 9.5, 10)] })), ['points']);
  deepStrictEqual(
    broken(card({ rounds: [{ round_no: 1, a: '10', b: '9' } as unknown as CardRound] })),
    ['points'],
    'points are numbers, not strings',
  );
  // the 10–8 round, entered the way §1 says
  const tenEight = card({ rounds: [r(1, 10, 9)], deductions: [kd(1, 'B')] });
  deepStrictEqual(broken(tenEight), []);
  assertEquals(roundTotal(tenEight, 1, 'B'), 8);
});

Deno.test('§2: a round total is points less that side’s deductions in that round', () => {
  const c = card({
    rounds: [r(1, 10, 9), r(2, 10, 9)],
    deductions: [
      kd(1, 'B'),
      kd(1, 'B'),
      { round_no: 1, side: 'A', points: 2, reason: 'low blow', note: 'second warning' },
      kd(2, 'A'),
    ],
  });
  assertEquals(roundTotal(c, 1, 'A'), 8);
  assertEquals(roundTotal(c, 1, 'B'), 7);
  assertEquals(roundTotal(c, 2, 'A'), 9, 'a deduction counts only in its own round');
  assertEquals(roundTotal(c, 2, 'B'), 9);
});

Deno.test('§3: a bout total is the sum of round totals over recorded rounds', () => {
  const c = card({ rounds: [r(1, 10, 9), r(2, 9, 10), r(3, 10, 9)], deductions: [kd(3, 'B')] });
  assertEquals(boutTotal(c, 'A'), 29);
  assertEquals(boutTotal(c, 'B'), 27);
  assertEquals(boutTotal(card(), 'A'), 0, 'an empty card totals 0');
});

Deno.test('§4 worked example: KO in round 2 after a knockdown', () => {
  // Round 1 scored normally; round 2 is the stoppage round, 0–0, carrying the
  // knockdown; rounds 3–12 are not recorded.
  const c = card({
    rounds: [r(1, 10, 9), r(2, 0, 0)],
    deductions: [kd(2, 'B')],
    result: result('KO', 'A', 2, '2:44'),
    is_draft: false,
  });
  deepStrictEqual(validateCard(c), []);
  assertEquals(roundTotal(c, 2, 'A'), 0);
  assertEquals(roundTotal(c, 2, 'B'), -1, 'points 0, total −1 — not a 10–8 round');
  assertEquals(boutTotal(c, 'A'), 10);
  assertEquals(boutTotal(c, 'B'), 8);
});

Deno.test('§4: a clean stoppage round is 0–0 with nothing in it', () => {
  const c = card({
    rounds: [r(1, 10, 9), r(2, 10, 10), r(3, 0, 0)],
    result: result('TKO', 'B', 3, '1:10'),
    is_draft: false,
  });
  deepStrictEqual(broken(c), []);
});

Deno.test('§4: the stoppage round is never scored on the 10-point system', () => {
  const scored = card({
    rounds: [r(1, 10, 9), r(2, 10, 8)],
    result: result('KO', 'A', 2),
    is_draft: false,
  });
  deepStrictEqual(broken(scored), ['stoppage-round']);
  // v1's falsy-zero defect read a 0 as 10: a 10–0 stoppage round is just as wrong
  deepStrictEqual(broken(card({ ...scored, rounds: [r(1, 10, 9), r(2, 10, 0)] })), [
    'stoppage-round',
  ]);
});

Deno.test('§4: rounds after the stoppage are not recorded', () => {
  const c = card({
    rounds: [r(1, 10, 9), r(2, 0, 0), r(3, 10, 9)],
    result: result('KO', 'A', 2),
    is_draft: false,
  });
  deepStrictEqual(broken(c), ['after-stoppage']);
});

Deno.test('§4: the stoppage round itself is recorded — v1 dropped it', () => {
  const c = card({
    rounds: [r(1, 10, 9)], // v1's maxRound = officialRound - 1
    deductions: [],
    result: result('KO', 'A', 2),
    is_draft: false,
  });
  deepStrictEqual(broken(c), ['no-gaps']);
});

Deno.test('§4: no gaps — every round up to the last has a row', () => {
  deepStrictEqual(broken(card({ rounds: [r(1, 10, 9), r(3, 10, 9)] })), ['no-gaps']);
  deepStrictEqual(broken(card({ rounds: [r(2, 10, 9)] })), ['no-gaps']);
  deepStrictEqual(broken(card({ rounds: [r(1, 10, 9), r(1, 9, 10)] })), ['no-gaps']);
  deepStrictEqual(broken(card({ rounds: [r(2, 10, 9), r(1, 10, 9)] })), [], 'in any order');
  deepStrictEqual(
    broken(card({ scheduled_rounds: 4, rounds: [1, 2, 3, 4, 5].map((n) => r(n, 10, 9)) })),
    ['no-gaps'],
    'none beyond the schedule',
  );
});

Deno.test('§4: a 0–0 round mid-card is not a valid state', () => {
  deepStrictEqual(broken(card({ rounds: [r(1, 10, 9), r(2, 0, 0), r(3, 10, 9)] })), ['points']);
  deepStrictEqual(
    broken(card({ rounds: [r(1, 10, 9), r(2, 0, 0)] })),
    ['points'],
    'nor in a draft',
  );
});

Deno.test('§4: a deduction belongs to a recorded round', () => {
  deepStrictEqual(broken(card({ rounds: [r(1, 10, 9)], deductions: [kd(2, 'A')] })), ['deduction']);
  deepStrictEqual(
    broken(card({
      rounds: [r(1, 10, 9), r(2, 0, 0)],
      deductions: [kd(3, 'B')],
      result: result('KO', 'A', 2),
    })),
    ['deduction'],
    'none after the stoppage round',
  );
});

Deno.test('§1: deductions are whole points with a known reason', () => {
  const rounds = [r(1, 10, 9)];
  const base: CardDeduction = { round_no: 1, side: 'A', points: 1, reason: 'holding' };
  deepStrictEqual(broken(card({ rounds, deductions: [{ ...base, points: 0 }] })), ['deduction']);
  deepStrictEqual(broken(card({ rounds, deductions: [{ ...base, points: 1.5 }] })), ['deduction']);
  deepStrictEqual(
    broken(card({ rounds, deductions: [{ ...base, reason: 'biting' as 'other' }] })),
    ['deduction'],
  );
  for (const reason of ['knockdown', 'low blow', 'holding', 'headbutt', 'other'] as const) {
    deepStrictEqual(broken(card({ rounds, deductions: [{ ...base, reason }] })), [], reason);
  }
});

Deno.test('a points decision goes the distance', () => {
  const full = card({ rounds: twelveRounds, result: result('UD', 'A', 12), is_draft: false });
  deepStrictEqual(broken(full), []);
  deepStrictEqual(broken({ ...full, result: result('SD', 'B') }), [], 'the round may be left out');
  deepStrictEqual(broken({ ...full, rounds: twelveRounds.slice(0, 11) }), ['distance']);
  deepStrictEqual(broken({ ...full, result: result('UD', 'A', 11) }), ['result-round']);
  deepStrictEqual(
    broken({ ...full, rounds: [...twelveRounds.slice(0, 11), r(12, 0, 0)] }),
    ['points'],
    'no 0–0 round in a decision',
  );
  deepStrictEqual(broken({ ...full, result: result('D', 'draw', 12) }), [], 'a draw too');
});

Deno.test('a stoppage needs the round it ended in, within the schedule', () => {
  const c = card({ rounds: [r(1, 10, 9), r(2, 0, 0)], is_draft: false });
  // without the round, the 0–0 round cannot be told from a mis-scored one either
  assertEquals(broken({ ...c, result: result('TKO', 'A') }).includes('result-round'), true);
  assertEquals(broken({ ...c, result: result('TKO', 'A', 13) }).includes('result-round'), true);
  for (const code of ['KO', 'TKO', 'RTD', 'TD', 'DQ'] as const) {
    deepStrictEqual(broken({ ...c, result: result(code, 'B', 2) }), [], code);
  }
  deepStrictEqual(broken({ ...c, result: result('T', 'draw', 2) }), [], 'a technical draw');
  // a stoppage in the last scheduled round is still a stoppage
  const last = card({
    scheduled_rounds: 3,
    rounds: [r(1, 10, 9), r(2, 10, 9), r(3, 0, 0)],
    result: result('KO', 'A', 3, '2:59'),
    is_draft: false,
  });
  deepStrictEqual(broken(last), []);
});

Deno.test('a no-contest may be stopped or go the distance (D20)', () => {
  const stopped = card({
    rounds: [r(1, 10, 9), r(2, 0, 0)],
    result: result('NC', 'none', 2, '0:40'),
    is_draft: false,
  });
  deepStrictEqual(broken(stopped), [], 'an accidental clash in round 2');
  const overturned = card({
    rounds: twelveRounds,
    result: result('NC', 'none', 12),
    is_draft: false,
  });
  deepStrictEqual(broken(overturned), [], 'a result overturned after the fight');
  deepStrictEqual(broken({ ...stopped, result: result('NC', 'A', 2) }), ['winner']);
  // an NC is one shape or the other, never a mix
  deepStrictEqual(
    broken(
      card({ rounds: twelveRounds.slice(0, 3), result: result('NC', 'none'), is_draft: false }),
    ),
    ['distance'],
    'not stopped, so all rounds',
  );
  deepStrictEqual(
    broken(
      card({ rounds: twelveRounds.slice(0, 2), result: result('NC', 'none', 5), is_draft: false }),
    ),
    ['no-gaps'],
    'ended in round 5, so rounds 3–5 are missing',
  );
  deepStrictEqual(
    broken(card({ rounds: twelveRounds, result: result('NC', 'none', 3), is_draft: false })),
    ['after-stoppage', 'stoppage-round'],
    'ended in round 3, so nothing after it',
  );
});

Deno.test('§5: the winner must be one the decision allows', () => {
  const c = card({ rounds: twelveRounds, is_draft: false });
  deepStrictEqual(broken({ ...c, result: result('UD', 'draw') }), ['winner']);
  deepStrictEqual(broken({ ...c, result: result('MT', 'A') }), ['winner']);
  deepStrictEqual(broken({ ...c, result: result('NC', 'B') }), ['winner']);
  deepStrictEqual(broken({ ...c, result: result('Unanimous Decision' as 'UD', 'A') }), [
    'decision',
  ]);
});

Deno.test('the result decides the bout, not the totals', () => {
  // The viewer's card can disagree with the judges; that is the point of keeping it.
  const c = card({
    rounds: twelveRounds,
    result: result('SD', 'B', 12),
    is_draft: false,
  });
  deepStrictEqual(broken(c), []);
});

Deno.test('a stoppage time is m:ss within a three-minute round', () => {
  const c = card({ rounds: [r(1, 0, 0)], is_draft: false });
  for (const time of ['0:01', '2:44', '3:00']) {
    deepStrictEqual(broken({ ...c, result: result('KO', 'A', 1, time) }), [], time);
  }
  for (const time of ['3:01', '2:60', '244', '02:44', 'KO']) {
    deepStrictEqual(broken({ ...c, result: result('KO', 'A', 1, time) }), ['result-time'], time);
  }
});

Deno.test('a draft needs no result; a finalised card does', () => {
  deepStrictEqual(broken(card({ rounds: [r(1, 10, 9)] })), []);
  deepStrictEqual(broken(card({ rounds: [r(1, 10, 9)], is_draft: false })), ['finalise']);
});

Deno.test('an unscored card is valid with any result (D20)', () => {
  deepStrictEqual(broken(card({ result: result('UD', 'A', 12), is_draft: false })), []);
  deepStrictEqual(broken(card({ result: result('KO', 'B', 4, '1:02'), is_draft: false })), []);
  deepStrictEqual(
    broken(card({ result: result('TKO', 'A'), is_draft: false })),
    [],
    'round unknown',
  );
  deepStrictEqual(broken(card({ deductions: [kd(1, 'A')] })), ['deduction'], 'but no deductions');
});

Deno.test('scheduled rounds are 1–15', () => {
  deepStrictEqual(broken(card({ scheduled_rounds: 0 })), ['scheduled-rounds']);
  deepStrictEqual(broken(card({ scheduled_rounds: 16 })), ['scheduled-rounds']);
  deepStrictEqual(broken(card({ scheduled_rounds: 15 })), []);
});
