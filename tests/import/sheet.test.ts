// The Numbers sheet's import (IMPORT.md, Source A; task 11). Tier 1 for the
// cells read one at a time; tier 3 for what a batch leaves in the database,
// from the fixture export in tests/fixtures/sheet (eleven bouts and a stray
// row, as Numbers writes the table, and its colours file).
import { deepStrictEqual, ok, strictEqual as assertEquals, throws } from 'node:assert/strict';
import type { Database } from '../../server/db/connection.ts';
import { insertBout, markNoSnapshot, setSideSnapshot } from '../../server/db/bout.ts';
import { insertFighter, setFighterRecord } from '../../server/db/fighter.ts';
import { eventAt } from '../../server/import/batch.ts';
import { importSheet } from '../../server/import/sheet.ts';
import { type Colours, sheetCard } from '../../server/import/sheet-card.ts';
import { sheetCategory } from '../../server/import/sheet-category.ts';
import {
  sheetName,
  sheetRecord,
  sheetWeight,
  splitName,
} from '../../server/import/sheet-fighter.ts';
import {
  parseCsv,
  sheetBouts,
  sheetDate,
  type SheetFighterRow,
} from '../../server/import/sheet-rows.ts';
import { testDatabase } from '../helpers/db.ts';

const FIXTURES = new URL('../fixtures/sheet/', import.meta.url);
const file = (name: string) => Deno.readTextFileSync(new URL(name, FIXTURES));
const run = (db: Database, csv = file('sheet.csv')) =>
  importSheet(db, csv, file('sheet-colours.csv'), '2026-11-23T00:00:00.000Z');
const all = (db: Database, sql: string) => db.prepare(sql).all().map((row) => ({ ...row }));

const row = (
  name: string,
  cells: (number | string)[],
  decision = '',
  refs: [string, string, string] = ['', '', ''],
  line = 2,
): SheetFighterRow => ({
  line,
  name,
  colors: '',
  weight: '',
  record: '',
  cells: [...cells.map(String), ...Array(12 - cells.length).fill('')],
  total: String(
    cells.filter((c) => typeof c === 'number').reduce<number>((x, y) => x + Number(y), 0),
  ),
  decision,
  refs,
});
const none: Colours = new Map();
const problemsOf = (read: ReturnType<typeof sheetCard>) => 'problems' in read ? read.problems : [];
const cardOf = (read: ReturnType<typeof sheetCard>) => {
  if ('problems' in read) throw new Error(read.problems.join('; '));
  return read.card;
};

Deno.test('parseCsv reads what Numbers writes: quoted commas, doubled quotes, a last line with no break', () => {
  deepStrictEqual(parseCsv('a,"b, c","say ""hi"""\r\n,,\nlast,1'), [
    ['a', 'b, c', 'say "hi"'],
    ['', '', ''],
    ['last', '1'],
  ]);
});

Deno.test('the table is read as bouts: a category row, two fighters, and the date cell they stand under', () => {
  const { bouts, stray } = sheetBouts(parseCsv(file('sheet.csv')));
  assertEquals(bouts.length, 11);
  deepStrictEqual(
    [bouts[0].dateCell, bouts[0].category, bouts[0].line],
    ['', '', 2], // nothing above the first bout
  );
  deepStrictEqual(
    [bouts[2].dateCell, bouts[2].category, bouts[2].order, bouts[2].a.name, bouts[2].b.name],
    ['13/11/2021. Honda Center. Anaheim. CA', 'Heavyweight', 2, 'Dan Loser', 'Big Winner'],
  );
  deepStrictEqual(stray, [{ line: 45, text: 'Nobody Under' }]);
  throws(() => sheetBouts([['Date', 'Name']]), /header/);
});

Deno.test('a date cell is a day, DD/MM/YYYY, then the place; a year the sheet cannot mean is refused', () => {
  deepStrictEqual(sheetDate('13/11/2021. Honda Center. Anaheim. CA'), {
    date: '2021-11-13',
    location: 'Honda Center. Anaheim. CA',
  });
  deepStrictEqual(sheetDate('19/04/2025 Frontwav Arena, Oceanside, CA'), {
    date: '2025-04-19',
    location: 'Frontwav Arena, Oceanside, CA',
  });
  ok('problem' in sheetDate('07/06/1014, Turning Stone, Verona, NY'));
  ok('problem' in sheetDate('31/02/2022, Somewhere, City, UK'));
  ok('problem' in sheetDate('Honda Center'));
});

