// Opening the one SQLite file (D4). Every db module takes the handle this
// returns; nothing holds a global connection.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export type Database = DatabaseSync;

// Relative to the repo, not the working directory: Atrium imports the chamber
// from its own tree (SETUP.md, "Environment").
const DEFAULT_PATH = new URL('../../data/boxing.db', import.meta.url);

export function databasePath(): string {
  return Deno.env.get('BOXING_DB') ?? fileURLToPath(DEFAULT_PATH);
}

export function openDatabase(path: string): Database {
  const db = new DatabaseSync(path);
  // SQLite leaves foreign keys off per connection unless asked; the schema's
  // cascades and the "fighter with bouts cannot be deleted" rule depend on it.
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

// Runs `work` inside BEGIN/COMMIT, rolling back if it throws. Merge, the
// guarded bout delete and bout writes with their titles each need several
// tables to move together or not at all (SPEC Architecture). node:sqlite is
// synchronous, so `work` is too; nesting is not supported and not needed.
export function transaction<T>(db: Database, work: () => T): T {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
