// import_batch: one run of the staged importer and what it did (IMPORT.md).
import type { Database } from './connection.ts';

export type ImportSource = 'v1' | 'sheet';
export type ImportCounts = { rows_read: number; rows_written: number; rows_rejected: number };
export type ImportBatch = ImportCounts & {
  id: number;
  source: ImportSource;
  started_at: string;
  finished_at: string | null;
};

export function startImportBatch(db: Database, source: ImportSource, startedAt: string): number {
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO import_batch (source, started_at) VALUES (?, ?)',
  ).run(source, startedAt);
  return Number(lastInsertRowid);
}

export function finishImportBatch(
  db: Database,
  id: number,
  finishedAt: string,
  counts: ImportCounts,
): boolean {
  const { changes } = db.prepare(
    `UPDATE import_batch SET finished_at = :finished_at, rows_read = :rows_read,
       rows_written = :rows_written, rows_rejected = :rows_rejected
     WHERE id = :id`,
  ).run({ ...counts, finished_at: finishedAt, id });
  return changes > 0;
}

export function getImportBatch(db: Database, id: number): ImportBatch | undefined {
  return db.prepare('SELECT * FROM import_batch WHERE id = ?').get(id) as ImportBatch | undefined;
}