Deno.test('a name is read without what stands beside it: (c), the belts held, a ranking', () => {
  deepStrictEqual(sheetName('Hamzah Sheeraz (c)'), {
    name: 'Hamzah Sheeraz',
    champion: true,
    bodies: [],
  });
  deepStrictEqual(sheetName('Canelo Alvarez (WBC/WBA/WBO) #1'), {
    name: 'Canelo Alvarez',
    champion: false,
    bodies: ['WBC', 'WBA', 'WBO'],
  });
  deepStrictEqual(sheetName('Nonito Donaire #2 (WBC)').name, 'Nonito Donaire');
  deepStrictEqual(sheetName('George Kambosos Jr. (8)'), {
    name: 'George Kambosos Jr.',
    champion: false,
    bodies: [],
  });
  deepStrictEqual(splitName('Oscar De La Hoya'), { first_name: 'Oscar', last_name: 'De La Hoya' });
  deepStrictEqual(splitName('Suraj'), { first_name: '', last_name: 'Suraj' });
});

Deno.test('a record is W(KO)-L-D as the sheet writes it, and a slip of the keyboard is refused', () => {
  deepStrictEqual(sheetRecord('14(11)-2-0'), { won: 14, kos: 11, lost: 2, draws: 0, nc: 0 });
  deepStrictEqual(sheetRecord('16(8)-1'), { won: 16, kos: 8, lost: 1, draws: 0, nc: 0 });
  deepStrictEqual(sheetRecord('30(20)-2-1-1'), { won: 30, kos: 20, lost: 2, draws: 1, nc: 1 });
  // No bracket is no knockouts.
  deepStrictEqual(sheetRecord('1-0-0'), { won: 1, kos: 0, lost: 0, draws: 0, nc: 0 });
  for (const bad of ['19(1)2-3', '', '7(4)-4-0-0-1', '3(4)-0-0']) {
    ok('problem' in sheetRecord(bad), bad);
  }
});

Deno.test('a weight is pounds, kilograms or stone, kept in pounds with the unit it was written in', () => {
  deepStrictEqual(sheetWeight('125.4lbs'), { pounds: 125.4, unit: 'lbs' });
  deepStrictEqual(sheetWeight('140lba'), { pounds: 140, unit: 'lbs' });
  deepStrictEqual(sheetWeight('72kg'), { pounds: 158.73, unit: 'kg' });
  deepStrictEqual(sheetWeight('14st 4lbs'), { pounds: 200, unit: 'st' });
  deepStrictEqual(sheetWeight('10st 12lbs 8oz'), { pounds: 152.5, unit: 'st' });
  deepStrictEqual(sheetWeight('18st 6oz'), { pounds: 252.38, unit: 'st' });
  deepStrictEqual(sheetWeight('16st'), { pounds: 224, unit: 'st' });
  assertEquals(sheetWeight(''), null);
  ok('problem' in (sheetWeight('heavy') ?? {}));
});

Deno.test('a category is a class, a contracted weight, or a title line with its belts', () => {
  const plain = { contracted_weight: null, belts: [] };
  deepStrictEqual(sheetCategory('Heavyweight'), { class_name: 'Heavyweight', ...plain });
  deepStrictEqual(sheetCategory('Junior Lightweight'), {
    class_name: 'Super Featherweight',
    ...plain,
  });
  deepStrictEqual(sheetCategory('W Featherweight'), { class_name: 'Featherweight', ...plain });
  deepStrictEqual(sheetCategory('Catchweight (150)'), {
    class_name: null,
    contracted_weight: 150,
    belts: [],
  });
  deepStrictEqual(sheetCategory('179lbs catchweight'), {
    class_name: null,
    contracted_weight: 179,
    belts: [],
  });
  ok('problem' in sheetCategory('Catchweight'));
  // An eliminator is for no title.
  deepStrictEqual(sheetCategory('WBC World Welterweight Title Eliminator'), {
    class_name: 'Welterweight',
    ...plain,
  });
  // A body alone takes the area of the belt after it.
  deepStrictEqual(sheetCategory('WBO/WBA/IBF/WBC World Super Middleweight Championship'), {
    class_name: 'Super Middleweight',
    contracted_weight: null,
    belts: ['WBO', 'WBA', 'IBF', 'WBC'].map((body) => ({
      body,
      area: 'World',
      interim: false,
      vacant: false,
    })),
  });
  // Each belt says for itself whether it is vacant or interim.
  deepStrictEqual(
    sheetCategory('Commonwealth/Vacant British/WBC Interim World Super-Welterweight Title'),
    {
      class_name: 'Super Welterweight',
      contracted_weight: null,
      belts: [
        { body: 'CBC', area: 'Commonwealth', interim: false, vacant: false },
        { body: 'BBBOFC', area: 'British', interim: false, vacant: true },
        { body: 'WBC', area: 'World', interim: true, vacant: false },
      ],
    },
  );
  // Refused: a belt the table does not know, a body with no area, no class.
  ok('problem' in sheetCategory('Martian Heavyweight Title'));
  ok('problem' in sheetCategory('WBA Lightweight Title'));
  ok('problem' in sheetCategory('WBA/Commonwealth Lightweight Title'));
  // NABF is the WBC's: it lends a body written alone nothing.
  ok('problem' in sheetCategory('WBA/NABF Heavyweight Title'));
  deepStrictEqual(
    (sheetCategory('WBA/WBC International Heavyweight Title') as { belts: unknown[] }).belts,
    ['WBA', 'WBC'].map((body) => ({ body, area: 'International', interim: false, vacant: false })),
  );
  ok('problem' in sheetCategory('Main Event'));
  ok('problem' in sheetCategory(''));
});

