// What the forms of task 08 make of what is typed: a weight in any unit, a
// fighter found by name, a decision and its round, a judge's card.
// Pure, so the tests can state it (SPEC Testing); the dialogs are templates
// over these.
import {
  decisionFromCards,
  type DecisionType,
  ending,
  type JudgeCard,
  type Winner,
  winnerKind,
} from '../server/rules/decisions.ts';
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
// "alv can" finds Saúl "Canelo" Álvarez. A name typed in full comes first,
// then the shortest names; up to `limit`. Nothing typed finds nobody.
export function findFighters(fighters: Fighter[], query: string, limit = 8): Fighter[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const exact = (f: Fighter) => (isNamed(f, query) ? 0 : 1);
  return fighters
    .map((f) => ({ f, name: fold(fighterName(f)) }))
    .filter(({ name }) => words.every((w) => name.includes(w)))
    .sort((x, y) =>
      exact(x.f) - exact(y.f) || x.name.length - y.name.length || x.name.localeCompare(y.name)
    )
    .slice(0, limit)
    .map(({ f }) => f);
}

// Whether `typed` is this fighter's name in full: first and last, or as the
// list shows it with the nickname, quotes optional; accents, case and
// spacing ignored.
function isNamed(f: Fighter, typed: string): boolean {
  const want = squash(typed);
  return want !== '' &&
    (squash(`${f.first_name} ${f.last_name}`) === want || squash(fighterName(f)) === want);
}

// The one fighter a typed name names exactly, among every fighter; null
// when nobody or more than one fighter has that name.
export function exactFighter(fighters: Fighter[], typed: string): Fighter | null {
  const named = fighters.filter((f) => isNamed(f, typed));
  return named.length === 1 ? named[0] : null;
}

// Every fighter a typed first and last name names in full (isNamed), so
// the fighter form can use them rather than add a duplicate (D43).
export function namedFighters(fighters: Fighter[], first: string, last: string): Fighter[] {
  const typed = `${first} ${last}`;
  return fighters.filter((f) => isNamed(f, typed));
}

// What saving the fighter form does with the name typed (D43). Finding:
// the one fighter with that name is taken, unless it is the other side's
// (the same fighter cannot fight themself, and the other side's details
// must not be written over); two with the name ask which; nobody, add.
// Editing (`selfId`): a name that is someone else's is refused, since
// renaming into it makes two fighters of one name; merging is the way.
export function fighterFor(
  list: Fighter[],
  first: string,
  last: string,
  selfId: number | null,
  otherId: number | null,
): { use: Fighter } | { error: string } | { add: true } {
  const name = `${first.trim()} ${last.trim()}`;
  const named = namedFighters(list.filter((f) => f.id !== selfId), first, last);
  if (named.length === 0) return { add: true };
  if (selfId !== null) {
    return { error: `${name} is already in your list; merge them on the fighters page instead` };
  }
  if (named.length > 1) {
    return { error: `${named.length} fighters are called ${name}; use one from the list above` };
  }
  if (named[0].id === otherId) return { error: `${name} is already the other fighter` };
  return { use: named[0] };
}

export type TypedDetails = {
  nickname: string | null;
  colors: string | null;
  weight: number | null; // pounds (D36)
  weight_unit: WeightUnit | null;
};

// The details typed in the fighter form, read for the API. The weight is
// read in the unit chosen in the form; when a fighter is found in the list
// and the unit was never touched, in that fighter's own unit, so "100"
// typed before the name means 100 kg for a fighter kept in kg, and "9 5 3"
// reads as stone for one kept in stone (D43). A unit counts only with a
// weight: no weight, nothing about it is sent.
export function readDetails(
  typed: { nickname: string; colors: string; weight: string; unit: WeightUnit },
  unitTouched: boolean,
  storedUnit: WeightUnit | null,
): TypedDetails | { error: string } {
  const unit = !unitTouched && storedUnit ? storedUnit : typed.unit;
  const weight = readWeight(typed.weight, unit);
  if ('error' in weight) return weight;
  return {
    nickname: typed.nickname.trim() || null,
    colors: typed.colors.trim() || null,
    weight: weight.pounds,
    weight_unit: weight.pounds === null ? null : unit,
  };
}

// What a fighter already in the list takes from the fighter form when the
// name typed turns out to be theirs (D43, Erez): the weight, unit, colours
// and nickname typed tonight, since a year-old weight or trunk colour is
// not tonight's, but never the record, which the app has kept fight by
// fight. Empty fields keep what is stored. Only what differs is sent.
export function updatesForExisting(stored: Fighter, typed: TypedDetails): Partial<TypedDetails> {
  const patch: Partial<TypedDetails> = {};
  if (typed.nickname !== null && typed.nickname !== stored.nickname) {
    patch.nickname = typed.nickname;
  }
  if (typed.colors !== null && typed.colors !== stored.colors) patch.colors = typed.colors;
  if (
    typed.weight !== null &&
    (typed.weight !== stored.weight || typed.weight_unit !== stored.weight_unit)
  ) {
    patch.weight = typed.weight;
    patch.weight_unit = typed.weight_unit;
  }
  return patch;
}

// The bout form's way to add a fighter, offered whether or not a name has
// been typed. At ringside the name often comes last, and whether the
// fighter is new is not known yet, so the fighter form opens blank and
// finds them in the list as the name goes in (D43); with a name typed, it
// opens with it split into first and last.
export function newFighterLabel(typed: string): string {
  const name = typed.trim();
  return name ? `+ Fighter "${name}"` : '+ Fighter (new, or from your list)';
}

// What the text in one side's search box comes to when the bout form is
// saved, or Enter finds no match (D38): the fighter it names in full, or
// what the user must do. Judged against every fighter, so the list's limit
// and the other side's choice do not hide anyone. `absent` means nobody has
// that name, so Enter may offer to add them.
export function resolveTyped(
  fighters: Fighter[],
  typed: string,
  otherId: number | null,
): { fighter: Fighter } | { error: string; absent: boolean } {
  const text = typed.trim();
  if (text === '') return { error: 'type a name and pick from the list', absent: false };
  const named = fighters.filter((f) => isNamed(f, text));
  if (named.length === 1) {
    if (named[0].id === otherId) {
      return { error: `"${text}" is already the other fighter`, absent: false };
    }
    return { fighter: named[0] };
  }
  if (named.length > 1) {
    return {
      error: `${named.length} fighters are called "${text}"; pick one from the list`,
      absent: false,
    };
  }
  const found = findFighters(fighters, text, Infinity).filter((f) => f.id !== otherId);
  if (found.length > 0) {
    return { error: `pick "${text}" from the list (click, or Enter)`, absent: false };
  }
  return { error: `"${text}" is not in the list; add them with + New fighter`, absent: true };
}

function squash(text: string): string {
  return fold(text).replace(/"/g, '').split(/\s+/).filter(Boolean).join(' ');
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

// What the judges' cards fill into the decision dialog (D41), or null to
// leave the decision as it is. Only while the decision is still the cards'
// to give: one they can produce (UD, SD, MD, MT, D, never the generic DEC,
// a stoppage, a technical result or a no-contest), and not one the user
// chose or the bout already had (`chosen`). Then only once all six totals
// are in.
const FROM_CARDS: DecisionType[] = ['UD', 'SD', 'MD', 'MT', 'D'];
export function fillFromCards(
  code: DecisionType,
  chosen: boolean,
  cards: JudgeCard[],
): { decision_type: DecisionType; winner: Winner } | null {
  if (chosen || !FROM_CARDS.includes(code)) return null;
  return decisionFromCards(cards);
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
