// What every resource file shares: reading an id from the path, reading a
// JSON body through its zod schema, and the error shapes of SPEC API.
import type { Context } from 'hono';
import type { z } from 'zod';
import type { Database } from '../db/connection.ts';

// Each resource gets the database through this, so the chamber can open its
// file on first use and the tests can hand in an in-memory one.
export type GetDb = () => Database;

// A path id that is not a positive integer names nothing, so it is a 404
// like any other missing id (D5, D30), not a 400.
export function pathId(c: Context, name = 'id'): number | null {
  const raw = c.req.param(name) ?? '';
  return /^[1-9]\d*$/.test(raw) ? Number(raw) : null;
}

export function notFound(c: Context, what: string) {
  return c.json({ error: `${what} not found` }, 404);
}

export function conflict(c: Context, error: string) {
  return c.json({ error }, 409);
}

type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

// 400 with zod's issues on a body that fails its schema; a body that is not
// JSON at all is reported the same way, as one issue (SPEC API).
export async function readBody<S extends z.ZodType>(
  c: Context,
  schema: S,
): Promise<Parsed<z.infer<S>>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    const issues = [{ code: 'invalid_json', path: [], message: 'body is not JSON' }];
    return { ok: false, response: c.json({ error: 'invalid body', issues }, 400) };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: c.json({ error: 'invalid body', issues: result.error.issues }, 400),
    };
  }
  return { ok: true, data: result.data };
}

// The schema has the last word on shapes (D18) and the handlers do not
// re-check every reference first: a write the database refuses becomes a
// client error here, in one place (D30). Anything else is a real 500.
export function constraintResponse(err: unknown): Response | null {
  const errcode = (err as { errcode?: number }).errcode;
  const message = (err as Error).message;
  const json = (status: number, error: string) =>
    new Response(JSON.stringify({ error, detail: message }), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  switch (errcode) {
    case 787: // SQLITE_CONSTRAINT_FOREIGNKEY
      return json(400, 'refers to something that does not exist');
    case 2067: // SQLITE_CONSTRAINT_UNIQUE
    case 1555: // SQLITE_CONSTRAINT_PRIMARYKEY
      return json(409, 'already exists');
    case 275: // SQLITE_CONSTRAINT_CHECK
    case 1299: // SQLITE_CONSTRAINT_NOTNULL
      return json(400, 'refused by the schema');
    default:
      return null;
  }
}
