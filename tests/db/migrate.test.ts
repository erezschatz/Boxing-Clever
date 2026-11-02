// Tier 3: what migrating leaves in the database (SPEC Architecture, Data model).
import { deepStrictEqual, strictEqual as assertEquals, throws } from 'node:assert/strict';
import { openDatabase } from '../../server/db/connection.ts';
import { migrate, readMigrations } from '../../server/db/migrate.ts';
import { listWeightClasses } from '../../server/db/weight-class.ts';
import { insertEvent, listEvents } from '../../server/db/event.ts';

const SPEC_TABLES = [
  'bout',
  'bout_title',
  'deduction',
  'event',
  'fighter',
  'fighter_alias',
  'import_batch',
  'import_reject',
  'round_score',
  'tbrb_snapshot',
  'title',
  'weight_class',
];

function tableNames(db: ReturnType<typeof openDatabase>) {
  return db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name <> 'schema_version' ORDER BY name",
  ).all().map((row) => row.name);
}

Deno.test('a fresh database gets every table the spec names', () => {
  const db = openDatabase(':memory:');
  deepStrictEqual(migrate(db), readMigrations().map((m) => m.version));
  deepStrictEqual(tableNames(db), SPEC_TABLES);
});

Deno.test('migrating again applies nothing and keeps the data', () => {
  const db = openDatabase(':memory:');
  migrate(db);
  insertEvent(db, { date: '2026-11-01', location: 'Riyadh' });
  deepStrictEqual(migrate(db), []);
  assertEquals(listEvents(db).length, 1);
  assertEquals(listWeightClasses(db).length, 18);
});

Deno.test('a failing migration leaves the database at the previous version', () => {
  const db = openDatabase(':memory:');
  const good = { version: 1, name: '001-good.sql', sql: 'CREATE TABLE a (id INTEGER PRIMARY KEY)' };
  const bad = {
    version: 2,
    name: '002-bad.sql',
    sql: 'CREATE TABLE b (id INTEGER PRIMARY KEY); INSERT INTO nowhere VALUES (1)',
  };
  throws(() => migrate(db, [good, bad]), /002-bad\.sql/);
  deepStrictEqual(tableNames(db), ['a']);
  deepStrictEqual(db.prepare('SELECT version FROM schema_version').all().map((r) => r.version), [
    1,
  ]);
  // and the fixed file applies on the next run
  deepStrictEqual(migrate(db, [good, { ...bad, sql: 'CREATE TABLE b (id INTEGER PRIMARY KEY)' }]), [
    2,
  ]);
});

Deno.test('the 18 weight classes are seeded, Heavyweight without a limit', () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const classes = listWeightClasses(db);
  assertEquals(classes.length, 18);
  // v1's seed order, lightest first (BOXING-CLEVER-V1.md); ids follow it.
  deepStrictEqual(classes.map((c) => c.name), [
    'Atomweight',
    'Minimumweight',
    'Light Flyweight',
    'Flyweight',
    'Super Flyweight',
    'Bantamweight',
    'Super Bantamweight',
    'Featherweight',
    'Super Featherweight',
    'Lightweight',
    'Super Lightweight',
    'Welterweight',
    'Super Welterweight',
    'Middleweight',
    'Super Middleweight',
    'Light Heavyweight',
    'Cruiserweight',
    'Heavyweight',
  ]);
  deepStrictEqual(classes.map((c) => c.id), Array.from({ length: 18 }, (_, i) => i + 1));
  const heavy = classes.find((c) => c.name === 'Heavyweight')!;
  assertEquals(heavy.lbs, null);
  assertEquals(heavy.kg, null);
  assertEquals(
    classes.find((c) => c.alternate_name === 'Jr Lightweight')?.name,
    'Super Featherweight',
  );
  for (const c of classes.filter((c) => c.lbs !== null)) {
    assertEquals(c.kg, Math.round(c.lbs! * 0.45359237 * 1000) / 1000, c.name);
  }
});
