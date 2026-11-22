// /api/events: a date and its venue (D117), and the bouts on its card (SPEC
// API). An event answers with its venue's parts, so a page needs one call.
import { Hono } from 'hono';
import { z } from 'zod';
import type { Database } from '../db/connection.ts';
import {
  deleteEvent,
  type Event,
  getEvent,
  insertEvent,
  listEvents,
  updateEvent,
} from '../db/event.ts';
import { getVenue } from '../db/venue.ts';
import { countFinalisedBouts, listBoutsForEvent } from '../db/bout.ts';
import { boutView } from './card.ts';
import { conflict, type GetDb, notFound, pathId, readBody } from './http.ts';

export const eventSchema = z.strictObject({
  date: z.iso.date(), // YYYY-MM-DD; the schema checks it is a real day too (D18)
  venue_id: z.int().positive(), // a venue that does not exist is a 400 (D30)
});

export type EventView = ReturnType<typeof eventView>;

export function eventView(db: Database, event: Event) {
  return { ...event, venue: getVenue(db, event.venue_id)! };
}

export function eventRoutes(db: GetDb): Hono {
  const routes = new Hono();

  routes.get('/', (c) => c.json(listEvents(db()).map((e) => eventView(db(), e))));

  routes.post('/', async (c) => {
    const body = await readBody(c, eventSchema);
    if (!body.ok) return body.response;
    const id = insertEvent(db(), body.data);
    return c.json(eventView(db(), getEvent(db(), id)!), 201);
  });

  routes.get('/:id', (c) => {
    const id = pathId(c);
    const event = id && getEvent(db(), id);
    return event ? c.json(eventView(db(), event)) : notFound(c, 'event');
  });

  routes.patch('/:id', async (c) => {
    const id = pathId(c);
    const event = id && getEvent(db(), id);
    if (!id || !event) return notFound(c, 'event');
    const body = await readBody(c, eventSchema.partial());
    if (!body.ok) return body.response;
    const { date, venue_id } = { ...event, ...body.data };
    updateEvent(db(), id, { date, venue_id });
    return c.json(eventView(db(), getEvent(db(), id)!));
  });

  // Its bouts go with it, but never a finalised one: that has moved two
  // records, and the event delete has no reset-or-keep choice (D23, D56: each
  // finalised fight is deleted through its own guarded flow first).
  routes.delete('/:id', (c) => {
    const id = pathId(c);
    if (!id || !getEvent(db(), id)) return notFound(c, 'event');
    const finalised = countFinalisedBouts(db(), id);
    if (finalised > 0) {
      return conflict(c, `the event has ${finalised} finalised bout(s); delete those first`);
    }
    deleteEvent(db(), id);
    return c.body(null, 204);
  });

  // The card, in card order, each bout as GET /bouts/:id answers it (D34).
  routes.get('/:id/bouts', (c) => {
    const id = pathId(c);
    if (!id || !getEvent(db(), id)) return notFound(c, 'event');
    return c.json(listBoutsForEvent(db(), id).map((b) => boutView(db(), b.id)));
  });

  return routes;
}
