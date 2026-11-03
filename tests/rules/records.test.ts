// Tier 1: how a result moves both records, SPEC Scoring §6.
import { deepStrictEqual, strictEqual as assertEquals, throws } from 'node:assert/strict';
import {
  applyDelta,
  type FightRecord,
  isNoChange,
  recordChange,
  recordDelta,
  reverseDelta,
} from '../../server/rules/records.ts';

const rec = (won = 0, lost = 0, draws = 0, nc = 0, kos = 0): FightRecord => ({
  won,
  lost,
  draws,
  nc,
  kos,
});

Deno.test('§6: KO, TKO and RTD — winner won+1 kos+1, loser lost+1', () => {
  for (const decision_type of ['KO', 'TKO', 'RTD'] as const) {
    deepStrictEqual(recordDelta({ decision_type, winner: 'A' }), {
      a: rec(1, 0, 0, 0, 1),
      b: rec(0, 1),
    }, decision_type);
    deepStrictEqual(recordDelta({ decision_type, winner: 'B' }), {
      a: rec(0, 1),
      b: rec(1, 0, 0, 0, 1),
    }, decision_type);
  }
});

Deno.test('§6: other wins — won+1 / lost+1, no knockout', () => {
  for (const decision_type of ['UD', 'MD', 'SD', 'DEC', 'TD', 'DQ'] as const) {
    deepStrictEqual(recordDelta({ decision_type, winner: 'B' }), {
      a: rec(0, 1),
      b: rec(1),
    }, decision_type);
  }
});

Deno.test('§6: draws — both draws+1', () => {
  for (const decision_type of ['MT', 'T', 'D'] as const) {
    deepStrictEqual(recordDelta({ decision_type, winner: 'draw' }), {
      a: rec(0, 0, 1),
      b: rec(0, 0, 1),
    }, decision_type);
  }
});

Deno.test('§6: NC — both nc+1', () => {
  deepStrictEqual(recordDelta({ decision_type: 'NC', winner: 'none' }), {
    a: rec(0, 0, 0, 1),
    b: rec(0, 0, 0, 1),
  });
});

Deno.test('§6: a result that breaks §5 is refused, not guessed', () => {
  throws(() => recordDelta({ decision_type: 'UD', winner: 'draw' }));
  throws(() => recordDelta({ decision_type: 'D', winner: 'A' }));
});

Deno.test('§6: finalising counts the result once', () => {
  const ko = { decision_type: 'KO' as const, winner: 'A' as const };
  deepStrictEqual(recordChange(null, ko), recordDelta(ko));
  assertEquals(applyDelta(rec(20, 1, 0, 0, 15), recordChange(null, ko).a).kos, 16);
});

Deno.test('§6: re-saving a finalised bout does not double count', () => {
  const ud = { decision_type: 'UD' as const, winner: 'B' as const };
  assertEquals(isNoChange(recordChange(ud, ud)), true);
  deepStrictEqual(recordChange(ud, ud), { a: rec(), b: rec() });
});

Deno.test('§6: editing the result reverses the old and applies the new as one change', () => {
  // Scored a UD to A, then corrected to a TKO to B.
  const before = { decision_type: 'UD' as const, winner: 'A' as const };
  const after = { decision_type: 'TKO' as const, winner: 'B' as const };
  const change = recordChange(before, after);
  deepStrictEqual(change, { a: rec(-1, 1), b: rec(1, -1, 0, 0, 1) });

  const a = rec(10, 2), b = rec(8, 3, 1, 0, 4);
  const counted = {
    a: applyDelta(a, recordDelta(before).a),
    b: applyDelta(b, recordDelta(before).b),
  };
  deepStrictEqual(applyDelta(counted.a, change.a), applyDelta(a, recordDelta(after).a));
  deepStrictEqual(applyDelta(counted.b, change.b), applyDelta(b, recordDelta(after).b));
});

Deno.test('§6: reversing a result undoes it exactly', () => {
  const draw = recordDelta({ decision_type: 'MT', winner: 'draw' });
  const start = rec(5, 5, 5, 5, 5);
  deepStrictEqual(applyDelta(applyDelta(start, draw.a), reverseDelta(draw).a), start);
  deepStrictEqual(recordChange({ decision_type: 'MT', winner: 'draw' }, null), reverseDelta(draw));
});
