// PUT /api/bouts/:id/card and the card in GET /api/bouts/:id (SPEC API,
// Scoring §1–7). Tier 2: the contract. Tier 3: what a sequence of saves
// leaves behind — the snapshot, the records, the stoppage card, a rollback.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import { type Api, HEAVYWEIGHT, recordOf, testApi, usyk, usykFury } from '../helpers/api.ts';
import { getBout, markNoSnapshot, setBoutResult } from '../../server/db/bout.ts';
import { setFighterRecord } from '../../server/db/fighter.ts';
import { insertTbrbRow } from '../../server/db/tbrb-snapshot.ts';

const r = (round_no: number, a: number, b: number) => ({ round_no, a, b });
const ten = Array.from({ length: 10 }, (_, i) => r(i + 1, 10, 9));
const twelve = [...ten, r(11, 9, 10), r(12, 10, 10)];
const ud = { decision_type: 'UD', winner: 'A', round: 12, time: '3:00' };

const put = (api: Api, boutId: number, card: object) =>
  api.call('PUT', `/api/bouts/${boutId}/card`, card);

// Usyk and Fury as usykFury makes them, before the fight.
const usykBefore = { won: 21, lost: 0, draws: 0, nc: 0, kos: 14 };
const furyBefore = { won: 34, lost: 0, draws: 1, nc: 0, kos: 24 };

// ---- Tier 2 -----------------------------------------------------------------

Deno.test('PUT card saves a draft mid-bout and answers the bout with the card and totals', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const { status, json } = await put(api, boutId, {
    rounds: [r(1, 10, 9), r(2, 9, 10), r(3, 10, 9)],
    deductions: [{ round_no: 3, side: 'B', points: 1, reason: 'knockdown' }],
    result: null,
    is_draft: true,
  });
  assertEquals(status, 200);
  assertEquals(json.id, boutId);
  assertEquals(json.is_draft, 1);
  deepStrictEqual(json.card, {
    rounds: [r(1, 10, 9), r(2, 9, 10), r(3, 10, 9)],
    deductions: [{ round_no: 3, side: 'B', points: 1, reason: 'knockdown', note: null }],
    result: null,
    judges: [{ a: null, b: null }, { a: null, b: null }, { a: null, b: null }],
    is_draft: true,
    totals: { rounds: [r(1, 10, 9), r(2, 9, 10), r(3, 10, 8)], a: 29, b: 27 },
  });
  deepStrictEqual((await api.call('GET', `/api/bouts/${boutId}`)).json.card, json.card);
});

Deno.test('PUT card refuses a card the rules refuse: 400 with the problems, nothing saved', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const cases = {
    'no-gaps': { rounds: [r(1, 10, 9), r(3, 10, 9)], result: null, is_draft: true },
    'points': { rounds: [r(1, 11, 9)], result: null, is_draft: true },
    'after-stoppage': {
      rounds: [r(1, 10, 9), r(2, 0, 0), r(3, 10, 9)],
      result: { decision_type: 'KO', winner: 'A', round: 2, time: '1:00' },
      is_draft: false,
    },
    'winner': { rounds: twelve, result: { ...ud, winner: 'draw' }, is_draft: false },
  };
  for (const [rule, card] of Object.entries(cases)) {
    const { status, json } = await put(api, boutId, card);
    assertEquals(status, 400, rule);
    assertEquals(json.problems.some((p: { rule: string }) => p.rule === rule), true, rule);
  }
  deepStrictEqual((await api.call('GET', `/api/bouts/${boutId}`)).json.card.rounds, []);
  assertEquals(getBout(api.db, boutId)?.a_won, null); // no snapshot either
});

Deno.test('PUT card: finalising without a result is 400 (§5), and nothing moves', async () => {
  const api = testApi();
  const { boutId, aId } = await usykFury(api);
  const { status, json } = await put(api, boutId, {
    rounds: twelve,
    result: null,
    is_draft: false,
  });
  assertEquals(status, 400);
  assertEquals(json.problems.some((p: { rule: string }) => p.rule === 'finalise'), true);
  assertEquals(getBout(api.db, boutId)?.is_draft, 1);
  deepStrictEqual(recordOf(api.db, aId), usykBefore);
});

