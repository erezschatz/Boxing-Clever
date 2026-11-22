// Tier 3: what the database modules write, what they read back, and what the
// schema refuses whatever the caller sends (SPEC Data model, Scoring §1, §4, §5).
import { deepStrictEqual, strictEqual as assertEquals, throws } from 'node:assert/strict';
import { testDatabase } from '../helpers/db.ts';
import type { Database } from '../../server/db/connection.ts';
import { deleteEvent, getEvent, insertEvent } from '../../server/db/event.ts';
import { insertVenue } from '../../server/db/venue.ts';

const kingdomArena = {
  name: 'Kingdom Arena',
  city: 'Riyadh',
  region: null,
  country: 'Saudi Arabia',
};
import {
  deleteFighter,
  type FighterFields,
  getFighter,
  insertFighter,
} from '../../server/db/fighter.ts';
import { findFighterIdByAlias, insertAlias, listAliases } from '../../server/db/fighter-alias.ts';
import {
  type BoutFields,
  deleteBout,
  getBout,
  insertBout,
  listBoutsForEvent,
  listBoutsForFighter,
} from '../../server/db/bout.ts';
import { insertRoundScore, listRoundScores } from '../../server/db/round-score.ts';
import { insertDeduction, listDeductions } from '../../server/db/deduction.ts';
import { insertTitle } from '../../server/db/title.ts';
import { insertBoutTitle, listBoutTitles } from '../../server/db/bout-title.ts';
import { insertTbrbRow, listTbrbSnapshot } from '../../server/db/tbrb-snapshot.ts';
import {
  finishImportBatch,
  getImportBatch,
  startImportBatch,
} from '../../server/db/import-batch.ts';
import { insertImportReject, listImportRejects } from '../../server/db/import-reject.ts';

const HEAVYWEIGHT = 18;

const usyk: FighterFields = {
  first_name: 'Oleksandr',
  last_name: 'Usyk',
  nickname: null,
  colors: 'Blue/Yellow',
  weight: 225.5,
  weight_unit: 'lbs',
};
const fury: FighterFields = { ...usyk, first_name: 'Tyson', last_name: 'Fury', colors: 'White' };

// node:sqlite rows have a null prototype; compare them as plain objects.
const plain = <T extends object>(rows: T[]) => rows.map((row) => ({ ...row }));

function setUpBout(db: Database, overrides: Partial<BoutFields> = {}) {
  const venue_id = insertVenue(db, kingdomArena);
  const eventId = insertEvent(db, { date: '2024-05-18', venue_id });
  const a = insertFighter(db, usyk);
  const b = insertFighter(db, fury);
  const boutId = insertBout(db, {
    event_id: eventId,
    card_order: 1,
    weight_class_id: HEAVYWEIGHT,
    contracted_weight: null,
    scheduled_rounds: 12,
    fighter_a_id: a,
    fighter_b_id: b,
    corner_a: 'blue',
    missed_weight_a: 0,
    missed_weight_b: 0,
    ...overrides,
  });
  return { eventId, a, b, boutId };
}

Deno.test('a bout and its card round-trip through the database', () => {
  const db = testDatabase();
  const { eventId, a, b, boutId } = setUpBout(db);

  // The KO-in-round-2 card from SPEC Testing: round 1 scored, round 2 the
  // stoppage round at points 0 carrying the knockdown.
  insertRoundScore(db, { bout_id: boutId, round_no: 1, side: 'A', points: 10 });
  insertRoundScore(db, { bout_id: boutId, round_no: 1, side: 'B', points: 9 });
  insertRoundScore(db, { bout_id: boutId, round_no: 2, side: 'A', points: 0 });
  insertRoundScore(db, { bout_id: boutId, round_no: 2, side: 'B', points: 0 });
  insertDeduction(db, {
    bout_id: boutId,
    round_no: 2,
    side: 'B',
    points: 1,
    reason: 'knockdown',
    note: null,
  });
  const titleId = insertTitle(db, {
    sanctioning_body: 'WBC',
    area: 'World',
    weight_class_id: HEAVYWEIGHT,
    interim: 0,
  });
  insertBoutTitle(db, { bout_id: boutId, title_id: titleId, holder_side: 'B' });

  const bout = getBout(db, boutId)!;
  assertEquals(bout.fighter_a_id, a);
  assertEquals(bout.fighter_b_id, b);
  assertEquals(bout.corner_a, 'blue');
  assertEquals(bout.is_draft, 1, 'a new bout is a draft');
  assertEquals(bout.a_won, null, 'no snapshot before the first save');
  assertEquals(bout.decision_type, null);

  deepStrictEqual(
    plain(listRoundScores(db, boutId)).map((
      { round_no, side, points },
    ) => [round_no, side, points]),
    [[1, 'A', 10], [1, 'B', 9], [2, 'A', 0], [2, 'B', 0]],
  );
  deepStrictEqual(
    plain(listDeductions(db, boutId)).map(({ round_no, side, points, reason }) => [
      round_no,
      side,
      points,
      reason,
    ]),
    [[2, 'B', 1, 'knockdown']],
  );
  assertEquals(listBoutTitles(db, boutId)[0].holder_side, 'B');
  deepStrictEqual(listBoutsForEvent(db, eventId).map((x) => x.id), [boutId]);
  deepStrictEqual(listBoutsForFighter(db, b).map((x) => x.id), [boutId]);
});

