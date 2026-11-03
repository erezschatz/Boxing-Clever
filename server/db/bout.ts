// bout: who fights whom on which card, the as-of snapshot of both fighters,
// and the result. This module covers the card details (SPEC API, PATCH
// /bouts/:id); taking the snapshot and finalising are task 05.
import type { Database } from './connection.ts';
import type { DecisionType, Winner } from '../rules/decisions.ts';
import type { WeightUnit } from '../rules/weight.ts';

export type Corner = 'red' | 'blue';

export type BoutFields = {
  event_id: number;
  card_order: number;
  weight_class_id: number;
  scheduled_rounds: number;
  fighter_a_id: number;
  fighter_b_id: number;
  corner_a: Corner | null; // fighter B has the other corner; null when not recorded (imports)
};

// The a_*/b_* columns are each fighter's record, weight, colors and TBRB rank
// on the night (SPEC §7). All null until the bout is first saved.
export type Bout = BoutFields & {
  id: number;
  a_won: number | null;
  a_lost: number | null;
  a_draws: number | null;
  a_nc: number | null;
  a_kos: number | null;
  a_weight: number | null;
  a_weight_unit: WeightUnit | null;
  a_colors: string | null;
  a_tbrb_rank: number | null; // 0 is champion, null unranked
  b_won: number | null;
  b_lost: number | null;
  b_draws: number | null;
  b_nc: number | null;
  b_kos: number | null;
  b_weight: number | null;
  b_weight_unit: WeightUnit | null;
  b_colors: string | null;
  b_tbrb_rank: number | null;
  decision_type: DecisionType | null;
  winner: Winner | null;
  result_round: number | null;
  result_time: string | null;
  judge1_a: number | null;
  judge1_b: number | null;
  judge2_a: number | null;
  judge2_b: number | null;
  judge3_a: number | null;
  judge3_b: number | null;
  is_draft: 0 | 1;
};

export function insertBout(db: Database, fields: BoutFields): number {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO bout (event_id, card_order, weight_class_id, scheduled_rounds,
       fighter_a_id, fighter_b_id, corner_a)
     VALUES (:event_id, :card_order, :weight_class_id, :scheduled_rounds,
       :fighter_a_id, :fighter_b_id, :corner_a)`,
  ).run(fields);
  return Number(lastInsertRowid);
}

export function getBout(db: Database, id: number): Bout | undefined {
  return db.prepare('SELECT * FROM bout WHERE id = ?').get(id) as Bout | undefined;
}

export function listBoutsForEvent(db: Database, eventId: number): Bout[] {
  return db.prepare('SELECT * FROM bout WHERE event_id = ? ORDER BY card_order, id')
    .all(eventId) as Bout[];
}

// A fighter's bouts as witnessed, oldest first, whichever side they were on.
export function listBoutsForFighter(db: Database, fighterId: number): Bout[] {
  return db.prepare(
    `SELECT bout.* FROM bout JOIN event ON event.id = bout.event_id
     WHERE bout.fighter_a_id = :id OR bout.fighter_b_id = :id
     ORDER BY event.date, bout.card_order, bout.id`,
  ).all({ id: fighterId }) as Bout[];
}

export function updateBout(db: Database, id: number, fields: BoutFields): boolean {
  const { changes } = db.prepare(
    `UPDATE bout SET event_id = :event_id, card_order = :card_order,
       weight_class_id = :weight_class_id, scheduled_rounds = :scheduled_rounds,
       fighter_a_id = :fighter_a_id, fighter_b_id = :fighter_b_id, corner_a = :corner_a
     WHERE id = :id`,
  ).run({ ...fields, id });
  return changes > 0;
}

// Rounds, deductions and titles go with it (ON DELETE CASCADE).
export function deleteBout(db: Database, id: number): boolean {
  return db.prepare('DELETE FROM bout WHERE id = ?').run(id).changes > 0;
}
