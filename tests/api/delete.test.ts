// Tier 3: what deleting leaves behind (SPEC API, D23). A finalised bout has
// moved both records; it is deleted only with the user's choice to reverse
// them or keep them, and deleting bouts never deletes the event.
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import { type Api, finalise, fury, recordOf, testApi, usyk, usykFury } from '../helpers/api.ts';
import { getBout } from '../../server/db/bout.ts';
import { getEvent } from '../../server/db/event.ts';
import { listAdjustments } from '../../server/db/record-adjustment.ts';

// A fighter's kept results as the recompute will read them: counts and the fight.
const keptOf = (api: Api, fighterId: number) =>
  listAdjustments(api.db, fighterId).map(
    ({ opponent_id, won, lost, draws, nc, kos, bout_description, bout_date }) => ({
      opponent_id,
      won,
      lost,
      draws,
      nc,
      kos,
      bout_description,
      bout_date,
    }),
  );

const before = {
  a: { won: usyk.won, lost: 0, draws: 0, nc: 0, kos: usyk.kos },
  b: { won: fury.won, lost: 0, draws: fury.draws, nc: 0, kos: fury.kos },
};

Deno.test('a finalised bout deleted with ?records=reverse moves both records back exactly', async () => {
  const api = testApi();
  const { aId, bId, boutId } = await usykFury(api);
  await finalise(api, boutId, { decision_type: 'SD', winner: 'A' });
  deepStrictEqual(recordOf(api.db, aId), { ...before.a, won: 22 });
  deepStrictEqual(recordOf(api.db, bId), { ...before.b, lost: 1 });

  const { status, json } = await api.call('DELETE', `/api/bouts/${boutId}?records=reverse`);
  assertEquals(status, 200);
  // It says what it did: both records, before and after.
  deepStrictEqual(json, {
    deleted: boutId,
    records: 'reverse',
    a: { id: aId, name: 'Oleksandr Usyk', before: { ...before.a, won: 22 }, after: before.a },
    b: { id: bId, name: 'Tyson Fury', before: { ...before.b, lost: 1 }, after: before.b },
  });
  assertEquals(getBout(api.db, boutId), undefined);
  deepStrictEqual(recordOf(api.db, aId), before.a);
  deepStrictEqual(recordOf(api.db, bId), before.b);
  // Nothing was kept, so nothing is stored for a recompute to add (D57).
  deepStrictEqual([keptOf(api, aId), keptOf(api, bId)], [[], []]);
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
    await finalise(api, boutId, outcome);
    deepStrictEqual(recordOf(api.db, aId), { ...before.a, ...aMoved }, outcome.decision_type);
    await api.call('DELETE', `/api/bouts/${boutId}?records=reverse`);
    deepStrictEqual(recordOf(api.db, aId), before.a, outcome.decision_type);
    deepStrictEqual(recordOf(api.db, bId), before.b, outcome.decision_type);
  }
});

Deno.test('a finalised bout deleted with ?records=keep leaves both records as they are', async () => {
  const api = testApi();
  const { aId, bId, boutId } = await usykFury(api);
  await finalise(api, boutId, { decision_type: 'UD', winner: 'A' });
  const a = recordOf(api.db, aId);
  const b = recordOf(api.db, bId);
  const { status, json } = await api.call('DELETE', `/api/bouts/${boutId}?records=keep`);
  assertEquals(status, 200);
  deepStrictEqual([json.records, json.a.after, json.b.after], ['keep', a, b]);
  assertEquals(getBout(api.db, boutId), undefined);
  deepStrictEqual(recordOf(api.db, aId), a);
  deepStrictEqual(recordOf(api.db, bId), b);
});

Deno.test('a finalised bout deleted without a choice is 409 and nothing changes', async () => {
  const api = testApi();
  const { aId, boutId } = await usykFury(api);
  await finalise(api, boutId, { decision_type: 'UD', winner: 'A' });
  const a = recordOf(api.db, aId);
  for (const query of ['', '?records=', '?records=yes']) {
    const { status, json } = await api.call('DELETE', `/api/bouts/${boutId}${query}`);
    assertEquals(status, 409, query);
    assertEquals(typeof json.error, 'string');
    // The refusal shows what each choice would do (D31).
    deepStrictEqual(json.preview, {
      bout_id: boutId,
      a: {
        id: aId,
        name: 'Oleksandr Usyk',
        before: { ...before.a, won: 22 },
        after_reverse: before.a,
      },
      b: {
        id: json.preview.b.id,
        name: 'Tyson Fury',
        before: { ...before.b, lost: 1 },
        after_reverse: before.b,
      },
      reverse_possible: true,
    });
  }
  assertEquals(getBout(api.db, boutId)?.is_draft, 0);
  deepStrictEqual(recordOf(api.db, aId), a);
});

