// The chamber's app over a fresh in-memory database, and a one-line way to
// call it. Tests speak HTTP to it and, for tier 3, read what it left in the
// database through the db modules.
import { createApp } from '../../server/api/app.ts';
import type { Database } from '../../server/db/connection.ts';
import { getBout, setBoutResult } from '../../server/db/bout.ts';
import { getFighter, setFighterRecord } from '../../server/db/fighter.ts';
import { applyDelta, type Outcome, recordDelta } from '../../server/rules/records.ts';
import { testDatabase } from './db.ts';

export type Api = {
  db: Database;
  // deno-lint-ignore no-explicit-any
  call: (method: string, path: string, body?: unknown) => Promise<{ status: number; json: any }>;
};

export function testApi(): Api {
  const db = testDatabase();
  const app = createApp(() => db);
  return {
    db,
    async call(method, path, body) {
      const init: RequestInit = { method };
      if (body !== undefined) {
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
        init.headers = { 'content-type': 'application/json' };
      }
      const res = await app.request('http://boxing.test' + path, init);
      const text = await res.text();
      return { status: res.status, json: text ? JSON.parse(text) : null };
    },
  };
}

export const HEAVYWEIGHT = 18;

export const usyk = {
  first_name: 'Oleksandr',
  last_name: 'Usyk',
  colors: 'Blue/Yellow',
  weight: 225.5,
  weight_unit: 'lbs',
  won: 21,
  kos: 14,
};
export const fury = {
  first_name: 'Tyson',
  last_name: 'Fury',
  nickname: 'The Gypsy King',
  colors: 'White',
  weight: 262,
  weight_unit: 'lbs',
  won: 34,
  draws: 1,
  kos: 24,
};

// An event with Usyk v Fury on it, made over HTTP; returns the ids.
export async function usykFury(api: Api) {
  const event = (await api.call('POST', '/api/events', {
    date: '2024-05-18',
    location: 'Kingdom Arena, Riyadh',
  })).json;
  const a = (await api.call('POST', '/api/fighters', usyk)).json;
  const b = (await api.call('POST', '/api/fighters', fury)).json;
  const bout = (await api.call('POST', '/api/bouts', {
    event_id: event.id,
    weight_class_id: HEAVYWEIGHT,
    scheduled_rounds: 12,
    fighter_a_id: a.id,
    fighter_b_id: b.id,
    corner_a: 'blue',
  })).json;
  return {
    eventId: event.id as number,
    aId: a.id as number,
    bId: b.id as number,
    boutId: bout.id as number,
  };
}

// Stands in for task 05's finalise until PUT /bouts/:id/card exists: the
// result is set and both records move by the §6 delta, as finalise will do.

export function finaliseByHand(db: Database, boutId: number, outcome: Outcome, round = 12) {
  setBoutResult(db, boutId, { ...outcome, result_round: round, result_time: null, is_draft: 0 });
  const bout = getBout(db, boutId)!;
  const delta = recordDelta(outcome);
  for (
    const [fighterId, d] of [[bout.fighter_a_id, delta.a], [bout.fighter_b_id, delta.b]] as const
  ) {
    const { won, lost, draws, nc, kos } = getFighter(db, fighterId)!;
    setFighterRecord(db, fighterId, applyDelta({ won, lost, draws, nc, kos }, d));
  }
}

export function recordOf(db: Database, fighterId: number) {
  const { won, lost, draws, nc, kos } = getFighter(db, fighterId)!;
  return { won, lost, draws, nc, kos };
}
