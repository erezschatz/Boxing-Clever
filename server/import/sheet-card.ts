// One bout of the Numbers sheet read as a card this app would accept
// (IMPORT.md, Source A; task 11). The two fighters' rows give the rounds,
// the stoppage, the result and the judges; the colours file gives the reason
// of a deduction the sheet folded into a round (D24, D63, D65). The card then
// passes the rules PUT /api/bouts/:id/card applies, or the bout is refused
// with the reason. Nothing is guessed but the one marked reason (D24).
//
// How the sheet says who won, as measured: the winner's row carries the
// `Decision` cell, and after a stoppage it carries the time (or `KO`/`TKO`)
// in the round's cell, where the other row has `x`.
//
// Pure: no I/O.
import {
  decisionFromCards,
  type DecisionType,
  ending,
  type JudgeCard,
  type Side,
  type Winner,
  winnerKind,
} from '../rules/decisions.ts';
import { type Card, type CardDeduction, type CardRound, validateCard } from '../rules/scoring.ts';
import type { SheetFighterRow } from './sheet-rows.ts';

export type Colour = 'red' | 'blue';
// The coloured round cells, by `line:round` (sheet-colours.csv; D64).
export type Colours = Map<string, Colour>;
export type Judges = [JudgeCard, JudgeCard, JudgeCard];
export type SheetCard = { card: Card; judges: Judges };

// The `Decision` column's spellings as this app's codes. A retirement is a
// TKO at 3:00 of the last round fought (D55). A technical decision or draw
// is refused, for Erez to enter with its last round scored (D53).
const CODES: Record<string, DecisionType | 'retired' | 'technical'> = {
  UD: 'UD',
  MD: 'MD',
  SD: 'SD',
  DEC: 'DEC',
  KO: 'KO',
  TKO: 'TKO',
  RSC: 'TKO', // referee stopped contest
  RTD: 'retired',
  RET: 'retired',
  DQ: 'DQ',
  NC: 'NC',
  D: 'D',
  DRAW: 'D',
  TD: 'technical',
  TUD: 'technical',
  TSD: 'technical',
  MTD: 'technical',
};

const FOUL = { reason: 'other' as const, note: 'foul (red in the sheet)' };
const KNOCKDOWN = { reason: 'knockdown' as const, note: null };
const ASSUMED = { reason: 'knockdown' as const, note: 'reason assumed (import)' };

type Cells = { scores: number[]; stop: string | null; scheduled: number };

// A row's twelve cells: the rounds scored, then the stoppage's time or
// marker if this row has it, then `x` to the scheduled distance, then blank.
function readCells(row: SheetFighterRow): Cells | null {
  const scores: number[] = [];
  let stop: string | null = null;
  let i = 0;
  while (i < 12 && /^\d+$/.test(row.cells[i])) scores.push(Number(row.cells[i++]));
  if (i < 12 && /^(\d+:\d\d|KO|TKO)$/i.test(row.cells[i])) stop = row.cells[i++];
  while (i < 12 && row.cells[i].toLowerCase() === 'x') i++;
  const scheduled = i;
  while (i < 12 && row.cells[i] === '') i++;
  return i === 12 ? { scores, stop, scheduled } : null;
}

const wholeNumber = (text: string): number | null => /^\d+$/.test(text) ? Number(text) : null;

// The result the two `Decision` cells give: the code, and the row it sits on.
function readDecision(
  a: string,
  b: string,
): { code: DecisionType; retired: boolean; row: Side | 'both' } | { problem: string } {
  if (a === '' && b === '') return { problem: 'the sheet gives no decision' };
  // `3` and `0`: the cards won, which is a unanimous decision for the 3.
  if ((a === '3' && b === '0') || (a === '0' && b === '3')) {
    return { code: 'UD', retired: false, row: a === '3' ? 'A' : 'B' };
  }
  if (a !== '' && b !== '' && a.toUpperCase() !== b.toUpperCase()) {
    return { problem: `the decision is "${a}" on one row and "${b}" on the other` };
  }
  const text = a !== '' ? a : b;
  const code = CODES[text.toUpperCase()];
  if (!code) return { problem: `decision "${text}" is not one the import knows` };
  if (code === 'technical') {
    return {
      problem: `a technical decision (${text}): enter it by hand with its last round scored (D53)`,
    };
  }
  const row = a !== '' && b !== '' ? 'both' : a !== '' ? 'A' : 'B';
  return code === 'retired' ? { code: 'TKO', retired: true, row } : { code, retired: false, row };
}

