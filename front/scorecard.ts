// The scorecard page's arithmetic and bookkeeping, kept apart from its
// template so the tests can state it (SPEC Testing: lit-html output is not
// tested). The totals are the rules' own (SPEC Scoring §2, §3); what a draft
// save sends is a card the rules accept, or nothing.
import type { Side } from '../server/rules/decisions.ts';
import {
  boutTotal,
  type Card,
  type CardDeduction,
  type CardRound,
  isUnderWay,
  type Result,
  resultEnd,
  roundTotal,
  shapeForResult,
  validateCard,
} from '../server/rules/scoring.ts';
import type { BoutView } from './api.ts';

// What is typed in one round: each side's points, or null while empty.
export type Entry = { a: number | null; b: number | null };
export type Deduction = CardDeduction;

// The note the importer leaves on a deduction whose reason it guessed (D24,
// IMPORT.md); the card marks such a deduction.
export const ASSUMED_NOTE = 'reason assumed (import)';

export function isAssumed(d: { note?: string | null }): boolean {
  return d.note === ASSUMED_NOTE;
}

// What a spot's deductions were for, as the card marks them: a knockdown
// (KD) or a foul (any other reason), as the Numbers sheet coloured them
// (D63; task restyle-scorecard).
export function deductionKinds(deductions: { reason: string }[]): { kd: boolean; foul: boolean } {
  return {
    kd: deductions.some((d) => d.reason === 'knockdown'),
    foul: deductions.some((d) => d.reason !== 'knockdown'),
  };
}

// One row per scheduled round, filled from the saved card (a reload).
export function entriesOf(bout: BoutView): Entry[] {
  const entries: Entry[] = Array.from({ length: bout.scheduled_rounds }, () => ({
    a: null,
    b: null,
  }));
  const held = scoredRounds(bout.card);
  for (const r of bout.card.rounds.slice(0, held)) {
    if (r.round_no >= 1 && r.round_no <= entries.length) {
      entries[r.round_no - 1] = { a: r.a, b: r.b };
    }
  }
  return entries;
}

// How many of a stored card's rounds are scored: all of them, but for a
// draft's round under way (isUnderWay, task kd-in-round-under-way), the 0–0
// row that only carries a knockdown logged before the round was scored. Its
// boxes load empty, and it does not count as a round the server holds.
export function scoredRounds(
  card: Pick<BoutView['card'], 'rounds' | 'deductions' | 'result' | 'is_draft'>,
): number {
  const { rounds } = card;
  const last = rounds.at(-1);
  const whole = { ...card, scheduled_rounds: rounds.length } as Card;
  return last && isUnderWay(whole, last, last.round_no) ? rounds.length - 1 : rounds.length;
}

// What the points box holds as it is typed (SPEC §1: whole points 0–10).
// `points` is null for an empty box; `complete` says the entry cannot grow,
// so focus may move on: any digit but 1, or 10. A lone 1 waits for a 0, or
// for Enter or Tab (D35). Anything else is not points at all.
export function readPoints(
  text: string,
): { ok: true; points: number | null; complete: boolean } | { ok: false } {
  if (text === '') return { ok: true, points: null, complete: false };
  if (!/^\d{1,2}$/.test(text)) return { ok: false };
  const points = Number(text);
  if (points > 10 || (text.length === 2 && text !== '10')) return { ok: false };
  return { ok: true, points, complete: text !== '1' };
}

// Where focus goes once a box is scored (D39, Erez's request, replacing
// D35's "down the same side"): across to the other fighter in the same
// round, unless that box already has a score, and then to the other
// fighter's box in the next round. Scoring forward into empty rounds, the
// card is scored by alternating, whichever side a round was started on.
// Focus only ever moves into an empty box: correcting a score among rounds
// already scored, the next box would be a score, selected, and the next key
// would overwrite it, so focus stays where it is (null). Null after the
// last round too.
export function nextBox(
  entries: Entry[],
  round: number,
  side: Side,
): { round: number; side: Side } | null {
  const other: Side = side === 'A' ? 'B' : 'A';
  const empty = (n: number, s: Side) => {
    const e = entries[n - 1];
    return e !== undefined && (s === 'A' ? e.a : e.b) === null;
  };
  if (empty(round, other)) return { round, side: other };
  if (empty(round + 1, other)) return { round: round + 1, side: other };
  return null;
}

