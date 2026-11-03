// fighter: who they are, and their current record. The record is stored
// derived data (D13); it is moved on finalise (task 05), not edited here.
import type { Database } from './connection.ts';
import type { WeightUnit } from '../rules/weight.ts';

export type FighterFields = {
  first_name: string;
  last_name: string;
  nickname: string | null;
  colors: string | null;
  weight: number | null;
  weight_unit: WeightUnit | null;
};

export type Fighter = FighterFields & {
  id: number;
  won: number;
  lost: number;
  draws: number;
  nc: number;
  kos: number;
};

export function insertFighter(db: Database, fields: FighterFields): number {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO fighter (first_name, last_name, nickname, colors, weight, weight_unit)
     VALUES (:first_name, :last_name, :nickname, :colors, :weight, :weight_unit)`,
  ).run(fields);
  return Number(lastInsertRowid);
}

export function getFighter(db: Database, id: number): Fighter | undefined {
  return db.prepare('SELECT * FROM fighter WHERE id = ?').get(id) as Fighter | undefined;
}

export function listFighters(db: Database): Fighter[] {
  return db.prepare('SELECT * FROM fighter ORDER BY last_name, first_name, id').all() as Fighter[];
}

// Whole-row update: the API merges a PATCH over the stored row first, so the
// SQL never has to be assembled from whichever fields were sent.
export function updateFighter(db: Database, id: number, fields: FighterFields): boolean {
  const { changes } = db.prepare(
    `UPDATE fighter SET first_name = :first_name, last_name = :last_name, nickname = :nickname,
       colors = :colors, weight = :weight, weight_unit = :weight_unit
     WHERE id = :id`,
  ).run({ ...fields, id });
  return changes > 0;
}

// Refused by the database while any bout names the fighter; merge repoints first.
export function deleteFighter(db: Database, id: number): boolean {
  return db.prepare('DELETE FROM fighter WHERE id = ?').run(id).changes > 0;
}
