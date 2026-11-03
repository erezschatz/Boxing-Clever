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
  | 'RTD'
  | 'TD'
  | 'DQ'
  | 'NC'
  | 'MT'
  | 'T'
  | 'D';

// What a decision says about the winner (§5): a side, a draw, or nobody.
export type WinnerKind = 'side' | 'draw' | 'none';

// What a decision says about the card's shape (§4, D20): every scheduled round
// scored ("distance"), stopped in the result round ("stoppage"), or either
// ("either": a no-contest can be a stoppage or an overturned distance fight).
export type Ending = 'distance' | 'stoppage' | 'either';

type Decision = { label: string; winner: WinnerKind; ending: Ending; ko: boolean };

const DECISIONS: Record<DecisionType, Decision> = {
  UD: { label: 'Unanimous Decision', winner: 'side', ending: 'distance', ko: false },
  MD: { label: 'Majority Decision', winner: 'side', ending: 'distance', ko: false },
  SD: { label: 'Split Decision', winner: 'side', ending: 'distance', ko: false },
  DEC: { label: 'Decision', winner: 'side', ending: 'distance', ko: false },
  KO: { label: 'Knockout', winner: 'side', ending: 'stoppage', ko: true },
  TKO: { label: 'Technical Knockout', winner: 'side', ending: 'stoppage', ko: true },
  RTD: { label: 'Corner Retirement', winner: 'side', ending: 'stoppage', ko: true },
  TD: { label: 'Technical Decision', winner: 'side', ending: 'stoppage', ko: false },
  DQ: { label: 'Disqualification', winner: 'side', ending: 'stoppage', ko: false },
  NC: { label: 'No Contest', winner: 'none', ending: 'either', ko: false },
  MT: { label: 'Majority Draw', winner: 'draw', ending: 'distance', ko: false },
  T: { label: 'Technical Draw', winner: 'draw', ending: 'stoppage', ko: false },
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

// KO, TKO and RTD add to the winner's kos (§6).
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
