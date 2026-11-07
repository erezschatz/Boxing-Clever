// How the pages say things: a fighter's name and record, a date, a title, a
// result. Pure functions, so the tests can state them. Where v1 had a way of
// saying it (BOXING-CLEVER-V1.md), that way is kept.
import { decisionLabel } from '../server/rules/decisions.ts';
import type { FightRecord } from '../server/rules/records.ts';
import type { BoutView, Title, WeightClass } from './api.ts';

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

export function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

// "WBC World", "WBC World Silver", or "WBC Interim World" (D42: interim is
// the one kind a belt has; vacancy is said per fight, by its holder).
export function titleText(t: Title): string {
  return `${t.sanctioning_body} ${t.interim ? 'Interim ' : ''}${t.area}`;
}

// The result as the card reads it: who won and how, with the round and time
// of a stoppage. The code goes on the page (SPEC §5); the label is the
// tooltip. A bout with no result says nothing, and the page offers to score
// it; a result not yet final (a bout reopened for scoring) says so. The word
// "draft" is the API's, never the page's (D39).
export function resultText(bout: BoutView, nameA: string, nameB: string): string {
  const { result } = bout.card;
  if (!result) return '';
  const when = result.round ? ` ${result.round}${result.time ? ` (${result.time})` : ''}` : '';
  const who = result.winner === 'A' ? nameA : result.winner === 'B' ? nameB : '';
  const how = `${result.decision_type}${when}`;
  const text = who ? `${who} · ${how}` : how;
  return bout.card.is_draft ? `${text} · not final` : text;
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
