// /api/fighters: who they are, their record, their history as witnessed, and
// merging a duplicate into the fighter it duplicates (SPEC API).
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import { transaction } from '../db/connection.ts';
import {
  deleteFighter,
  type Fighter,
  getFighter,
  insertFighter,
  listFighters,
  setFighterRecord,
  updateFighter,
} from '../db/fighter.ts';
import { listAliases, repointAliases } from '../db/fighter-alias.ts';
import { countBoutsBetween, listBoutsForFighter, repointBoutFighter } from '../db/bout.ts';
import { listTbrbRowsForFighter, repointTbrbRows } from '../db/tbrb-snapshot.ts';
import type { Side } from '../rules/decisions.ts';
import { applyDelta, type FightRecord, resultsAdded } from '../rules/records.ts';
import { conflict, type GetDb, notFound, pathId, readBody } from './http.ts';

const count = z.int().nonnegative();
const optionalText = z.string().trim().min(1).nullable();

// The record is part of the body: a fighter arrives with the record they
// already have, and a typo in it is corrected by hand (D28). Afterwards
// finalise moves it (SPEC Scoring §6).
const fields = {
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  nickname: optionalText,
  colors: optionalText,
  weight: z.number().positive().nullable(),
  weight_unit: z.enum(['lbs', 'kg', 'st']).nullable(),
  won: count,
  lost: count,
  draws: count,
  nc: count,
  kos: count,
};

// A weight means nothing without its unit, and a unit nothing without a weight.
const weightHasUnit = (f: { weight?: number | null; weight_unit?: string | null }) =>
  (f.weight == null) === (f.weight_unit == null);
const weightIssue = { message: 'weight and weight_unit go together', path: ['weight_unit'] };

export const fighterSchema = z.strictObject({
  first_name: fields.first_name,
  last_name: fields.last_name,
  nickname: fields.nickname.default(null),
  colors: fields.colors.default(null),
  weight: fields.weight.default(null),
  weight_unit: fields.weight_unit.default(null),
  won: count.default(0),
  lost: count.default(0),
  draws: count.default(0),
  nc: count.default(0),
  kos: count.default(0),
}).refine(weightHasUnit, weightIssue);

// PATCH sends what changed; the check that needs both weight fields runs on
// the merged row, in the handler.
const fighterPatchSchema = z.strictObject(fields).partial();

type FighterBody = z.infer<typeof fighterSchema>;

function save(db: GetDb, id: number | null, f: FighterBody): number {
  const identity = {
    first_name: f.first_name,
    last_name: f.last_name,
    nickname: f.nickname,
    colors: f.colors,
    weight: f.weight,
    weight_unit: f.weight_unit,
  };
  const record = { won: f.won, lost: f.lost, draws: f.draws, nc: f.nc, kos: f.kos };
  return transaction(db(), () => {
    let fighterId = id;
    if (fighterId === null) fighterId = insertFighter(db(), identity);
    else updateFighter(db(), fighterId, identity);
    setFighterRecord(db(), fighterId, record);
    return fighterId;
  });
}

const nameOf = (f: Fighter) => `${f.first_name} ${f.last_name}`;
const recordOf = (f: Fighter): FightRecord => ({
  won: f.won,
  lost: f.lost,
  draws: f.draws,
  nc: f.nc,
  kos: f.kos,
});

// What merging :id into :targetId does, or why it cannot (D28, D31). The
// duplicate's own typed-in record is dropped; only the results of its
// finalised fights travel with those fights.
type MergePlan =
  | { ok: false; response: Response }
  | { ok: true; preview: MergePreview; dupId: number; targetId: number };

type MergePreview = {
  duplicate: { id: number; name: string; record_dropped: FightRecord };
  target: { id: number; name: string; before: FightRecord; after: FightRecord };
  bouts: number;
  finalised_bouts: number;
  aliases: number;
  tbrb_rows: number;
};

