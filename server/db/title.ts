// title: a belt — body, area, class, kind. Unique on the four (SPEC Data model).
import type { Database } from './connection.ts';

export type TitleFields = {
  sanctioning_body: string;
  area: string;
  weight_class_id: number;
  status: string;
};
export type Title = TitleFields & { id: number };

export function insertTitle(db: Database, fields: TitleFields): number {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO title (sanctioning_body, area, weight_class_id, status)
     VALUES (:sanctioning_body, :area, :weight_class_id, :status)`,
  ).run(fields);
  return Number(lastInsertRowid);
}

export function getTitle(db: Database, id: number): Title | undefined {
  return db.prepare('SELECT * FROM title WHERE id = ?').get(id) as Title | undefined;
}

export function listTitles(db: Database): Title[] {
  return db.prepare(
    'SELECT * FROM title ORDER BY weight_class_id, sanctioning_body, area, status',
  ).all() as Title[];
}
