// Tier 2: /api/venues over HTTP (task venues, D117), and what an event and
// a bout answer of their venue.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import { testApi, usykFury } from '../helpers/api.ts';
import { insertVenue } from '../../server/db/venue.ts';

const o2 = { name: 'O2 Arena', city: 'London', region: null, country: 'UK' };
const tMobile = { name: 'T-Mobile Arena', city: 'Las Vegas', region: 'NV', country: 'USA' };

Deno.test('POST /api/venues adds a venue; GET lists them by country, city and name', async () => {
  const api = testApi();
  const vegas = await api.call('POST', '/api/venues', tMobile);
  assertEquals(vegas.status, 201);
  deepStrictEqual(vegas.json, { id: vegas.json.id, ...tMobile });
  const london = await api.call('POST', '/api/venues', { ...o2, region: '  ' }); // empty: none
  deepStrictEqual(london.json, { id: london.json.id, ...o2 });
  const { json: list } = await api.call('GET', '/api/venues');
  deepStrictEqual(list.map((v: { name: string }) => v.name), ['O2 Arena', 'T-Mobile Arena']);
  deepStrictEqual((await api.call('GET', `/api/venues/${vegas.json.id}`)).json, vegas.json);
  assertEquals((await api.call('GET', '/api/venues/999')).status, 404);
});

Deno.test('a venue needs a name, a city and a country; the same place twice is a 409', async () => {
  const api = testApi();
  for (const body of [{ ...o2, name: ' ' }, { ...o2, city: '' }, { ...o2, country: '' }, {}]) {
    assertEquals((await api.call('POST', '/api/venues', body)).status, 400, JSON.stringify(body));
  }
  assertEquals((await api.call('POST', '/api/venues', o2)).status, 201);
  assertEquals((await api.call('POST', '/api/venues', { ...o2, region: '' })).status, 409);
  // Another region is another place.
  assertEquals((await api.call('POST', '/api/venues', { ...o2, region: 'England' })).status, 201);
});

Deno.test('PATCH /api/venues/:id fixes a venue, and every event held there shows it', async () => {
  const api = testApi();
  const { eventId, boutId } = await usykFury(api);
  const { json: event } = await api.call('GET', `/api/events/${eventId}`);
  const fixed = await api.call('PATCH', `/api/venues/${event.venue_id}`, {
    region: 'Riyadh Province',
  });
  assertEquals(fixed.status, 200);
  assertEquals(fixed.json.region, 'Riyadh Province');
  assertEquals(fixed.json.name, 'Kingdom Arena');
  const again = (await api.call('GET', `/api/events/${eventId}`)).json;
  deepStrictEqual(again.venue, fixed.json);
  // The bout's page reads its event, which carries the venue.
  const bout = (await api.call('GET', `/api/bouts/${boutId}`)).json;
  assertEquals(bout.event_id, eventId);
  assertEquals((await api.call('PATCH', '/api/venues/999', { city: 'x' })).status, 404);
  assertEquals(
    (await api.call('PATCH', `/api/venues/${event.venue_id}`, { city: ' ' })).status,
    400,
  );
});

Deno.test('an event moves to another venue with PATCH, and the list answers each with its venue', async () => {
  const api = testApi();
  const { eventId } = await usykFury(api);
  const { json: vegas } = await api.call('POST', '/api/venues', tMobile);
  const moved = await api.call('PATCH', `/api/events/${eventId}`, { venue_id: vegas.id });
  assertEquals(moved.status, 200);
  deepStrictEqual(moved.json.venue, vegas);
  const { json: list } = await api.call('GET', '/api/events');
  deepStrictEqual(list[0].venue, vegas);
  assertEquals((await api.call('PATCH', `/api/events/${eventId}`, { venue_id: 999 })).status, 400);
});

Deno.test('a venue the migration left half empty is fixed whole: a PATCH that leaves a part empty is refused (D118)', async () => {
  const api = testApi();
  const id = insertVenue(api.db, { name: 'Riyadh', city: '', region: null, country: '' });
  assertEquals(
    (await api.call('PATCH', `/api/venues/${id}`, { region: 'Riyadh Province' })).status,
    400,
  );
  const fixed = await api.call('PATCH', `/api/venues/${id}`, {
    name: 'Kingdom Arena',
    city: 'Riyadh',
    country: 'Saudi Arabia',
  });
  assertEquals(fixed.status, 200);
  deepStrictEqual(fixed.json, {
    id,
    name: 'Kingdom Arena',
    city: 'Riyadh',
    region: null,
    country: 'Saudi Arabia',
  });
});
