// How a result moves both fighters' records (SPEC Scoring §6). The record is
// stored derived data (D13); task 05 applies these deltas inside the finalise
// transaction, and scripts/recompute-records.ts uses the same arithmetic.
//
// Pure: imports nothing outside server/rules/.
import { countsAsKo, type DecisionType, type Winner, winnerFits, winnerKind } from './decisions.ts';

export type FightRecord = { won: number; lost: number; draws: number; nc: number; kos: number };
export type RecordDelta = { a: FightRecord; b: FightRecord };

// The part of a result the record cares about.
export type Outcome = { decision_type: DecisionType; winner: Winner };

const NONE: FightRecord = { won: 0, lost: 0, draws: 0, nc: 0, kos: 0 };

// §6: what one finalised result adds to each side's record.
// An outcome that breaks §5 is a caller's bug (validateCard runs first), so it
// throws rather than guess which side to credit.
export function recordDelta(outcome: Outcome): RecordDelta {
  if (!winnerFits(outcome.decision_type, outcome.winner)) {
    throw new Error(`a ${outcome.decision_type} cannot have winner "${outcome.winner}"`);
  }
  switch (winnerKind(outcome.decision_type)) {
    case 'draw':
      return { a: { ...NONE, draws: 1 }, b: { ...NONE, draws: 1 } };
    case 'none':
      return { a: { ...NONE, nc: 1 }, b: { ...NONE, nc: 1 } };
    case 'side': {
      const win = { ...NONE, won: 1, kos: countsAsKo(outcome.decision_type) ? 1 : 0 };
      const loss = { ...NONE, lost: 1 };
      return outcome.winner === 'A' ? { a: win, b: loss } : { a: loss, b: win };
    }
  }
}

// §6: undoing a result that was counted.
export function reverseDelta(delta: RecordDelta): RecordDelta {
  return { a: scale(delta.a, -1), b: scale(delta.b, -1) };
}

// §6: what the record must move by when a bout's counted result changes.
// `before` is the result already in the record (null while the bout was a
// draft); `after` is the one to count from now on (null: back to draft).
// Re-saving the same result moves nothing; an edit reverses the old result
// and applies the new one as a single delta, for a single transaction.
export function recordChange(before: Outcome | null, after: Outcome | null): RecordDelta {
  const undo = before ? reverseDelta(recordDelta(before)) : { a: NONE, b: NONE };
  const apply = after ? recordDelta(after) : { a: NONE, b: NONE };
  return { a: add(undo.a, apply.a), b: add(undo.b, apply.b) };
}

export function applyDelta(record: FightRecord, delta: FightRecord): FightRecord {
  return add(record, delta);
}

export function isNoChange(delta: RecordDelta): boolean {
  return [delta.a, delta.b].every((r) => Object.values(r).every((n) => n === 0));
}

function add(x: FightRecord, y: FightRecord): FightRecord {
  return {
    won: x.won + y.won,
    lost: x.lost + y.lost,
    draws: x.draws + y.draws,
    nc: x.nc + y.nc,
    kos: x.kos + y.kos,
  };
}

// `+ 0` keeps a negated zero from showing up as -0 in comparisons and JSON.
function scale(r: FightRecord, k: number): FightRecord {
  return {
    won: r.won * k + 0,
    lost: r.lost * k + 0,
    draws: r.draws * k + 0,
    nc: r.nc * k + 0,
    kos: r.kos * k + 0,
  };
}
