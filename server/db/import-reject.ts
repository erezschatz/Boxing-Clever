// import_reject: a source row the importer could not place, kept verbatim with
// the reason, so nothing is skipped silently (IMPORT.md).
import type { Database } from './connection.ts';

export type ImportReject = { id: number; batch_id: number; row_text: string; reason: string };

export function insertImportReject(
  db: Database,
  batchId: number,
  rowText: string,
  reason: string,
): number {
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO import_reject (batch_id, row_text, reason) VALUES (?, ?, ?)',
  ).run(batchId, rowText, reason);
  return Number(lastInsertRowid);
}

export function listImportRejects(db: Database, batchId: number): ImportReject[] {
  return db.prepare('SELECT * FROM import_reject WHERE batch_id = ? ORDER BY id')
    .all(batchId) as ImportReject[];
}
