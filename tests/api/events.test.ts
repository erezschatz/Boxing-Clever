// Tier 2: /api/events over HTTP (SPEC API). The finalised-bout refusal is
// tier 3, in tests/api/delete.test.ts.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import { type Api, testApi, usykFury, venueId } from '../helpers/api.ts';

const kingdomArena = {
  name: 'Kingdom Arena',
  city: 'Riyadh',
  region: null,
  country: 'Saudi Arabia',
};

// An event at the Kingdom Arena (task venues: an event points to its venue).
const riyadh = async (api: Api) => ({ date: '2024-05-18', venue_id: await venueId(api) });

Deno.test('POST /api/events creates an event; GET /api/events lists newest first', async () => {
  const api = testApi();
  const body = await riyadh(api);
  const older = await api.call('POST', '/api/events', { ...body, date: '2023-12-23' });
  const newer = await api.call('POST', '/api/events', body);
  assertEquals(newer.status, 201);
  // The event answers with its venue's parts.
  deepStrictEqual(newer.json, {
    id: newer.json.id,
    ...body,
    venue: { id: body.venue_id, ...kingdomArena },
  });
  const list = await api.call('GET', '/api/events');
  assertEquals(list.status, 200);
  deepStrictEqual(list.json.map((e: { id: number }) => e.id), [newer.json.id, older.json.id]);
});

Deno.test('POST /api/events refuses a day that does not exist, a missing venue and a location string', async () => {
  const api = testApi();
  const event = await riyadh(api);
  for (
    const body of [
      { ...event, date: '2024-02-30' },
      { date: event.date },
      { date: event.date, location: 'Kingdom Arena, Riyadh' },
      {},
    ]
  ) {
    const { status, json } = await api.call('POST', '/api/events', body);
    assertEquals(status, 400, JSON.stringify(body));
    assertEquals(Array.isArray(json.issues), true);
  }
  // A venue that does not exist is refused by the schema (D30).
  assertEquals((await api.call('POST', '/api/events', { ...event, venue_id: 999 })).status, 400);
});

Deno.test('GET /api/events/:id returns the event, or 404', async () => {
  const api = testApi();
  const { json: event } = await api.call('POST', '/api/events', await riyadh(api));
  deepStrictEqual((await api.call('GET', `/api/events/${event.id}`)).json, event);
  for (const path of ['/api/events/999', '/api/events/abc', '/api/events/0']) {
    const miss = await api.call('GET', path);
    assertEquals(miss.status, 404, path);
    assertEquals(typeof miss.json.error, 'string');
  }
});

Deno.test('PATCH /api/events/:id changes only what was sent; 404 when missing', async () => {
  const api = testApi();
  const { json: event } = await api.call('POST', '/api/events', await riyadh(api));
  const { status, json } = await api.call('PATCH', `/api/events/${event.id}`, {
    date: '2024-05-19',
  });
  assertEquals(status, 200);
  deepStrictEqual(json, { ...event, date: '2024-05-19' });
  assertEquals((await api.call('PATCH', '/api/events/999', { date: '2024-05-19' })).status, 404);
  assertEquals((await api.call('PATCH', `/api/events/${event.id}`, { date: 'May' })).status, 400);
  assertEquals((await api.call('PATCH', `/api/events/${event.id}`, { id: 7 })).status, 400);
});

Deno.test('DELETE /api/events/:id deletes an event of drafts, with its bouts; 404 when missing', async () => {
  const api = testApi();
  const { eventId, boutId } = await usykFury(api);
  assertEquals((await api.call('DELETE', `/api/events/${eventId}`)).status, 204);
  assertEquals((await api.call('GET', `/api/events/${eventId}`)).status, 404);
  assertEquals((await api.call('GET', `/api/bouts/${boutId}`)).status, 404);
  assertEquals((await api.call('DELETE', `/api/events/${eventId}`)).status, 404);
});

Deno.test('GET /api/events/:id/bouts lists the card in order, each bout as GET /bouts/:id answers it; 404 when missing', async () => {
  const api = testApi();
  const { eventId, aId, bId, boutId } = await usykFury(api);
  const { json: title } = await api.call('POST', '/api/titles', {
    sanctioning_body: 'WBC',
    area: 'World',
    weight_class_id: 18,
    interim: false,
  });
  const second = await api.call('POST', '/api/bouts', {
    event_id: eventId,
    weight_class_id: 18,
    scheduled_rounds: 10,
    fighter_a_id: bId,
    fighter_b_id: aId,
    titles: [{ title_id: title.id, holder_side: 'A' }],
  });
  assertEquals(second.json.card_order, 2); // left out, so it goes last
  const { status, json } = await api.call('GET', `/api/events/${eventId}/bouts`);
  assertEquals(status, 200);
  deepStrictEqual(json.map((b: { id: number }) => b.id), [boutId, second.json.id]);
  // The card page reads the titles and the result off the list (D34).
  deepStrictEqual(json[1], (await api.call('GET', `/api/bouts/${second.json.id}`)).json);
  deepStrictEqual(json[1].titles, [{ title_id: title.id, holder_side: 'A' }]);
  assertEquals(json[1].card.is_draft, true);
  assertEquals((await api.call('GET', '/api/events/999/bouts')).status, 404);
});
