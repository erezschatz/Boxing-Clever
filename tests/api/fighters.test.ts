// Tier 2: /api/fighters over HTTP (SPEC API). Merge's all-or-nothing is
// tier 3, in tests/api/merge.test.ts.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import { fury, testApi, usyk, usykFury } from '../helpers/api.ts';

Deno.test('POST /api/fighters creates a fighter with the record they arrive with', async () => {
  const { status, json } = await testApi().call('POST', '/api/fighters', usyk);
  assertEquals(status, 201);
  deepStrictEqual(json, {
    id: json.id,
    first_name: 'Oleksandr',
    last_name: 'Usyk',
    nickname: null,
    colors: 'Blue/Yellow',
    weight: 225.5,
    weight_unit: 'lbs',
    won: 21,
    lost: 0,
    draws: 0,
    nc: 0,
    kos: 14,
  });
});

Deno.test('POST /api/fighters refuses bad bodies with 400 and the issues', async () => {
  const api = testApi();
  const bad = [
    { ...usyk, last_name: '' },
    { ...usyk, won: -1 },
    { ...usyk, won: 1.5 },
    { ...usyk, weight_unit: 'stone' },
    { ...usyk, weight_unit: null }, // a weight without its unit
    { ...usyk, id: 7 }, // unknown fields are refused, not ignored
  ];
  for (const body of bad) {
    const { status, json } = await api.call('POST', '/api/fighters', body);
    assertEquals(status, 400, JSON.stringify(body));
    assertEquals(json.issues.length > 0, true);
  }
  const notJson = await api.call('POST', '/api/fighters', '{ nope');
  assertEquals(notJson.status, 400);
  assertEquals((await api.call('GET', '/api/fighters')).json.length, 0);
});

Deno.test('GET /api/fighters lists by last name', async () => {
  const api = testApi();
  await api.call('POST', '/api/fighters', usyk);
  await api.call('POST', '/api/fighters', fury);
  const { status, json } = await api.call('GET', '/api/fighters');
  assertEquals(status, 200);
  deepStrictEqual(json.map((f: { last_name: string }) => f.last_name), ['Fury', 'Usyk']);
});

Deno.test('GET /api/fighters/:id returns the fighter, or 404', async () => {
  const api = testApi();
  const { json: created } = await api.call('POST', '/api/fighters', fury);
  deepStrictEqual((await api.call('GET', `/api/fighters/${created.id}`)).json, created);
  const miss = await api.call('GET', '/api/fighters/999');
  assertEquals(miss.status, 404);
  assertEquals(typeof miss.json.error, 'string');
});

Deno.test('PATCH /api/fighters/:id changes what was sent, the record included', async () => {
  const api = testApi();
  const { json: created } = await api.call('POST', '/api/fighters', fury);
  const { status, json } = await api.call('PATCH', `/api/fighters/${created.id}`, {
    nickname: null,
    won: 35,
  });
  assertEquals(status, 200);
  deepStrictEqual(json, { ...created, nickname: null, won: 35 });
  assertEquals((await api.call('PATCH', '/api/fighters/999', { won: 1 })).status, 404);
  // Clearing the weight but not its unit leaves a unit with nothing to measure.
  const half = await api.call('PATCH', `/api/fighters/${created.id}`, { weight: null });
  assertEquals(half.status, 400);
  assertEquals((await api.call('GET', `/api/fighters/${created.id}`)).json.weight, 262);
});

Deno.test('GET /api/fighters/:id/bouts lists their bouts on either side; 404 when missing', async () => {
  const api = testApi();
  const { aId, bId, boutId } = await usykFury(api);
  for (const id of [aId, bId]) {
    const { status, json } = await api.call('GET', `/api/fighters/${id}/bouts`);
    assertEquals(status, 200);
    deepStrictEqual(json.map((b: { id: number }) => b.id), [boutId]);
    // The as-of snapshot columns are there, empty until the first save (task 05).
    assertEquals(json[0].a_won, null);
    // Each bout as GET /bouts/:id answers it: titles and card included (D34).
    deepStrictEqual(json[0], (await api.call('GET', `/api/bouts/${boutId}`)).json);
  }
  assertEquals((await api.call('GET', '/api/fighters/999/bouts')).status, 404);
});

