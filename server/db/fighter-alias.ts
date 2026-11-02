// fighter_alias: the spellings TBRB and the sheet use for a fighter. Names
// resolve to fighters only by an exact match here, never fuzzily (D14).
import type { Database } from './connection.ts';

export type FighterAlias = { id: number; fighter_id: number; alias: string };

export function insertAlias(db: Database, fighterId: number, alias: string): number {
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO fighter_alias (fighter_id, alias) VALUES (?, ?)',
  ).run(fighterId, alias);
  return Number(lastInsertRowid);
}

export function listAliases(db: Database, fighterId: number): FighterAlias[] {
  return db.prepare('SELECT * FROM fighter_alias WHERE fighter_id = ? ORDER BY alias')
    .all(fighterId) as FighterAlias[];
}

export function findFighterIdByAlias(db: Database, alias: string): number | undefined {
  const row = db.prepare('SELECT fighter_id FROM fighter_alias WHERE alias = ?').get(alias);
  return row?.fighter_id as number | undefined;
}
