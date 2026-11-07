// title: a belt, as body, area, class, and whether it is the interim one.
// Unique on the four (SPEC Data model, D42). Vacancy is not the belt's: it
// is bout_title.holder_side, per fight. Silver, Diamond and the like are
// part of the area ("World Silver").
import type { Database } from './connection.ts';

export type TitleFields = {
  sanctioning_body: string;
  area: string;
  weight_class_id: number;
  interim: 0 | 1;
};
export type Title = TitleFields & { id: number };

export function insertTitle(db: Database, fields: TitleFields): number {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO title (sanctioning_body, area, weight_class_id, interim)
     VALUES (:sanctioning_body, :area, :weight_class_id, :interim)`,
  ).run(fields);
  return Number(lastInsertRowid);
}

export function getTitle(db: Database, id: number): Title | undefined {
  return db.prepare('SELECT * FROM title WHERE id = ?').get(id) as Title | undefined;
}

export function listTitles(db: Database): Title[] {
  return db.prepare(
    'SELECT * FROM title ORDER BY weight_class_id, sanctioning_body, area, interim',
  ).all() as Title[];
}
