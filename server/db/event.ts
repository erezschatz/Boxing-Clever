// event: a date and a place. Deleting an event is its own act, and its bouts
// go with it (the API refuses first when any bout is finalised, SPEC API).
// Deleting bouts never deletes their event, not even the last one: a bout
// filed under the wrong event is removed and the event stays (D23).
import type { Database } from './connection.ts';

export type EventFields = { date: string; location: string };
export type Event = EventFields & { id: number };

export function insertEvent(db: Database, fields: EventFields): number {
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO event (date, location) VALUES (:date, :location)',
  ).run(fields);
  return Number(lastInsertRowid);
}

export function getEvent(db: Database, id: number): Event | undefined {
  return db.prepare('SELECT * FROM event WHERE id = ?').get(id) as Event | undefined;
}

// Newest first, as the events page lists them.
export function listEvents(db: Database): Event[] {
  return db.prepare('SELECT * FROM event ORDER BY date DESC, id DESC').all() as Event[];
}

export function updateEvent(db: Database, id: number, fields: EventFields): boolean {
  const { changes } = db.prepare(
    'UPDATE event SET date = :date, location = :location WHERE id = :id',
  ).run({ ...fields, id });
  return changes > 0;
}

export function deleteEvent(db: Database, id: number): boolean {
  return db.prepare('DELETE FROM event WHERE id = ?').run(id).changes > 0;
}
