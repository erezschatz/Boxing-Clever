// /api/fighters: who they are, their record, their history as witnessed, and
// merging a duplicate into the fighter it duplicates (SPEC API).
import { Hono } from 'hono';
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
import { repointAliases } from '../db/fighter-alias.ts';
import { countBoutsBetween, listBoutsForFighter, repointBoutFighter } from '../db/bout.ts';
import { repointTbrbRows } from '../db/tbrb-snapshot.ts';
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

  // :id is the duplicate, :targetId the fighter it duplicates. Bouts, aliases
  // and TBRB rows move to the target and the duplicate is deleted, all in one
  // transaction or not at all (SPEC Testing, tier 3). The target keeps its
  // own record, as in v1 (D28).
  routes.post('/:id/merge/:targetId', (c) => {
    const id = pathId(c);
    const targetId = pathId(c, 'targetId');
    if (!id || !getFighter(db(), id)) return notFound(c, 'fighter');
    if (!targetId || !getFighter(db(), targetId)) return notFound(c, 'target fighter');
    if (id === targetId) return c.json({ error: 'a fighter cannot be merged into itself' }, 400);
    // The same person cannot have fought themself; two who met are two people.
    if (countBoutsBetween(db(), id, targetId) > 0) {
      return conflict(c, 'these fighters fought each other, so they are not the same fighter');
    }
    transaction(db(), () => {
      repointBoutFighter(db(), id, targetId);
      repointAliases(db(), id, targetId);
      repointTbrbRows(db(), id, targetId);
      deleteFighter(db(), id);
    });
    return c.json(getFighter(db(), targetId));
  });

  return routes;
}
