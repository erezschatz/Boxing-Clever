// /api/bouts: who fights whom on which card, in which corners, for which
// belts; and the guarded delete (SPEC API, D23). The scorecard itself —
// rounds, deductions, result, finalise — is PUT /bouts/:id/card, task 05.
import { Hono } from 'hono';
import { z } from 'zod';
import { type Database, transaction } from '../db/connection.ts';
import {
  type BoutFields,
  clearSnapshot,
  deleteBout,
  getBout,
  insertBout,
  nextCardOrder,
  updateBout,
} from '../db/bout.ts';
import { deleteBoutTitles, insertBoutTitle } from '../db/bout-title.ts';
import { boutView, readCard } from './card.ts';
import { type Fighter, getFighter, setFighterRecord } from '../db/fighter.ts';
import {
  applyDelta,
  type FightRecord,
  isNegative,
  recordDelta,
  reverseDelta,
} from '../rules/records.ts';
import { MAX_ROUNDS, validateCard } from '../rules/scoring.ts';
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
    return c.json(boutView(db(), boutId), 201);
  });

  routes.get('/:id', (c) => {
    const boutId = pathId(c);
    if (!boutId || !getBout(db(), boutId)) return notFound(c, 'bout');
    return c.json(boutView(db(), boutId));
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
    // The card already saved must still hold under the new schedule (SPEC
    // Scoring §4: no round beyond it; a distance decision scores them all).
    if (merged.scheduled_rounds !== bout.scheduled_rounds) {
      const { rounds, deductions, result, is_draft } = readCard(db(), bout);
      const problems = validateCard({
        scheduled_rounds: merged.scheduled_rounds,
        rounds,
        deductions,
        result,
        is_draft,
      });
      if (problems.length > 0) return c.json({ error: 'invalid card', problems }, 400);
    }
    transaction(db(), () => {
      updateBout(db(), boutId, merged);
      if (titles) replaceTitles(db(), boutId, titles);
      // A draft's snapshot is of the fighter it was taken from; a new fighter
      // gets theirs at the next save (D32).
      if (merged.fighter_a_id !== bout.fighter_a_id) clearSnapshot(db(), boutId, 'a');
      if (merged.fighter_b_id !== bout.fighter_b_id) clearSnapshot(db(), boutId, 'b');
    });
    return c.json(boutView(db(), boutId));
  });

  // D23: a draft goes on request (204; no record is touched). A finalised
  // bout needs the user's choice, ?records=reverse (both records lose the
  // result, in the same transaction) or ?records=keep, else 409 with the
  // preview and nothing is deleted. The event always stays.
  routes.delete('/:id', (c) => {
    const boutId = pathId(c);
    const bout = boutId && getBout(db(), boutId);
    if (!boutId || !bout) return notFound(c, 'bout');

    if (bout.is_draft === 1) {
      deleteBout(db(), boutId);
      return c.body(null, 204);
    }

    // What each choice does to the two records, shown before the user picks
    // and returned after (D23, D31): `before` is now, `after_reverse` is the
    // record once this result is taken off.
    const undo = reverseDelta(recordDelta({
      decision_type: bout.decision_type!, // set on every finalised bout (D18)
      winner: bout.winner!,
    }));
    const side = (fighterId: number, delta: FightRecord) => {
      const f = getFighter(db(), fighterId)!;
      const before = recordOf(f);
      return {
        id: f.id,
        name: `${f.first_name} ${f.last_name}`,
        before,
        after_reverse: applyDelta(before, delta),
      };
    };
    const a = side(bout.fighter_a_id, undo.a);
    const b = side(bout.fighter_b_id, undo.b);
    // A record corrected by hand since finalise (D28) may no longer hold this
    // result; reversing would take it below zero, so only keep is offered.
    const reversePossible = !isNegative(a.after_reverse) && !isNegative(b.after_reverse);
    const preview = { bout_id: boutId, a, b, reverse_possible: reversePossible };

    const choice = c.req.query('records');
    if (choice !== 'reverse' && choice !== 'keep') {
      return c.json({
        error: 'the bout is finalised: say ?records=reverse or ?records=keep',
        preview,
      }, 409);
    }
    if (choice === 'reverse' && !reversePossible) {
      return c.json({
        error: 'reversing would take a record below zero; delete with ?records=keep',
        preview,
      }, 409);
    }
    transaction(db(), () => {
      if (choice === 'reverse') {
        setFighterRecord(db(), a.id, a.after_reverse);
        setFighterRecord(db(), b.id, b.after_reverse);
      }
      deleteBout(db(), boutId);
    });
    // What was done: the records as they now stand.
    const now = (s: typeof a) => ({
      id: s.id,
      name: s.name,
      before: s.before,
      after: choice === 'reverse' ? s.after_reverse : s.before,
    });
    return c.json({ deleted: boutId, records: choice, a: now(a), b: now(b) });
  });

  return routes;
}
