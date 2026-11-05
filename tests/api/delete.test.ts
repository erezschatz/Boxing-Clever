// Tier 3: what deleting leaves behind (SPEC API, D23). A finalised bout has
// moved both records; it is deleted only with the user's choice to reverse
// them or keep them, and deleting bouts never deletes the event.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import { finaliseByHand, fury, recordOf, testApi, usyk, usykFury } from '../helpers/api.ts';
import { getBout } from '../../server/db/bout.ts';
import { getEvent } from '../../server/db/event.ts';

const before = {
  a: { won: usyk.won, lost: 0, draws: 0, nc: 0, kos: usyk.kos },
  b: { won: fury.won, lost: 0, draws: fury.draws, nc: 0, kos: fury.kos },
};

Deno.test('a finalised bout deleted with ?records=reverse moves both records back exactly', async () => {
  const api = testApi();
  const { aId, bId, boutId } = await usykFury(api);
  finaliseByHand(api.db, boutId, { decision_type: 'SD', winner: 'A' });
  deepStrictEqual(recordOf(api.db, aId), { ...before.a, won: 22 });
  deepStrictEqual(recordOf(api.db, bId), { ...before.b, lost: 1 });

  assertEquals((await api.call('DELETE', `/api/bouts/${boutId}?records=reverse`)).status, 204);
  assertEquals(getBout(api.db, boutId), undefined);
  deepStrictEqual(recordOf(api.db, aId), before.a);
  deepStrictEqual(recordOf(api.db, bId), before.b);
});

Deno.test('reverse undoes a KO with its ko, and a draw on both sides', async () => {
  for (
    const [outcome, aMoved] of [
      [{ decision_type: 'KO', winner: 'B' }, { lost: 1 }],
      [{ decision_type: 'D', winner: 'draw' }, { draws: 1 }],
    ] as const
  ) {
    const api = testApi();
    const { aId, bId, boutId } = await usykFury(api);
    finaliseByHand(api.db, boutId, outcome);
    deepStrictEqual(recordOf(api.db, aId), { ...before.a, ...aMoved }, outcome.decision_type);
    await api.call('DELETE', `/api/bouts/${boutId}?records=reverse`);
    deepStrictEqual(recordOf(api.db, aId), before.a, outcome.decision_type);
    deepStrictEqual(recordOf(api.db, bId), before.b, outcome.decision_type);
  }
});

Deno.test('a finalised bout deleted with ?records=keep leaves both records as they are', async () => {
  const api = testApi();
  const { aId, bId, boutId } = await usykFury(api);
  finaliseByHand(api.db, boutId, { decision_type: 'UD', winner: 'A' });
  const a = recordOf(api.db, aId);
  const b = recordOf(api.db, bId);
  assertEquals((await api.call('DELETE', `/api/bouts/${boutId}?records=keep`)).status, 204);
  assertEquals(getBout(api.db, boutId), undefined);
  deepStrictEqual(recordOf(api.db, aId), a);
  deepStrictEqual(recordOf(api.db, bId), b);
});

Deno.test('a finalised bout deleted without a choice is 409 and nothing changes', async () => {
  const api = testApi();
  const { aId, boutId } = await usykFury(api);
  finaliseByHand(api.db, boutId, { decision_type: 'UD', winner: 'A' });
  const a = recordOf(api.db, aId);
  for (const query of ['', '?records=', '?records=yes']) {
    const { status, json } = await api.call('DELETE', `/api/bouts/${boutId}${query}`);
    assertEquals(status, 409, query);
    assertEquals(typeof json.error, 'string');
  }
  assertEquals(getBout(api.db, boutId)?.is_draft, 0);
  deepStrictEqual(recordOf(api.db, aId), a);
});

Deno.test('reverse that would take a record below zero is 409 and nothing changes', async () => {
  const api = testApi();
  const { bId, boutId } = await usykFury(api);
  finaliseByHand(api.db, boutId, { decision_type: 'UD', winner: 'A' });
  // The loss was corrected away by hand after finalise (D28).
  await api.call('PATCH', `/api/fighters/${bId}`, { lost: 0 });
  assertEquals((await api.call('DELETE', `/api/bouts/${boutId}?records=reverse`)).status, 409);
  assertEquals(getBout(api.db, boutId)?.id, boutId);
  assertEquals(recordOf(api.db, bId).lost, 0);
});

Deno.test("deleting an event's last bout leaves the event, draft or finalised", async () => {
  for (const finalised of [false, true]) {
    const api = testApi();
    const { eventId, boutId } = await usykFury(api);
    if (finalised) finaliseByHand(api.db, boutId, { decision_type: 'UD', winner: 'A' });
    const res = await api.call('DELETE', `/api/bouts/${boutId}?records=reverse`);
    assertEquals(res.status, 204);
    assertEquals(getEvent(api.db, eventId)?.id, eventId);
    deepStrictEqual((await api.call('GET', `/api/events/${eventId}/bouts`)).json, []);
  }
});

Deno.test('an event with a finalised bout cannot be deleted: 409, event and bouts intact', async () => {
  const api = testApi();
  const { eventId, aId, bId, boutId } = await usykFury(api);
  const { json: draft } = await api.call('POST', '/api/bouts', {
    event_id: eventId,
    weight_class_id: 18,
    scheduled_rounds: 12,
    fighter_a_id: bId,
    fighter_b_id: aId,
  });
  finaliseByHand(api.db, boutId, { decision_type: 'UD', winner: 'A' });
  const { status, json } = await api.call('DELETE', `/api/events/${eventId}`);
  assertEquals(status, 409);
  assertEquals(typeof json.error, 'string');
  assertEquals(getEvent(api.db, eventId)?.id, eventId);
  assertEquals(getBout(api.db, boutId)?.id, boutId);
  assertEquals(getBout(api.db, draft.id)?.id, draft.id);
});

Deno.test('a finalised bout keeps its fighters: PATCHing them is 409, other fields still change', async () => {
  const api = testApi();
  const { aId, bId, boutId } = await usykFury(api);
  finaliseByHand(api.db, boutId, { decision_type: 'UD', winner: 'A' });
  const swap = await api.call('PATCH', `/api/bouts/${boutId}`, {
    fighter_a_id: bId,
    fighter_b_id: aId,
  });
  assertEquals(swap.status, 409);
  assertEquals(getBout(api.db, boutId)?.fighter_a_id, aId);
  assertEquals((await api.call('PATCH', `/api/bouts/${boutId}`, { corner_a: 'red' })).status, 200);
});
