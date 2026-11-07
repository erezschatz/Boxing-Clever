// Tier 1: the decision-type table, SPEC Scoring §5. Pure functions, nothing running.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import {
  countsAsKo,
  DECISION_TYPES,
  decisionFromCards,
  decisionLabel,
  ending,
  isDecisionType,
  winnerFits,
  winnerKind,
} from '../../server/rules/decisions.ts';

Deno.test('§5: the thirteen decision codes, and only those', () => {
  deepStrictEqual(
    [...DECISION_TYPES].sort(),
    ['D', 'DEC', 'DQ', 'KO', 'MD', 'MT', 'NC', 'RTD', 'SD', 'T', 'TD', 'TKO', 'UD'],
  );
  assertEquals(isDecisionType('KO'), true);
  assertEquals(isDecisionType('ko'), false);
  assertEquals(isDecisionType('RSC'), false, "the sheet's spellings are the importer's to map");
  assertEquals(isDecisionType('toString'), false);
});

Deno.test('§5: points wins and stoppages have a side as winner', () => {
  for (const code of ['UD', 'MD', 'SD', 'DEC', 'KO', 'TKO', 'RTD', 'TD', 'DQ'] as const) {
    assertEquals(winnerKind(code), 'side', code);
    assertEquals(winnerFits(code, 'A'), true, code);
    assertEquals(winnerFits(code, 'B'), true, code);
    assertEquals(winnerFits(code, 'draw'), false, code);
    assertEquals(winnerFits(code, 'none'), false, code);
  }
});

Deno.test('§5: MT, T and D are draws', () => {
  for (const code of ['MT', 'T', 'D'] as const) {
    assertEquals(winnerKind(code), 'draw', code);
    assertEquals(winnerFits(code, 'draw'), true, code);
    assertEquals(winnerFits(code, 'A'), false, code);
    assertEquals(winnerFits(code, 'none'), false, code);
  }
});

Deno.test('§5: NC has no winner', () => {
  assertEquals(winnerKind('NC'), 'none');
  assertEquals(winnerFits('NC', 'none'), true);
  assertEquals(winnerFits('NC', 'A'), false);
  assertEquals(winnerFits('NC', 'draw'), false);
});

Deno.test('§5: the label comes from the code', () => {
  assertEquals(decisionLabel('UD'), 'Unanimous Decision');
  assertEquals(decisionLabel('TKO'), 'Technical Knockout');
  assertEquals(decisionLabel('MT'), 'Majority Draw');
  assertEquals(decisionLabel('NC'), 'No Contest');
  const labels = DECISION_TYPES.map(decisionLabel);
  assertEquals(new Set(labels).size, labels.length, 'every code has its own label');
});

Deno.test('§4, D20, D22: which decisions end in a stoppage round, and which go to the cards', () => {
  deepStrictEqual(
    DECISION_TYPES.filter((code) => ending(code) === 'stoppage').sort(),
    ['DQ', 'KO', 'RTD', 'TKO'],
  );
  deepStrictEqual(DECISION_TYPES.filter((code) => ending(code) === 'cards').sort(), ['T', 'TD']);
  deepStrictEqual(
    DECISION_TYPES.filter((code) => ending(code) === 'distance').sort(),
    ['D', 'DEC', 'MD', 'MT', 'SD', 'UD'],
  );
  assertEquals(ending('NC'), 'either');
});

Deno.test('§6: KO, TKO and RTD count as knockouts', () => {
  deepStrictEqual(DECISION_TYPES.filter(countsAsKo).sort(), ['KO', 'RTD', 'TKO']);
});

Deno.test('§5, D41: a decision that went the distance follows from the three cards', () => {
  const c = (a: number | null, b: number | null) => ({ a, b });
  const from = (...cards: ReturnType<typeof c>[]) => decisionFromCards(cards);
  deepStrictEqual(from(c(116, 112), c(115, 113), c(117, 111)), {
    decision_type: 'UD',
    winner: 'A',
  });
  deepStrictEqual(from(c(115, 113), c(113, 115), c(114, 115)), {
    decision_type: 'SD',
    winner: 'B',
  });
  deepStrictEqual(from(c(115, 113), c(116, 112), c(113, 115)), {
    decision_type: 'SD',
    winner: 'A',
  });
  deepStrictEqual(from(c(115, 113), c(114, 114), c(116, 112)), {
    decision_type: 'MD',
    winner: 'A',
  });
  deepStrictEqual(from(c(114, 114), c(114, 114), c(113, 115)), {
    decision_type: 'MT',
    winner: 'draw',
  });
  deepStrictEqual(from(c(114, 114), c(114, 114), c(114, 114)), {
    decision_type: 'D',
    winner: 'draw',
  });
  deepStrictEqual(from(c(115, 113), c(113, 115), c(114, 114)), {
    decision_type: 'D',
    winner: 'draw',
  });
  // Either side, every shape.
  deepStrictEqual(from(c(110, 118), c(111, 117), c(112, 116)), {
    decision_type: 'UD',
    winner: 'B',
  });
  deepStrictEqual(from(c(113, 115), c(114, 114), c(112, 116)), {
    decision_type: 'MD',
    winner: 'B',
  });
  deepStrictEqual(from(c(115, 113), c(114, 114), c(114, 114)), {
    decision_type: 'MT',
    winner: 'draw',
  });
  // Nothing until all six totals are in, whichever is missing.
  assertEquals(from(c(115, 113), c(116, 112), c(117, null)), null);
  assertEquals(from(c(115, 113), c(116, 112)), null);
  assertEquals(from(c(null, 113), c(116, 112), c(117, 111)), null);
  assertEquals(from(c(115, 113), c(116, 112), c(117, 111), c(117, 111)), null);
});
