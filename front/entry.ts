// What the forms of task 08 make of what is typed: a weight in any unit, a
// fighter found by name, a decision and its round, a judge's card.
// Pure, so the tests can state it (SPEC Testing); the dialogs are templates
// over these.
import { type DecisionType, ending, type Winner, winnerKind } from '../server/rules/decisions.ts';
import {
  convertFromPounds,
  convertToPounds,
  parseStoneLbsOz,
  poundsToStoneLbsOz,
  type WeightUnit,
} from '../server/rules/weight.ts';
import type { Fighter, Title } from './api.ts';
import { fighterName } from './format.ts';

// A weight as typed in its unit, stored in pounds as v1 stored it, with the
// unit kept for entry and display (D36; SPEC Data model, weight + unit).
// Pounds and kilograms are a decimal; stone is typed as v1 did, "S L O"
// (stones, pounds, ounces). Empty is no weight; anything unreadable is an
// error to show.
export function readWeight(
  text: string,
  unit: WeightUnit,
): { pounds: number | null } | { error: string } {
  const t = text.trim();
  if (t === '') return { pounds: null };
  if (unit === 'st') {
    const pounds = parseStoneLbsOz(t);
    if (pounds === null || pounds <= 0) return { error: 'stone is "S L O", e.g. "9 5 3"' };
    return { pounds };
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return { error: `weight in ${unit} is a positive number` };
  return { pounds: convertToPounds(n, unit) }; // two decimals, as it is shown back
}

// The stored pounds back into the box, in the fighter's unit.
export function weightText(pounds: number | null, unit: WeightUnit | null): string {
  if (pounds === null || unit === null) return '';
  return unit === 'st' ? poundsToStoneLbsOz(pounds) : String(convertFromPounds(pounds, unit));
}

// Fighters whose name holds every word typed, any order, accents ignored:
// "alv can" finds Saúl "Canelo" Álvarez. Up to `limit`, best (shortest
// name) first; nothing typed finds nobody.
export function findFighters(fighters: Fighter[], query: string, limit = 8): Fighter[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return fighters
    .map((f) => ({ f, name: fold(fighterName(f)) }))
    .filter(({ name }) => words.every((w) => name.includes(w)))
    .sort((x, y) => x.name.length - y.name.length || x.name.localeCompare(y.name))
    .slice(0, limit)
    .map(({ f }) => f);
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// The winners a decision allows (SPEC §5): a side, a draw, or nobody.
export function winnersFor(code: DecisionType): Winner[] {
  switch (winnerKind(code)) {
    case 'side':
      return ['A', 'B'];
    case 'draw':
      return ['draw'];
    case 'none':
      return ['none'];
  }
}

// The winner once the decision changes: the only one it allows, or the one
// already chosen when it still fits (a KO for A changed to a TKO is still
// A's), else none yet.
export function winnerAfter(code: DecisionType, chosen: Winner | null): Winner | null {
  const allowed = winnersFor(code);
  if (allowed.length === 1) return allowed[0];
  return chosen !== null && allowed.includes(chosen) ? chosen : null;
}

// Whether the form asks for the round the bout ended in. A stopped bout
// needs it (§5); one that went the distance ended in the last scheduled
// round, which the form fills in itself; a no-contest may be either.
export function roundAsked(code: DecisionType): 'needed' | 'last' | 'optional' {
  switch (ending(code)) {
    case 'stoppage':
    case 'cards':
      return 'needed';
    case 'distance':
      return 'last';
    case 'either':
      return 'optional';
  }
}

// A judge's total as typed: empty is unknown, else a whole number of points.
export function readJudge(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  return /^\d{1,3}$/.test(t) ? Number(t) : undefined;
}

// The titles on the line that are not of the bout's class: a heavyweight
// belt left behind when the class was changed to lightweight. The server
// does not check this, so the form does.
export function titlesOffClass(
  lines: { title_id: number }[],
  titles: Title[],
  classId: number,
): Title[] {
  return lines
    .map((l) => titles.find((t) => t.id === l.title_id))
    .filter((t): t is Title => t !== undefined && t.weight_class_id !== classId);
}

// A PATCH carries only what the form changed, so an edit made from a list
// read before a fight was finalised does not write the old record back
// over the new one (D28: the record is correctable, not overwritten).
export function changedFields<T extends Record<string, unknown>>(
  before: Record<string, unknown>,
  after: T,
): Partial<T> {
  const changed: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T & string)[]) {
    if (after[key] !== before[key]) changed[key] = after[key];
  }
  return changed;
}
