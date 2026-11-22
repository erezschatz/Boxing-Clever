// How the pages say things: a fighter's name and record, a date, a title, a
// result. Pure functions, so the tests can state them. Where v1 had a way of
// saying it (BOXING-CLEVER-V1.md), that way is kept.
import { decisionLabel } from '../server/rules/decisions.ts';
import { isUnderWay } from '../server/rules/scoring.ts';
import { applyDelta, type FightRecord, recordChange } from '../server/rules/records.ts';
import {
  convertFromPounds,
  formatWeight,
  poundsToStoneLbsOz,
  type WeightUnit,
} from '../server/rules/weight.ts';
import type { BoutView, Fighter, Title, Venue, WeightClass } from './api.ts';

type Named = { first_name: string; last_name: string; nickname: string | null };

// Tyson "The Gypsy King" Fury, as v1 wrote it.
export function fighterName(f: Named): string {
  const nickname = f.nickname ? `"${f.nickname}"` : null;
  return [f.first_name, nickname, f.last_name].filter(Boolean).join(' ');
}

// W-L-D (N KOs), with the no-contests after when there are any (SPEC Front end).
export function recordText(r: FightRecord): string {
  const kos = r.kos === 1 ? '1 KO' : `${r.kos} KOs`;
  const nc = r.nc > 0 ? `, ${r.nc} NC` : '';
  return `${r.won}-${r.lost}-${r.draws} (${kos})${nc}`;
}

// The letter the fighters page files a last name under: Álvarez under A,
// and '#' when the name does not start with a letter.
export function initialOf(lastName: string): string {
  const first = lastName.trim().charAt(0).normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  return /\p{L}/u.test(first) ? first : '#';
}

