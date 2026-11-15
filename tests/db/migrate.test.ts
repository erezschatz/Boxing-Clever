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
  deepStrictEqual(migrate(db, readMigrations().filter((m) => m.version <= 3)), [3]);
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
  migrate(db, readMigrations().filter((m) => m.version <= 3));
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

// A database as the title kinds left it (001–003): a finalised bout with its
// snapshot, a scored round with a knockdown and a belt, and a draft beside it.
function beforeContractedWeight() {
  const db = openDatabase(':memory:');
  migrate(db, readMigrations().filter((m) => m.version <= 3));
  db.exec(`
    INSERT INTO event (id, date, location) VALUES (1, '2026-03-15', 'Dublin');
    INSERT INTO fighter (id, first_name, last_name) VALUES (1, 'Jono', 'Carroll'), (2, 'Colm', 'Murphy');
    INSERT INTO bout (id, event_id, card_order, weight_class_id, scheduled_rounds, fighter_a_id,
      fighter_b_id, corner_a, a_won, a_lost, a_draws, a_nc, a_kos, a_weight, a_weight_unit,
      a_colors, b_won, b_lost, b_draws, b_nc, b_kos, decision_type, winner, result_round,
      result_time, judge1_a, judge1_b, is_draft)
      VALUES (1, 1, 1, 9, 12, 1, 2, 'red', 20, 1, 1, 0, 6, 130, 'lbs', 'Green', 18, 2, 0, 0, 9,
        'KO', 'A', 1, '2:10', 10, 8, 0);
    INSERT INTO bout (id, event_id, card_order, weight_class_id, scheduled_rounds, fighter_a_id,
      fighter_b_id) VALUES (2, 1, 2, 10, 10, 2, 1);
    INSERT INTO round_score (bout_id, round_no, side, points) VALUES (1, 1, 'A', 0), (1, 1, 'B', 0);
    INSERT INTO deduction (bout_id, round_no, side, points, reason) VALUES (1, 1, 'B', 1, 'knockdown');
    INSERT INTO title (id, sanctioning_body, area, weight_class_id, interim) VALUES (1, 'IBO', 'World', 9, 0);
    INSERT INTO bout_title (bout_id, title_id, holder_side) VALUES (1, 1, 'vacant');
  `);
  return db;
}

Deno.test('migration 004: every bout keeps its class, card and belts; none has a contracted weight or a missed weight (D26, D45)', () => {
  const db = beforeContractedWeight();
  const before = db.prepare('SELECT * FROM bout ORDER BY id').all().map((b) => ({ ...b }));
  deepStrictEqual(migrate(db, readMigrations().filter((m) => m.version <= 4)), [4]);
  const after = db.prepare('SELECT * FROM bout ORDER BY id').all().map((b) => ({ ...b }));
  deepStrictEqual(
    after,
    before.map((b) => ({ ...b, contracted_weight: null, missed_weight_a: 0, missed_weight_b: 0 })),
  );
  const count = (table: string) =>
    db.prepare(`SELECT count(*) AS n FROM ${table} WHERE bout_id = 1`).get()?.n;
  deepStrictEqual([count('round_score'), count('deduction'), count('bout_title')], [2, 1, 1]);
  deepStrictEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assertEquals(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys, 1);
  // The indexes come back with the table.
  deepStrictEqual(
    db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'bout' ORDER BY name",
    )
      .all().map((i) => i.name),
    ['bout_event', 'bout_fighter_a', 'bout_fighter_b'],
  );
  // The new table still cascades: deleting the bout takes its card and belts.
  db.prepare('DELETE FROM bout WHERE id = 1').run();
  deepStrictEqual([count('round_score'), count('deduction'), count('bout_title')], [0, 0, 0]);
  // And a bout is refused with neither a class nor a contracted weight.
  throws(() => db.prepare('UPDATE bout SET weight_class_id = NULL WHERE id = 2').run(), /CHECK/);
});

Deno.test('migration 005: an RTD becomes a TKO at 3:00 in the same round; nothing else changes, and RTD is refused after (D55)', () => {
  const db = openDatabase(':memory:');
  migrate(db, readMigrations().filter((m) => m.version <= 4));
  db.exec(`
    INSERT INTO event (id, date, location) VALUES (1, '2026-03-15', 'Dublin');
    INSERT INTO fighter (id, first_name, last_name) VALUES (1, 'A', 'A'), (2, 'B', 'B');
    INSERT INTO bout (id, event_id, card_order, weight_class_id, contracted_weight, scheduled_rounds,
                      fighter_a_id, fighter_b_id, missed_weight_b,
                      decision_type, winner, result_round, result_time, is_draft)
    VALUES (1, 1, 1, 18, NULL, 12, 1, 2, 0, 'RTD', 'A', 7, NULL, 0),
           (2, 1, 2, NULL, 150, 10, 1, 2, 1, 'TKO', 'B', 3, '1:40', 0),
           (3, 1, 3, 18, NULL, 12, 1, 2, 0, NULL, NULL, NULL, NULL, 1);
    INSERT INTO round_score (bout_id, round_no, side, points) VALUES (1, 7, 'A', 0), (1, 7, 'B', 0);
  `);
  deepStrictEqual(migrate(db), [5]);
  const bouts = db.prepare(
    `SELECT id, weight_class_id, contracted_weight, missed_weight_b, decision_type, winner,
            result_round, result_time, is_draft FROM bout ORDER BY id`,
  ).all().map((b) => ({ ...b }));
  deepStrictEqual(bouts, [
    {
      id: 1,
      weight_class_id: 18,
      contracted_weight: null,
      missed_weight_b: 0,
      decision_type: 'TKO',
      winner: 'A',
      result_round: 7,
      result_time: '3:00',
      is_draft: 0,
    },
    {
      id: 2,
      weight_class_id: null,
      contracted_weight: 150,
      missed_weight_b: 1,
      decision_type: 'TKO',
      winner: 'B',
      result_round: 3,
      result_time: '1:40',
      is_draft: 0,
    },
    {
      id: 3,
      weight_class_id: 18,
      contracted_weight: null,
      missed_weight_b: 0,
      decision_type: null,
      winner: null,
      result_round: null,
      result_time: null,
      is_draft: 1,
    },
  ]);
  // The rounds still point at their bout.
  assertEquals(db.prepare('SELECT COUNT(*) AS n FROM round_score WHERE bout_id = 1').get()?.n, 2);
  deepStrictEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  throws(() => db.exec("UPDATE bout SET decision_type = 'RTD' WHERE id = 2"), /CHECK/);
});
