// /api/titles: belts, unique on body, area, class and interim (SPEC Data model, D42).
// A duplicate is a 409 and an unknown class a 400, both from the schema (D30).
import { Hono } from 'hono';
import { z } from 'zod';
import { getTitle, insertTitle, listTitles } from '../db/title.ts';
import { type GetDb, readBody } from './http.ts';

const text = z.string().trim().min(1);

// `interim` is the one kind a belt has (D42); vacancy is per fight, and
// Silver or Diamond is part of the area.
export const titleSchema = z.strictObject({
  sanctioning_body: text,
  area: text,
  weight_class_id: z.int().positive(),
  interim: z.boolean().default(false),
});

export function titleRoutes(db: GetDb): Hono {
  const routes = new Hono();

  routes.get('/', (c) => c.json(listTitles(db())));

  routes.post('/', async (c) => {
    const body = await readBody(c, titleSchema);
    if (!body.ok) return body.response;
    const id = insertTitle(db(), { ...body.data, interim: body.data.interim ? 1 : 0 });
    return c.json(getTitle(db(), id), 201);
  });

  return routes;
}