Deno.test("the winner is the row with the Decision cell, whatever Erez's own card says", () => {
  const card = cardOf(sheetCard(row('A', [10, 10, 10, 9]), row('B', [9, 9, 9, 10], 'SD'), none));
  deepStrictEqual(card.result, { decision_type: 'SD', winner: 'B', round: null, time: null });
  assertEquals(card.scheduled_rounds, 4);
  assertEquals(card.is_draft, false);
  // 3 and 0 are the cards won: a unanimous decision.
  assertEquals(
    cardOf(sheetCard(row('A', [10, 9], '3'), row('B', [9, 10], '0'), none)).result?.winner,
    'A',
  );
  assertEquals(
    cardOf(sheetCard(row('A', [10, 9], 'DRAW'), row('B', [9, 10], 'DRAW'), none)).result
      ?.decision_type,
    'D',
  );
});

Deno.test("the judges' cards, where the sheet has all three, must agree with the Decision cell, and settle one typed on both rows", () => {
  const forA: [string, string, string] = ['20', '20', '19'];
  const forB: [string, string, string] = ['18', '18', '19'];
  ok(
    problemsOf(sheetCard(row('A', [10, 10], '', forA), row('B', [9, 9], 'UD', forB), none))[0]
      .includes("judges' cards"),
  );
  const both = sheetCard(row('A', [10, 10], 'MD', forA), row('B', [9, 9], 'MD', forB), none);
  assertEquals(cardOf(both).result?.winner, 'A');
  deepStrictEqual('judges' in both && both.judges, [{ a: 20, b: 18 }, { a: 20, b: 18 }, {
    a: 19,
    b: 19,
  }]);
  ok(problemsOf(sheetCard(row('A', [10, 10], 'MD'), row('B', [9, 9], 'MD'), none)).length > 0);
});

Deno.test('a stoppage is in the round whose cell holds the time or the marker, on the winner’s row, and that round is 0–0', () => {
  const ko = cardOf(
    sheetCard(row('A', [9, 'x', 'x', 'x']), row('B', [10, '2:44', 'x', 'x'], 'KO'), none),
  );
  deepStrictEqual(ko.rounds, [{ round_no: 1, a: 9, b: 10 }, { round_no: 2, a: 0, b: 0 }]);
  deepStrictEqual(ko.result, { decision_type: 'KO', winner: 'B', round: 2, time: '2:44' });
  // RSC is a TKO; the marker alone gives no time.
  const rsc = cardOf(sheetCard(row('A', ['TKO', 'x'], 'RSC'), row('B', ['x', 'x']), none));
  deepStrictEqual(rsc.result, { decision_type: 'TKO', winner: 'A', round: 1, time: null });
  // The decision typed on both rows: the row with the stoppage's cell won.
  assertEquals(
    cardOf(sheetCard(row('A', [10, '1:10'], 'TKO'), row('B', [9, 'x'], 'TKO'), none)).result
      ?.winner,
    'A',
  );
  ok(
    problemsOf(sheetCard(row('A', [10, 'x'], 'TKO'), row('B', [9, 'x'], 'TKO'), none))[0]
      .includes('no stoppage cell'),
  );
  // Refused: no cell to say when, and a time on the loser's row.
  ok(problemsOf(sheetCard(row('A', [9, 'x']), row('B', [10, 'x'], 'TKO'), none)).length > 0);
  ok(problemsOf(sheetCard(row('A', [9, '1:10']), row('B', [10, 'x'], 'TKO'), none)).length > 0);
});

