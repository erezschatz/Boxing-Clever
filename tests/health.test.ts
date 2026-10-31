// Tier 2: the HTTP contract, asked of the chamber's fetch handler directly.
// No server, no port — the same handler Atrium calls.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import chamber from '../mod.ts';

Deno.test('GET /api/health answers ok with the version', async () => {
  const res = await chamber.fetch(new Request('http://boxing.test/api/health'));
  assertEquals(res.status, 200);
  deepStrictEqual(await res.json(), { ok: true, version: '2.0.0-draft' });
});

Deno.test('any non-API path serves the front page', async () => {
  for (const path of ['/', '/events/12', '/no-such-file.png']) {
    const res = await chamber.fetch(new Request('http://boxing.test' + path));
    assertEquals(res.status, 200, path);
    assertEquals(res.headers.get('content-type'), 'text/html; charset=utf-8', path);
  }
});

Deno.test('an unknown API path is a 404', async () => {
  const res = await chamber.fetch(new Request('http://boxing.test/api/nothing'));
  assertEquals(res.status, 404);
});
