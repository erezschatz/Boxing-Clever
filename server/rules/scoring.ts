// The scorecard's arithmetic and the shape a card must have (SPEC Scoring
// §1–4). The server validates every saved card with validateCard; the browser
// computes its running totals with roundTotal and boutTotal, so both agree.
//
// The scorecard is bookkeeping: the result is carried by the decision, not by
// the totals, so nothing here checks that the winner out-scored the loser.
//
// Pure: imports nothing outside server/rules/.
import {
  type DecisionType,
  ending,
  isDecisionType,
  type Side,
  type Winner,
  winnerFits,
} from './decisions.ts';

export type DeductionReason = 'knockdown' | 'low blow' | 'holding' | 'headbutt' | 'other';
export const DEDUCTION_REASONS: DeductionReason[] = [
  'knockdown',
  'low blow',
  'holding',
  'headbutt',
  'other',
];

export type CardRound = { round_no: number; a: number; b: number };
export type CardDeduction = {
  round_no: number;
  side: Side;
  points: number;
  reason: DeductionReason;
  note?: string | null;
};
export type Result = {
  decision_type: DecisionType;
  winner: Winner;
  round: number | null;
  time: string | null; // m:ss into the round
};
export type Card = {
  scheduled_rounds: number;
  rounds: CardRound[];
  deductions: CardDeduction[];
  result: Result | null;
  is_draft: boolean;
};

export type CardProblem = { rule: string; message: string };

// The longest scheduled distance the app accepts, matching the schema check.
export const MAX_ROUNDS = 15;
const ROUND_SECONDS = 180;

// §2: a round total is the points less that side's deductions in that round.
export function roundTotal(card: Card, roundNo: number, side: Side): number {
  const round = card.rounds.find((r) => r.round_no === roundNo);
  if (!round) return 0;
  const points = side === 'A' ? round.a : round.b;
  const deducted = card.deductions
    .filter((d) => d.round_no === roundNo && d.side === side)
    .reduce((sum, d) => sum + d.points, 0);
  return points - deducted;
}

// §3: a bout total is the sum of round totals over the recorded rounds.
export function boutTotal(card: Card, side: Side): number {
  return card.rounds.reduce((sum, r) => sum + roundTotal(card, r.round_no, side), 0);
}

// Every way the card breaks §1–5; an empty list means it may be saved.
export function validateCard(card: Card): CardProblem[] {
  const problems: CardProblem[] = [];
  const problem = (rule: string, message: string) => problems.push({ rule, message });

  if (!isWholeIn(card.scheduled_rounds, 1, MAX_ROUNDS)) {
    problem('scheduled-rounds', `scheduled rounds must be 1–${MAX_ROUNDS}`);
    return problems;
  }

  // §4: no gaps. The rows, in any order, are rounds 1, 2, … n, each once,
  // none beyond the schedule.
  const numbers = card.rounds.map((r) => r.round_no).sort((x, y) => x - y);
  if (!numbers.every((n, i) => n === i + 1)) {
    problem('no-gaps', 'rounds must be 1, 2, 3… with none missing or repeated');
  }
  if (numbers.length > card.scheduled_rounds) {
    problem('no-gaps', `${numbers.length} rounds recorded, ${card.scheduled_rounds} scheduled`);
  }
  const last = numbers.at(-1) ?? 0; // the highest round recorded
  const scored = numbers.length > 0; // an unscored card is valid with any result (D20)

  const result = card.result;
  if (result) checkResult(card, result, problem);
  if (!result && !card.is_draft) problem('finalise', 'a finalised bout needs a result');
  const code = result && isDecisionType(result.decision_type) ? result.decision_type : null;

  // §4: the stoppage round is 0–0; every round before it is scored normally.
  const stoppageRound = result && code ? stoppedIn(card, result) : null;
  for (const round of card.rounds) {
    if (round.round_no === stoppageRound) {
      if (round.a !== 0 || round.b !== 0) {
        problem('stoppage-round', `round ${round.round_no} is the stoppage round and must be 0–0`);
      }
    } else if (!isScoredRound(round)) {
      problem('points', `round ${round.round_no} must be 10–9, 9–10 or 10–10`);
    }
  }
  if (stoppageRound && last > stoppageRound) {
    problem('after-stoppage', `stopped in round ${stoppageRound}, but ${last} rounds are recorded`);
  }
  if (stoppageRound && scored && last < stoppageRound) {
    problem(
      'no-gaps',
      `stopped in round ${stoppageRound}: rounds ${last + 1}–${stoppageRound} are missing`,
    );
  }

  // A points decision, or a no-contest that was not stopped, goes the distance.
  if (code && !stoppageRound && ending(code) !== 'stoppage' && scored) {
    if (last !== card.scheduled_rounds) {
      problem('distance', `a ${code} goes the distance: score all ${card.scheduled_rounds} rounds`);
    }
  }

  // §1, §4: deductions are whole points, belong to a recorded round, and
  // carry one of the known reasons.
  for (const d of card.deductions) {
    if (!isWholeIn(d.round_no, 1, last)) {
      problem('deduction', `deduction in round ${d.round_no}, which is not recorded`);
    }
    if (d.side !== 'A' && d.side !== 'B') problem('deduction', `deduction side ${d.side}`);
    if (!isWholeIn(d.points, 1, 10)) problem('deduction', `deduction of ${d.points} points`);
    if (!DEDUCTION_REASONS.includes(d.reason)) {
      problem('deduction', `unknown deduction reason "${d.reason}"`);
    }
  }

  return problems;
}