Deno.test('PUT card: a bad shape is 400 with issues; a missing bout is 404', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const bad = [
    { rounds: [], result: null }, // is_draft missing
    { rounds: [{ round_no: 1, a: 10 }], result: null, is_draft: true },
    { rounds: [], result: { ...ud, decision_type: 'KO2' }, is_draft: false },
    { rounds: [], result: null, is_draft: true, totals: {} }, // totals are read-only
  ];
  for (const body of bad) {
    const { status, json } = await put(api, boutId, body);
    assertEquals(status, 400, JSON.stringify(body));
    assertEquals(json.issues.length > 0, true);
  }
  assertEquals((await put(api, 999, { rounds: [], result: null, is_draft: true })).status, 404);
});

Deno.test('the judges are stored and read back', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const judges = [{ a: 115, b: 113 }, { a: 113, b: 115 }, { a: 114, b: 114 }];
  const { json } = await put(api, boutId, {
    rounds: twelve,
    result: { ...ud, decision_type: 'SD' },
    judges,
    is_draft: false,
  });
  deepStrictEqual(json.card.judges, judges);
  assertEquals(json.judge1_a, 115);
});

// ---- Tier 3 -----------------------------------------------------------------

Deno.test('§4: the stoppage example is stored and read back exactly', async () => {
  // KO in round 2 with a knockdown: rounds 1 and 2 recorded, round 2 at 0 / −1.
  const api = testApi();
  const { boutId } = await usykFury(api);
  await put(api, boutId, {
    rounds: [r(1, 10, 9), r(2, 0, 0)],
    deductions: [{ round_no: 2, side: 'B', points: 1, reason: 'knockdown' }],
    result: { decision_type: 'KO', winner: 'A', round: 2, time: '2:10' },
    is_draft: false,
  });
  const { json } = await api.call('GET', `/api/bouts/${boutId}`);
  deepStrictEqual(json.card.rounds, [r(1, 10, 9), r(2, 0, 0)]);
  deepStrictEqual(json.card.totals, { rounds: [r(1, 10, 9), r(2, 0, -1)], a: 10, b: 8 });
  deepStrictEqual(json.card.result, { decision_type: 'KO', winner: 'A', round: 2, time: '2:10' });
  assertEquals(json.is_draft, 0);
});

Deno.test('§7: the first save takes the snapshot, and nothing after changes it', async () => {
  const api = testApi();
  const { boutId, aId } = await usykFury(api);
  await api.call('PATCH', `/api/fighters/${aId}`, { weight: 223.25 });
  await put(api, boutId, { rounds: [r(1, 10, 9)], result: null, is_draft: true });
  const snapshot = (b: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(b).filter(([k]) => /^[ab]_/.test(k)));
  const first = snapshot(getBout(api.db, boutId)!);
  deepStrictEqual(first, {
    a_won: 21,
    a_lost: 0,
    a_draws: 0,
    a_nc: 0,
    a_kos: 14,
    a_weight: 223.25,
    a_weight_unit: 'lbs',
    a_colors: 'Blue/Yellow',
    a_tbrb_rank: null,
    b_won: 34,
    b_lost: 0,
    b_draws: 1,
    b_nc: 0,
    b_kos: 24,
    b_weight: 262,
    b_weight_unit: 'lbs',
    b_colors: 'White',
    b_tbrb_rank: null,
  });
  // The fighter changes, the card is saved again, then finalised: the
  // snapshot is still the fighter as they were at the first save.
  await api.call('PATCH', `/api/fighters/${aId}`, { weight: 226, colors: 'Gold' });
  await put(api, boutId, { rounds: [r(1, 10, 9), r(2, 10, 9)], result: null, is_draft: true });
  await put(api, boutId, { rounds: twelve, result: ud, is_draft: false });
  deepStrictEqual(snapshot(getBout(api.db, boutId)!), first);
  assertEquals(recordOf(api.db, aId).won, 22); // the record moved; the snapshot did not
});

