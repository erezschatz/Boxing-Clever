// The v1 import (IMPORT.md, Source B; task 10). Tier 1 for a v1 document
// read as a card; tier 3 for what a batch leaves in the database, from the
// fixture dump in tests/fixtures/v1 (seven bouts, as `mysql --batch` and
// mongoexport write them).
import { deepStrictEqual, ok, strictEqual as assertEquals } from 'node:assert/strict';
import type { Database } from '../../server/db/connection.ts';
import { importV1, parseTsv, type V1Dumps } from '../../server/import/v1.ts';
import { v1Card, type V1Doc } from '../../server/import/v1-card.ts';
import { testDatabase } from '../helpers/db.ts';

const FIXTURES = new URL('../fixtures/v1/', import.meta.url);
const file = (name: string) => Deno.readTextFileSync(new URL(name, FIXTURES));

function dumps(): V1Dumps {
  return {
    events: parseTsv(file('event.tsv')),
    fighters: parseTsv(file('fighter.tsv')),
    weightClasses: parseTsv(file('weight_class.tsv')),
    titles: parseTsv(file('title.tsv')),
    bouts: parseTsv(file('bout_detail.tsv')),
    boutTitles: parseTsv(file('bout_title.tsv')),
    docs: JSON.parse(file('v1-mongo.json')),
  };
}

const side = (score: number, deductions: string[] = [], total = score - deductions.length) => ({
  round_score: score,
  total_score: total,
  deductions,
});
const round = (a: number, b: number) => ({ fighterA: side(a), fighterB: side(b) });
const doc = (fields: Partial<V1Doc>): V1Doc => ({ bout_id: 1, rounds: [], ...fields });
const result = (type: string, winner: string, round = 0, time = '') => ({
  time,
  round,
  decision: { type, winner },
});
const problemsOf = (read: ReturnType<typeof v1Card>) => 'problems' in read ? read.problems : [];
const cardOf = (read: ReturnType<typeof v1Card>) => {
  if ('problems' in read) throw new Error(read.problems.join('; '));
  return read.card;
};

Deno.test('parseTsv reads mysql --batch: a header, NULL as null, and escaped tabs and backslashes', () => {
  deepStrictEqual(parseTsv('id\tname\tnote\n1\tO\\\\Neil\tNULL\n2\ta\\tb\t\n'), [
    { id: '1', name: 'O\\Neil', note: null },
    { id: '2', name: 'a\tb', note: '' },
  ]);
  deepStrictEqual(parseTsv(''), []);
});

Deno.test('D125: v1 dropped the stoppage round, and it comes back at 0–0', () => {
  const card = cardOf(v1Card(
    doc({ rounds: [round(10, 9), round(10, 9)], result: result('TKO', 'fighterA', 3, '01:10') }),
    4,
  ));
  deepStrictEqual(card.rounds.at(-1), { round_no: 3, a: 0, b: 0 });
  deepStrictEqual(card.result, { decision_type: 'TKO', winner: 'A', round: 3, time: '1:10' });
  assertEquals(card.is_draft, false);
  // Watched and not scored: no rounds, and none invented.
  deepStrictEqual(
    cardOf(v1Card(doc({ result: result('KO', 'fighterB', 2, '0:40') }), 4)).rounds,
    [],
  );
  // Rounds missing before the stoppage are not made up.
  ok(
    problemsOf(v1Card(doc({ rounds: [round(10, 9)], result: result('KO', 'fighterA', 4) }), 4))
      .length > 0,
  );
});

