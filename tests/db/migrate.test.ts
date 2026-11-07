// Tier 3: what migrating leaves in the database (SPEC Architecture, Data model).
import { deepStrictEqual, strictEqual as assertEquals, throws } from 'node:assert/strict';
import { openDatabase } from '../../server/db/connection.ts';
import { migrate, readMigrations, REBUILDS } from '../../server/db/migrate.ts';
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

// A database as task 08 left it (migrations 001–002), with v1's title
// kinds in it, as Erez entered them and as the v1 import would.
function beforeTitleKinds() {
  const db = openDatabase(':memory:');
  migrate(db, readMigrations().filter((m) => m.version <= 2));
  db.exec(`
    INSERT INTO event (id, date, location) VALUES (1, '2026-03-15', 'Dublin');
    INSERT INTO fighter (id, first_name, last_name) VALUES (1, 'Jono', 'Carroll'), (2, 'Colm', 'Murphy');
    INSERT INTO bout (id, event_id, card_order, weight_class_id, scheduled_rounds, fighter_a_id, fighter_b_id)
      VALUES (1, 1, 1, 9, 12, 1, 2), (2, 1, 2, 9, 12, 1, 2);
    INSERT INTO title (id, sanctioning_body, area, weight_class_id, status) VALUES
      (1, 'IBO', 'World', 9, 'Vacant'),
      (2, 'IBO', 'World', 9, 'Active'),
      (3, 'WBC', 'World', 9, 'Interim'),
      (4, 'WBC', 'World', 9, 'Silver'),
      (5, 'WBA', 'World', 9, 'Active');
    INSERT INTO bout_title (bout_id, title_id, holder_side) VALUES
      (1, 1, 'vacant'), (1, 3, 'A'), (1, 4, 'B'),
      (2, 2, 'A'), (2, 1, 'vacant'), (2, 5, 'B');
  `);
  return db;
}

Deno.test('migration 003: v1 kinds become regular or interim, Silver joins the area, one belt is one title (D42)', () => {
  const db = beforeTitleKinds();
  deepStrictEqual(migrate(db), [3]);
  const titles = db.prepare('SELECT id, sanctioning_body, area, interim FROM title ORDER BY id')
    .all()
    .map((t) => ({ ...t }));
  deepStrictEqual(titles, [
    { id: 1, sanctioning_body: 'IBO', area: 'World', interim: 0 }, // Vacant and Active: one belt
    { id: 3, sanctioning_body: 'WBC', area: 'World', interim: 1 },
    { id: 4, sanctioning_body: 'WBC', area: 'World Silver', interim: 0 },
    { id: 5, sanctioning_body: 'WBA', area: 'World', interim: 0 },
  ]);
  const lines = db.prepare(
    'SELECT bout_id, title_id, holder_side FROM bout_title ORDER BY bout_id, id',
  )
    .all().map((l) => ({ ...l }));
  deepStrictEqual(lines, [
    { bout_id: 1, title_id: 1, holder_side: 'vacant' },
    { bout_id: 1, title_id: 3, holder_side: 'A' },
    { bout_id: 1, title_id: 4, holder_side: 'B' },
    // Bout 2 listed both rows of the IBO belt: it keeps its first.
    { bout_id: 2, title_id: 1, holder_side: 'A' },
    { bout_id: 2, title_id: 5, holder_side: 'B' },
  ]);
  deepStrictEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  // Foreign keys are on again afterwards.
  assertEquals(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys, 1);
});

Deno.test('a rebuild that would leave a broken reference rolls back, and foreign keys stay on', () => {
  const db = openDatabase(':memory:');
  migrate(db, readMigrations().filter((m) => m.version <= 2));
  db.exec(`
    INSERT INTO event (id, date, location) VALUES (1, '2026-03-15', 'Dublin');
    INSERT INTO fighter (id, first_name, last_name) VALUES (1, 'A', 'A'), (2, 'B', 'B');
    INSERT INTO bout (id, event_id, card_order, weight_class_id, scheduled_rounds, fighter_a_id, fighter_b_id)
      VALUES (1, 1, 1, 9, 12, 1, 2);
    INSERT INTO title (id, sanctioning_body, area, weight_class_id, status) VALUES (7, 'IBO', 'World', 9, 'Active');
    INSERT INTO bout_title (bout_id, title_id, holder_side) VALUES (1, 7, 'A');
  `);
  const losesTitle7 = {
    version: 3,
    name: '003-bad.sql',
    sql: `${REBUILDS}
      CREATE TABLE title_new (id INTEGER PRIMARY KEY, sanctioning_body TEXT NOT NULL, area TEXT NOT NULL,
        weight_class_id INTEGER NOT NULL, status TEXT NOT NULL);
      DROP TABLE title;
      ALTER TABLE title_new RENAME TO title;`,
  };
  throws(
    () => migrate(db, [...readMigrations().filter((m) => m.version <= 2), losesTitle7]),
    /references broken/,
  );
  assertEquals(db.prepare('SELECT count(*) AS n FROM title').get()?.n, 1); // nothing changed
  assertEquals(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys, 1);
});

Deno.test('migration 003 reads kinds as typed: any case, "Interim Silver", a blank area; a holder beats vacant (D42)', () => {
  const db = openDatabase(':memory:');
  migrate(db, readMigrations().filter((m) => m.version <= 2));
  db.exec(`
    INSERT INTO event (id, date, location) VALUES (1, '2026-03-15', 'Dublin');
    INSERT INTO fighter (id, first_name, last_name) VALUES (1, 'A', 'A'), (2, 'B', 'B');
    INSERT INTO bout (id, event_id, card_order, weight_class_id, scheduled_rounds, fighter_a_id, fighter_b_id)
      VALUES (1, 1, 1, 9, 12, 1, 2);
    INSERT INTO title (id, sanctioning_body, area, weight_class_id, status) VALUES
      (1, 'WBC', 'World', 9, 'Silver'),
      (2, 'wbc ', 'world', 9, ' silver'),
      (3, 'WBC', 'World', 9, 'Interim Silver'),
      (4, 'IBO', 'World', 9, 'VACANT'),
      (5, 'IBO', 'World', 9, 'active'),
      (6, 'EBU', '', 9, 'European');
    -- The vacant row was entered first, the one with a holder second.
    INSERT INTO bout_title (bout_id, title_id, holder_side) VALUES (1, 4, 'vacant'), (1, 5, 'A');
  `);
  migrate(db);
  const titles = db.prepare('SELECT id, sanctioning_body, area, interim FROM title ORDER BY id')
    .all()
    .map((t) => ({ ...t }));
  deepStrictEqual(titles, [
    { id: 1, sanctioning_body: 'WBC', area: 'World Silver', interim: 0 }, // "silver" merged in
    { id: 3, sanctioning_body: 'WBC', area: 'World Silver', interim: 1 },
    { id: 4, sanctioning_body: 'IBO', area: 'World', interim: 0 },
    { id: 6, sanctioning_body: 'EBU', area: 'European', interim: 0 },
  ]);
  deepStrictEqual(
    db.prepare('SELECT bout_id, title_id, holder_side FROM bout_title').all().map((l) => ({
      ...l,
    })),
    [{ bout_id: 1, title_id: 4, holder_side: 'A' }],
  );
});