Deno.test("§7, D25: the snapshot's TBRB rank is the class's last list on or before the fight", async () => {
  const api = testApi();
  const { boutId, aId, bId } = await usykFury(api); // fought 2024-05-18
  const list = (date: string, rank: number, fighter_id: number) =>
    insertTbrbRow(api.db, {
      snapshot_date: date,
      weight_class_id: HEAVYWEIGHT,
      rank,
      fighter_name: `${fighter_id}`,
      fighter_id,
    });
  list('2024-04-01', 1, bId); // an older list: Fury #1, Usyk not on it
  list('2024-05-15', 0, bId); // the last list before the fight: Fury champion, Usyk #1
  list('2024-05-15', 1, aId);
  list('2024-05-25', 0, aId); // after the fight: does not count
  await put(api, boutId, { rounds: [], result: null, is_draft: true });
  const bout = getBout(api.db, boutId)!;
  deepStrictEqual([bout.a_tbrb_rank, bout.b_tbrb_rank], [1, 0]);
});

Deno.test('§6: finalising moves both records once; saving it again moves nothing', async () => {
  const api = testApi();
  const { boutId, aId, bId } = await usykFury(api);
  await put(api, boutId, { rounds: ten, result: null, is_draft: true });
  deepStrictEqual(recordOf(api.db, aId), usykBefore); // a draft counts nothing
  for (let i = 0; i < 2; i++) {
    const { status } = await put(api, boutId, { rounds: twelve, result: ud, is_draft: false });
    assertEquals(status, 200);
    deepStrictEqual(recordOf(api.db, aId), { ...usykBefore, won: 22 });
    deepStrictEqual(recordOf(api.db, bId), { ...furyBefore, lost: 1 });
  }
});

Deno.test('§6: changing a finalised result reverses the old one and applies the new', async () => {
  const api = testApi();
  const { boutId, aId, bId } = await usykFury(api);
  await put(api, boutId, { rounds: twelve, result: ud, is_draft: false });
  // It was Fury by KO in round 9, not Usyk on points.
  await put(api, boutId, {
    rounds: [...ten.slice(0, 8), r(9, 0, 0)],
    result: { decision_type: 'KO', winner: 'B', round: 9, time: '2:30' },
    is_draft: false,
  });
  deepStrictEqual(recordOf(api.db, aId), { ...usykBefore, lost: 1 });
  deepStrictEqual(recordOf(api.db, bId), { ...furyBefore, won: 35, kos: 25 });
  // And back to a draft: the result comes off both records.
  await put(api, boutId, { rounds: ten.slice(0, 8), result: null, is_draft: true });
  deepStrictEqual(recordOf(api.db, aId), usykBefore);
  deepStrictEqual(recordOf(api.db, bId), furyBefore);
});

Deno.test('a failed write mid-transaction leaves the card, the snapshot and both records untouched', async () => {
  const api = testApi();
  const { boutId, aId, bId } = await usykFury(api);
  // The last step of finalise, moving the records, fails after the card rows
  // and the snapshot were written. Test-only fault injection.
  api.db.exec(`CREATE TRIGGER refuse_record BEFORE UPDATE OF won ON fighter
    BEGIN SELECT RAISE(ABORT, 'refused for the test'); END`);
  const { status } = await put(api, boutId, { rounds: twelve, result: ud, is_draft: false });
  assertEquals(status, 500);
  const bout = getBout(api.db, boutId)!;
  deepStrictEqual([bout.is_draft, bout.decision_type, bout.a_won], [1, null, null]);
  deepStrictEqual((await api.call('GET', `/api/bouts/${boutId}`)).json.card.rounds, []);
  deepStrictEqual(recordOf(api.db, aId), usykBefore);
  deepStrictEqual(recordOf(api.db, bId), furyBefore);
});

Deno.test('reversing a result a hand correction already removed is 409, and nothing changes', async () => {
  const api = testApi();
  const { boutId, bId } = await usykFury(api);
  await put(api, boutId, { rounds: twelve, result: ud, is_draft: false });
  await api.call('PATCH', `/api/fighters/${bId}`, { lost: 0 }); // D28
  const { status } = await put(api, boutId, { rounds: twelve, result: null, is_draft: true });
  assertEquals(status, 409);
  assertEquals(getBout(api.db, boutId)?.is_draft, 0);
});