Deno.test('D55: a retirement is a TKO at 3:00 of the last round scored; D53: a technical decision is refused', () => {
  const card = cardOf(
    sheetCard(row('A', [9, 9, 'x', 'x']), row('B', [10, 10, 'x', 'x'], 'RTD'), none),
  );
  deepStrictEqual(card.result, { decision_type: 'TKO', winner: 'B', round: 2, time: '3:00' });
  assertEquals(card.rounds.length, 2);
  for (const code of ['TD', 'TUD', 'TSD', 'MTD']) {
    ok(
      problemsOf(sheetCard(row('A', [9, 'x']), row('B', [10, 'x'], code), none))[0].includes('D53'),
    );
  }
});

Deno.test('D24, D63: a side under 9 is 9 less one-point deductions, a foul in red, a knockdown in blue or assumed', () => {
  const colours: Colours = new Map([['3:1', 'red'], ['3:2', 'blue']]);
  const card = cardOf(sheetCard(
    row('A', [10, 10, 10], 'UD', ['', '', ''], 2),
    row('B', [7, 8, 8], '', ['', '', ''], 3),
    colours,
  ));
  deepStrictEqual(card.rounds, [1, 2, 3].map((round_no) => ({ round_no, a: 10, b: 9 })));
  deepStrictEqual(
    card.deductions.map((d) => [d.round_no, d.side, d.points, d.reason, d.note]),
    [
      [1, 'B', 1, 'other', 'foul (red in the sheet)'],
      [1, 'B', 1, 'other', 'foul (red in the sheet)'],
      [2, 'B', 1, 'knockdown', null],
      [3, 'B', 1, 'knockdown', 'reason assumed (import)'],
    ],
  );
});

Deno.test('D65: a round with no 10 is the red side’s, docked from 10; with neither or both in red it is refused', () => {
  const a = row('A', [9, 10], 'UD', ['', '', ''], 2);
  const b = row('B', [8, 9], '', ['', '', ''], 3);
  const card = cardOf(sheetCard(a, b, new Map([['2:1', 'red']])));
  deepStrictEqual(card.rounds[0], { round_no: 1, a: 10, b: 9 });
  deepStrictEqual(
    card.deductions.map((d) => [d.side, d.reason, d.note]),
    [['A', 'other', 'foul (red in the sheet)'], ['B', 'knockdown', 'reason assumed (import)']],
  );
  ok(problemsOf(sheetCard(a, b, none))[0].includes('D65'));
  ok(problemsOf(sheetCard(a, b, new Map([['2:1', 'red'], ['3:1', 'red']])))[0].includes('D65'));
});

Deno.test('a card is refused when its cells are out of order, its total is wrong, or it has no decision', () => {
  ok(problemsOf(sheetCard(row('A', [10, 'x', 10]), row('B', [9, 'x', 9], 'UD'), none)).length > 0);
  ok(problemsOf(sheetCard(row('A', [10, 9]), row('B', [9, 10]), none))[0].includes('no decision'));
  ok(problemsOf(sheetCard(row('A', [10, 9, 10]), row('B', [9, 10], 'UD'), none)).length > 0);
  const wrong = { ...row('A', [10, 10]), total: '19' };
  ok(problemsOf(sheetCard(wrong, row('B', [9, 9], 'UD'), none))[0].includes('Total'));
  ok(problemsOf(sheetCard(row('A', [10, 10], 'KBO'), row('B', [9, 9]), none)).length > 0);
});

