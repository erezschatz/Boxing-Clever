// deduction: points taken from one side in one recorded round. 10–8 is a 10
// and a deduction, never an 8 (SPEC Scoring §1). The database refuses a
// deduction in a round that has no round_score row for that side.
import type { Database } from './connection.ts';
import type { Side } from '../rules/decisions.ts';
import type { DeductionReason } from '../rules/scoring.ts';

export type DeductionFields = {
  bout_id: number;
  round_no: number;
  side: Side;
  points: number;
  reason: DeductionReason;
  note: string | null;
};
export type Deduction = DeductionFields & { id: number };

export function insertDeduction(db: Database, fields: DeductionFields): number {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO deduction (bout_id, round_no, side, points, reason, note)
     VALUES (:bout_id, :round_no, :side, :points, :reason, :note)`,
  ).run(fields);
  return Number(lastInsertRowid);
}

export function listDeductions(db: Database, boutId: number): Deduction[] {
  return db.prepare('SELECT * FROM deduction WHERE bout_id = ? ORDER BY round_no, side, id')
    .all(boutId) as Deduction[];
}
