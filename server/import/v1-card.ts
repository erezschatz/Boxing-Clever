// One v1 scorecard (a document of Mongo's `boutscores`) read as a card this
// app would accept (IMPORT.md, Source B; D125, D126). v1's documents are
// taken as v1's front end really wrote them:
//   - a deduction is its reason alone, one point each, checked against the
//     round's total;
//   - the stoppage round was dropped, so it is put back at 0–0 (SPEC
//     Scoring §4);
//   - `T` is v1's "Draw", a draw over the distance, which is `D` here; a
//     `TD` is refused, for Erez to enter with its last round scored (D53);
//   - the winner's kind comes from the decision type (§5), since v1 wrote
//     "draw" only for MT and T;
//   - a document with a decision type is final whatever its `is_draft` says.
// The card then passes the rules PUT /api/bouts/:id/card applies, or it is
// refused with their problems. Nothing is guessed.
//
// Pure: no I/O.
import {
  type DecisionType,
  ending,
  isDecisionType,
  type JudgeCard,
  type Winner,
  winnerKind,
} from '../rules/decisions.ts';
import {
  type Card,
  type CardDeduction,
  type DeductionReason,
  validateCard,
} from '../rules/scoring.ts';

type V1Record = { won: number; lost: number; draws: number; nc: number; kos: number };
type V1Side = { round_score: number; total_score: number; deductions?: string[] };
type V1Fighter = {
  record?: V1Record;
  weight?: number | null;
  weight_unit?: string | null;
  colors?: string | null;
};
type V1Judge = { fighterA?: number; fighterB?: number };

// The parts of a v1 document the import reads. The older documents have no
// `event` and no fighter details, only the two ids (IMPORT.md).
export type V1Doc = {
  bout_id: number;
  fighters?: { fighterA?: V1Fighter; fighterB?: V1Fighter };
  rounds?: { fighterA: V1Side; fighterB: V1Side }[];
  result?: {
    time?: string;
    round?: number;
    decision?: { type?: string; winner?: string };
    judges_scores?: { ref_1?: V1Judge; ref_2?: V1Judge; ref_3?: V1Judge };
  };
  updatedAt?: { $date: string } | string;
};

export type Judges = [JudgeCard, JudgeCard, JudgeCard];
export type V1Card = { card: Card; judges: Judges };

// v1's deduction dialog offered these six; anything else is not v1's.
const REASONS: Record<string, { reason: DeductionReason; note: string | null }> = {
  KnockDown: { reason: 'knockdown', note: null },
  LowBlow: { reason: 'low blow', note: null },
  Holding: { reason: 'holding', note: null },
  HeadButt: { reason: 'headbutt', note: null },
  IllegalPunch: { reason: 'other', note: 'illegal punch' },
  Other: { reason: 'other', note: null },
};

// v1's code as this app's (D126), or why the bout is refused.
export function v1Decision(type: string): DecisionType | { problem: string } {
  if (type === 'T') return 'D';
  if (type === 'TD') {
    return { problem: 'a technical decision: enter it by hand with its last round scored (D53)' };
  }
  return isDecisionType(type) ? type : { problem: `decision "${type}" is not a known code` };
}

// The result as §5 needs it: the kind of winner from the type, the side from v1.
export function v1Winner(type: DecisionType, winner: string | undefined): Winner | null {
  const kind = winnerKind(type);
  if (kind === 'draw') return 'draw';
  if (kind === 'none') return 'none';
  return winner === 'fighterA' ? 'A' : winner === 'fighterB' ? 'B' : null;
}

const judge = (j: V1Judge | undefined): JudgeCard =>
  // v1 saved 0–0 for a card nobody typed.
  j && (j.fighterA || j.fighterB)
    ? { a: j.fighterA ?? 0, b: j.fighterB ?? 0 }
    : { a: null, b: null };

// "00:01" is 0:01: v1 took the time as typed, and the rules want m:ss.
const roundTime = (time: string | undefined): string | null => {
  const t = (time ?? '').trim();
  return t === '' ? null : t.replace(/^0(\d:\d\d)$/, '$1');
};

export function v1Card(doc: V1Doc, scheduledRounds: number): V1Card | { problems: string[] } {
  const problems: string[] = [];
  const rounds = (doc.rounds ?? []).map((r, i) => ({
    round_no: i + 1,
    a: r.fighterA.round_score,
    b: r.fighterB.round_score,
  }));

  const deductions: CardDeduction[] = [];
  (doc.rounds ?? []).forEach((r, i) => {
    for (const side of ['A', 'B'] as const) {
      const s = side === 'A' ? r.fighterA : r.fighterB;
      const listed = s.deductions ?? [];
      // v1 kept no points per deduction; the round's own arithmetic says
      // whether each was one point (D125).
      if (s.round_score - s.total_score !== listed.length) {
        problems.push(
          `round ${i + 1}, side ${side}: ${s.round_score} less ${listed.length} deduction(s) ` +
            `is not the total v1 stored, ${s.total_score}`,
        );
        continue;
      }
      for (const text of listed) {
        const known = REASONS[text];
        if (!known) {
          problems.push(`round ${i + 1}, side ${side}: deduction "${text}" is not one of v1's`);
        } else {
          deductions.push({ round_no: i + 1, side, points: 1, ...known });
        }
      }
    }
  });

  let result: Card['result'] = null;
  const type = doc.result?.decision?.type ?? '';
  if (type !== '') {
    const code = v1Decision(type);
    if (typeof code !== 'string') {
      problems.push(code.problem);
    } else {
      const winner = v1Winner(code, doc.result?.decision?.winner);
      if (winner === null) {
        problems.push(`a ${code} needs a winner, and v1 has "${doc.result?.decision?.winner}"`);
      } else {
        result = {
          decision_type: code,
          winner,
          round: doc.result?.round || null, // v1 saved 0 for none
          time: roundTime(doc.result?.time),
        };
        // §4: v1 dropped the stoppage round, so a card stopped in round N
        // holds N−1 rounds; round N goes back at 0–0. A card with no rounds
        // was watched and not scored, and stays empty. Any other count is
        // left for the rules to refuse.
        const stopped = ending(code) === 'stoppage' || ending(code) === 'either';
        if (stopped && result.round !== null && rounds.length > 0) {
          if (rounds.length === result.round - 1) {
            rounds.push({ round_no: result.round, a: 0, b: 0 });
          }
        }
      }
    }
  }
  if (problems.length > 0) return { problems };

  const card: Card = {
    scheduled_rounds: scheduledRounds,
    rounds,
    deductions,
    result,
    is_draft: result === null,
  };
  const refused = validateCard(card);
  if (refused.length > 0) return { problems: refused.map((p) => p.message) };

  const j = doc.result?.judges_scores;
  return { card, judges: [judge(j?.ref_1), judge(j?.ref_2), judge(j?.ref_3)] };
}