Deno.test('the fixture export imports: bouts, cards, places, titles and holders, and five rejects that do not lose the batch', () => {
  const db = testDatabase();
  const report = run(db);
  deepStrictEqual(
    [report.read, report.written, report.already, report.rejects.length],
    [12, 7, 0, 5],
  );
  deepStrictEqual(report.rejects.map((r) => r.row_text), [
    'sheet line 2, no date: Edward Vazquez v Irvin Gonzalez',
    'sheet line 42, 2024-05-25: Jason Cunningham v Brad Foster',
    'sheet line 22, 2025-04-19: Tyler Denny v Hamzah Sheeraz',
    'sheet line 30, 2025-04-19: Jose Gonzalez v Diego De La Hoya',
    'sheet line 45: Nobody Under',
  ]);
  ok(report.rejects[0].reason.includes('Date/Location'));
  ok(report.rejects[1].reason.includes('D65'));
  ok(report.rejects[2].reason.includes('19(1)2-3'));
  ok(report.rejects[3].reason.includes('D53'));
  deepStrictEqual(
    all(db, 'SELECT rows_read, rows_written, rows_rejected, source FROM import_batch'),
    [{ rows_read: 12, rows_written: 7, rows_rejected: 5, source: 'sheet' }],
  );
  assertEquals(all(db, 'SELECT * FROM import_reject').length, 5);
  // A refused bout leaves nothing behind: no fighter of the three refused pairs.
  assertEquals(
    all(
      db,
      "SELECT * FROM fighter WHERE last_name IN ('Denny', 'Sheeraz', 'Gonzalez', 'Foster', 'Under')",
    )
      .length,
    0,
  );

  // Places: the American way, and a country written out.
  deepStrictEqual(all(db, 'SELECT name, city, region, country FROM venue ORDER BY name'), [
    { name: 'First Direct Arena', city: 'Leeds', region: null, country: 'England' },
    { name: 'Frontwav Arena', city: 'Oceanside', region: 'CA', country: 'USA' },
    { name: 'Honda Center', city: 'Anaheim', region: 'CA', country: 'USA' },
  ]);
  deepStrictEqual(
    all(
      db,
      `SELECT event.date, count(*) AS bouts FROM bout JOIN event ON event.id = bout.event_id
       GROUP BY event.id ORDER BY event.date`,
    ),
    [{ date: '2021-11-13', bouts: 3 }, { date: '2024-05-25', bouts: 1 }, {
      date: '2025-04-19',
      bouts: 3,
    }],
  );

  const bout = (aLast: string) =>
    all(
      db,
      `SELECT bout.* FROM bout JOIN fighter ON fighter.id = bout.fighter_a_id
       WHERE fighter.last_name = '${aLast}'`,
    )[0];
  const titles = (boutId: unknown) =>
    all(
      db,
      `SELECT sanctioning_body AS body, area, weight_class.name AS class, interim, holder_side
       FROM bout_title JOIN title ON title.id = bout_title.title_id
       JOIN weight_class ON weight_class.id = title.weight_class_id
       WHERE bout_id = ${boutId} ORDER BY title.id`,
    );
  const rounds = (boutId: unknown) =>
    all(
      db,
      `SELECT round_no, side, points FROM round_score WHERE bout_id = ${boutId} ORDER BY round_no, side`,
    )
      .map((r) => `${r.round_no}${r.side}${r.points}`).join(' ');

  // A points win under a title, the champion marked (c), the judges' cards.
  const zepeda = bout('Vincent Moralde');
  deepStrictEqual(
    [
      zepeda.decision_type,
      zepeda.winner,
      zepeda.scheduled_rounds,
      zepeda.is_draft,
      zepeda.card_order,
    ],
    ['UD', 'B', 4, 0, 1],
  );
  deepStrictEqual(
    [zepeda.judge1_a, zepeda.judge1_b, zepeda.judge2_a, zepeda.judge2_b],
    [36, 40, 37, 39],
  );
  deepStrictEqual(titles(zepeda.id), [{
    body: 'WBA',
    area: 'Continental Americas',
    class: 'Lightweight',
    interim: 0,
    holder_side: 'B',
  }]);
  // The record on the night, as the sheet has it.
  deepStrictEqual(
    [
      zepeda.b_won,
      zepeda.b_kos,
      zepeda.b_lost,
      zepeda.b_draws,
      zepeda.b_weight,
      zepeda.b_weight_unit,
      zepeda.b_colors,
    ],
    [23, 21, 0, 0, 134.2, 'lbs', 'Black/Gold'],
  );

  // A knockout: the round it ended in is 0–0, with its time; stone kept as pounds.
  const ko = bout('Loser');
  deepStrictEqual(
    [ko.decision_type, ko.winner, ko.result_round, ko.result_time, ko.card_order],
    ['KO', 'B', 2, '2:44', 2],
  );
  assertEquals(rounds(ko.id), '1A9 1B10 2A0 2B0');
  deepStrictEqual([ko.a_weight, ko.a_weight_unit, ko.b_weight], [200, 'st', 212.5]);
  assertEquals(ko.corner_a, null);

  // A unification: each belt's holder from the name; a draw.
  const draw = bout('Alvarez');
  deepStrictEqual([draw.decision_type, draw.winner], ['D', 'draw']);
  deepStrictEqual(
    titles(draw.id).map((t) => [t.body, t.area, t.class, t.holder_side]),
    [['WBO', 'World', 'Super Middleweight', 'B'], ['WBA', 'World', 'Super Middleweight', 'A']],
  );

  // A vacant title, and the deductions the sheet folded into its rounds.
  const vacant = bout('Jimenez');
  deepStrictEqual(titles(vacant.id).map((t) => [t.body, t.area, t.holder_side]), [[
    'WBC',
    'World Silver',
    'vacant',
  ]]);
  assertEquals(rounds(vacant.id), '1A10 1B9 2A10 2B9 3A9 3B10 4A10 4B9');
  deepStrictEqual(
    all(
      db,
      `SELECT round_no, side, points, reason, note FROM deduction WHERE bout_id = ${vacant.id} ORDER BY id`,
    ),
    [
      { round_no: 2, side: 'B', points: 1, reason: 'other', note: 'foul (red in the sheet)' },
      { round_no: 2, side: 'B', points: 1, reason: 'other', note: 'foul (red in the sheet)' },
      { round_no: 4, side: 'B', points: 1, reason: 'knockdown', note: 'reason assumed (import)' },
    ],
  );
  deepStrictEqual([vacant.b_weight, vacant.b_weight_unit, vacant.b_kos], [146.61, 'kg', 0]);

  // A contracted weight and no class; a retirement.
  const retired = bout('Ozgul');
  deepStrictEqual(
    [
      retired.weight_class_id,
      retired.contracted_weight,
      retired.decision_type,
      retired.winner,
      retired.result_round,
      retired.result_time,
    ],
    [null, 150, 'TKO', 'B', 2, '3:00'],
  );
  assertEquals(rounds(retired.id), '1A9 1B10 2A9 2B10');

  // An eliminator is for no title; the red 9 won its round, less a foul.
  const eliminator = bout('Garcia');
  deepStrictEqual(titles(eliminator.id), []);
  deepStrictEqual([eliminator.decision_type, eliminator.winner], ['MD', 'A']);
  assertEquals(rounds(eliminator.id).slice(0, 9), '1A10 1B9 ');
  deepStrictEqual(
    all(db, `SELECT round_no, side, reason FROM deduction WHERE bout_id = ${eliminator.id}`),
    [{ round_no: 1, side: 'A', reason: 'other' }],
  );

  // A stoppage marked TKO with no time.
  const tko = bout('Zorro');
  deepStrictEqual([tko.decision_type, tko.winner, tko.result_round, tko.result_time], [
    'TKO',
    'B',
    2,
    null,
  ]);
  deepStrictEqual(titles(tko.id).map((t) => [t.body, t.area, t.class, t.holder_side]), [[
    'BBBOFC',
    'British',
    'Cruiserweight',
    'B',
  ]]);
  assertEquals(all(db, 'PRAGMA foreign_key_check').length, 0);
});