Deno.test('reverse that would take a record below zero is 409 and nothing changes', async () => {
  const api = testApi();
  const { bId, boutId } = await usykFury(api);
  await finalise(api, boutId, { decision_type: 'UD', winner: 'A' });
  // The loss was corrected away by hand after finalise (D28).
  await api.call('PATCH', `/api/fighters/${bId}`, { lost: 0 });
  const refused = await api.call('DELETE', `/api/bouts/${boutId}?records=reverse`);
  assertEquals(refused.status, 409);
  assertEquals(refused.json.preview.reverse_possible, false);
  assertEquals(refused.json.preview.b.after_reverse.lost, -1);
  assertEquals(getBout(api.db, boutId)?.id, boutId);
  assertEquals(recordOf(api.db, bId).lost, 0);
});

Deno.test("deleting an event's last bout leaves the event, draft or finalised", async () => {
  for (const finalised of [false, true]) {
    const api = testApi();
    const { eventId, boutId } = await usykFury(api);
    if (finalised) await finalise(api, boutId, { decision_type: 'UD', winner: 'A' });
    const res = await api.call('DELETE', `/api/bouts/${boutId}?records=reverse`);
    assertEquals(res.status, finalised ? 200 : 204); // a draft touches no record
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
  await finalise(api, boutId, { decision_type: 'UD', winner: 'A' });
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
  await finalise(api, boutId, { decision_type: 'UD', winner: 'A' });
  const swap = await api.call('PATCH', `/api/bouts/${boutId}`, {
    fighter_a_id: bId,
    fighter_b_id: aId,
  });
  assertEquals(swap.status, 409);
  assertEquals(getBout(api.db, boutId)?.fighter_a_id, aId);
  assertEquals((await api.call('PATCH', `/api/bouts/${boutId}`, { corner_a: 'red' })).status, 200);
});

Deno.test('D57: keep stores what the result added to each record, with the fight it came from', async () => {
  for (
    const [outcome, aKept, bKept] of [
      [{ decision_type: 'UD', winner: 'A' }, { won: 1 }, { lost: 1 }],
      [{ decision_type: 'KO', winner: 'B' }, { lost: 1 }, { won: 1, kos: 1 }],
      [{ decision_type: 'D', winner: 'draw' }, { draws: 1 }, { draws: 1 }],
      [{ decision_type: 'NC', winner: 'none' }, { nc: 1 }, { nc: 1 }],
    ] as const
  ) {
    const api = testApi();
    const { aId, bId, boutId } = await usykFury(api);
    await finalise(api, boutId, outcome);
    const res = await api.call('DELETE', `/api/bouts/${boutId}?records=keep`);
    assertEquals(res.status, 200, outcome.decision_type);
    const none = { won: 0, lost: 0, draws: 0, nc: 0, kos: 0 };
    const fight = {
      bout_description: `Oleksandr Usyk vs Tyson Fury, ${outcome.decision_type}`,
      bout_date: '2024-05-18',
    };
    deepStrictEqual(
      keptOf(api, aId),
      [{ opponent_id: bId, ...none, ...aKept, ...fight }],
      outcome.decision_type,
    );
    deepStrictEqual(
      keptOf(api, bId),
      [{ opponent_id: aId, ...none, ...bKept, ...fight }],
      outcome.decision_type,
    );
  }
});

Deno.test('D57: keep stores the result even when the record was corrected by hand and reverse is refused', async () => {
  const api = testApi();
  const { bId, boutId } = await usykFury(api);
  await finalise(api, boutId, { decision_type: 'UD', winner: 'A' });
  await api.call('PATCH', `/api/fighters/${bId}`, { lost: 0 }); // D28
  assertEquals((await api.call('DELETE', `/api/bouts/${boutId}?records=keep`)).status, 200);
  deepStrictEqual(keptOf(api, bId).map((k) => k.lost), [1]);
});

Deno.test('D57: a refused delete and a draft delete store nothing', async () => {
  const api = testApi();
  const { aId, bId, eventId, boutId } = await usykFury(api);
  const { json: draft } = await api.call('POST', '/api/bouts', {
    event_id: eventId,
    weight_class_id: 18,
    scheduled_rounds: 12,
    fighter_a_id: bId,
    fighter_b_id: aId,
  });
  await finalise(api, boutId, { decision_type: 'UD', winner: 'A' });
  assertEquals((await api.call('DELETE', `/api/bouts/${boutId}`)).status, 409);
  assertEquals((await api.call('DELETE', `/api/bouts/${draft.id}?records=keep`)).status, 204);
  deepStrictEqual([keptOf(api, aId), keptOf(api, bId)], [[], []]);
});
