// Tier 2: /api/bouts over HTTP (SPEC API): the card details, corners, and
// titles with the side that held each. The guarded delete of a finalised bout
// is tier 3, in tests/api/delete.test.ts.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import { type Api, HEAVYWEIGHT, testApi, usykFury } from '../helpers/api.ts';

async function belts(api: Api) {
  const make = (body: string) =>
    api.call('POST', '/api/titles', {
      sanctioning_body: body,
      area: 'World',
      weight_class_id: HEAVYWEIGHT,
      interim: false,
    }).then((r) => r.json.id as number);
  return { wbc: await make('WBC'), wba: await make('WBA'), ibf: await make('IBF') };
}

Deno.test('POST /api/bouts creates a bout with its titles and who held each', async () => {
  const api = testApi();
  const { eventId, aId, bId } = await usykFury(api);
  const { wbc, wba } = await belts(api);
  const { status, json } = await api.call('POST', '/api/bouts', {
    event_id: eventId,
    card_order: 5,
    weight_class_id: HEAVYWEIGHT,
    scheduled_rounds: 12,
    fighter_a_id: aId,
    fighter_b_id: bId,
    corner_a: 'red',
    titles: [{ title_id: wbc, holder_side: 'B' }, { title_id: wba, holder_side: 'A' }],
  });
  assertEquals(status, 201);
  assertEquals(json.card_order, 5);
  assertEquals(json.corner_a, 'red');
  assertEquals(json.is_draft, 1);
  assertEquals(json.decision_type, null);
  deepStrictEqual(json.titles, [
    { title_id: wbc, holder_side: 'B' },
    { title_id: wba, holder_side: 'A' },
  ]);
});

Deno.test('POST /api/bouts refuses bad bodies: 400 with issues, nothing written', async () => {
  const api = testApi();
  const { eventId, aId, bId } = await usykFury(api);
  const good = {
    event_id: eventId,
    weight_class_id: HEAVYWEIGHT,
    scheduled_rounds: 12,
    fighter_a_id: aId,
    fighter_b_id: bId,
  };
  const bad = [
    { ...good, fighter_b_id: aId }, // the same fighter on both sides
    { ...good, scheduled_rounds: 16 },
    { ...good, corner_a: 'green' },
    { ...good, titles: [{ title_id: 1, holder_side: 'C' }] },
    { ...good, titles: [{ title_id: 1, holder_side: 'A' }, { title_id: 1, holder_side: 'B' }] },
    { ...good, fighter_b_id: undefined },
  ];
  for (const body of bad) {
    const { status, json } = await api.call('POST', '/api/bouts', body);
    assertEquals(status, 400, JSON.stringify(body));
    assertEquals(json.issues.length > 0, true);
  }
  // References the schema refuses: an unknown fighter, an unknown title.
  assertEquals((await api.call('POST', '/api/bouts', { ...good, fighter_b_id: 999 })).status, 400);
  const unknownTitle = { ...good, titles: [{ title_id: 999, holder_side: 'A' }] };
  assertEquals((await api.call('POST', '/api/bouts', unknownTitle)).status, 400);
  // Only the bout usykFury made: the unknown title took its bout with it.
  assertEquals((await api.call('GET', `/api/events/${eventId}/bouts`)).json.length, 1);
});

Deno.test('GET /api/bouts/:id returns the bout with its titles, or 404', async () => {
  const api = testApi();
  const { boutId, aId } = await usykFury(api);
  const { status, json } = await api.call('GET', `/api/bouts/${boutId}`);
  assertEquals(status, 200);
  assertEquals(json.id, boutId);
  assertEquals(json.fighter_a_id, aId);
  assertEquals(json.corner_a, 'blue');
  deepStrictEqual(json.titles, []);
  assertEquals((await api.call('GET', '/api/bouts/999')).status, 404);
});

Deno.test('PATCH /api/bouts/:id: corners, scheduled rounds, and titles replaced whole', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const { wbc, wba, ibf } = await belts(api);
  await api.call('PATCH', `/api/bouts/${boutId}`, {
    titles: [{ title_id: wbc, holder_side: 'B' }, { title_id: wba, holder_side: 'A' }],
  });
  const { status, json } = await api.call('PATCH', `/api/bouts/${boutId}`, {
    corner_a: 'red',
    scheduled_rounds: 10,
    titles: [{ title_id: ibf, holder_side: 'vacant' }],
  });
  assertEquals(status, 200);
  assertEquals(json.corner_a, 'red');
  assertEquals(json.scheduled_rounds, 10);
  deepStrictEqual(json.titles, [{ title_id: ibf, holder_side: 'vacant' }]);
  // Leaving titles out leaves them as they are; a null corner means "not recorded".
  const again = await api.call('PATCH', `/api/bouts/${boutId}`, { corner_a: null });
  assertEquals(again.json.corner_a, null);
  deepStrictEqual(again.json.titles, [{ title_id: ibf, holder_side: 'vacant' }]);
});

Deno.test('PATCH /api/bouts/:id: 404 when missing, 400 on a bad body', async () => {
  const api = testApi();
  const { boutId, aId } = await usykFury(api);
  assertEquals((await api.call('PATCH', '/api/bouts/999', { corner_a: 'red' })).status, 404);
  assertEquals(
    (await api.call('PATCH', `/api/bouts/${boutId}`, { corner_a: 'green' })).status,
    400,
  );
  // Both sides the same fighter: the schema refuses the merged row.
  const same = await api.call('PATCH', `/api/bouts/${boutId}`, { fighter_b_id: aId });
  assertEquals(same.status, 400);
  assertEquals((await api.call('GET', `/api/bouts/${boutId}`)).json.fighter_b_id !== aId, true);
});

Deno.test('DELETE /api/bouts/:id deletes a draft bout; 404 when missing', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  assertEquals((await api.call('DELETE', `/api/bouts/${boutId}`)).status, 204);
  assertEquals((await api.call('GET', `/api/bouts/${boutId}`)).status, 404);
  assertEquals((await api.call('DELETE', `/api/bouts/${boutId}`)).status, 404);
});