Deno.test("a new fighter has the record of their latest night in the sheet plus its result, and the sheet's spelling as an alias", () => {
  const db = testDatabase();
  run(db);
  const fighter = (last: string) =>
    all(
      db,
      `SELECT first_name, won, kos, lost, draws, colors, weight, weight_unit, id FROM fighter WHERE last_name = '${last}'`,
    )[0];
  // Two nights: 20(14)-0-0 in 2021, 21(15)-0-0 in 2024, which he won by TKO.
  const winner = fighter('Winner');
  deepStrictEqual(
    [winner.first_name, winner.won, winner.kos, winner.lost, winner.weight, winner.weight_unit],
    ['Big', 22, 16, 0, 199, 'st'],
  );
  deepStrictEqual([fighter('Loser').won, fighter('Loser').lost, fighter('Loser').draws], [
    16,
    2,
    1,
  ]);
  deepStrictEqual([fighter('Alvarez').won, fighter('Alvarez').draws], [56, 3]); // the draw
  deepStrictEqual(fighter('Vincent Moralde').first_name, 'John');
  assertEquals(all(db, 'SELECT * FROM fighter').length, 13); // Big Winner once
  // The names without what stood beside them.
  deepStrictEqual(
    all(db, "SELECT alias FROM fighter_alias WHERE alias LIKE '%a%e%' ORDER BY alias").map((r) =>
      r.alias
    )
      .filter((alias) =>
        ['Canelo Alvarez', 'Devin Haney', 'William Zepeda'].includes(String(alias))
      ),
    ['Canelo Alvarez', 'Devin Haney', 'William Zepeda'],
  );
  assertEquals(all(db, 'SELECT * FROM fighter_alias').length, 13);
});

