// A fresh, fully migrated in-memory database per test: the real schema, no file.
import { type Database, openDatabase } from '../../server/db/connection.ts';
import { migrate } from '../../server/db/migrate.ts';

export function testDatabase(): Database {
  const db = openDatabase(':memory:');
  migrate(db);
  return db;
}