function mergePlan(c: Context, db: GetDb): MergePlan {
  const dupId = pathId(c);
  const targetId = pathId(c, 'targetId');
  const dup = dupId && getFighter(db(), dupId);
  const target = targetId && getFighter(db(), targetId);
  if (!dupId || !dup) return { ok: false, response: notFound(c, 'fighter') };
  if (!targetId || !target) return { ok: false, response: notFound(c, 'target fighter') };
  if (dupId === targetId) {
    return {
      ok: false,
      response: c.json({ error: 'a fighter cannot be merged into itself' }, 400),
    };
  }
  // The same person cannot have fought themself; two who met are two people.
  if (countBoutsBetween(db(), dupId, targetId) > 0) {
    return {
      ok: false,
      response: conflict(c, 'these fighters fought each other, so they are not the same fighter'),
    };
  }
  const bouts = listBoutsForFighter(db(), dupId);
  const finalised = bouts.filter((b) => b.is_draft === 0).map((b) => ({
    outcome: { decision_type: b.decision_type!, winner: b.winner! }, // set when finalised (D18)
    side: (b.fighter_a_id === dupId ? 'A' : 'B') as Side,
  }));
  const before = recordOf(target);
  const preview: MergePreview = {
    duplicate: { id: dup.id, name: nameOf(dup), record_dropped: recordOf(dup) },
    target: {
      id: target.id,
      name: nameOf(target),
      before,
      after: applyDelta(before, resultsAdded(finalised)),
    },
    bouts: bouts.length,
    finalised_bouts: finalised.length,
    aliases: listAliases(db(), dupId).length,
    tbrb_rows: listTbrbRowsForFighter(db(), dupId).length,
  };
  return { ok: true, preview, dupId, targetId };
}

export function fighterRoutes(db: GetDb): Hono {
  const routes = new Hono();

  routes.get('/', (c) => c.json(listFighters(db())));

  routes.post('/', async (c) => {
    const body = await readBody(c, fighterSchema);
    if (!body.ok) return body.response;
    return c.json(getFighter(db(), save(db, null, body.data)), 201);
  });

  routes.get('/:id', (c) => {
    const id = pathId(c);
    const fighter = id && getFighter(db(), id);
    return fighter ? c.json(fighter) : notFound(c, 'fighter');
  });

  routes.patch('/:id', async (c) => {
    const id = pathId(c);
    const fighter = id && getFighter(db(), id);
    if (!id || !fighter) return notFound(c, 'fighter');
    const body = await readBody(c, fighterPatchSchema);
    if (!body.ok) return body.response;
    const merged: Fighter = { ...fighter, ...body.data };
    if (!weightHasUnit(merged)) {
      const issues = [{ code: 'custom', ...weightIssue }];
      return c.json({ error: 'invalid body', issues }, 400);
    }
    save(db, id, merged);
    return c.json(getFighter(db(), id));
  });

  // Oldest first, each bout carrying both fighters' as-of snapshot (SPEC §7).
  routes.get('/:id/bouts', (c) => {
    const id = pathId(c);
    if (!id || !getFighter(db(), id)) return notFound(c, 'fighter');
    return c.json(listBoutsForFighter(db(), id));
  });

  // :id is the duplicate, :targetId the fighter it duplicates. GET says what
  // a merge would do; POST does it. Bouts, aliases and TBRB rows move to the
  // target and the duplicate is deleted, all in one transaction or not at all
  // (SPEC Testing, tier 3). The duplicate's finalised fights are added to the
  // target's record, so each is counted once, by its owner, and the
  // duplicate's typed-in record is dropped. Every merge needs the user's
  // ?records=add, else 409 with the preview (D31).
  routes.get('/:id/merge/:targetId', (c) => {
    const plan = mergePlan(c, db);
    return plan.ok ? c.json(plan.preview) : plan.response;
  });

  routes.post('/:id/merge/:targetId', (c) => {
    const plan = mergePlan(c, db);
    if (!plan.ok) return plan.response;
    const { preview, dupId, targetId } = plan;
    if (c.req.query('records') !== 'add') {
      return c.json({
        error: 'approve what the merge does to the records with ?records=add',
        preview,
      }, 409);
    }
    transaction(db(), () => {
      repointBoutFighter(db(), dupId, targetId);
      repointAliases(db(), dupId, targetId);
      repointTbrbRows(db(), dupId, targetId);
      setFighterRecord(db(), targetId, preview.target.after);
      deleteFighter(db(), dupId);
    });
    return c.json(preview); // what was done: the preview, now carried out
  });

  return routes;
}
