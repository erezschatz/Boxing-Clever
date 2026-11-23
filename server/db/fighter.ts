// fighter: who they are, and their current record. The record is stored
// derived data (D13): typed in when the fighter is created or corrected
// (D28), and moved by finalise and by the guarded bout delete (D23).
import type { Database } from './connection.ts';
import type { WeightUnit } from '../rules/weight.ts';
import type { FightRecord } from '../rules/records.ts';

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

// The record alone, so the identity update above never touches it by accident.
export function setFighterRecord(db: Database, id: number, record: FightRecord): boolean {
  const { changes } = db.prepare(
    `UPDATE fighter SET won = :won, lost = :lost, draws = :draws, nc = :nc, kos = :kos
     WHERE id = :id`,
  ).run({ ...record, id });
  return changes > 0;
}

// Refused by the database while any bout names the fighter; merge repoints first.
export function deleteFighter(db: Database, id: number): boolean {
  return db.prepare('DELETE FROM fighter WHERE id = ?').run(id).changes > 0;
}

// The fighter with this name, compared trimmed and without case, as the
// import matches one (IMPORT.md, D133). The lowest id when two share it.
export function findFighterByName(
  db: Database,
  firstName: string,
  lastName: string,
): Fighter | undefined {
  return db.prepare(
    `SELECT * FROM fighter
     WHERE lower(trim(first_name)) = lower(trim(:first)) AND lower(trim(last_name)) = lower(trim(:last))
     ORDER BY id LIMIT 1`,
  ).get({ first: firstName, last: lastName }) as Fighter | undefined;
}

// The fighter whose whole name this is, however it is split between the two
// boxes: the sheet's import has one name per fighter ("Oscar De La Hoya").
// Ignores case and the spaces around; the lowest id when two share it.
export function findFighterByFullName(db: Database, name: string): Fighter | undefined {
  return db.prepare(
    `SELECT * FROM fighter
     WHERE lower(trim(trim(first_name) || ' ' || trim(last_name))) = lower(trim(?))
     ORDER BY id LIMIT 1`,
  ).get(name) as Fighter | undefined;
}
