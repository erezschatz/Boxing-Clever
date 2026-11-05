// /api/weight-classes: the 18 seeded classes, read-only (SPEC API).
import { Hono } from 'hono';
import { listWeightClasses } from '../db/weight-class.ts';
import type { GetDb } from './http.ts';

export function weightClassRoutes(db: GetDb): Hono {
  const routes = new Hono();
  routes.get('/', (c) => c.json(listWeightClasses(db())));
  return routes;
}
