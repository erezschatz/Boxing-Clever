// /api/bouts/:id/card: the scorecard, saved whole (SPEC API). Saving takes
// the as-of snapshot the first time (SPEC §7); finalising moves both records
// once, and editing a finalised result reverses and re-applies (SPEC §6).
// All of it is one transaction, or nothing changes.
import { Hono } from 'hono';
import { z } from 'zod';
import { type Database, transaction } from '../db/connection.ts';
import {
  type Bout,
  getBout,
  type Judges,
  setBoutResult,
  setJudges,
  setSideSnapshot,
  type SideSnapshot,
} from '../db/bout.ts';
import { listBoutTitles } from '../db/bout-title.ts';
import { deleteRoundScores, insertRoundScore, listRoundScores } from '../db/round-score.ts';
import { insertDeduction, listDeductions } from '../db/deduction.ts';
import { type Fighter, getFighter, setFighterRecord } from '../db/fighter.ts';
import { getEvent } from '../db/event.ts';
import { rankAsOf } from '../db/tbrb-snapshot.ts';
import { DECISION_TYPES, type DecisionType } from '../rules/decisions.ts';
import {
  applyDelta,
  type FightRecord,
  isNegative,
  isNoChange,
  type Outcome,
  recordChange,
} from '../rules/records.ts';
import {
  boutTotal,
  type Card,
  DEDUCTION_REASONS,
  type DeductionReason,
  roundTotal,
  validateCard,
} from '../rules/scoring.ts';
import { type GetDb, notFound, pathId, readBody } from './http.ts';

// The shape only; whether the card makes sense as a whole is validateCard's
// (SPEC Scoring, D18). Points 0–10 and the m:ss time are checked there too,
// so the rules give the message.
const whole = z.int();
const judgeTotal = z.int().min(0).max(150).nullable(); // 15 rounds of 10
const NO_JUDGES: Judges = [{ a: null, b: null }, { a: null, b: null }, { a: null, b: null }];

export const cardSchema = z.strictObject({
  rounds: z.array(z.strictObject({ round_no: whole, a: whole, b: whole })),
  deductions: z.array(z.strictObject({
    round_no: whole,
    side: z.enum(['A', 'B']),
    points: whole,
    reason: z.enum(DEDUCTION_REASONS as [DeductionReason, ...DeductionReason[]]),
    note: z.string().nullable().default(null),
  })).default([]),
  result: z.strictObject({
    decision_type: z.enum(DECISION_TYPES as [DecisionType, ...DecisionType[]]),
    winner: z.enum(['A', 'B', 'draw', 'none']),
    round: whole.nullable(),
    time: z.string().nullable(),
  }).nullable(),
  judges: z.tuple([
    z.strictObject({ a: judgeTotal, b: judgeTotal }),
    z.strictObject({ a: judgeTotal, b: judgeTotal }),
    z.strictObject({ a: judgeTotal, b: judgeTotal }),
  ]).default(NO_JUDGES),
  is_draft: z.boolean(),
});

type CardBody = z.infer<typeof cardSchema>;

// The stored card in the shape PUT takes, so a client can GET, edit and PUT
// back; `totals` are computed by the rules (§2, §3) and are read-only.
export function readCard(db: Database, bout: Bout) {
  const scores = listRoundScores(db, bout.id);
  const byRound = new Map<number, { round_no: number; a: number; b: number }>();
  for (const s of scores) {
    const round = byRound.get(s.round_no) ?? { round_no: s.round_no, a: 0, b: 0 };
    if (s.side === 'A') round.a = s.points;
    else round.b = s.points;
    byRound.set(s.round_no, round);
  }
  const card: Card = {
    scheduled_rounds: bout.scheduled_rounds,
    rounds: [...byRound.values()],
    deductions: listDeductions(db, bout.id).map(({ round_no, side, points, reason, note }) => ({
      round_no,
      side,
      points,
      reason,
      note,
    })),
    result: bout.decision_type
      ? {
        decision_type: bout.decision_type,
        winner: bout.winner!,
        round: bout.result_round,
        time: bout.result_time,
      }
      : null,
    is_draft: bout.is_draft === 1,
  };
  const judges: Judges = [
    { a: bout.judge1_a, b: bout.judge1_b },
    { a: bout.judge2_a, b: bout.judge2_b },
    { a: bout.judge3_a, b: bout.judge3_b },
  ];
  const totals = {
    rounds: card.rounds.map((r) => ({
      round_no: r.round_no,
      a: roundTotal(card, r.round_no, 'A'),
      b: roundTotal(card, r.round_no, 'B'),
    })),
    a: boutTotal(card, 'A'),
    b: boutTotal(card, 'B'),
  };
  return {
    rounds: card.rounds,
    deductions: card.deductions,
    result: card.result,
    judges,
    is_draft: card.is_draft,
    totals,
  };
}