Deno.test('a new fighter starts at 0-0-0 and resolves by exact alias only', () => {
  const db = testDatabase();
  const id = insertFighter(db, usyk);
  const fighter = getFighter(db, id)!;
  deepStrictEqual(
    [fighter.won, fighter.lost, fighter.draws, fighter.nc, fighter.kos],
    [0, 0, 0, 0, 0],
  );
  insertAlias(db, id, 'Oleksandr Usyk');
  assertEquals(findFighterIdByAlias(db, 'Oleksandr Usyk'), id);
  assertEquals(findFighterIdByAlias(db, 'oleksandr usyk'), undefined);
  assertEquals(findFighterIdByAlias(db, 'Alexander Usyk'), undefined);
  deepStrictEqual(listAliases(db, id).map((x) => x.alias), ['Oleksandr Usyk']);
});

Deno.test('an alias names one fighter only', () => {
  const db = testDatabase();
  insertAlias(db, insertFighter(db, usyk), 'Usyk');
  throws(() => insertAlias(db, insertFighter(db, fury), 'Usyk'), /UNIQUE/);
});

Deno.test('round points outside 0–10 are refused (Scoring §1)', () => {
  const db = testDatabase();
  const { boutId } = setUpBout(db);
  throws(
    () => insertRoundScore(db, { bout_id: boutId, round_no: 1, side: 'A', points: 11 }),
    /CHECK/,
  );
  throws(
    () => insertRoundScore(db, { bout_id: boutId, round_no: 1, side: 'A', points: -1 }),
    /CHECK/,
  );
  insertRoundScore(db, { bout_id: boutId, round_no: 1, side: 'A', points: 10 });
  throws(
    () => insertRoundScore(db, { bout_id: boutId, round_no: 1, side: 'A', points: 9 }),
    /UNIQUE/,
    'one row per side per round',
  );
});

Deno.test('a deduction needs a recorded round for that side (Scoring §4)', () => {
  const db = testDatabase();
  const { boutId } = setUpBout(db);
  insertRoundScore(db, { bout_id: boutId, round_no: 1, side: 'A', points: 10 });
  const deduction = {
    bout_id: boutId,
    round_no: 1,
    side: 'B' as const,
    points: 1,
    reason: 'low blow' as const,
    note: null,
  };
  throws(() => insertDeduction(db, deduction), /FOREIGN KEY/);
  throws(() => insertDeduction(db, { ...deduction, side: 'A', round_no: 2 }), /FOREIGN KEY/);
  insertDeduction(db, { ...deduction, side: 'A' });
  throws(() => insertDeduction(db, { ...deduction, side: 'A', points: 0 }), /CHECK/);
});