Deno.test('D125: a v1 deduction is one point when the round adds up, and the bout is refused when it does not', () => {
  const kd = { fighterA: side(9, ['KnockDown', 'IllegalPunch']), fighterB: side(10) };
  const card = cardOf(v1Card(doc({ rounds: [kd] }), 4));
  deepStrictEqual(card.deductions, [
    { round_no: 1, side: 'A', points: 1, reason: 'knockdown', note: null },
    { round_no: 1, side: 'A', points: 1, reason: 'other', note: 'illegal punch' },
  ]);
  // v1 kept a total that two one-point deductions do not explain.
  const off = { fighterA: side(9, ['KnockDown'], 6), fighterB: side(10) };
  ok(/is not the total v1 stored/.test(problemsOf(v1Card(doc({ rounds: [off] }), 4))[0]));
  const unknown = { fighterA: side(10), fighterB: side(9, ['Punch']) };
  ok(/"Punch" is not one of v1's/.test(problemsOf(v1Card(doc({ rounds: [unknown] }), 4))[0]));
});

Deno.test("D126: v1's T is a draw over the distance, a TD is refused, and the winner's kind follows the type", () => {
  const four = [round(10, 9), round(9, 10), round(10, 9), round(9, 10)];
  deepStrictEqual(cardOf(v1Card(doc({ rounds: four, result: result('T', 'draw') }), 4)).result, {
    decision_type: 'D',
    winner: 'draw',
    round: null,
    time: null,
  });
  ok(/technical decision/.test(
    problemsOf(
      v1Card(doc({ rounds: four.slice(0, 2), result: result('TD', 'fighterA', 3) }), 4),
    )[0],
  ));
  // v1 wrote a side as the winner of a no contest; the type says there is none.
  assertEquals(
    cardOf(v1Card(doc({ result: result('NC', 'fighterA', 2) }), 4)).result?.winner,
    'none',
  );
  ok(problemsOf(v1Card(doc({ rounds: four, result: result('UD', 'draw') }), 4)).length > 0);
  ok(problemsOf(v1Card(doc({ rounds: four, result: result('RTD', 'fighterA') }), 4)).length > 0);
});

Deno.test("D125: a document with no decision is a draft; one with a decision passes the card's rules or is refused", () => {
  const draft = cardOf(v1Card(doc({ rounds: [round(10, 9)] }), 4));
  assertEquals(draft.is_draft, true);
  assertEquals(draft.result, null);
  // A decision over the distance with rounds missing is what PUT /card refuses too.
  ok(
    problemsOf(v1Card(doc({ rounds: [round(10, 9)], result: result('UD', 'fighterA') }), 4))
      .length > 0,
  );
  // Judges' totals of 0–0 are no card.
  const read = v1Card(
    doc({
      result: {
        ...result('KO', 'fighterA', 1, '2:00'),
        judges_scores: {
          ref_1: { fighterA: 0, fighterB: 0 },
          ref_2: { fighterA: 39, fighterB: 37 },
        },
      },
    }),
    4,
  );
  ok(!('problems' in read));
  deepStrictEqual(read.judges, [{ a: null, b: null }, { a: 39, b: 37 }, { a: null, b: null }]);
});

const all = (db: Database, sql: string) => db.prepare(sql).all().map((row) => ({ ...row }));
const recordOf = (db: Database, last: string) =>
  all(db, `SELECT won, lost, draws, nc, kos FROM fighter WHERE last_name = '${last}'`);

Deno.test('the fixture dump imports: bouts, cards, places and titles, and three rejects that do not lose the batch', () => {
  const db = testDatabase();
  const report = importV1(db, dumps(), '2026-11-22T10:00:00Z');
  deepStrictEqual([report.read, report.written, report.already, report.rejects.length], [
    7,
    4,
    0,
    3,
  ]);

  // The rejects: said, stored with the batch, and nothing of theirs left behind.
  const reasons = report.rejects.map((r) => r.reason).join('\n');
  for (
    const said of [
      /"Punch" is not one of v1's/,
      /technical decision/,
      /Utilita Arena Newcastle, England/,
    ]
  ) {
    ok(said.test(reasons), reasons);
  }
  deepStrictEqual(
    all(db, 'SELECT source, rows_read, rows_written, rows_rejected FROM import_batch'),
    [{ source: 'v1', rows_read: 7, rows_written: 4, rows_rejected: 3 }],
  );
  deepStrictEqual(
    all(db, 'SELECT row_text, reason FROM import_reject ORDER BY id').sort((x, y) =>
      String(x.reason).localeCompare(String(y.reason))
    ),
    [...report.rejects].sort((x, y) => x.reason.localeCompare(y.reason)),
  );
  ok(
    /v1 bout 4, 2025-11-22: Fay Fox v Gia Golf/.test(report.rejects.map((r) => r.row_text).join()),
  );
  // Fay Fox fought only in refused bouts, so she is not here.
  deepStrictEqual(all(db, "SELECT id FROM fighter WHERE last_name = 'Fox'"), []);

  // Places: a state names the USA (D129); the same four parts are one venue.
  deepStrictEqual(all(db, 'SELECT name, city, region, country FROM venue ORDER BY name'), [
    { name: 'ANB Arena', city: 'Riyadh', region: null, country: 'Saudi Arabia' },
    { name: 'T-Mobile Arena', city: 'Las Vegas', region: 'NV', country: 'USA' },
  ]);
  deepStrictEqual(all(db, 'SELECT date FROM event ORDER BY date'), [
    { date: '2025-09-13' },
    { date: '2025-11-22' },
  ]);

  // Fighters: names trimmed, the two Ana Alphas one fighter from the later row (D133).
  deepStrictEqual(report.folded.length, 1);
  deepStrictEqual(
    all(
      db,
      'SELECT first_name, last_name, nickname, weight, weight_unit, colors FROM fighter ORDER BY last_name',
    ),
    [
      {
        first_name: 'ana',
        last_name: 'Alpha',
        nickname: 'Ace',
        weight: 146.5,
        weight_unit: 'lbs',
        colors: 'Gold',
      },
      {
        first_name: 'Bea',
        last_name: 'Bravo',
        nickname: null,
        weight: null,
        weight_unit: null,
        colors: null,
      },
      {
        first_name: 'Cy',
        last_name: 'Charlie',
        nickname: 'The Sea',
        weight: 66.5,
        weight_unit: 'kg',
        colors: 'Blue/White',
      },
      {
        first_name: 'Dee',
        last_name: 'Delta',
        nickname: null,
        weight: 10.7,
        weight_unit: 'st',
        colors: null,
      },
      {
        first_name: 'Eve',
        last_name: 'Echo',
        nickname: null,
        weight: 147,
        weight_unit: 'lbs',
        colors: null,
      },
      {
        first_name: 'Gia',
        last_name: 'Golf',
        nickname: null,
        weight: null,
        weight_unit: null,
        colors: null,
      },
      {
        first_name: 'Hal',
        last_name: 'Hotel',
        nickname: null,
        weight: null,
        weight_unit: null,
        colors: null,
      },
    ],
  );

  const bout = (a: string, b: string) =>
    all(
      db,
      `SELECT bout.* FROM bout JOIN fighter fa ON fa.id = fighter_a_id JOIN fighter fb ON fb.id = fighter_b_id
       WHERE fa.last_name = '${a}' AND fb.last_name = '${b}'`,
    )[0];
  const rounds = (id: unknown) =>
    all(
      db,
      `SELECT round_no, side, points FROM round_score WHERE bout_id = ${id} ORDER BY round_no, side`,
    );

  // Bout 1: stopped in round 3, which v1 dropped; the oldest shape has no snapshot (D128).
  const tko = bout('Alpha', 'Bravo');
  deepStrictEqual(
    [
      tko.decision_type,
      tko.winner,
      tko.result_round,
      tko.result_time,
      tko.is_draft,
      tko.a_won,
      tko.b_won,
      tko.corner_a,
    ],
    ['TKO', 'A', 3, '1:10', 0, null, null, null],
  );
  deepStrictEqual(rounds(tko.id).slice(-2), [
    { round_no: 3, side: 'A', points: 0 },
    { round_no: 3, side: 'B', points: 0 },
  ]);

  // Bout 2: v1 called it a draft, and it has a result, so it is final; the
  // snapshot is the document's, the knockdown one point, the judges kept.
  const ud = bout('Charlie', 'Delta');
  deepStrictEqual([ud.decision_type, ud.winner, ud.result_round, ud.is_draft], [
    'UD',
    'B',
    null,
    0,
  ]);
  deepStrictEqual(
    [ud.a_won, ud.a_kos, ud.a_weight, ud.a_weight_unit, ud.a_colors, ud.b_won, ud.b_weight_unit],
    [5, 2, 66.5, 'kg', 'Blue/White', 2, 'st'],
  );
  deepStrictEqual([ud.judge1_a, ud.judge1_b, ud.judge3_a, ud.judge3_b], [36, 39, 37, 38]);
  deepStrictEqual(
    all(db, `SELECT round_no, side, points, reason, note FROM deduction WHERE bout_id = ${ud.id}`),
    [{ round_no: 2, side: 'A', points: 1, reason: 'knockdown', note: null }],
  );

  // Its two v1 rows of one belt, "Vacant" IBF World and "Active" ibf world,
  // are one line, and the row that is not vacant decides: no holder recorded.
  deepStrictEqual(
    all(
      db,
      `SELECT sanctioning_body, area, holder_side FROM bout_title
       JOIN title ON title.id = title_id WHERE bout_id = ${ud.id}`,
    ),
    [{ sanctioning_body: 'IBF', area: 'World', holder_side: null }],
  );
  // No snapshot came with bout 1's card, and none is to be taken later (D138).
  deepStrictEqual([tko.no_snapshot, ud.no_snapshot], [1, 0]);

  // Bout 3: v1's T is a draw (D126). Its titles: the regular WBC with the
  // holder not recorded (D127), the IBF vacant, and "Interim Silver" as the
  // interim WBC World Silver (D42).
  const draw = bout('Alpha', 'Echo');
  deepStrictEqual([draw.decision_type, draw.winner, draw.is_draft], ['D', 'draw', 0]);
  deepStrictEqual(
    all(
      db,
      `SELECT sanctioning_body, area, interim, holder_side FROM bout_title
       JOIN title ON title.id = title_id WHERE bout_id = ${draw.id} ORDER BY sanctioning_body, interim`,
    ),
    [
      { sanctioning_body: 'IBF', area: 'World', interim: 0, holder_side: 'vacant' },
      { sanctioning_body: 'WBC', area: 'World', interim: 0, holder_side: null },
      { sanctioning_body: 'WBC', area: 'World Silver', interim: 1, holder_side: null },
    ],
  );

  // Bout 6 has no document: an unscored bout.
  const unscored = bout('Golf', 'Hotel');
  deepStrictEqual([unscored.is_draft, unscored.decision_type, rounds(unscored.id).length], [
    1,
    null,
    0,
  ]);
});

Deno.test('D137: a fighter arrives with the record going into their latest v1 bout, plus that bout once it is written', () => {
  const db = testDatabase();
  importV1(db, dumps(), '2026-11-22T10:00:00Z');
  const record = (won: number, lost: number, draws: number, kos: number) => [
    { won, lost, draws, nc: 0, kos },
  ];
  // Saved before v1 counted results: the row is the record going in, and the result is added.
  deepStrictEqual(recordOf(db, 'Bravo'), record(8, 2, 0, 3));
  deepStrictEqual(recordOf(db, 'Charlie'), record(5, 1, 0, 2));
  // Saved after: v1's row already holds the draw, and it is counted once.
  deepStrictEqual(recordOf(db, 'Echo'), record(6, 2, 1, 4));
  // Two rows, one fighter: the later row's record, its own bout's draw counted
  // once, and the earlier row's win not added again (D133).
  deepStrictEqual(recordOf(db, 'Alpha'), record(11, 0, 1, 6));
  // Delta's win is an earlier bout: v1's row, typed for the later one, has it.
  deepStrictEqual(recordOf(db, 'Delta'), record(3, 0, 0, 1));
  // Their latest bouts are unscored or refused: the row as it is.
  deepStrictEqual(recordOf(db, 'Golf'), record(2, 2, 0, 0));
  deepStrictEqual(recordOf(db, 'Hotel'), record(1, 0, 0, 1));
});

Deno.test('running the batch again writes nothing twice, and a bout fixed in the dump comes in on the next run', () => {
  const db = testDatabase();
  importV1(db, dumps(), '2026-11-22T10:00:00Z');
  const counts = () =>
    all(
      db,
      `SELECT (SELECT count(*) FROM bout) AS bouts, (SELECT count(*) FROM fighter) AS fighters,
         (SELECT count(*) FROM event) AS events, (SELECT count(*) FROM venue) AS venues,
         (SELECT count(*) FROM title) AS titles, (SELECT count(*) FROM round_score) AS rounds,
         (SELECT group_concat(won || '-' || lost || '-' || draws, ' ') FROM fighter) AS records`,
    )[0];
  const before = counts();
  const again = importV1(db, dumps(), '2026-11-22T11:00:00Z');
  deepStrictEqual([again.written, again.already, again.rejects.length], [0, 4, 3]);
  deepStrictEqual(counts(), before);
  assertEquals(all(db, 'SELECT id FROM import_batch').length, 2);

  // Erez fixes the deduction in the source and runs it again: bout 4 comes
  // in, Fay Fox with it, her win counted once on top of the record going in.
  const fixed = dumps();
  fixed.docs = JSON.parse(file('v1-mongo.json').replace('"Punch"', '"LowBlow"'));
  const third = importV1(db, fixed, '2026-11-22T12:00:00Z');
  deepStrictEqual([third.written, third.already, third.rejects.length], [1, 4, 2]);
  deepStrictEqual(recordOf(db, 'Fox'), [{ won: 4, lost: 0, draws: 0, nc: 0, kos: 4 }]);
  // Golf's latest bout is the unscored one, so this earlier loss is in the row already.
  deepStrictEqual(recordOf(db, 'Golf'), [{ won: 2, lost: 2, draws: 0, nc: 0, kos: 0 }]);
});