// §1: 10 to the winner of the round, 9 to the loser, or 10–10. A 10–8 is a
// 10–9 with a deduction, never points of 8.
function isScoredRound({ a, b }: CardRound): boolean {
  return (a === 10 && b === 9) || (a === 9 && b === 10) || (a === 10 && b === 10);
}

// The round the card stops in, or null when the result went the distance.
// A no-contest is a stoppage when it ended before the last scheduled round,
// or in it with that round's row at 0–0; otherwise it went the distance (D20).
function stoppedIn(card: Card, result: Result): number | null {
  if (!isDecisionType(result.decision_type) || result.round === null) return null;
  if (!isWholeIn(result.round, 1, card.scheduled_rounds)) return null; // reported by checkResult
  const kind = ending(result.decision_type);
  if (kind === 'stoppage') return result.round;
  if (kind === 'either') {
    if (result.round < card.scheduled_rounds) return result.round;
    const row = card.rounds.find((r) => r.round_no === result.round);
    if (row && row.a === 0 && row.b === 0) return result.round;
  }
  return null;
}

function checkResult(
  card: Card,
  result: Result,
  problem: (rule: string, message: string) => void,
) {
  if (!isDecisionType(result.decision_type)) {
    problem('decision', `unknown decision type "${result.decision_type}"`);
    return;
  }
  const code = result.decision_type;
  if (!winnerFits(code, result.winner)) {
    problem('winner', `a ${code} cannot have winner "${result.winner}"`);
  }
  const kind = ending(code);
  if (result.round === null) {
    // On an unscored card there is no stoppage round to place (D20).
    if (kind === 'stoppage' && card.rounds.length > 0) {
      problem('result-round', `a ${code} needs the round it ended in`);
    }
  } else if (!isWholeIn(result.round, 1, card.scheduled_rounds)) {
    problem(
      'result-round',
      `round ${result.round} is outside the ${card.scheduled_rounds} scheduled`,
    );
  } else if (kind === 'distance' && result.round !== card.scheduled_rounds) {
    problem('result-round', `a ${code} ends in the last scheduled round`);
  }
  if (result.time !== null && !isRoundTime(result.time)) {
    problem('result-time', `time "${result.time}" is not m:ss within a round`);
  }
}

function isRoundTime(time: string): boolean {
  const match = /^(\d):([0-5]\d)$/.exec(time);
  return match !== null && Number(match[1]) * 60 + Number(match[2]) <= ROUND_SECONDS;
}

function isWholeIn(n: number, min: number, max: number): boolean {
  return Number.isInteger(n) && n >= min && n <= max;
}
