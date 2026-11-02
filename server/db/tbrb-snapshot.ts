// tbrb_snapshot: one row per ranked name per dated list; rank 0 is champion
// (TBRB.md). fighter_id is set only from an exact alias match (D14).
import type { Database } from './connection.ts';

export type TbrbSnapshotFields = {
  snapshot_date: string;
  weight_class_id: number;
  rank: number;
  fighter_name: string;
  fighter_id: number | null;
};
export type TbrbSnapshot = TbrbSnapshotFields & { id: number };

export function insertTbrbRow(db: Database, fields: TbrbSnapshotFields): number {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO tbrb_snapshot (snapshot_date, weight_class_id, rank, fighter_name, fighter_id)
     VALUES (:snapshot_date, :weight_class_id, :rank, :fighter_name, :fighter_id)`,
  ).run(fields);
  return Number(lastInsertRowid);
}

// One class's list exactly as stored for that date, champion first.
export function listTbrbSnapshot(
  db: Database,
  weightClassId: number,
  date: string,
): TbrbSnapshot[] {
  return db.prepare(
    'SELECT * FROM tbrb_snapshot WHERE weight_class_id = ? AND snapshot_date = ? ORDER BY rank',
  ).all(weightClassId, date) as TbrbSnapshot[];
}
