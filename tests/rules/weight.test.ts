// Tier 1: weight entry and display, v1's six conversions ported behaviour-first
// (front/src/utils/weightConversion.ts in v1). Two intended changes, D21: the
// exact pound, and unreadable stone input is null rather than 0.
import { strictEqual as assertEquals } from 'node:assert/strict';
import {
  convertFromPounds,
  convertToPounds,
  formatWeight,
  getUnitDisplayName,
  parseStoneLbsOz,
  poundsToStoneLbsOz,
} from '../../server/rules/weight.ts';

const near = (actual: number, expected: number, within: number, what: string) =>
  assertEquals(Math.abs(actual - expected) <= within, true, `${what}: ${actual} vs ${expected}`);

Deno.test('to pounds: lbs as is, kg and st converted, two decimals', () => {
  assertEquals(convertToPounds(147, 'lbs'), 147);
  assertEquals(convertToPounds(125.456, 'lbs'), 125.46);
  assertEquals(convertToPounds(72, 'kg'), 158.73);
  assertEquals(convertToPounds(90.718, 'kg'), 200);
  // D21: the exact pound. v1's 2.20462 gave 212.3 here.
  assertEquals(convertToPounds(96.3, 'kg'), 212.31);
  assertEquals(convertToPounds(10, 'st'), 140);
  assertEquals(convertToPounds(10.5, 'st'), 147);
});

Deno.test('from pounds: to kg and st for display, two decimals', () => {
  assertEquals(convertFromPounds(147, 'lbs'), 147);
  assertEquals(convertFromPounds(158.73, 'kg'), 72);
  assertEquals(convertFromPounds(200, 'kg'), 90.72);
  assertEquals(convertFromPounds(140, 'st'), 10);
  assertEquals(convertFromPounds(147, 'st'), 10.5);
});

Deno.test('kg and st round-trip through pounds within a hundredth', () => {
  for (const kg of [47.6, 61.2, 72, 76.2, 90.7, 113.4]) {
    near(convertFromPounds(convertToPounds(kg, 'kg'), 'kg'), kg, 0.01, `${kg} kg`);
  }
  for (const st of [8, 9.5, 10.25, 14]) {
    near(convertFromPounds(convertToPounds(st, 'st'), 'st'), st, 0.01, `${st} st`);
  }
});

Deno.test('stone entry "S L O" reads as pounds; missing parts are 0', () => {
  assertEquals(parseStoneLbsOz('9 5 3'), 131.1875);
  assertEquals(parseStoneLbsOz('9 5'), 131);
  assertEquals(parseStoneLbsOz('9'), 126);
  assertEquals(parseStoneLbsOz('  10   12  8 '), 152.5);
  assertEquals(parseStoneLbsOz('9 0 8'), 126.5);
  assertEquals(parseStoneLbsOz('9 .5'), 126.5, 'parts read as numbers, as in v1');
  assertEquals(parseStoneLbsOz('5.'), 70);
});

Deno.test('stone entry that is not 1–3 numbers is unreadable, not 0 (D21)', () => {
  for (const input of ['', '   ', 'nine', '9 st', '9 5 3 1', '-9 5', '9 x 3']) {
    assertEquals(parseStoneLbsOz(input), null, JSON.stringify(input));
  }
});

Deno.test('pounds show as "S L O", to the nearest ounce', () => {
  assertEquals(poundsToStoneLbsOz(131.1875), '9 5 3');
  assertEquals(poundsToStoneLbsOz(126), '9 0 0');
  assertEquals(poundsToStoneLbsOz(131.19), '9 5 3');
  assertEquals(poundsToStoneLbsOz(139.99), '10 0 0', 'rounding carries into the stone');
});

Deno.test('stone round-trips: "S L O" → pounds → "S L O"', () => {
  for (const slo of ['9 5 3', '10 12 8', '14 0 0', '7 13 15']) {
    assertEquals(poundsToStoneLbsOz(parseStoneLbsOz(slo)!), slo);
  }
});

Deno.test('a weight shows with its unit, to two decimals', () => {
  assertEquals(formatWeight(158.734, 'lbs'), '158.73 lbs');
  assertEquals(formatWeight(72, 'kg'), '72 kg');
});

Deno.test('an unknown unit passes through, as in v1', () => {
  const unknown = 'stone' as 'st';
  assertEquals(convertToPounds(140.456, unknown), 140.46);
  assertEquals(convertFromPounds(140.456, unknown), 140.46);
  assertEquals(getUnitDisplayName(unknown), 'stone');
});

Deno.test('each unit has a display name', () => {
  assertEquals(getUnitDisplayName('lbs'), 'Pounds (US)');
  assertEquals(getUnitDisplayName('kg'), 'Kilograms');
  assertEquals(getUnitDisplayName('st'), 'Stone (UK)');
});
