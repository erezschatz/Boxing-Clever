// The decision-type table (SPEC Scoring §5). The wire and the database carry
// the code; the label is derived from it here and never parsed back (v1
// recovered the code from the label, BOXING-CLEVER-V1.md).
//
// Pure: imports nothing outside server/rules/.

export type Side = 'A' | 'B';
export type Winner = Side | 'draw' | 'none';

export type DecisionType =
  | 'UD'
  | 'MD'
  | 'SD'
  | 'DEC'
  | 'KO'
  | 'TKO'
  | 'TD'
  | 'DQ'
  | 'NC'
  | 'MT'
  | 'T'
  | 'D';

// What a decision says about the winner (§5): a side, a draw, or nobody.
export type WinnerKind = 'side' | 'draw' | 'none';

// What a decision says about the card's shape (§4, D20, D22): every scheduled
// round scored ("distance"); stopped in the result round, which is 0–0
// ("stoppage", except a TKO at 3:00, which is a retirement after a round
// fought in full and scored: D55, scoring.ts); stopped and sent to the scorecards, so the result round is
// scored like any other ("cards"); or a no-contest, which can be a stoppage
// or an overturned distance fight ("either").
export type Ending = 'distance' | 'stoppage' | 'cards' | 'either';

type Decision = { label: string; winner: WinnerKind; ending: Ending; ko: boolean };

const DECISIONS: Record<DecisionType, Decision> = {
  UD: { label: 'Unanimous Decision', winner: 'side', ending: 'distance', ko: false },
  MD: { label: 'Majority Decision', winner: 'side', ending: 'distance', ko: false },
  SD: { label: 'Split Decision', winner: 'side', ending: 'distance', ko: false },
  DEC: { label: 'Decision', winner: 'side', ending: 'distance', ko: false },
  KO: { label: 'Knockout', winner: 'side', ending: 'stoppage', ko: true },
  TKO: { label: 'Technical Knockout', winner: 'side', ending: 'stoppage', ko: true },
  TD: { label: 'Technical Decision', winner: 'side', ending: 'cards', ko: false },
  DQ: { label: 'Disqualification', winner: 'side', ending: 'stoppage', ko: false },
  NC: { label: 'No Contest', winner: 'none', ending: 'either', ko: false },
  MT: { label: 'Majority Draw', winner: 'draw', ending: 'distance', ko: false },
  T: { label: 'Technical Draw', winner: 'draw', ending: 'cards', ko: false },
  D: { label: 'Draw', winner: 'draw', ending: 'distance', ko: false },
};

export const DECISION_TYPES = Object.keys(DECISIONS) as DecisionType[];

export function isDecisionType(code: string): code is DecisionType {
  return Object.hasOwn(DECISIONS, code);
}

export function decisionLabel(code: DecisionType): string {
  return DECISIONS[code].label;
}

export function winnerKind(code: DecisionType): WinnerKind {
  return DECISIONS[code].winner;
}

export function ending(code: DecisionType): Ending {
  return DECISIONS[code].ending;
}

// KO and TKO add to the winner's kos (§6). A corner retirement is a TKO (D55).
export function countsAsKo(code: DecisionType): boolean {
  return DECISIONS[code].ko;
}

// Whether `winner` is one this decision allows (§5).
export function winnerFits(code: DecisionType, winner: Winner): boolean {
  switch (winnerKind(code)) {
    case 'side':
      return winner === 'A' || winner === 'B';
    case 'draw':
      return winner === 'draw';
    case 'none':
      return winner === 'none';
  }
}

export type JudgeCard = { a: number | null; b: number | null };

// §5, from the three judges' cards (D41): who wins a decision that went the
// distance, and what kind it is. Each card goes to the side with more
// points, or is even. 3–0 is a unanimous decision, 2–1 a split one, two for
// a side and one even a majority decision; two even and one for a side is a
// majority draw, and three even, or one each and one even, a draw. Null
// until all three cards are complete.
export function decisionFromCards(
  cards: JudgeCard[],
): { decision_type: DecisionType; winner: Winner } | null {
  if (cards.length !== 3 || cards.some((c) => c.a === null || c.b === null)) return null;
  const forA = cards.filter((c) => c.a! > c.b!).length;
  const forB = cards.filter((c) => c.b! > c.a!).length;
  const even = 3 - forA - forB;
  const lead: Side = forA > forB ? 'A' : 'B';
  const most = Math.max(forA, forB);
  if (most === 3) return { decision_type: 'UD', winner: lead };
  if (most === 2 && even === 0) return { decision_type: 'SD', winner: lead };
  if (most === 2 && even === 1) return { decision_type: 'MD', winner: lead };
  if (even === 2) return { decision_type: 'MT', winner: 'draw' };
  return { decision_type: 'D', winner: 'draw' }; // three even, or one each and one even
}
