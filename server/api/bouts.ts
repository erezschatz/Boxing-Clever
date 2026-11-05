// /api/bouts: who fights whom on which card, in which corners, for which
// belts; and the guarded delete (SPEC API, D23). The scorecard itself —
// rounds, deductions, result, finalise — is PUT /bouts/:id/card, task 05.
import { Hono } from 'hono';
import { z } from 'zod';
import { type Database, transaction } from '../db/connection.ts';
import {
  type BoutFields,
  deleteBout,
  getBout,
  insertBout,
  nextCardOrder,
  updateBout,
} from '../db/bout.ts';
import { deleteBoutTitles, insertBoutTitle, listBoutTitles } from '../db/bout-title.ts';
import { type Fighter, getFighter, setFighterRecord } from '../db/fighter.ts';
import type { DecisionType, Winner } from '../rules/decisions.ts';
import { applyDelta, type FightRecord, recordDelta, reverseDelta } from '../rules/records.ts';
import { MAX_ROUNDS } from '../rules/scoring.ts';
import { conflict, type GetDb, notFound, pathId, readBody } from './http.ts';

const rowId = z.int().positive();

// Which belts were on the line and who brought each one in (SPEC Data model).
const titlesSchema = z.array(z.strictObject({
  title_id: rowId,
  holder_side: z.enum(['A', 'B', 'vacant']),
})).refine(
  (titles) => new Set(titles.map((t) => t.title_id)).size === titles.length,
  { message: 'a title is listed twice' },
);

const fields = {
  event_id: rowId,
  card_order: z.int().positive(),
  weight_class_id: rowId,
  scheduled_rounds: z.int().min(1).max(MAX_ROUNDS),
  fighter_a_id: rowId,
  fighter_b_id: rowId,
  corner_a: z.enum(['red', 'blue']).nullable(), // B has the other corner
  titles: titlesSchema,
};

const twoFighters = (b: { fighter_a_id: number; fighter_b_id: number }) =>
  b.fighter_a_id !== b.fighter_b_id;
const twoFightersIssue = { message: 'a fighter cannot fight themself', path: ['fighter_b_id'] };

// card_order may be left out: the bout goes to the end of the card.
export const boutSchema = z.strictObject({
  ...fields,
  card_order: fields.card_order.optional(),
  corner_a: fields.corner_a.default(null),
  titles: fields.titles.default([]),
}).refine(twoFighters, twoFightersIssue);

const boutPatchSchema = z.strictObject(fields).partial();

type TitleOnTheLine = z.infer<typeof titlesSchema>[number];

// A bout as the API shows it: the row, with its titles beside it.
function boutJson(db: Database, boutId: number) {
  const bout = getBout(db, boutId)!;
  const titles = listBoutTitles(db, boutId)
    .map(({ title_id, holder_side }) => ({ title_id, holder_side }));
  return { ...bout, titles };
}

function replaceTitles(db: Database, boutId: number, titles: TitleOnTheLine[]) {
  deleteBoutTitles(db, boutId);
  for (const t of titles) insertBoutTitle(db, { bout_id: boutId, ...t });
}

const recordOf = (f: Fighter): FightRecord => ({
  won: f.won,
  lost: f.lost,
  draws: f.draws,
  nc: f.nc,
  kos: f.kos,
});

// Just the bout's own columns, out of a stored row with a PATCH spread over it.
function bodyFields(b: BoutFields): BoutFields {
  return {
    event_id: b.event_id,
    card_order: b.card_order,
    weight_class_id: b.weight_class_id,
    scheduled_rounds: b.scheduled_rounds,
    fighter_a_id: b.fighter_a_id,
    fighter_b_id: b.fighter_b_id,
    corner_a: b.corner_a,
  };
}

export function boutRoutes(db: GetDb): Hono {
  const routes = new Hono();

  routes.post('/', async (c) => {
    const body = await readBody(c, boutSchema);
    if (!body.ok) return body.response;
    const { titles, ...rest } = body.data;
    const boutId = transaction(db(), () => {
      const card_order = rest.card_order ?? nextCardOrder(db(), rest.event_id);
      const newId = insertBout(db(), { ...rest, card_order });
      replaceTitles(db(), newId, titles);
      return newId;
    });
    return c.json(boutJson(db(), boutId), 201);
  });

  routes.get('/:id', (c) => {
    const boutId = pathId(c);
    if (!boutId || !getBout(db(), boutId)) return notFound(c, 'bout');
    return c.json(boutJson(db(), boutId));
  });

  // Fields not sent keep their value; `titles`, when sent, is the whole list.
  routes.patch('/:id', async (c) => {
    const boutId = pathId(c);
    const bout = boutId && getBout(db(), boutId);
    if (!boutId || !bout) return notFound(c, 'bout');
    const body = await readBody(c, boutPatchSchema);
    if (!body.ok) return body.response;
    const { titles, ...changes } = body.data;
    const merged = bodyFields({ ...bout, ...changes });
    // A finalised result has already moved these two fighters' records (§6).
    // Putting other fighters in the bout would leave those counts on the wrong
    // people, so it is refused rather than moved (D30).
    const fightersChanged = merged.fighter_a_id !== bout.fighter_a_id ||
      merged.fighter_b_id !== bout.fighter_b_id;
    if (bout.is_draft === 0 && fightersChanged) {
      return conflict(c, 'the bout is finalised; its fighters cannot change');
    }
    transaction(db(), () => {
      updateBout(db(), boutId, merged);
      if (titles) replaceTitles(db(), boutId, titles);
    });
    return c.json(boutJson(db(), boutId));
  });

  // D23: a draft goes on request. A finalised bout needs the user's choice,
  // ?records=reverse (both records lose the result, in the same transaction)
  // or ?records=keep, else 409 and nothing is deleted. The event always stays.
  routes.delete('/:id', (c) => {
    const boutId = pathId(c);
    const bout = boutId && getBout(db(), boutId);
    if (!boutId || !bout) return notFound(c, 'bout');

    if (bout.is_draft === 1) {
      deleteBout(db(), boutId);
      return c.body(null, 204);
    }

    const choice = c.req.query('records');
    if (choice !== 'reverse' && choice !== 'keep') {
      return conflict(c, 'the bout is finalised: say ?records=reverse or ?records=keep');
    }
    if (choice === 'keep') {
      deleteBout(db(), boutId);
      return c.body(null, 204);
    }

    const undo = reverseDelta(recordDelta({
      decision_type: bout.decision_type as DecisionType, // set on every finalised bout (D18)
      winner: bout.winner as Winner,
    }));
    const a = getFighter(db(), bout.fighter_a_id)!;
    const b = getFighter(db(), bout.fighter_b_id)!;
    const aAfter = applyDelta(recordOf(a), undo.a);
    const bAfter = applyDelta(recordOf(b), undo.b);
    // A record corrected by hand since finalise (D28) may no longer hold this
    // result; reversing it would go below zero, so the user must choose keep.
    if ([aAfter, bAfter].some((r) => Object.values(r).some((n) => n < 0))) {
      return conflict(c, 'reversing would take a record below zero; delete with ?records=keep');
    }
    transaction(db(), () => {
      setFighterRecord(db(), a.id, aAfter);
      setFighterRecord(db(), b.id, bAfter);
      deleteBout(db(), boutId);
    });
    return c.body(null, 204);
  });

  return routes;
}