Deno.test('checked values outside their sets are refused', () => {
  const db = testDatabase();
  const { boutId, eventId, a } = setUpBout(db);
  const set = (sql: string, ...params: (string | number)[]) =>
    db.prepare(sql).run(...params, boutId);

  throws(() => set('UPDATE bout SET corner_a = ? WHERE id = ?', 'green'), /CHECK/);
  insertRoundScore(db, { bout_id: boutId, round_no: 1, side: 'A', points: 10 });
  throws(() => set('UPDATE round_score SET side = ? WHERE bout_id = ?', 'C'), /CHECK/);
  throws(
    () => set("UPDATE bout SET decision_type = ?, winner = 'A' WHERE id = ?", 'Unanimous Decision'),
    /CHECK/,
    'the code, never the label (§5)',
  );
  throws(
    () => set("UPDATE bout SET decision_type = 'UD', winner = ? WHERE id = ?", 'red'),
    /CHECK/,
  );
  throws(() => set('UPDATE bout SET decision_type = ? WHERE id = ?', 'UD'), /CHECK/, 'no winner');
  const titleId = insertTitle(db, {
    sanctioning_body: 'WBO',
    area: 'World',
    weight_class_id: HEAVYWEIGHT,
    interim: 0,
  });
  throws(
    () => insertBoutTitle(db, { bout_id: boutId, title_id: titleId, holder_side: 'C' as 'A' }),
    /CHECK/,
  );
  const venue_id = insertVenue(db, { ...kingdomArena, name: 'Nowhere' });
  throws(() => insertEvent(db, { date: '2026-02-30', venue_id }), /CHECK/);
  throws(() => insertEvent(db, { date: '18/05/2024', venue_id }), /CHECK/);
  throws(
    () =>
      insertBout(db, {
        event_id: eventId,
        card_order: 2,
        weight_class_id: HEAVYWEIGHT,
        contracted_weight: null,
        scheduled_rounds: 12,
        fighter_a_id: a,
        fighter_b_id: a,
        corner_a: null,
        missed_weight_a: 0,
        missed_weight_b: 0,
      }),
    /CHECK/,
    'a fighter cannot fight themself',
  );
});

Deno.test('a bout has a class or a contracted weight, one of the two; missed weight is 0 or 1 (D26, D45)', () => {
  const db = testDatabase();
  const { boutId } = setUpBout(db, {
    weight_class_id: null,
    contracted_weight: 150,
    missed_weight_b: 1,
  });
  const bout = getBout(db, boutId)!;
  assertEquals(bout.weight_class_id, null);
  assertEquals(bout.contracted_weight, 150);
  deepStrictEqual([bout.missed_weight_a, bout.missed_weight_b], [0, 1]);

  const set = (sql: string, ...params: (number | null)[]) => db.prepare(sql).run(...params, boutId);
  throws(
    () => set('UPDATE bout SET contracted_weight = ? WHERE id = ?', null),
    /CHECK/,
    'neither a class nor a contracted weight',
  );
  throws(
    () => set('UPDATE bout SET weight_class_id = ? WHERE id = ?', HEAVYWEIGHT),
    /CHECK/,
    'both a class and a contracted weight',
  );
  throws(() => set('UPDATE bout SET contracted_weight = ? WHERE id = ?', 0), /CHECK/);
  throws(() => set('UPDATE bout SET missed_weight_a = ? WHERE id = ?', 2), /CHECK/);
  throws(() => set('UPDATE bout SET missed_weight_b = ? WHERE id = ?', null), /NOT NULL/);
});

Deno.test('units, rounds, ranks and reasons outside their ranges are refused', () => {
  const db = testDatabase();
  const { boutId } = setUpBout(db);
  const set = (sql: string, value: string | number) => db.prepare(sql).run(value, boutId);

  throws(() => insertFighter(db, { ...usyk, weight_unit: 'stone' as 'st' }), /CHECK/);
  throws(() => set('UPDATE bout SET a_weight_unit = ? WHERE id = ?', 'pounds'), /CHECK/);
  throws(() => set('UPDATE bout SET scheduled_rounds = ? WHERE id = ?', 0), /CHECK/);
  throws(() => set('UPDATE bout SET scheduled_rounds = ? WHERE id = ?', 16), /CHECK/);
  set('UPDATE bout SET scheduled_rounds = ? WHERE id = ?', 15);
  throws(() => set('UPDATE bout SET result_round = ? WHERE id = ?', 0), /CHECK/);
  throws(() => set('UPDATE bout SET b_tbrb_rank = ? WHERE id = ?', -1), /CHECK/);
  set('UPDATE bout SET b_tbrb_rank = ? WHERE id = ?', 0); // champion
  throws(
    () =>
      set('UPDATE fighter SET won = ? WHERE id = (SELECT fighter_a_id FROM bout WHERE id = ?)', -1),
    /CHECK/,
  );
  insertRoundScore(db, { bout_id: boutId, round_no: 1, side: 'A', points: 10 });
  throws(
    () =>
      insertDeduction(db, {
        bout_id: boutId,
        round_no: 1,
        side: 'A',
        points: 1,
        reason: 'biting' as 'other',
        note: null,
      }),
    /CHECK/,
  );
});

Deno.test('a bout cannot be finalised without a result', () => {
  const db = testDatabase();
  const { boutId } = setUpBout(db);
  throws(() => db.prepare('UPDATE bout SET is_draft = 0 WHERE id = ?').run(boutId), /CHECK/);
  db.prepare("UPDATE bout SET is_draft = 0, decision_type = 'KO', winner = 'A' WHERE id = ?")
    .run(boutId);
  assertEquals(getBout(db, boutId)!.is_draft, 0);
});

