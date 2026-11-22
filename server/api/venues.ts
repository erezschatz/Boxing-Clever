// /api/venues: where events were held, each typed once (D117, task venues).
// Listed, added and edited; a venue is never deleted here, as events point
// to it. The same four parts twice is a 409 (the venue_place index).
import { Hono } from 'hono';
import { z } from 'zod';
import { getVenue, insertVenue, listVenues, updateVenue } from '../db/venue.ts';
import { type GetDb, notFound, pathId, readBody } from './http.ts';

// A region left empty is none: "London, UK" has no state.
const region = z.string().trim().nullable().transform((r) => (r ? r : null));

export const venueSchema = z.strictObject({
  name: z.string().trim().min(1),
  city: z.string().trim().min(1),
  region,
  country: z.string().trim().min(1),
});

export function venueRoutes(db: GetDb): Hono {
  const routes = new Hono();

  routes.get('/', (c) => c.json(listVenues(db())));

  routes.post('/', async (c) => {
    const body = await readBody(c, venueSchema);
    if (!body.ok) return body.response;
    const id = insertVenue(db(), body.data);
    return c.json(getVenue(db(), id), 201);
  });

  routes.get('/:id', (c) => {
    const id = pathId(c);
    const venue = id && getVenue(db(), id);
    return venue ? c.json(venue) : notFound(c, 'venue');
  });

  // Fixing a venue fixes it on every event held there.
  routes.patch('/:id', async (c) => {
    const id = pathId(c);
    const venue = id && getVenue(db(), id);
    if (!id || !venue) return notFound(c, 'venue');
    const body = await readBody(c, venueSchema.partial());
    if (!body.ok) return body.response;
    // Checked as it will stand: a venue the migration left with an empty
    // city or country (D118) is fixed whole, not left half-empty.
    const { name, city, region, country } = { ...venue, ...body.data };
    const merged = venueSchema.safeParse({ name, city, region, country });
    if (!merged.success) {
      return c.json({ error: 'invalid body', issues: merged.error.issues }, 400);
    }
    updateVenue(db(), id, merged.data);
    return c.json(getVenue(db(), id));
  });

  return routes;
}
