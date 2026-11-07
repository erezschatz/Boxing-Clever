// The browser's side of SPEC API: JSON over fetch, and the server's
// `{ error }` thrown as an Error with its status. The wire shapes are the
// server's own types, imported as types only, so the bundle carries nothing
// of the server and the two cannot drift apart unnoticed.
import type { Event } from '../server/db/event.ts';
import type { Fighter } from '../server/db/fighter.ts';
import type { WeightClass } from '../server/db/weight-class.ts';
import type { Title } from '../server/db/title.ts';
import type { BoutView } from '../server/api/card.ts';

export type { BoutView, Event, Fighter, Title, WeightClass };

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch('/api' + path, {
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? `${res.status} ${res.statusText}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

// The reference lists a page joins against by id: every fighter, class and
// title (D34). One user's database is small enough to read whole.
export async function references() {
  const [fighters, classes, titles] = await Promise.all([
    api<Fighter[]>('/fighters'),
    api<WeightClass[]>('/weight-classes'),
    api<Title[]>('/titles'),
  ]);
  return { fighters: byId(fighters), classes: byId(classes), titles: byId(titles) };
}

export function byId<T extends { id: number }>(rows: T[]): Map<number, T> {
  return new Map(rows.map((row) => [row.id, row]));
}
