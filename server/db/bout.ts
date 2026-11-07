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
  // A class, or a contracted weight in pounds that is no class's limit:
  // exactly one of the two (D26, D45; the schema refuses neither and both).
  weight_class_id: number | null;
  contracted_weight: number | null;
  scheduled_rounds: number;
  fighter_a_id: number;
  fighter_b_id: number;
  corner_a: Corner | null; // fighter B has the other corner; null when not recorded (imports)
  // Marked by the user, never computed from the weigh-in (D26).
  missed_weight_a: 0 | 1;
  missed_weight_b: 0 | 1;
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
    `INSERT INTO bout (event_id, card_order, weight_class_id, contracted_weight,
       scheduled_rounds, fighter_a_id, fighter_b_id, corner_a, missed_weight_a, missed_weight_b)
     VALUES (:event_id, :card_order, :weight_class_id, :contracted_weight,
       :scheduled_rounds, :fighter_a_id, :fighter_b_id, :corner_a, :missed_weight_a,
       :missed_weight_b)`,
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
       weight_class_id = :weight_class_id, contracted_weight = :contracted_weight,
       scheduled_rounds = :scheduled_rounds, fighter_a_id = :fighter_a_id,
       fighter_b_id = :fighter_b_id, corner_a = :corner_a, missed_weight_a = :missed_weight_a,
       missed_weight_b = :missed_weight_b
     WHERE id = :id`,
  ).run({ ...fields, id });
  return changes > 0;
}

// Where a bout added without a card_order goes: after the last one on the card.
export function nextCardOrder(db: Database, eventId: number): number {
  const row = db.prepare('SELECT MAX(card_order) AS last FROM bout WHERE event_id = ?')
    .get(eventId);
  return ((row?.last as number | null) ?? 0) + 1;
}

export type BoutResult = {
  decision_type: DecisionType | null;
  winner: Winner | null;
  result_round: number | null;
  result_time: string | null;
  is_draft: 0 | 1;
};

// The result and the draft flag. Task 05's finalise calls this inside its
// transaction, after the rules have passed the card.
export function setBoutResult(db: Database, id: number, result: BoutResult): boolean {
  const { changes } = db.prepare(
    `UPDATE bout SET decision_type = :decision_type, winner = :winner,
       result_round = :result_round, result_time = :result_time, is_draft = :is_draft
     WHERE id = :id`,
  ).run({ ...result, id });
  return changes > 0;
}

// Merge: every bout the duplicate fought becomes the target's, on the same side.
export function repointBoutFighter(db: Database, fromId: number, toId: number): number {
  const a = db.prepare('UPDATE bout SET fighter_a_id = ? WHERE fighter_a_id = ?').run(toId, fromId);
  const b = db.prepare('UPDATE bout SET fighter_b_id = ? WHERE fighter_b_id = ?').run(toId, fromId);
  return Number(a.changes) + Number(b.changes);
}

// Bouts with these two fighters on opposite sides. Merging them would put one
// fighter on both sides, which the schema refuses.
export function countBoutsBetween(db: Database, x: number, y: number): number {
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM bout
     WHERE (fighter_a_id = :x AND fighter_b_id = :y) OR (fighter_a_id = :y AND fighter_b_id = :x)`,
  ).get({ x, y });
  return row?.n as number;
}

// Rounds, deductions and titles go with it (ON DELETE CASCADE).
export function deleteBout(db: Database, id: number): boolean {
  return db.prepare('DELETE FROM bout WHERE id = ?').run(id).changes > 0;
}

// DELETE /events/:id refuses while any of its bouts is finalised (SPEC API).
export function countFinalisedBouts(db: Database, eventId: number): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM bout WHERE event_id = ? AND is_draft = 0')
    .get(eventId);
  return row?.n as number;
}

// One fighter's side of the as-of snapshot (SPEC §7): their record, weight,
// colors and TBRB rank on the night.
export type SideSnapshot = {
  won: number;
  lost: number;
  draws: number;
  nc: number;
  kos: number;
  weight: number | null;
  weight_unit: WeightUnit | null;
  colors: string | null;
  tbrb_rank: number | null;
};

// One side's snapshot, taken once (at the first save of the card, inside its
// transaction). One side at a time, so retaking a replaced fighter's side
// never touches the other (D32). The caller decides when; this only writes.
export function setSideSnapshot(db: Database, id: number, side: 'a' | 'b', s: SideSnapshot) {
  const sql = side === 'a'
    ? `UPDATE bout SET a_won = :won, a_lost = :lost, a_draws = :draws, a_nc = :nc, a_kos = :kos,
         a_weight = :weight, a_weight_unit = :weight_unit, a_colors = :colors,
         a_tbrb_rank = :tbrb_rank
       WHERE id = :id`
    : `UPDATE bout SET b_won = :won, b_lost = :lost, b_draws = :draws, b_nc = :nc, b_kos = :kos,
         b_weight = :weight, b_weight_unit = :weight_unit, b_colors = :colors,
         b_tbrb_rank = :tbrb_rank
       WHERE id = :id`;
  return db.prepare(sql).run({ ...s, id }).changes > 0;
}

// A draft whose fighter was replaced holds a snapshot of the wrong person;
// clearing it lets the next save take the right one (D32).
export function clearSnapshot(db: Database, id: number, side: 'a' | 'b'): boolean {
  const sql = side === 'a'
    ? `UPDATE bout SET a_won = NULL, a_lost = NULL, a_draws = NULL, a_nc = NULL, a_kos = NULL,
         a_weight = NULL, a_weight_unit = NULL, a_colors = NULL, a_tbrb_rank = NULL
       WHERE id = ?`
    : `UPDATE bout SET b_won = NULL, b_lost = NULL, b_draws = NULL, b_nc = NULL, b_kos = NULL,
         b_weight = NULL, b_weight_unit = NULL, b_colors = NULL, b_tbrb_rank = NULL
       WHERE id = ?`;
  return db.prepare(sql).run(id).changes > 0;
}

// The three ring-side cards, each side's total or null when not known.
export type Judges = [JudgeCard, JudgeCard, JudgeCard];
export type JudgeCard = { a: number | null; b: number | null };

export function setJudges(db: Database, id: number, judges: Judges): boolean {
  const [j1, j2, j3] = judges;
  const { changes } = db.prepare(
    `UPDATE bout SET judge1_a = :j1a, judge1_b = :j1b, judge2_a = :j2a, judge2_b = :j2b,
       judge3_a = :j3a, judge3_b = :j3b
     WHERE id = :id`,
  ).run({ j1a: j1.a, j1b: j1.b, j2a: j2.a, j2b: j2.b, j3a: j3.a, j3b: j3.b, id });
  return changes > 0;
}
