// bout_title: a title on the line in a bout, and which side held it coming in.
// Champion and title-for-title are read from holder_side (SPEC Data model).
import type { Database } from './connection.ts';
import type { Side } from '../rules/decisions.ts';

export type HolderSide = Side | 'vacant';
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

// PATCH /bouts/:id sends the whole title list; it replaces what was there.
export function deleteBoutTitles(db: Database, boutId: number): number {
  return Number(db.prepare('DELETE FROM bout_title WHERE bout_id = ?').run(boutId).changes);
}
