// weight_class: the 18 classes seeded by migration 002. Read-only in the app.
import type { Database } from './connection.ts';

export type WeightClass = {
  id: number;
  name: string;
  alternate_name: string | null;
  lbs: number | null; // null for Heavyweight, which has no limit (D17)
  kg: number | null;
};

export function listWeightClasses(db: Database): WeightClass[] {
  return db.prepare('SELECT * FROM weight_class ORDER BY id').all() as WeightClass[];
}

export function getWeightClass(db: Database, id: number): WeightClass | undefined {
  return db.prepare('SELECT * FROM weight_class WHERE id = ?').get(id) as WeightClass | undefined;
}