Deno.test('POST /api/fighters/:id/merge/:targetId moves the bouts and deletes the duplicate', async () => {
  const api = testApi();
  const { aId, boutId } = await usykFury(api);
  const { json: dup } = await api.call('POST', '/api/fighters', {
    ...usyk,
    first_name: 'Aleksandr',
  });
  // The duplicate fought someone too, on the B side.
  const { json: other } = await api.call('POST', '/api/fighters', {
    first_name: 'Anthony',
    last_name: 'Joshua',
  });
  const { json: event } = await api.call('POST', '/api/events', {
    date: '2021-09-25',
    location: 'London',
  });
  const { json: dupBout } = await api.call('POST', '/api/bouts', {
    event_id: event.id,
    weight_class_id: 18,
    scheduled_rounds: 12,
    fighter_a_id: other.id,
    fighter_b_id: dup.id,
  });

  const { status, json } = await api.call(
    'POST',
    `/api/fighters/${dup.id}/merge/${aId}?records=add`,
  );
  assertEquals(status, 200);
  assertEquals(json.target.id, aId);
  // The duplicate's typed-in record is dropped; the target's stands (D28).
  deepStrictEqual(json.target.after, json.target.before);
  assertEquals((await api.call('GET', `/api/fighters/${aId}`)).json.won, 21);
  assertEquals((await api.call('GET', `/api/fighters/${dup.id}`)).status, 404);
  assertEquals((await api.call('GET', `/api/bouts/${dupBout.id}`)).json.fighter_b_id, aId);
  const history = (await api.call('GET', `/api/fighters/${aId}/bouts`)).json;
  deepStrictEqual(history.map((b: { id: number }) => b.id), [dupBout.id, boutId]);
});

Deno.test('GET /api/fighters/:id/merge/:targetId previews the merge and changes nothing', async () => {
  const api = testApi();
  const { aId } = await usykFury(api);
  const { json: dup } = await api.call('POST', '/api/fighters', {
    ...usyk,
    first_name: 'Aleksandr',
  });
  const { status, json } = await api.call('GET', `/api/fighters/${dup.id}/merge/${aId}`);
  assertEquals(status, 200);
  deepStrictEqual(json, {
    duplicate: {
      id: dup.id,
      name: 'Aleksandr Usyk',
      record_dropped: { won: 21, lost: 0, draws: 0, nc: 0, kos: 14 },
    },
    target: {
      id: aId,
      name: 'Oleksandr Usyk',
      before: { won: 21, lost: 0, draws: 0, nc: 0, kos: 14 },
      after: { won: 21, lost: 0, draws: 0, nc: 0, kos: 14 },
    },
    bouts: 0,
    finalised_bouts: 0,
    aliases: 0,
    tbrb_rows: 0,
    kept_results: 0,
  });
  assertEquals((await api.call('GET', `/api/fighters/${dup.id}`)).status, 200);
  assertEquals((await api.call('GET', `/api/fighters/999/merge/${aId}`)).status, 404);
  // Even with no fight moving, the duplicate's 21-0 is dropped, so POST asks first.
  const unapproved = await api.call('POST', `/api/fighters/${dup.id}/merge/${aId}`);
  assertEquals(unapproved.status, 409);
  deepStrictEqual(unapproved.json.preview, json);
  assertEquals((await api.call('GET', `/api/fighters/${dup.id}`)).status, 200);
});

Deno.test('merge: 404 for either missing fighter, 400 into itself, 409 when they fought', async () => {
  const api = testApi();
  const { aId, bId } = await usykFury(api);
  assertEquals((await api.call('POST', `/api/fighters/999/merge/${aId}`)).status, 404);
  assertEquals((await api.call('POST', `/api/fighters/${aId}/merge/999`)).status, 404);
  assertEquals((await api.call('POST', `/api/fighters/${aId}/merge/${aId}`)).status, 400);
  assertEquals((await api.call('POST', `/api/fighters/${bId}/merge/${aId}`)).status, 409);
  assertEquals((await api.call('GET', `/api/fighters/${bId}`)).status, 200);
});
