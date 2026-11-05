// Tier 2: weight classes and titles over HTTP (SPEC API).
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import { HEAVYWEIGHT, testApi } from '../helpers/api.ts';

const wbc = {
  sanctioning_body: 'WBC',
  area: 'World',
  weight_class_id: HEAVYWEIGHT,
  status: 'Active',
};

Deno.test('GET /api/weight-classes lists the 18 classes, Heavyweight without a limit', async () => {
  const { status, json } = await testApi().call('GET', '/api/weight-classes');
  assertEquals(status, 200);
  assertEquals(json.length, 18);
  deepStrictEqual(json[17], {
    id: HEAVYWEIGHT,
    name: 'Heavyweight',
    alternate_name: null,
    lbs: null,
    kg: null,
  });
});

Deno.test('POST /api/titles creates a title and GET lists it', async () => {
  const api = testApi();
  const created = await api.call('POST', '/api/titles', wbc);
  assertEquals(created.status, 201);
  deepStrictEqual(created.json, { id: created.json.id, ...wbc });
  const list = await api.call('GET', '/api/titles');
  assertEquals(list.status, 200);
  deepStrictEqual(list.json, [created.json]);
});

Deno.test('POST /api/titles: the same four again is 409, an unknown class is 400', async () => {
  const api = testApi();
  await api.call('POST', '/api/titles', wbc);
  assertEquals((await api.call('POST', '/api/titles', wbc)).status, 409);
  assertEquals(
    (await api.call('POST', '/api/titles', { ...wbc, weight_class_id: 99 })).status,
    400,
  );
});

Deno.test('POST /api/titles with a missing field is 400 with the issues', async () => {
  const { status, json } = await testApi().call('POST', '/api/titles', { ...wbc, area: undefined });
  assertEquals(status, 400);
  deepStrictEqual(json.issues.map((i: { path: string[] }) => i.path), [['area']]);
});
