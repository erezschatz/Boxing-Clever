// venue: where an event was held, typed once (D117, task venues): a name, a
// city, a region (a state or province, or null) and a country. Two venues
// never share all four (the venue_place index); the API says so as a 409.
import type { Database } from './connection.ts';

export type VenueFields = { name: string; city: string; region: string | null; country: string };
export type Venue = VenueFields & { id: number };

export function insertVenue(db: Database, fields: VenueFields): number {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO venue (name, city, region, country)
     VALUES (:name, :city, :region, :country)`,
  ).run(fields);
  return Number(lastInsertRowid);
}

export function getVenue(db: Database, id: number): Venue | undefined {
  return db.prepare('SELECT * FROM venue WHERE id = ?').get(id) as Venue | undefined;
}

// By country, then city, then name, as a list of places reads.
export function listVenues(db: Database): Venue[] {
  return db.prepare('SELECT * FROM venue ORDER BY country, city, name, id').all() as Venue[];
}

export function updateVenue(db: Database, id: number, fields: VenueFields): boolean {
  const { changes } = db.prepare(
    `UPDATE venue SET name = :name, city = :city, region = :region, country = :country
     WHERE id = :id`,
  ).run({ ...fields, id });
  return changes > 0;
}

// The venue with these four parts, as the import looks a place up before
// making it (IMPORT.md, "Places"). The same comparison as the unique index.
export function findVenue(db: Database, place: VenueFields): Venue | undefined {
  return db.prepare(
    `SELECT * FROM venue WHERE name = :name AND city = :city
       AND coalesce(region, '') = coalesce(:region, '') AND country = :country`,
  ).get(place) as Venue | undefined;
}