// Running totals while scoring: each side's typed rounds, with the
// deductions, through the rules' own §2 and §3. An empty box counts nothing,
// but a deduction in its round still counts, as it does on the server.
export function runningTotals(entries: Entry[], deductions: Deduction[]) {
  const card = asCard(
    entries.flatMap((e, i) => {
      const counted = e.a !== null || e.b !== null ||
        deductions.some((d) => d.round_no === i + 1);
      return counted ? [{ round_no: i + 1, a: e.a ?? 0, b: e.b ?? 0 }] : [];
    }),
    deductions,
  );
  const round = (n: number, side: Side) => {
    const e = entries[n - 1];
    const typed = side === 'A' ? e.a : e.b;
    const deducted = deductions.some((d) => d.round_no === n && d.side === side);
    return typed === null && !deducted ? null : roundTotal(card, n, side);
  };
  return {
    rounds: entries.map((_, i) => ({ a: round(i + 1, 'A'), b: round(i + 1, 'B') })),
    a: boutTotal(card, 'A'),
    b: boutTotal(card, 'B'),
  };
}

export type DraftBody = {
  rounds: CardRound[];
  deductions: Deduction[];
  result: BoutView['card']['result'];
  judges: BoutView['card']['judges'];
  is_draft: true;
};

// What a draft save sends (D35), or null and why not. A save replaces the
// whole stored card, so it is all or nothing: every typed round goes, from
// round 1 with no gaps, and the card must pass the rules with the
// deductions, judges and result as loaded. The one round that may be held
// back is the last typed one while it has only one side scored, and only
// when the server does not hold it yet: a save never removes a stored round
// unless both its boxes were cleared, and then only from the end. A
// deduction in the round after the last scored goes with that round, 0–0,
// under way. `stored` is how many scored rounds the server holds: the page counts it from the last
// card it sent, which may be newer than the bout it loaded.
export function draftToSave(
  bout: BoutView,
  entries: Entry[],
  deductions: Deduction[],
  stored = scoredRounds(bout.card),
): { body: DraftBody | null; unsaved: string[] } {
  const typed = entries.flatMap((e, i) => (e.a !== null || e.b !== null ? [i + 1] : []));
  const last = typed.at(-1) ?? 0;
  const refuse = (message: string) => ({ body: null, unsaved: [message] });

  const rounds: CardRound[] = [];
  const unsaved: string[] = [];
  for (let n = 1; n <= last; n++) {
    const { a, b } = entries[n - 1];
    if (a !== null && b !== null) {
      rounds.push({ round_no: n, a, b });
      continue;
    }
    if (a === null && b === null) return refuse(`round ${n} is empty, with later rounds scored`);
    if (n < last) return refuse(`round ${n} has one side empty, with later rounds scored`);
    if (n <= stored) return refuse(`round ${n} has one side empty`);
    unsaved.push(`round ${n} is saved once both sides are scored`);
  }

  // A deduction logged in the round after the last one scored (a knockdown
  // before the round is) goes with that round under way, 0–0, so it is kept
  // (isUnderWay, task kd-in-round-under-way). Only a round the server has
  // not held scored: a stored round cleared under its deduction is refused
  // as before (D35). A card with a result has no round under way.
  const next = rounds.length + 1;
  if (
    bout.card.result === null && next > stored && next <= bout.scheduled_rounds &&
    deductions.some((d) => d.round_no === next)
  ) {
    rounds.push({ round_no: next, a: 0, b: 0 });
  }

  const body: DraftBody = {
    rounds,
    deductions,
    result: bout.card.result,
    judges: bout.card.judges,
    is_draft: true,
  };
  const problems = validateCard({
    ...asCard(rounds, deductions, bout.card.result),
    scheduled_rounds: bout.scheduled_rounds,
  });
  if (problems.length > 0) return { body: null, unsaved: problems.map((p) => p.message) };
  return { body, unsaved };
}

// The highest round with anything in it, points or a deduction: whether
// anything is typed (finalCard), and the round a TD or T is offered, its
// last round being on the cards (D22).
export function lastTyped(entries: Entry[], deductions: Deduction[] = []): number {
  const typed = entries.reduce((last, e, i) => (e.a !== null || e.b !== null ? i + 1 : last), 0);
  return Math.max(typed, ...deductions.map((d) => d.round_no));
}

// The round a stopped bout most likely ended in, which the decision dialog
// offers for a stoppage (task stoppage-round): the round after the last one
// scored on both sides, since a stopped round is not scored (D20), unless a
// later round already holds something (a side typed, or a knockdown logged
// as it happened), which is then the one. Never past the scheduled rounds;
// round 1 when nothing is typed. Erez, 2026-11-20: "it's usually a TKO/KO
// in the round"; a corner retirement after round X he changes to X (D55).
export function stoppedRound(entries: Entry[], deductions: Deduction[], scheduled: number): number {
  const scored = entries.reduce((last, e, i) => (e.a !== null && e.b !== null ? i + 1 : last), 0);
  const round = Math.max(scored + 1, lastTyped(entries, deductions));
  return Math.max(1, Math.min(round, scheduled));
}

