// round_score: one row per side per round actually scored. Points are 0–10;
// the stoppage round is points 0 for both sides (SPEC Scoring §1, §4). Whether
// a card's rows make sense together is server/rules/, not this module.
import type { Database } from './connection.ts';
import type { Side } from '../rules/decisions.ts';

export type RoundScoreFields = { bout_id: number; round_no: number; side: Side; points: number };
export type RoundScore = RoundScoreFields & { id: number };

export function insertRoundScore(db: Database, fields: RoundScoreFields): number {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO round_score (bout_id, round_no, side, points)
     VALUES (:bout_id, :round_no, :side, :points)`,
  ).run(fields);
  return Number(lastInsertRowid);
}

export function listRoundScores(db: Database, boutId: number): RoundScore[] {
  return db.prepare('SELECT * FROM round_score WHERE bout_id = ? ORDER BY round_no, side')
    .all(boutId) as RoundScore[];
}

// The card is saved whole (PUT /bouts/:id/card); its deductions go with it.
export function deleteRoundScores(db: Database, boutId: number): number {
  return Number(db.prepare('DELETE FROM round_score WHERE bout_id = ?').run(boutId).changes);
}