Deno.test('running the batch again writes nothing twice, and a bout fixed in the sheet comes in on the next run', () => {
  const db = testDatabase();
  run(db);
  const before = all(db, 'SELECT * FROM fighter ORDER BY id');
  const again = run(db);
  deepStrictEqual([again.written, again.already, again.rejects.length], [0, 7, 5]);
  deepStrictEqual(all(db, 'SELECT * FROM fighter ORDER BY id'), before);
  assertEquals(all(db, 'SELECT * FROM bout').length, 7);
  assertEquals(all(db, 'SELECT * FROM fighter_alias').length, 13);

  // The record's slip of the keyboard, corrected in the sheet.
  const fixed = run(db, file('sheet.csv').replace('19(1)2-3', '19(1)-2-3'));
  deepStrictEqual([fixed.written, fixed.already, fixed.rejects.length], [1, 7, 4]);
  deepStrictEqual(
    all(
      db,
      "SELECT won, lost, draws FROM fighter WHERE last_name IN ('Denny', 'Sheeraz') ORDER BY last_name",
    ),
    [{ won: 19, lost: 3, draws: 3 }, { won: 21, lost: 0, draws: 0 }],
  );
});

Deno.test("a bout v1 brought in keeps its card; the sheet gives it the record on the night v1 never kept, and the fighters' records stay", () => {
  const db = testDatabase();
  const person = (first_name: string, last_name: string) =>
    insertFighter(db, {
      first_name,
      last_name,
      nickname: null,
      colors: null,
      weight: null,
      weight_unit: null,
    });
  const loser = person('Dan', 'Loser');
  const winner = person('Big', 'Winner');
  setFighterRecord(db, winner, { won: 30, lost: 0, draws: 0, nc: 0, kos: 20 });
  const event = eventAt(db, '2021-11-13', {
    name: 'Honda Center',
    city: 'Anaheim',
    region: 'CA',
    country: 'USA',
  });
  // As v1's import leaves one of its oldest bouts, the sides the other way round.
  const id = insertBout(db, {
    event_id: event,
    card_order: 1,
    weight_class_id: 18,
    contracted_weight: null,
    scheduled_rounds: 4,
    fighter_a_id: winner,
    fighter_b_id: loser,
    corner_a: null,
    missed_weight_a: 0,
    missed_weight_b: 0,
  });
  markNoSnapshot(db, id);

  const report = run(db);
  deepStrictEqual([report.written, report.already], [6, 1]);
  deepStrictEqual(report.snapshots, ['sheet line 10, 2021-11-13: Dan Loser v Big Winner']);
  const bout = all(db, `SELECT * FROM bout WHERE id = ${id}`)[0];
  deepStrictEqual(
    [bout.a_won, bout.a_kos, bout.b_won, bout.b_lost, bout.no_snapshot, bout.decision_type],
    [20, 14, 16, 1, 0, null], // the record of each on the night; the card untouched
  );
  assertEquals(all(db, 'SELECT * FROM bout').length, 7);
  assertEquals(all(db, 'SELECT * FROM round_score WHERE bout_id = ' + id).length, 0);
  // Here before the sheet: their records are not the sheet's to set. Big
  // Winner's later night is written, and adds nothing to a record that is
  // not the one the sheet wrote.
  deepStrictEqual(
    all(db, `SELECT won, kos FROM fighter WHERE id IN (${winner}, ${loser}) ORDER BY id`),
    [{ won: 0, kos: 0 }, { won: 30, kos: 20 }],
  );
  // A second run finds the snapshot there and leaves it.
  deepStrictEqual(run(db).snapshots, []);
});

Deno.test('a colours file that does not match the export stops the import before it writes', () => {
  const db = testDatabase();
  throws(
    () =>
      importSheet(db, file('sheet.csv'), 'row,round,colour,boxer\n19,2,red,Somebody Else\n', 'now'),
    /does not match/,
  );
  assertEquals(all(db, 'SELECT * FROM import_batch').length, 0);
});