// A bout as the API answers it: the row (snapshot and result included), the
// titles on the line with who held each, and the card (SPEC API).
export function boutView(db: Database, boutId: number) {
  const bout = getBout(db, boutId)!;
  const titles = listBoutTitles(db, boutId)
    .map(({ title_id, holder_side }) => ({ title_id, holder_side }));
  return { ...bout, titles, card: readCard(db, bout) };
}

const recordOf = (f: Fighter): FightRecord => ({
  won: f.won,
  lost: f.lost,
  draws: f.draws,
  nc: f.nc,
  kos: f.kos,
});

// §7: each fighter as they stood before this fight was counted. Normally
// the bout is not counted yet. A bout finalised with no snapshot (an import)
// already counts in the record, so its own result is taken off first
// (`uncount`). The TBRB rank is read from the bout's own class for now
// (D32; which list counts is tasks/tbrb-rank-across-classes.md).
function snapshotOf(
  db: Database,
  f: Fighter,
  uncount: FightRecord,
  bout: Bout,
  date: string,
): SideSnapshot {
  return {
    ...applyDelta(recordOf(f), uncount),
    weight: f.weight,
    weight_unit: f.weight_unit,
    colors: f.colors,
    tbrb_rank: rankAsOf(db, f.id, bout.weight_class_id, date),
  };
}

// What the record holds for this bout now, and what it must hold after.
const counted = (bout: Bout): Outcome | null =>
  bout.is_draft === 0 ? { decision_type: bout.decision_type!, winner: bout.winner! } : null;
const toCount = (body: CardBody): Outcome | null =>
  !body.is_draft && body.result
    ? { decision_type: body.result.decision_type, winner: body.result.winner }
    : null;

export function cardRoutes(db: GetDb): Hono {
  const routes = new Hono();

  routes.put('/:id/card', async (c) => {
    const boutId = pathId(c);
    const bout = boutId && getBout(db(), boutId);
    if (!boutId || !bout) return notFound(c, 'bout');
    const body = await readBody(c, cardSchema);
    if (!body.ok) return body.response;
    const card = body.data;

    const problems = validateCard({ ...card, scheduled_rounds: bout.scheduled_rounds });
    if (problems.length > 0) return c.json({ error: 'invalid card', problems }, 400);

    // §6: the change to both records, as one delta. Nothing moves when the
    // same result is saved again.
    const change = recordChange(counted(bout), toCount(card));
    const a = getFighter(db(), bout.fighter_a_id)!;
    const b = getFighter(db(), bout.fighter_b_id)!;
    const aAfter = applyDelta(recordOf(a), change.a);
    const bAfter = applyDelta(recordOf(b), change.b);
    // Reversing a result off a record that was corrected by hand (D28) can
    // find it no longer there.
    if (isNegative(aAfter) || isNegative(bAfter)) {
      return c.json({ error: 'the change would take a record below zero' }, 409);
    }

    transaction(db(), () => {
      // §7: the first save of any kind takes the snapshot, before this
      // bout's result is counted; later saves leave it alone.
      // Each side on its own: a replaced fighter's side is retaken while the
      // other keeps the snapshot it has (D32).
      const date = getEvent(db(), bout.event_id)!.date;
      const already = recordChange(counted(bout), null); // this result off, if counted
      if (bout.a_won === null) {
        setSideSnapshot(db(), bout.id, 'a', snapshotOf(db(), a, already.a, bout, date));
      }
      if (bout.b_won === null) {
        setSideSnapshot(db(), bout.id, 'b', snapshotOf(db(), b, already.b, bout, date));
      }
      deleteRoundScores(db(), bout.id); // its deductions go with it
      for (const r of card.rounds) {
        insertRoundScore(db(), { bout_id: bout.id, round_no: r.round_no, side: 'A', points: r.a });
        insertRoundScore(db(), { bout_id: bout.id, round_no: r.round_no, side: 'B', points: r.b });
      }
      for (const d of card.deductions) insertDeduction(db(), { bout_id: bout.id, ...d });
      setBoutResult(db(), bout.id, {
        decision_type: card.result?.decision_type ?? null,
        winner: card.result?.winner ?? null,
        result_round: card.result?.round ?? null,
        result_time: card.result?.time ?? null,
        is_draft: card.is_draft ? 1 : 0,
      });
      setJudges(db(), bout.id, card.judges);
      if (!isNoChange(change)) {
        setFighterRecord(db(), a.id, aAfter);
        setFighterRecord(db(), b.id, bAfter);
      }
    });

    return c.json(boutView(db(), bout.id));
  });

  return routes;
}