// An ISO date as a day, read as a calendar date and never shifted by the
// time zone: '2024-05-18' is 18 May 2024 wherever the laptop is.
export function dateText(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// The months by their three letters, fixed here rather than taken from the
// locale, which gives September as "Sept" in some.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// What an events row shows large (task restyle-events): '2024-05-18' is
// day '18', month 'MAY'. A calendar date, like dateText.
export function dayAndMonth(iso: string): { day: string; month: string } {
  const [, month, day] = iso.split('-').map(Number);
  return { day: String(day), month: MONTHS[month - 1].toUpperCase() };
}

// The line under the events title: "218 nights watched since Nov 2021",
// counted from the dates of every event, and '' when there are none.
export function watchedSince(dates: string[]): string {
  if (dates.length === 0) return '';
  const first = dates.reduce((a, b) => (b < a ? b : a));
  const nights = dates.length === 1 ? '1 night' : `${dates.length} nights`;
  return `${nights} watched since ${MONTHS[Number(first.slice(5, 7)) - 1]} ${yearOf(first)}`;
}

export function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

// "WBC World", "WBC World Silver", or "WBC Interim World" (D42: interim is
// the one kind a belt has; vacancy is said per fight, by its holder).
export function titleText(t: Title): string {
  return `${t.sanctioning_body} ${t.interim ? 'Interim ' : ''}${t.area}`;
}

// Who brought a title into a bout, as the event card and the fighter card
// say it beside the belt: a name, "vacant", or "holder not recorded" for a
// bout that came from v1, which never stored it (D127).
export function holderText(
  holder: 'A' | 'B' | 'vacant' | null,
  nameA: string,
  nameB: string,
): string {
  if (holder === 'A') return nameA;
  if (holder === 'B') return nameB;
  return holder === 'vacant' ? 'vacant' : 'holder not recorded';
}

// The result as the card reads it: who won and how, with the round and time
// of a stoppage. The code goes on the page (SPEC §5); the label is the
// tooltip. A bout with no result says nothing, and the page offers to score
// it; a result not yet final (a bout reopened for scoring) says so. The word
// "draft" is the API's, never the page's (D39).
export function resultText(bout: BoutView, nameA: string, nameB: string): string {
  const text = outcomeText(bout, nameA, nameB);
  return text && bout.card.is_draft ? `${text} · not final` : text;
}

// Who won and how, without saying whether it is final: the event card says
// "not final" on a line of its own (task restyle-event-card).
export function outcomeText(bout: BoutView, nameA: string, nameB: string): string {
  const { result } = bout.card;
  if (!result) return '';
  const who = result.winner === 'A' ? nameA : result.winner === 'B' ? nameB : '';
  const how = howItEnded(bout);
  return who ? `${who} · ${how}` : how;
}

// How far an event's card has got, for the line beside "Add bout": every
// bout, those with no result yet (to score), and those with a result that
// is not final (a bout reopened for scoring, D39).
export function cardCounts(
  bouts: BoutView[],
): { bouts: number; toScore: number; notFinal: number } {
  const toScore = bouts.filter((b) => !b.card.result).length;
  const notFinal = bouts.filter((b) => b.card.result && b.card.is_draft).length;
  return { bouts: bouts.length, toScore, notFinal };
}

// "1 fighter", "48 fighters": the fighters page's count, for the whole list
// and for each letter (task restyle-fighters).
export function fighterCount(n: number): string {
  return n === 1 ? '1 fighter' : `${n} fighters`;
}

// The scorecard's save line in the header is its first words ("Unsaved
// changes", "Progress saved", "Not saved", "Cannot be saved"); what
// follows the first ";" or ":" (which rounds wait, why a save failed) is the
// line's tooltip (task short-save-line).
export function shortStatus(full: string): string {
  return full.split(/[;:]/)[0].trim();
}

// A name without the nickname, as the event card's rows set it large:
// "Tyson Fury".
export function plainName(f: Named): string {
  return `${f.first_name} ${f.last_name}`;
}

// The code with the round and time of a stoppage: "KO 7 (2:14)", "UD".
export function howItEnded(bout: BoutView): string {
  const { result } = bout.card;
  if (!result) return '';
  const when = result.round ? ` ${result.round}${result.time ? ` (${result.time})` : ''}` : '';
  return `${result.decision_type}${when}`;
}

// A weight as the marquee says it, in the unit it was typed in (D36):
// "121.6 lbs", "55.15 kg", "8 st 10 lb" (and the ounces when there are any).
// Nothing when no weight was taken.
export function weightOnTheNight(pounds: number | null, unit: WeightUnit | null): string {
  if (pounds === null || unit === null) return '';
  if (unit !== 'st') return formatWeight(convertFromPounds(pounds, unit), unit);
  const [st, lb, oz] = poundsToStoneLbsOz(pounds).split(' ');
  return `${st} st ${lb} lb${oz === '0' ? '' : ` ${oz} oz`}`;
}

// The fighter card reads every bout from one fighter's side (task
// fighter-card): which side they were, how it went for them, and my card
// with their total first.
export function sideOf(bout: BoutView, fighterId: number): 'A' | 'B' {
  return bout.fighter_a_id === fighterId ? 'A' : 'B';
}

// W, L, D or NC for that side; '' while the bout has no result.
export function outcomeFor(bout: BoutView, side: 'A' | 'B'): 'W' | 'L' | 'D' | 'NC' | '' {
  const result = bout.card.result;
  if (!result) return '';
  if (result.winner === 'draw') return 'D';
  if (result.winner === 'none') return 'NC';
  return result.winner === side ? 'W' : 'L';
}

// "115–111" with that side's total first, or '' when no round was scored
// (a fight watched, not scored, is valid: SPEC Scoring §5). A draft's round
// under way is not a scored round, so a card holding only that says nothing;
// with rounds scored, its deduction counts, as on the scorecard (task
// kd-in-round-under-way).
export function myCardFor(bout: BoutView, side: 'A' | 'B'): string {
  const { totals, rounds } = bout.card;
  const last = rounds.at(-1);
  const underWay = last !== undefined &&
    isUnderWay({ ...bout.card, scheduled_rounds: bout.scheduled_rounds }, last, last.round_no);
  if (rounds.length - (underWay ? 1 : 0) === 0) return '';
  return side === 'A' ? `${totals.a}–${totals.b}` : `${totals.b}–${totals.a}`;
}

export function resultLabel(bout: BoutView): string {
  return bout.card.result ? decisionLabel(bout.card.result.decision_type) : '';
}

// A TBRB rank as the scorecard says it (TBRB.md: 0 is the champion).
export function rankText(rank: number): string {
  return rank === 0 ? 'TBRB champion' : `TBRB #${rank}`;
}

// The side's record from the as-of snapshot (SPEC §7), or null before the
// first save has taken it. The five columns are written together, so the
// first one says whether they are there.
export function recordOnTheNight(bout: BoutView, side: 'a' | 'b'): string | null {
  const s = side === 'a'
    ? { won: bout.a_won, lost: bout.a_lost, draws: bout.a_draws, nc: bout.a_nc, kos: bout.a_kos }
    : { won: bout.b_won, lost: bout.b_lost, draws: bout.b_draws, nc: bout.b_nc, kos: bout.b_kos };
  if (s.won === null) return null;
  return recordText({ won: s.won, lost: s.lost!, draws: s.draws!, nc: s.nc!, kos: s.kos! });
}

// What a scorecard's marquee shows of one side (task marquee-before-save):
// the record, weight and colours on the night, from the snapshot once the
// first save has taken it (§7); before that, the fighter as they stand now,
// which is what that save will take. A finalised bout with no snapshot (an
// import) already counts in the fighter's record, and the save takes it off
// first, so the marquee does too. A side whose fighter is not loaded shows
// only what the snapshot has.
export function standingOnTheNight(
  bout: BoutView,
  side: 'a' | 'b',
  fighter: Fighter | undefined,
): { record: string | null; weight: string; colours: string | null } {
  const taken = (side === 'a' ? bout.a_won : bout.b_won) !== null;
  if (taken || !fighter) {
    return {
      record: recordOnTheNight(bout, side),
      weight: side === 'a'
        ? weightOnTheNight(bout.a_weight, bout.a_weight_unit)
        : weightOnTheNight(bout.b_weight, bout.b_weight_unit),
      colours: side === 'a' ? bout.a_colors : bout.b_colors,
    };
  }
  const result = bout.card.result;
  const counted = bout.is_draft === 0 && result
    ? recordChange({ decision_type: result.decision_type, winner: result.winner }, null)[side]
    : null;
  return {
    record: recordText(counted ? applyDelta(fighter, counted) : fighter),
    weight: weightOnTheNight(fighter.weight, fighter.weight_unit),
    colours: fighter.colors,
  };
}

// The titles a bout is fought for, under its class on the scorecard, as the
// design has it: "WBC World title", "WBC World · IBF World titles"; empty
// when none is at stake.
export function titlesAtStake(bout: BoutView, titles: Map<number, Title>): string {
  const names = bout.titles.map((t) => {
    const title = titles.get(t.title_id);
    return title ? titleText(title) : `title ${t.title_id}`;
  });
  if (names.length === 0) return '';
  return `${names.join(' · ')} ${names.length === 1 ? 'title' : 'titles'}`;
}

// A venue as the pages set it (Erez, 2026-11-22; task venue-name-first):
// the venue's name large, and under it the city, region and country, "Las
// Vegas, NV, USA". A part the migration left empty is left out (D118).
export function placeLines(venue: Venue): { name: string; where: string } {
  return {
    name: venue.name,
    where: [venue.city, venue.region, venue.country].filter(Boolean).join(', '),
  };
}

// The scorecard's crumb: the venue and its city, "O2 Arena, London".
export function venueAndCity(venue: Venue): string {
  return [venue.name, venue.city].filter(Boolean).join(', ');
}

// A venue in one line, every part it has: "O2 Arena, London, UK".
export function venueText(venue: Venue): string {
  return [venue.name, venue.city, venue.region, venue.country].filter(Boolean).join(', ');
}

// A class as the bout form's dropdown offers it, with its limit as v1 showed
// it: "Flyweight (112 lbs / 50.802 kg)". Heavyweight has no limit (D17).
export function classText(c: WeightClass): string {
  return c.lbs === null ? `${c.name} (no limit)` : `${c.name} (${c.lbs} lbs / ${c.kg} kg)`;
}

// What a bout was fought at: its class, or the contracted weight in pounds
// when it was fought at one instead (D26, D45). There is no catchweight class.
export function boutWeightText(
  bout: { weight_class_id: number | null; contracted_weight: number | null },
  classes: Map<number, WeightClass>,
): string {
  if (bout.contracted_weight !== null) return `Contracted at ${bout.contracted_weight} lbs`;
  return bout.weight_class_id === null ? '' : classes.get(bout.weight_class_id)?.name ?? '';
}

// The sides marked as having missed weight, which every page that shows the
// fight highlights (D26). Marked by the user, never computed.
export function missedWeight(
  bout: { missed_weight_a: 0 | 1; missed_weight_b: 0 | 1 },
  side: 'A' | 'B',
): boolean {
  return (side === 'A' ? bout.missed_weight_a : bout.missed_weight_b) === 1;
}

// The words the card and the scorecard put after a side that missed weight,
// or '' when it did not. A quiet note, not a badge: it happens once every
// month or two (D47).
export function missedWeightNote(
  bout: { missed_weight_a: 0 | 1; missed_weight_b: 0 | 1 },
  side: 'A' | 'B',
): string {
  return missedWeight(bout, side) ? '(missed weight)' : '';
}