export function sheetCard(
  a: SheetFighterRow,
  b: SheetFighterRow,
  colours: Colours,
): SheetCard | { problems: string[] } {
  const refuse = (...problems: string[]) => ({ problems });
  const ca = readCells(a);
  const cb = readCells(b);
  if (!ca || !cb) {
    return refuse('the round cells are not rounds scored, then a stoppage, then x');
  }
  if (ca.scheduled !== cb.scheduled || ca.scheduled === 0) {
    return refuse('the two rows do not agree on how many rounds were scheduled');
  }
  if (ca.scores.length !== cb.scores.length) {
    return refuse('the two rows do not have the same rounds scored');
  }
  for (const [row, cells] of [[a, ca], [b, cb]] as const) {
    const sum = cells.scores.reduce((x, y) => x + y, 0);
    if (wholeNumber(row.total) !== sum) {
      return refuse(`${row.name}: the rounds add up to ${sum}, and the Total says ${row.total}`);
    }
  }

  const decided = readDecision(a.decision, b.decision);
  if ('problem' in decided) return refuse(decided.problem);
  const { code, retired } = decided;
  const kind = winnerKind(code);
  const how = ending(code);

  // The judges' totals, where both rows have one for a judge. The sheet's
  // own card is Erez's and may go the other way, but the three judges'
  // cards, where the sheet has them, decide who won.
  const judges = [0, 1, 2].map((i): JudgeCard => {
    const [ja, jb] = [wholeNumber(a.refs[i]), wholeNumber(b.refs[i])];
    return ja !== null && jb !== null ? { a: ja, b: jb } : { a: null, b: null };
  }) as Judges;
  const official = how === 'distance' ? decisionFromCards(judges) : null;

  // The stoppage's cell, which is on the winner's row.
  const stopRow: Side | null = ca.stop !== null ? 'A' : cb.stop !== null ? 'B' : null;
  const stop = ca.stop ?? cb.stop;
  if (ca.stop !== null && cb.stop !== null) return refuse('both rows carry a stoppage');

  let winner: Winner;
  if (kind !== 'side') winner = kind;
  else if (decided.row !== 'both') winner = decided.row;
  else if (official && (official.winner === 'A' || official.winner === 'B')) {
    // The decision typed on both rows: the judges' cards say whose it was,
    winner = official.winner;
  } else if (how !== 'distance' && stopRow !== null) {
    winner = stopRow; // or, after a stoppage, the row that carries its cell.
  } else {
    return refuse(
      `a ${code} on both rows, and ` +
        (how === 'distance' ? "no judges' cards" : 'no stoppage cell') + ' to say who won',
    );
  }
  if (official && official.winner !== winner) {
    return refuse(
      `the Decision cell says ${code}` +
        (winner === 'A' ? ` for ${a.name}` : winner === 'B' ? ` for ${b.name}` : '') +
        `, and the judges' cards say ${official.decision_type}` +
        (official.winner === 'A'
          ? ` for ${a.name}`
          : official.winner === 'B'
          ? ` for ${b.name}`
          : ''),
    );
  }

  // Rounds and the deductions folded into them (D24, D63, D65).
  const rounds: CardRound[] = [];
  const deductions: CardDeduction[] = [];
  for (let i = 0; i < ca.scores.length; i++) {
    const round_no = i + 1;
    const sides = [
      { side: 'A' as const, score: ca.scores[i], colour: colours.get(`${a.line}:${round_no}`) },
      { side: 'B' as const, score: cb.scores[i], colour: colours.get(`${b.line}:${round_no}`) },
    ];
    if (sides.some((s) => s.score < 5 || s.score > 10)) {
      return refuse(`round ${round_no}: ${sides[0].score}–${sides[1].score} is not a score`);
    }
    // With a 10 in the round a side's base is 9. With none, the side in red
    // was docked from 10 and so won it; who that is must be said (D65).
    const docked = sides.every((s) => s.score < 10) ? sides.filter((s) => s.colour === 'red') : [];
    if (sides.every((s) => s.score < 10) && docked.length !== 1) {
      return refuse(
        `round ${round_no}: ${sides[0].score}–${sides[1].score} has no 10, and the sheet's ` +
          'colours do not say who was docked (D65)',
      );
    }
    const points = { A: 0, B: 0 };
    for (const s of sides) {
      const base = s === docked[0] ? 10 : Math.max(9, s.score);
      points[s.side] = base;
      const why = s === docked[0] || s.colour === 'red'
        ? FOUL
        : s.colour === 'blue'
        ? KNOCKDOWN
        : ASSUMED;
      for (let n = s.score; n < base; n++) {
        deductions.push({ round_no, side: s.side, points: 1, ...why });
      }
    }
    rounds.push({ round_no, a: points.A, b: points.B });
  }

  // The result's round and time (SPEC Scoring §4).
  let round: number | null = null;
  let time: string | null = null;
  if (retired) {
    // Retired after the last round scored, which was fought in full (D55).
    if (stop !== null) return refuse('a retirement with a stoppage time in a round');
    if (rounds.length === 0) return refuse('a retirement with no round scored');
    round = rounds.length;
    time = '3:00';
  } else if (how === 'distance') {
    if (stop !== null) return refuse(`a ${code} with a stoppage in round ${rounds.length + 1}`);
  } else if (stop !== null) {
    if (kind === 'side' && stopRow !== winner) {
      return refuse('the stoppage is on one row and the decision on the other');
    }
    round = rounds.length + 1;
    time = /^\d+:\d\d$/.test(stop) ? stop : null; // `KO` and `TKO` give no time
    rounds.push({ round_no: round, a: 0, b: 0 }); // the stoppage round is 0–0 (§4)
  } else if (how === 'stoppage') {
    return refuse(`a ${code} with no time or marker in the round it ended in`);
  }

  const card: Card = {
    scheduled_rounds: ca.scheduled,
    rounds,
    deductions,
    result: { decision_type: code, winner, round, time },
    is_draft: false,
  };
  const refused = validateCard(card);
  if (refused.length > 0) return { problems: refused.map((p) => p.message) };

  return { card, judges };
}
