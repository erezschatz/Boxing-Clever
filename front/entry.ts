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
import type { Fighter, Title, Venue } from './api.ts';
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

// The venues whose name, city, region or country hold every word typed, in
// any order, accents and case ignored: "vegas" finds the T-Mobile Arena,
// "uk london" the O2 (task venues). Exactly what was typed first, then by
// country, city and name.
export function findVenues(venues: Venue[], query: string, limit = 8): Venue[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const text = (v: Venue) => fold([v.name, v.city, v.region ?? '', v.country].join(' '));
  const exact = (v: Venue) => (squash(v.name) === squash(query) ? 0 : 1);
  return venues
    .filter((v) => words.every((w) => text(v).includes(w)))
    .sort((x, y) =>
      exact(x) - exact(y) || x.country.localeCompare(y.country) ||
      x.city.localeCompare(y.city) || x.name.localeCompare(y.name)
    )
    .slice(0, limit);
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

// Whether the name typed in the form may be saved for a fighter the form
// is about (found, or being edited): a name left as theirs is theirs,
// whoever else shares it (two Joe Smiths are allowed to exist, D43); a
// name changed into someone else's is refused by `fighterFor`. Null when
// the name may be saved.
export function renameProblem(
  list: Fighter[],
  entry: { first_name: string; last_name: string },
  self: Fighter,
  otherId: number | null,
): string | null {
  const first = entry.first_name.trim();
  const last = entry.last_name.trim();
  if (first === self.first_name && last === self.last_name) return null;
  const who = fighterFor(list, first, last, self.id, otherId);
  return 'error' in who ? who.error : null;
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

// The fighter form's boxes, as typed (D44). Strings, since they are what the
// user sees; `readDetails` and `readRecord` make numbers of them.
export type FighterEntry = {
  first_name: string;
  last_name: string;
  nickname: string;
  colors: string;
  weight: string;
  unit: WeightUnit;
  won: string;
  lost: string;
  draws: string;
  nc: string;
  kos: string;
};
export type RecordCounts = { won: number; lost: number; draws: number; nc: number; kos: number };
// In the order the boxes are laid out: KOs beside the wins they are part
// of, as v1's form had them (Erez, 2026-11-07).
export const RECORD_KEYS = ['won', 'kos', 'lost', 'draws', 'nc'] as const;
const RECORD_WORDS = { won: 'Won', lost: 'Lost', draws: 'Drawn', nc: 'NC', kos: 'KOs' };

// The record as typed: five whole numbers, or which box is not one.
export function readRecord(entry: FighterEntry): RecordCounts | { error: string } {
  const counts = {} as RecordCounts;
  for (const k of RECORD_KEYS) {
    if (!/^\d+$/.test(entry[k].trim())) return { error: `${RECORD_WORDS[k]} is a whole number` };
    counts[k] = Number(entry[k]);
  }
  return counts;
}

function recordOf(r: RecordCounts): RecordCounts {
  return { won: r.won, lost: r.lost, draws: r.draws, nc: r.nc, kos: r.kos };
}

function sameRecord(x: RecordCounts, y: RecordCounts): boolean {
  return RECORD_KEYS.every((k) => x[k] === y[k]);
}

// What the fighter form shows once the name typed turns out to be a
// fighter in the list (D44): the form stays open and becomes theirs. Their
// name goes in the name boxes. Tonight's nickname, colours and weight stay
// as typed, and an empty box keeps what is stored (D43); the unit shown is
// theirs unless one was chosen, which is how `readDetails` reads it. The
// record boxes take their stored record, since the app keeps it fight by
// fight; the record typed off the broadcast is kept beside it when it
// differs, for the user to take with a click or leave. Zeros were not
// typed, so they are not offered back.
export function fieldsOnFound(
  typed: FighterEntry,
  unitTouched: boolean,
  stored: Fighter,
): { fields: FighterEntry; typedRecord: RecordCounts | null } {
  const read = readRecord(typed);
  const typedRecord = 'error' in read ||
      sameRecord(read, stored) ||
      RECORD_KEYS.every((k) => read[k] === 0)
    ? null
    : read;
  return {
    fields: {
      ...typed,
      first_name: stored.first_name,
      last_name: stored.last_name,
      unit: unitTouched ? typed.unit : stored.weight_unit ?? typed.unit,
      ...recordStrings(recordOf(stored)),
    },
    typedRecord,
  };
}

// "Not him": the form is a new fighter's again. The name and record go back
// to what was typed before the find; the details typed since stay, since
// they are tonight's whoever it is.
export function fieldsUnfound(current: FighterEntry, before: FighterEntry): FighterEntry {
  return {
    ...current,
    first_name: before.first_name,
    last_name: before.last_name,
    won: before.won,
    lost: before.lost,
    draws: before.draws,
    nc: before.nc,
    kos: before.kos,
  };
}

export function recordStrings(r: RecordCounts): Pick<FighterEntry, typeof RECORD_KEYS[number]> {
  return {
    won: String(r.won),
    lost: String(r.lost),
    draws: String(r.draws),
    nc: String(r.nc),
    kos: String(r.kos),
  };
}

// What saving the form sends for a fighter it found (D44): the name and
// the record only where they were changed, since a change there is a
// deliberate correction (D28), and tonight's details by D43's rule
// (`updatesForExisting`: typed replaces, empty keeps). Nothing to send is
// an empty patch, and the fighter is taken as they are.
export function patchForFound(
  stored: Fighter,
  entry: FighterEntry,
  unitTouched: boolean,
): { patch: Record<string, unknown> } | { error: string } {
  const details = readDetails(entry, unitTouched, stored.weight_unit);
  if ('error' in details) return details;
  const record = readRecord(entry);
  if ('error' in record) return record;
  const named = { first_name: entry.first_name.trim(), last_name: entry.last_name.trim() };
  return {
    patch: {
      ...changedFields(stored as unknown as Record<string, unknown>, { ...named, ...record }),
      ...updatesForExisting(stored, details),
    },
  };
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
// belt left behind when the class was changed to lightweight. A bout at a
// contracted weight has no class (`classId` null), so every belt is off it:
// a title is fought for at its class's limit. The server does not check
// this, so the form does.
export function titlesOffClass(
  lines: { title_id: number }[],
  titles: Title[],
  classId: number | null,
): Title[] {
  return lines
    .map((l) => titles.find((t) => t.id === l.title_id))
    .filter((t): t is Title => t !== undefined && t.weight_class_id !== classId);
}

// What the bout form's weight comes to (D26, D45): the class chosen, or the
// contracted weight typed in pounds, the other null, as the API takes them.
// A contracted weight is required once chosen, and is a positive number.
export function readBoutWeight(
  by: 'class' | 'contracted',
  classId: number,
  contracted: string,
):
  | { weight_class_id: number; contracted_weight: null }
  | { weight_class_id: null; contracted_weight: number }
  | { error: string } {
  if (by === 'class') return { weight_class_id: classId, contracted_weight: null };
  if (contracted.trim() === '') return { error: 'type the contracted weight in lbs' };
  const weight = readWeight(contracted, 'lbs');
  // Read to the hundredth, so "0.001" comes out as 0, which is no weight.
  if ('error' in weight || weight.pounds === null || weight.pounds <= 0) {
    return { error: 'the contracted weight is a positive number of lbs' };
  }
  return { weight_class_id: null, contracted_weight: weight.pounds };
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

// A whole number stepped by the arrow keys, as a number box's arrows would
// step it (task arrow-keys): up or down one, kept within min and max; an
// empty box starts at `start`. Anything that is not a whole number is left
// alone (null), so a half-typed weight or time is never rewritten.
export function stepped(
  text: string,
  by: 1 | -1,
  { min, max = Infinity, start = min }: { min: number; max?: number; start?: number },
): string | null {
  const t = text.trim();
  if (t === '') return String(Math.min(Math.max(start, min), max));
  if (!/^\d+$/.test(t)) return null;
  return String(Math.min(Math.max(Number(t) + by, min), max));
}

// A score box stepped (task arrow-keys): between 10 and 9, the only points a
// round gives (§1), an empty box at 10. A lone 1 is a 10 being typed (D35),
// so Up makes it 10.
export function steppedPoints(text: string, by: 1 | -1): string | null {
  if (text.trim() === '1') return by === 1 ? '10' : '9';
  return stepped(text, by, { min: 9, max: 10, start: 10 });
}

// Up or Down alone: with a modifier held (Shift to select, Cmd or Alt to
// jump the caret) or while composing, the keys keep the browser's meaning.
export function stepKey(event: KeyboardEvent): 1 | -1 | 0 {
  if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.isComposing) {
    return 0;
  }
  return event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
}
