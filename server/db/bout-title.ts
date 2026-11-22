// bout_title: a title on the line in a bout, and which side held it coming in.
// Champion and title-for-title are read from holder_side (SPEC Data model).
import type { Database } from './connection.ts';
import type { Side } from '../rules/decisions.ts';
import type { TitleLine } from '../rules/titles.ts';

// null: not recorded, which is how a title bout arrives from v1 (D127).
export type HolderSide = Side | 'vacant' | null;
export type BoutTitleFields = { bout_id: number; title_id: number; holder_side: HolderSide };
export type BoutTitle = BoutTitleFields & { id: number };

export function insertBoutTitle(db: Database, fields: BoutTitleFields): number {
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO bout_title (bout_id, title_id, holder_side) VALUES (:bout_id, :title_id, :holder_side)',
  ).run(fields);
  return Number(lastInsertRowid);
}

export function listBoutTitles(db: Database, boutId: number): BoutTitle[] {
  return db.prepare('SELECT * FROM bout_title WHERE bout_id = ? ORDER BY id')
    .all(boutId) as BoutTitle[];
}

// Every finalised bout that had on the line a title this fighter has fought
// for, whoever fought in it, in fight order: what titlesHeld reads
// (SPEC Scoring §8). A finalised bout always has a winner.
export function listTitleLinesForFighter(db: Database, fighterId: number): TitleLine[] {
  return db.prepare(
    `SELECT bout_title.title_id, bout_title.holder_side, bout.winner,
       bout.fighter_a_id, bout.fighter_b_id, bout.missed_weight_a, bout.missed_weight_b
     FROM bout_title
     JOIN bout ON bout.id = bout_title.bout_id
     JOIN event ON event.id = bout.event_id
     WHERE bout.is_draft = 0 AND bout.winner IS NOT NULL AND bout_title.title_id IN (
       SELECT bt.title_id FROM bout_title bt JOIN bout b ON b.id = bt.bout_id
       WHERE b.fighter_a_id = :id OR b.fighter_b_id = :id
     )
     ORDER BY event.date, bout.card_order, bout.id`,
  ).all({ id: fighterId }) as TitleLine[];
}

// PATCH /bouts/:id sends the whole title list; it replaces what was there.
export function deleteBoutTitles(db: Database, boutId: number): number {
  return Number(db.prepare('DELETE FROM bout_title WHERE bout_id = ?').run(boutId).changes);
}
