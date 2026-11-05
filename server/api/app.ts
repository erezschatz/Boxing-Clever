// The chamber's Hono app: the API under /api, the front end everywhere else
// (SPEC Atrium). It takes the database as a function so that mod.ts can open
// the real file on first use and the tests can pass an in-memory one.
import { Hono } from 'hono';
import { serveFront } from '../static.ts';
import { constraintResponse, type GetDb } from './http.ts';
import { weightClassRoutes } from './weight-classes.ts';
import { fighterRoutes } from './fighters.ts';
import { eventRoutes } from './events.ts';
import { titleRoutes } from './titles.ts';
import { boutRoutes } from './bouts.ts';
import { cardRoutes } from './card.ts';

export const VERSION = '2.0.0-draft';

export function createApp(db: GetDb): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true, version: VERSION }));
  app.route('/api/weight-classes', weightClassRoutes(db));
  app.route('/api/fighters', fighterRoutes(db));
  app.route('/api/events', eventRoutes(db));
  app.route('/api/titles', titleRoutes(db));
  app.route('/api/bouts', boutRoutes(db));
  app.route('/api/bouts', cardRoutes(db));

  // An API path nobody registered is a 404, never the front page (D5).
  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

  // Everything else is the front end (task 06 fills front/).
  app.get('*', (c) => serveFront(c.req.raw));

  // A write the schema refuses is the client's error (D30); the rest is a 500.
  app.onError((err, c) => constraintResponse(err) ?? c.json({ error: 'internal error' }, 500));

  return app;
}
