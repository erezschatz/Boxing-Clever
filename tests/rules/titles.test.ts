// Tier 1: who holds a title as witnessed, SPEC Scoring §8.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import { holderAfter, type TitleLine, titlesHeld } from '../../server/rules/titles.ts';

const USYK = 1;
const FURY = 2;
const JOSHUA = 3;
const WBC = 10;
const WBO = 11;

// Usyk on the A side, Fury on the B side, the WBC on the line.
const line = (fields: Partial<TitleLine>): TitleLine => ({
  title_id: WBC,
  holder_side: 'A',
  winner: 'A',
  fighter_a_id: USYK,
  fighter_b_id: FURY,
  missed_weight_a: 0,
  missed_weight_b: 0,
  ...fields,
});

Deno.test('§8: the winner of a finalised bout takes every title on the line', () => {
  assertEquals(holderAfter(line({ holder_side: 'A', winner: 'B' })), FURY);
  assertEquals(holderAfter(line({ holder_side: 'A', winner: 'A' })), USYK);
  assertEquals(holderAfter(line({ holder_side: 'vacant', winner: 'B' })), FURY);
});

Deno.test('§8: a draw or a no contest leaves a title with the side that brought it in', () => {
  for (const winner of ['draw', 'none'] as const) {
    assertEquals(holderAfter(line({ holder_side: 'A', winner })), USYK, winner);
    assertEquals(holderAfter(line({ holder_side: 'B', winner })), FURY, winner);
    assertEquals(holderAfter(line({ holder_side: 'vacant', winner })), null, winner); // stays vacant
  }
});

Deno.test('§8: a side that missed weight can neither take a title nor keep it: it goes vacant', () => {
  // The challenger came in heavy and won.
  assertEquals(holderAfter(line({ holder_side: 'A', winner: 'B', missed_weight_b: 1 })), null);
  assertEquals(holderAfter(line({ holder_side: 'vacant', winner: 'A', missed_weight_a: 1 })), null);
  // The holder came in heavy and won, or drew, or the bout was a no contest.
  assertEquals(holderAfter(line({ holder_side: 'A', winner: 'A', missed_weight_a: 1 })), null);
  for (const winner of ['draw', 'none'] as const) {
    assertEquals(holderAfter(line({ holder_side: 'B', winner, missed_weight_b: 1 })), null, winner);
  }
  // The holder came in heavy and lost: the challenger made weight and takes it.
  assertEquals(holderAfter(line({ holder_side: 'A', winner: 'B', missed_weight_a: 1 })), FURY);
  // A draw where only the challenger missed: the holder keeps it.
  assertEquals(holderAfter(line({ holder_side: 'A', winner: 'draw', missed_weight_b: 1 })), USYK);
});

Deno.test('§8: the last finalised bout with a title decides, whoever fought in it', () => {
  const won = line({ holder_side: 'vacant', winner: 'A' }); // Usyk wins the vacant WBC
  // A later bout for the WBC between Fury and Joshua: Usyk had lost it or
  // vacated it off-screen, and holds it no longer.
  const later = line({ holder_side: 'vacant', winner: 'B', fighter_a_id: JOSHUA });
  deepStrictEqual(titlesHeld(USYK, [won]), [WBC]);
  deepStrictEqual(titlesHeld(USYK, [won, later]), []);
  deepStrictEqual(titlesHeld(FURY, [won, later]), [WBC]);
});

Deno.test('§8: titles held are the ones left with that fighter, in the order first seen', () => {
  const lines = [
    line({ title_id: WBO, holder_side: 'B', winner: 'draw' }), // Fury keeps the WBO
    line({ title_id: WBC, holder_side: 'A', winner: 'A' }), // Usyk keeps the WBC
  ];
  deepStrictEqual(titlesHeld(USYK, lines), [WBC]);
  deepStrictEqual(titlesHeld(FURY, lines), [WBO]);
  deepStrictEqual(titlesHeld(JOSHUA, lines), []);
  deepStrictEqual(titlesHeld(USYK, []), []);
});

Deno.test('§8, D127: with the holder not recorded a winner still takes the title, and a draw leaves it with nobody known', () => {
  assertEquals(holderAfter(line({ holder_side: null, winner: 'A' })), USYK);
  assertEquals(holderAfter(line({ holder_side: null, winner: 'B' })), FURY);
  assertEquals(holderAfter(line({ holder_side: null, winner: 'B', missed_weight_b: 1 })), null);
  for (const winner of ['draw', 'none'] as const) {
    assertEquals(holderAfter(line({ holder_side: null, winner })), null, winner);
  }
  // Usyk won it in a bout that named a holder; a later draw that names none
  // is the last word on the belt, and it does not say whose it is.
  const won = line({ holder_side: 'B', winner: 'A' });
  deepStrictEqual(titlesHeld(USYK, [won]), [WBC]);
  deepStrictEqual(titlesHeld(USYK, [won, line({ holder_side: null, winner: 'draw' })]), []);
});
