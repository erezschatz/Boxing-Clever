// The chamber's app over a fresh in-memory database, and a one-line way to
// call it. Tests speak HTTP to it and, for tier 3, read what it left in the
// database through the db modules.
import { createApp } from '../../server/api/app.ts';
import type { Database } from '../../server/db/connection.ts';
import { getFighter } from '../../server/db/fighter.ts';
import type { Outcome } from '../../server/rules/records.ts';
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

// A venue made over HTTP (task venues); returns its id. The same four parts
// are one venue, so a second call with them answers the venue already made.
export async function venueId(
  api: Api,
  fields = { name: 'Kingdom Arena', city: 'Riyadh', region: null, country: 'Saudi Arabia' },
): Promise<number> {
  const made = await api.call('POST', '/api/venues', fields);
  if (made.status === 201) return made.json.id;
  // Already there: the same four parts are one venue.
  const all = (await api.call('GET', '/api/venues')).json as { id: number; name: string }[];
  return all.find((v) => v.name === fields.name)!.id;
}

// An event with Usyk v Fury on it, made over HTTP; returns the ids.
export async function usykFury(api: Api) {
  const event = (await api.call('POST', '/api/events', {
    date: '2024-05-18',
    venue_id: await venueId(api),
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

// Finalises a bout over HTTP with an unscored card, which is valid with any
// result (D20): the shortest way to a finalised bout whose records moved.
export async function finalise(api: Api, boutId: number, outcome: Outcome) {
  const res = await api.call('PUT', `/api/bouts/${boutId}/card`, {
    rounds: [],
    result: { ...outcome, round: null, time: null },
    is_draft: false,
  });
  if (res.status !== 200) throw new Error(`finalise: ${res.status} ${JSON.stringify(res.json)}`);
  return res.json;
}

export function recordOf(db: Database, fighterId: number) {
  const { won, lost, draws, nc, kos } = getFighter(db, fighterId)!;
  return { won, lost, draws, nc, kos };
}
