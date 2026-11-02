// Applies server/migrations/NNN-name.sql in order, each file and its
// schema_version row in one transaction, so a failed file leaves the database
// at the previous version. Running it again applies nothing (SPEC Architecture).
import { dirname } from 'node:path';
import { type Database, databasePath, openDatabase } from './connection.ts';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

export type Migration = { version: number; name: string; sql: string };

export function migrate(db: Database, migrations: Migration[] = readMigrations()): number[] {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');
  const done = new Set(
    db.prepare('SELECT version FROM schema_version').all().map((row) => row.version as number),
  );
  const applied: number[] = [];
  for (const { version, name, sql } of migrations) {
    if (done.has(version)) continue;
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`migration ${name} failed: ${(err as Error).message}`);
    }
    applied.push(version);
  }
  return applied;
}

export function readMigrations(): Migration[] {
  const migrations = [];
  for (const entry of Deno.readDirSync(MIGRATIONS)) {
    const match = /^(\d{3})-.+\.sql$/.exec(entry.name);
    if (!entry.isFile || !match) continue;
    const sql = Deno.readTextFileSync(new URL(entry.name, MIGRATIONS));
    migrations.push({ version: Number(match[1]), name: entry.name, sql });
  }
  return migrations.sort((a, b) => a.version - b.version);
}

// `deno task migrate`: bring data/boxing.db (or $BOXING_DB) up to date.
if (import.meta.main) {
  const path = databasePath();
  Deno.mkdirSync(dirname(path), { recursive: true });
  const db = openDatabase(path);
  const applied = migrate(db);
  db.close();
  console.log(
    applied.length ? `applied ${applied.join(', ')} to ${path}` : `${path} is up to date`,
  );
}
