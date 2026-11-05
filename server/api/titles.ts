// /api/titles: belts, unique on body, area, class and status (SPEC Data model).
// A duplicate is a 409 and an unknown class a 400, both from the schema (D30).
import { Hono } from 'hono';
import { z } from 'zod';
import { getTitle, insertTitle, listTitles } from '../db/title.ts';
import { type GetDb, readBody } from './http.ts';

const text = z.string().trim().min(1);

export const titleSchema = z.strictObject({
  sanctioning_body: text,
  area: text,
  weight_class_id: z.int().positive(),
  status: text,
});

export function titleRoutes(db: GetDb): Hono {
  const routes = new Hono();

  routes.get('/', (c) => c.json(listTitles(db())));

  routes.post('/', async (c) => {
    const body = await readBody(c, titleSchema);
    if (!body.ok) return body.response;
    const id = insertTitle(db(), body.data);
    return c.json(getTitle(db(), id), 201);
  });

  return routes;
}
