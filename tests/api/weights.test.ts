// Tier 3: a bout's weight across requests (D26, D45). A bout is fought in a
// class or at a contracted weight in pounds, one of the two; each side can be
// marked as having missed weight. What the API takes, what it leaves in the
// database, and what the card, the event and the fighter's history answer.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import { finalise, HEAVYWEIGHT, testApi, usykFury } from '../helpers/api.ts';
import { getBout } from '../../server/db/bout.ts';
import { insertTbrbRow } from '../../server/db/tbrb-snapshot.ts';

const LIGHTWEIGHT = 10;
const weightOf = (b: { weight_class_id: number | null; contracted_weight: number | null }) => [
  b.weight_class_id,
  b.contracted_weight,
];
const marksOf = (b: { missed_weight_a: number; missed_weight_b: number }) => [
  b.missed_weight_a,
  b.missed_weight_b,
];

Deno.test('a bout at a contracted weight round-trips: no class, the pounds as sent, wherever the bout is answered', async () => {
  const api = testApi();
  const { eventId, aId, bId } = await usykFury(api);
  const made = await api.call('POST', '/api/bouts', {
    event_id: eventId,
    contracted_weight: 150.5,
    scheduled_rounds: 10,
    fighter_a_id: aId,
    fighter_b_id: bId,
  });
  assertEquals(made.status, 201);
  deepStrictEqual(weightOf(made.json), [null, 150.5]);
  deepStrictEqual(weightOf(getBout(api.db, made.json.id)!), [null, 150.5]);
  deepStrictEqual(weightOf((await api.call('GET', `/api/bouts/${made.json.id}`)).json), [
    null,
    150.5,
  ]);
  const onCard = (await api.call('GET', `/api/events/${eventId}/bouts`)).json;
  deepStrictEqual(onCard.map(weightOf), [[HEAVYWEIGHT, null], [null, 150.5]]);
  const history = (await api.call('GET', `/api/fighters/${bId}/bouts`)).json;
  deepStrictEqual(history.map(weightOf), [[HEAVYWEIGHT, null], [null, 150.5]]);

  // Saving and finalising the card keep it.
  const done = await finalise(api, made.json.id, { decision_type: 'UD', winner: 'A' });
  deepStrictEqual(weightOf(done), [null, 150.5]);
});

Deno.test('a bout with neither a class nor a contracted weight is refused, and so is one with both', async () => {
  const api = testApi();
  const { eventId, aId, bId, boutId } = await usykFury(api);
  const base = { event_id: eventId, scheduled_rounds: 10, fighter_a_id: aId, fighter_b_id: bId };
  const bad = [
    base,
    { ...base, weight_class_id: null, contracted_weight: null },
    { ...base, weight_class_id: HEAVYWEIGHT, contracted_weight: 150 },
    { ...base, contracted_weight: 0 },
    { ...base, contracted_weight: -147 },
    { ...base, contracted_weight: '150' },
  ];
  for (const body of bad) {
    const { status, json } = await api.call('POST', '/api/bouts', body);
    assertEquals(status, 400, JSON.stringify(body));
    assertEquals(json.issues.length > 0, true);
  }
  assertEquals((await api.call('GET', `/api/events/${eventId}/bouts`)).json.length, 1);

  // A PATCH is judged on the bout as it would stand: taking the class away
  // without a weight, or adding a weight to a class, changes nothing.
  for (const body of [{ weight_class_id: null }, { contracted_weight: 150 }]) {
    const { status } = await api.call('PATCH', `/api/bouts/${boutId}`, body);
    assertEquals(status, 400, JSON.stringify(body));
    deepStrictEqual(weightOf(getBout(api.db, boutId)!), [HEAVYWEIGHT, null]);
  }
});

Deno.test('a bout moves between a class and a contracted weight when PATCH sends both, one null', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const toWeight = await api.call('PATCH', `/api/bouts/${boutId}`, {
    weight_class_id: null,
    contracted_weight: 230,
  });
  assertEquals(toWeight.status, 200);
  deepStrictEqual(weightOf(getBout(api.db, boutId)!), [null, 230]);
  // Other fields leave it alone.
  await api.call('PATCH', `/api/bouts/${boutId}`, { scheduled_rounds: 10 });
  deepStrictEqual(weightOf(getBout(api.db, boutId)!), [null, 230]);
  const toClass = await api.call('PATCH', `/api/bouts/${boutId}`, {
    weight_class_id: LIGHTWEIGHT,
    contracted_weight: null,
  });
  assertEquals(toClass.status, 200);
  deepStrictEqual(weightOf(getBout(api.db, boutId)!), [LIGHTWEIGHT, null]);
});

Deno.test('missed weight is marked per side: neither, either or both, and each mark stays until changed', async () => {
  const api = testApi();
  const { eventId, aId, bId, boutId } = await usykFury(api);
  // Nobody misses weight unless said.
  deepStrictEqual(marksOf(getBout(api.db, boutId)!), [0, 0]);

  const made = await api.call('POST', '/api/bouts', {
    event_id: eventId,
    weight_class_id: HEAVYWEIGHT,
    scheduled_rounds: 12,
    fighter_a_id: bId,
    fighter_b_id: aId,
    missed_weight_b: true,
  });
  assertEquals(made.status, 201);
  deepStrictEqual(marksOf(made.json), [0, 1]);

  const patch = (body: unknown) => api.call('PATCH', `/api/bouts/${boutId}`, body);
  deepStrictEqual(marksOf((await patch({ missed_weight_a: true })).json), [1, 0]);
  deepStrictEqual(marksOf((await patch({ missed_weight_b: true })).json), [1, 1]);
  deepStrictEqual(marksOf((await patch({ corner_a: 'red' })).json), [1, 1]);
  deepStrictEqual(marksOf((await patch({ missed_weight_a: false })).json), [0, 1]);
  deepStrictEqual(marksOf(getBout(api.db, boutId)!), [0, 1]);

  // A mark is true or false on the wire, nothing else.
  for (const value of [1, 'yes', null]) {
    assertEquals((await patch({ missed_weight_a: value })).status, 400, JSON.stringify(value));
  }
  deepStrictEqual(marksOf(getBout(api.db, boutId)!), [0, 1]);

  // The fighter's history and the card carry the marks, and the card's save
  // keeps them.
  const history = (await api.call('GET', `/api/fighters/${aId}/bouts`)).json;
  deepStrictEqual(history.map(marksOf), [[0, 1], [0, 1]]);
  deepStrictEqual(marksOf(await finalise(api, boutId, { decision_type: 'UD', winner: 'A' })), [
    0,
    1,
  ]);
});

Deno.test("a contracted-weight bout's snapshot has no TBRB rank: it has no class's list to read (D45)", async () => {
  const api = testApi();
  const { boutId, aId } = await usykFury(api); // fought 2024-05-18
  insertTbrbRow(api.db, {
    snapshot_date: '2024-05-15',
    weight_class_id: HEAVYWEIGHT,
    rank: 1,
    fighter_name: 'Usyk',
    fighter_id: aId,
  });
  await api.call('PATCH', `/api/bouts/${boutId}`, {
    weight_class_id: null,
    contracted_weight: 230,
  });
  await api.call('PUT', `/api/bouts/${boutId}/card`, { rounds: [], result: null, is_draft: true });
  const bout = getBout(api.db, boutId)!;
  assertEquals(bout.a_won !== null, true, 'the snapshot was taken');
  assertEquals(bout.a_tbrb_rank, null);
});
