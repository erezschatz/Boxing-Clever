// How the pages say things: a fighter's name and record, a date, a title, a
// result. Pure functions, so the tests can state them. Where v1 had a way of
// saying it (BOXING-CLEVER-V1.md), that way is kept.
import { decisionLabel } from '../server/rules/decisions.ts';
import type { FightRecord } from '../server/rules/records.ts';
import type { BoutView, Title } from './api.ts';

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

// "WBC World", or "WBC Interim World": the kind is said only when it is not
// the plain one, "Active" (v1's formatTitles; migration 001 keeps v1's kinds).
export function titleText(t: Title): string {
  const kind = t.status === 'Active' ? '' : `${t.status} `;
  return `${t.sanctioning_body} ${kind}${t.area}`;
}

// The result as the card reads it: who won and how, with the round and time
// of a stoppage. The code goes on the page (SPEC §5); the label is the
// tooltip. A draft or an unfinished bout says so instead.
export function resultText(bout: BoutView, nameA: string, nameB: string): string {
  const { result } = bout.card;
  if (!result) return bout.card.is_draft ? 'draft' : '';
  const when = result.round ? ` ${result.round}${result.time ? ` (${result.time})` : ''}` : '';
  const who = result.winner === 'A' ? nameA : result.winner === 'B' ? nameB : '';
  const how = `${result.decision_type}${when}`;
  const text = who ? `${who} · ${how}` : how;
  return bout.card.is_draft ? `${text} · draft` : text;
}

export function resultLabel(bout: BoutView): string {
  return bout.card.result ? decisionLabel(bout.card.result.decision_type) : '';
}