Deno.test('a bout keeps its place under the date cell when one above it is refused, and takes it when it comes in later', () => {
  const db = testDatabase();
  run(db);
  const card = () =>
    all(
      db,
      `SELECT fighter.last_name AS a, card_order FROM bout JOIN fighter ON fighter.id = fighter_a_id
       JOIN event ON event.id = event_id WHERE event.date = '2025-04-19' ORDER BY card_order`,
    ).map((r) => `${r.card_order} ${r.a}`);
  // Denny v Sheeraz (2) and Gonzalez v De La Hoya (4) were refused.
  deepStrictEqual(card(), ['1 Jimenez', '3 Ozgul', '5 Garcia']);
  run(db, file('sheet.csv').replace('19(1)2-3', '19(1)-2-3'));
  deepStrictEqual(card(), ['1 Jimenez', '2 Denny', '3 Ozgul', '5 Garcia']);
});

Deno.test("a cell that cannot be read on a fighter's latest night refuses that bout, and not their others", () => {
  const db = testDatabase();
  const header = file('sheet.csv').split('\n')[0];
  const fighter = (
    name: string,
    record: string,
    weight: string,
    cells: string,
    total: number,
    decision = '',
  ) => `,,${name},,${weight},${record},${cells},,,,,,,,,${total},${decision},,,`;
  const night = (date: string, record: string, weight: string) => [
    `"${date}, Honda Center, Anaheim, CA",Heavyweight,,,,,,,,,,,,,,,,,,,,,`,
    fighter('Two Nights', record, weight, '10,10,10,10', 40, 'UD'),
    fighter(`Opponent ${date.slice(-4)}`, '5(1)-0-0', '200lbs', '9,9,9,9', 36),
    ',,,,,,,,,,,,,,,,,,,,,,',
  ];
  const csv = [
    header,
    ...night('01/01/2022', '10(5)-0-0', '200lbs'),
    ...night('01/01/2023', '11(5)0-0', '200lbs'), // the record's slip
    ...night('01/01/2024', '12(5)-0-0', 'heavy'), // the weight's
  ].join('\n');
  const report = importSheet(db, csv, 'row,round,colour,boxer\n', 'now');
  deepStrictEqual([report.written, report.rejects.length], [1, 2]);
  ok(report.rejects[0].reason.includes('11(5)0-0'));
  ok(report.rejects[1].reason.includes('heavy'));
  // His one night that reads: 10(5)-0-0 going in, and the win.
  deepStrictEqual(all(db, "SELECT won, kos, lost FROM fighter WHERE last_name = 'Nights'"), [{
    won: 11,
    kos: 5,
    lost: 0,
  }]);
});

Deno.test('a v1 bout with one side’s record on the night gets the other from the sheet, and its mark comes off', () => {
  const db = testDatabase();
  const person = (first_name: string, last_name: string) =>
    insertFighter(db, {
      first_name,
      last_name,
      nickname: null,
      colors: null,
      weight: null,
      weight_unit: null,
    });
  const [loser, winner] = [person('Dan', 'Loser'), person('Big', 'Winner')];
  const event = eventAt(db, '2021-11-13', {
    name: 'Honda Center',
    city: 'Anaheim',
    region: 'CA',
    country: 'USA',
  });
  const id = insertBout(db, {
    event_id: event,
    card_order: 1,
    weight_class_id: 18,
    contracted_weight: null,
    scheduled_rounds: 4,
    fighter_a_id: loser,
    fighter_b_id: winner,
    corner_a: null,
    missed_weight_a: 0,
    missed_weight_b: 0,
  });
  setSideSnapshot(db, id, 'a', {
    won: 1,
    lost: 1,
    draws: 1,
    nc: 0,
    kos: 1,
    weight: null,
    weight_unit: null,
    colors: null,
    tbrb_rank: null,
  });
  markNoSnapshot(db, id);
  deepStrictEqual(run(db).snapshots, ['sheet line 10, 2021-11-13: Dan Loser v Big Winner']);
  const bout = all(db, `SELECT a_won, b_won, b_kos, no_snapshot FROM bout WHERE id = ${id}`)[0];
  deepStrictEqual(bout, { a_won: 1, b_won: 20, b_kos: 14, no_snapshot: 0 }); // v1's side kept
});
