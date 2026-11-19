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

// Merge: rankings linked to the duplicate are the target's.
export function repointTbrbRows(db: Database, fromId: number, toId: number): number {
  return Number(
    db.prepare('UPDATE tbrb_snapshot SET fighter_id = ? WHERE fighter_id = ?').run(toId, fromId)
      .changes,
  );
}

export function listTbrbRowsForFighter(db: Database, fighterId: number): TbrbSnapshot[] {
  return db.prepare(
    'SELECT * FROM tbrb_snapshot WHERE fighter_id = ? ORDER BY snapshot_date, weight_class_id',
  ).all(fighterId) as TbrbSnapshot[];
}

// A fighter's standing now, for the fighter card: their rank on each class's
// latest list that names them, with that list's date. A class whose latest
// list leaves them off is not here: they are unranked in it (D25).
export type CurrentRank = { weight_class_id: number; rank: number; snapshot_date: string };

export function currentRanks(db: Database, fighterId: number): CurrentRank[] {
  return db.prepare(
    `SELECT s.weight_class_id, s.rank, s.snapshot_date FROM tbrb_snapshot s
     JOIN (
       SELECT weight_class_id, MAX(snapshot_date) AS latest FROM tbrb_snapshot
       GROUP BY weight_class_id
     ) l ON l.weight_class_id = s.weight_class_id AND l.latest = s.snapshot_date
     WHERE s.fighter_id = ?
     ORDER BY s.weight_class_id`,
  ).all(fighterId) as CurrentRank[];
}

// A fighter's standing in one class as of a date: their rank on that class's
// last list on or before it (0 champion), or null when not on it, or when
// no list is that old (D25, D58: a list dated that day counts; no age limit).
export function rankAsOf(
  db: Database,
  fighterId: number,
  weightClassId: number,
  date: string,
): number | null {
  const row = db.prepare(
    `SELECT rank FROM tbrb_snapshot
     WHERE weight_class_id = :cls AND fighter_id = :fighter AND snapshot_date = (
       SELECT MAX(snapshot_date) FROM tbrb_snapshot
       WHERE weight_class_id = :cls AND snapshot_date <= :date
     )`,
  ).get({ cls: weightClassId, fighter: fighterId, date });
  return (row?.rank as number | undefined) ?? null;
}