Deno.test('PATCH scheduled_rounds that the saved card no longer fits is 400 with the problems', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  await put(api, boutId, { rounds: ten, result: null, is_draft: true });
  const { status, json } = await api.call('PATCH', `/api/bouts/${boutId}`, { scheduled_rounds: 8 });
  assertEquals(status, 400);
  assertEquals(json.problems.length > 0, true);
  assertEquals(getBout(api.db, boutId)?.scheduled_rounds, 12);
  // Ten rounds fit a ten-round schedule.
  assertEquals(
    (await api.call('PATCH', `/api/bouts/${boutId}`, { scheduled_rounds: 10 })).status,
    200,
  );
});

Deno.test("D32: replacing a draft's fighter clears their side of the snapshot, retaken next save", async () => {
  const api = testApi();
  const { boutId, bId } = await usykFury(api);
  await put(api, boutId, { rounds: [r(1, 10, 9)], result: null, is_draft: true });
  const { json: other } = await api.call('POST', '/api/fighters', {
    ...usyk,
    first_name: 'Anthony',
    last_name: 'Joshua',
    won: 28,
    lost: 3,
    kos: 25,
  });
  await api.call('PATCH', `/api/bouts/${boutId}`, { fighter_a_id: other.id });
  const cleared = getBout(api.db, boutId)!;
  deepStrictEqual([cleared.a_won, cleared.b_won], [null, 34]); // B's stays
  // Fury's record moves before the next save; his side was taken already and
  // must not be retaken along with Joshua's.
  await api.call('PATCH', `/api/fighters/${bId}`, { won: 35 });
  await put(api, boutId, { rounds: [r(1, 10, 9)], result: null, is_draft: true });
  const retaken = getBout(api.db, boutId)!;
  deepStrictEqual([retaken.a_won, retaken.a_lost, retaken.b_won], [28, 3, 34]);
});

Deno.test("replacing a draft's fighter from the scorecard leaves the rounds scored so far as they are", async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  await put(api, boutId, { rounds: [r(1, 10, 9), r(2, 9, 10)], result: null, is_draft: true });
  const { json: brother } = await api.call('POST', '/api/fighters', {
    ...usyk,
    first_name: 'Naoya',
    last_name: 'Inoue',
  });
  const { status, json: bout } = await api.call('PATCH', `/api/bouts/${boutId}`, {
    fighter_a_id: brother.id,
  });
  assertEquals(status, 200);
  assertEquals(bout.fighter_a_id, brother.id);
  assertEquals(bout.is_draft, 1);
  deepStrictEqual(bout.card.rounds, [r(1, 10, 9), r(2, 9, 10)]);
});

Deno.test('§7: a bout finalised without a snapshot (an import from v1) keeps none when its card is saved again', async () => {
  // What task 10 leaves for v1's oldest bouts: finalised, counted in both
  // records, with no snapshot (D128). Set up through the db modules, as the importer does.
  const api = testApi();
  const { boutId, aId, bId } = await usykFury(api);
  setBoutResult(api.db, boutId, {
    decision_type: 'UD',
    winner: 'A',
    result_round: 12,
    result_time: null,
    is_draft: 0,
  });
  setFighterRecord(api.db, aId, { ...usykBefore, won: 22 });
  setFighterRecord(api.db, bId, { ...furyBefore, lost: 1 });
  markNoSnapshot(api.db, boutId);
  const snapshot = () => {
    const bout = getBout(api.db, boutId)!;
    return [bout.a_won, bout.a_weight, bout.b_won, bout.b_lost];
  };

  const { status } = await put(api, boutId, { rounds: twelve, result: ud, is_draft: false });
  assertEquals(status, 200);
  // Today's record less this result is not the record on the night (D138).
  deepStrictEqual(snapshot(), [null, null, null, null]);
  deepStrictEqual(recordOf(api.db, aId), { ...usykBefore, won: 22 }); // counted once, still

  // Reopened as a draft, the result comes off the records, and still no
  // snapshot is taken, at that save or at the ones after it.
  await put(api, boutId, { rounds: twelve, result: ud, is_draft: true });
  deepStrictEqual(recordOf(api.db, aId), { ...usykBefore, won: 21 });
  deepStrictEqual(snapshot(), [null, null, null, null]);
  await put(api, boutId, { rounds: twelve, result: null, is_draft: true });
  await put(api, boutId, { rounds: twelve, result: ud, is_draft: false });
  deepStrictEqual(snapshot(), [null, null, null, null]);
  deepStrictEqual(recordOf(api.db, aId), { ...usykBefore, won: 22 });
});
