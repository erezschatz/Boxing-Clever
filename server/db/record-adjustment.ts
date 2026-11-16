// record_adjustment: a result kept in a fighter's record after its bout was
// deleted with "keep the records" (D23, D57). scripts/recompute-records.ts
// (D13) adds these to what it rebuilds, so a recompute keeps the keep.
import type { Database } from './connection.ts';
import type { FightRecord } from '../rules/records.ts';

export type RecordAdjustmentFields = FightRecord & {
  fighter_id: number;
  opponent_id: number;
  bout_description: string;
  bout_date: string;
};

export type RecordAdjustment = RecordAdjustmentFields & { id: number };

export function insertAdjustment(db: Database, fields: RecordAdjustmentFields): number {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO record_adjustment
       (fighter_id, opponent_id, won, lost, draws, nc, kos, bout_description, bout_date)
     VALUES (:fighter_id, :opponent_id, :won, :lost, :draws, :nc, :kos, :bout_description, :bout_date)`,
  ).run(fields);
  return Number(lastInsertRowid);
}

// Oldest fight first.
export function listAdjustments(db: Database, fighterId: number): RecordAdjustment[] {
  return db.prepare(
    'SELECT * FROM record_adjustment WHERE fighter_id = ? ORDER BY bout_date, id',
  ).all(fighterId) as RecordAdjustment[];
}

// Merge: the duplicate's kept results are the target's now, and so are the
// kept results of those who fought them (D31).
export function repointAdjustments(db: Database, fromId: number, toId: number): void {
  db.prepare('UPDATE record_adjustment SET fighter_id = ? WHERE fighter_id = ?').run(toId, fromId);
  db.prepare('UPDATE record_adjustment SET opponent_id = ? WHERE opponent_id = ?').run(
    toId,
    fromId,
  );
}

// Kept results from fights between x and y, either way round (D62).
export function countAdjustmentsBetween(db: Database, x: number, y: number): number {
  const row = db.prepare(
    `SELECT count(*) AS n FROM record_adjustment
     WHERE (fighter_id = ? AND opponent_id = ?) OR (fighter_id = ? AND opponent_id = ?)`,
  ).get(x, y, y, x);
  return row?.n as number;
}