export type FinalBody = Omit<DraftBody, 'is_draft' | 'result'> & {
  result: Result;
  is_draft: false;
};

// What "End bout" sends: the card shaped by the result as the rules say
// (§4, shapeForResult: the stoppage round 0–0 with its own deductions) and
// checked by them. Nothing typed is dropped quietly: a round with one side
// empty, points typed after the round the bout ended in, or a deduction
// after it are reported for the user to clear or correct (D37). The
// stoppage round itself may be half typed or empty; it becomes 0–0.
export function finalCard(
  bout: BoutView,
  entries: Entry[],
  deductions: Deduction[],
  result: Result,
  judges: BoutView['card']['judges'],
): { body: FinalBody; problems: [] } | { body: null; problems: string[] } {
  const rounds: CardRound[] = entries.flatMap((e, i) =>
    e.a !== null && e.b !== null ? [{ round_no: i + 1, a: e.a, b: e.b }] : []
  );
  const card: Card = {
    scheduled_rounds: bout.scheduled_rounds,
    rounds,
    deductions,
    result,
    is_draft: false,
  };
  const anything = lastTyped(entries, deductions) > 0;
  // An empty card is watched, not scored (D20); otherwise find the end with
  // the stoppage round present, typed or not.
  const end = anything
    ? resultEnd({ ...card, rounds: rounds.length > 0 ? rounds : [{ round_no: 1, a: 0, b: 0 }] })
    : null;
  const problems: string[] = [];
  for (const [i, e] of entries.entries()) {
    const n = i + 1;
    const typed = e.a !== null || e.b !== null;
    if (!typed) continue;
    if (end && n > end.round) {
      problems.push(`round ${n} has points, but the bout ended in round ${end.round}`);
    } else if ((e.a === null || e.b === null) && !(end?.zero && n === end.round)) {
      problems.push(`round ${n} has one side empty`);
    }
  }
  for (const d of deductions) {
    if (end && d.round_no > end.round) {
      problems.push(
        `a deduction in round ${d.round_no}, after the bout ended in round ${end.round}`,
      );
    }
  }
  if (problems.length > 0) return { body: null, problems };

  if (end?.zero && !rounds.some((r) => r.round_no === end.round)) {
    rounds.push({ round_no: end.round, a: 0, b: 0 }); // shapeForResult makes it 0–0 either way
    rounds.sort((x, y) => x.round_no - y.round_no);
  }
  const shaped = { ...card, ...shapeForResult(card) };
  const refused = validateCard(shaped).map((p) => p.message);
  if (refused.length > 0) return { body: null, problems: refused };
  return {
    body: {
      rounds: shaped.rounds,
      deductions: shaped.deductions,
      result,
      judges,
      is_draft: false,
    },
    problems: [],
  };
}

// What "Reopen scoring" sends (D32, D37, D39): the card as it stands,
// result and all, as a draft. The result stays because the card's shape depends
// on it (a KO's last round is 0–0, which only a stoppage allows), so the
// rounds before it can be corrected and the draft still saves; changing
// where the bout ended is "End bout" again.
export function reopenBody(card: BoutView['card']): DraftBody {
  return {
    rounds: card.rounds,
    deductions: card.deductions,
    result: card.result,
    judges: card.judges,
    is_draft: true,
  };
}

function asCard(
  rounds: CardRound[],
  deductions: Deduction[],
  result: Card['result'] = null,
): Card {
  return { scheduled_rounds: rounds.length, rounds, deductions, result, is_draft: true };
}

// The belts a side brought into the bout, and so whether they are champion:
// a title on the line whose holder is that side (SPEC Data model, bout_title).
// Where the page goes once the decision dialog has saved (Erez,
// 2026-11-07): "End bout" is the end of the night's work on this fight, so
// the page goes back to the card; "Change decision" on a bout already
// finalised is a correction, and the page stays. Null means stay.
export function afterDecision(wasFinalised: boolean, eventId: number): string | null {
  return wasFinalised ? null : `/events/${eventId}`;
}

export function beltsOf(bout: BoutView, side: Side): number[] {
  return bout.titles.filter((t) => t.holder_side === side).map((t) => t.title_id);
}

// The TBRB standing on the night (SPEC §7, D25), from the as-of snapshot.
// Before the first save there is no snapshot, and no rank is said; a null
// rank says nothing either, as no list may have been that old.
export function rankOf(bout: BoutView, side: Side): number | null {
  return side === 'A'
    ? (bout.a_won === null ? null : bout.a_tbrb_rank)
    : (bout.b_won === null ? null : bout.b_tbrb_rank);
}