Deno.test('a fighter with bouts cannot be deleted; one without can', () => {
  const db = testDatabase();
  const { a } = setUpBout(db);
  throws(() => deleteFighter(db, a), /FOREIGN KEY/);
  const loner = insertFighter(db, { ...usyk, last_name: 'Nobody' });
  insertAlias(db, loner, 'Nobody');
  assertEquals(deleteFighter(db, loner), true);
  assertEquals(findFighterIdByAlias(db, 'Nobody'), undefined, 'its aliases go with it');
});

Deno.test('deleting bouts removes their cards and leaves their event in place', () => {
  const db = testDatabase();
  const { boutId, eventId, a, b } = setUpBout(db);
  const other = insertBout(db, {
    event_id: eventId,
    card_order: 2,
    weight_class_id: HEAVYWEIGHT,
    contracted_weight: null,
    scheduled_rounds: 10,
    fighter_a_id: a,
    fighter_b_id: b,
    corner_a: null,
    missed_weight_a: 0,
    missed_weight_b: 0,
  });
  insertRoundScore(db, { bout_id: boutId, round_no: 1, side: 'A', points: 10 });
  insertDeduction(db, {
    bout_id: boutId,
    round_no: 1,
    side: 'A',
    points: 1,
    reason: 'holding',
    note: 'warned twice',
  });
  assertEquals(deleteBout(db, boutId), true);
  assertEquals(listRoundScores(db, boutId).length, 0);
  assertEquals(listDeductions(db, boutId).length, 0);
  assertEquals(getEvent(db, eventId)?.id, eventId, 'the event stays');
  deepStrictEqual(listBoutsForEvent(db, eventId).map((x) => x.id), [other]);
  assertEquals(deleteBout(db, boutId), false, 'a second delete finds nothing');

  assertEquals(deleteBout(db, other), true);
  assertEquals(getEvent(db, eventId)?.id, eventId, 'not even when its last bout goes');
});

Deno.test('deleting an event removes its bouts', () => {
  const db = testDatabase();
  const { boutId, eventId } = setUpBout(db);
  insertRoundScore(db, { bout_id: boutId, round_no: 1, side: 'A', points: 10 });
  assertEquals(deleteEvent(db, eventId), true);
  assertEquals(getEvent(db, eventId), undefined);
  assertEquals(getBout(db, boutId), undefined);
  assertEquals(listRoundScores(db, boutId).length, 0);
});

Deno.test('a TBRB list stores champion and ranks, linked or not', () => {
  const db = testDatabase();
  const usykId = insertFighter(db, usyk);
  const row = { snapshot_date: '2024-05-22', weight_class_id: HEAVYWEIGHT };
  insertTbrbRow(db, { ...row, rank: 0, fighter_name: 'Oleksandr Usyk', fighter_id: usykId });
  insertTbrbRow(db, { ...row, rank: 1, fighter_name: 'Tyson Fury', fighter_id: null });
  deepStrictEqual(
    plain(listTbrbSnapshot(db, HEAVYWEIGHT, '2024-05-22')).map((r) => [r.rank, r.fighter_id]),
    [[0, usykId], [1, null]],
  );
  throws(
    () => insertTbrbRow(db, { ...row, rank: 2, fighter_name: 'Tyson Fury', fighter_id: null }),
    /UNIQUE/,
    'a name appears once per list',
  );
});

Deno.test('an import batch keeps its counts and its rejects', () => {
  const db = testDatabase();
  const id = startImportBatch(db, 'sheet', '2026-11-02T10:00:00Z');
  insertImportReject(db, id, '13/11/2021. Honda Center,,,Z`che', 'unknown decision "Z`che"');
  finishImportBatch(db, id, '2026-11-02T10:00:05Z', {
    rows_read: 3,
    rows_written: 2,
    rows_rejected: 1,
  });
  const batch = getImportBatch(db, id)!;
  deepStrictEqual(
    [batch.source, batch.rows_read, batch.rows_written, batch.rows_rejected, batch.finished_at],
    ['sheet', 3, 2, 1, '2026-11-02T10:00:05Z'],
  );
  deepStrictEqual(listImportRejects(db, id).map((r) => r.reason), ['unknown decision "Z`che"']);
  throws(() => startImportBatch(db, 'mongo' as 'v1', '2026-11-02T10:00:00Z'), /CHECK/);
});
