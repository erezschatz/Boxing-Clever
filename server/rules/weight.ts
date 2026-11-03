// Weight entry and display: v1's six conversions (v1
// front/src/utils/weightConversion.ts), ported behaviour-first. Pounds are the
// unit everything converts through; stone is entered and shown as "S L O"
// (stones, pounds, ounces). Two intended changes from v1 (D21): the exact
// international pound instead of 2.20462, and stone input that is not one to
// three non-negative numbers is unreadable (null) instead of silently 0.
//
// Pure: imports nothing outside server/rules/.

export type WeightUnit = 'lbs' | 'kg' | 'st';

const KG_PER_LB = 0.45359237; // exact, by definition (1959)
const LBS_PER_STONE = 14;
const OZ_PER_LB = 16;

function roundToTwo(n: number): number {
  return Math.round(n * 100) / 100;
}

// "9 5 3" → 131.1875. Missing trailing parts are 0. Each part reads as v1 read
// it (Number(), so ".5" and "1e1" too); a part that is not a non-negative
// number, a fourth part, or nothing at all is null where v1 said 0.
export function parseStoneLbsOz(input: string): number | null {
  const parts = input.trim().split(/\s+/).map(Number);
  const readable = input.trim() !== '' && parts.length <= 3 &&
    parts.every((n) => Number.isFinite(n) && n >= 0);
  if (!readable) return null;
  const [stones, lbs = 0, oz = 0] = parts;
  return stones * LBS_PER_STONE + lbs + oz / OZ_PER_LB;
}

// 131.1875 → "9 5 3", to the nearest ounce.
export function poundsToStoneLbsOz(pounds: number): string {
  const totalOz = Math.round(pounds * OZ_PER_LB);
  const ozPerStone = LBS_PER_STONE * OZ_PER_LB;
  const stones = Math.floor(totalOz / ozPerStone);
  const lbs = Math.floor((totalOz % ozPerStone) / OZ_PER_LB);
  const oz = totalOz % OZ_PER_LB;
  return `${stones} ${lbs} ${oz}`;
}

// A decimal weight in any unit → pounds, two decimals. For "S L O" stone
// entry use parseStoneLbsOz.
export function convertToPounds(weight: number, unit: WeightUnit): number {
  switch (unit) {
    case 'lbs':
      return roundToTwo(weight);
    case 'kg':
      return roundToTwo(weight / KG_PER_LB);
    case 'st':
      return roundToTwo(weight * LBS_PER_STONE);
    default: // as v1: a unit it does not know passes the weight through
      return roundToTwo(weight);
  }
}

// Pounds → a decimal weight in the unit, two decimals. For "S L O" display
// use poundsToStoneLbsOz.
export function convertFromPounds(pounds: number, unit: WeightUnit): number {
  switch (unit) {
    case 'lbs':
      return roundToTwo(pounds);
    case 'kg':
      return roundToTwo(pounds * KG_PER_LB);
    case 'st':
      return roundToTwo(pounds / LBS_PER_STONE);
    default:
      return roundToTwo(pounds);
  }
}

export function formatWeight(weight: number, unit: WeightUnit): string {
  return `${roundToTwo(weight)} ${unit}`;
}

export function getUnitDisplayName(unit: WeightUnit): string {
  switch (unit) {
    case 'lbs':
      return 'Pounds (US)';
    case 'kg':
      return 'Kilograms';
    case 'st':
      return 'Stone (UK)';
    default:
      return unit;
  }
}
