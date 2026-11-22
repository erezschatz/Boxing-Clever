-- migrate: rebuilds a referenced table
-- D117 (task venues): an event's place is a venue record, typed once, with a
-- city, a region (a state or province, which may be empty) and a country.
-- The location strings typed so far are split at their commas, as Erez typed
-- them: "Venue, City, Country" or "Venue, City, Region, Country". A location
-- with five parts or more keeps the extra in the venue's name; one with two
-- parts has no country, and one with one part neither city nor country.
-- Those are stored with '' for what is missing, for the venue form to fill
-- in: the migration does not guess (D118). Empty parts (",,") are dropped
-- before counting, and a location with no part at all becomes a venue
-- named "Unknown venue", so every event keeps its id and gets a venue and
-- the migration always commits. The same four parts make one venue.

CREATE TABLE venue (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK (name <> ''),
  city TEXT NOT NULL,
  region TEXT CHECK (region IS NULL OR region <> ''),
  country TEXT NOT NULL
);
-- One venue per place; an empty region is NULL, compared as ''.
CREATE UNIQUE INDEX venue_place ON venue (name, city, coalesce(region, ''), country);

-- Each event's location in its non-empty parts, numbered 1, 2, 3… with no
-- gaps, in the order typed.
CREATE TEMP TABLE location_part AS
WITH RECURSIVE split (event_id, n, part, rest) AS (
  SELECT id, 0, NULL, location || ',' FROM event
  UNION ALL
  SELECT event_id, n + 1, trim(substr(rest, 1, instr(rest, ',') - 1)),
         substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest <> ''
)
SELECT event_id, row_number() OVER (PARTITION BY event_id ORDER BY n) AS n, part
FROM split WHERE n > 0 AND part <> '';

CREATE TEMP TABLE location_split AS
SELECT
  event_id,
  CASE WHEN total <= 4 THEN (SELECT part FROM location_part p WHERE p.event_id = c.event_id AND n = 1)
       ELSE (SELECT group_concat(part, ', ') FROM (
               SELECT part FROM location_part p WHERE p.event_id = c.event_id AND n <= total - 3
               ORDER BY n))
  END AS name,
  CASE WHEN total = 1 THEN ''
       WHEN total <= 3 THEN (SELECT part FROM location_part p WHERE p.event_id = c.event_id AND n = 2)
       ELSE (SELECT part FROM location_part p WHERE p.event_id = c.event_id AND n = total - 2)
  END AS city,
  CASE WHEN total >= 4
       THEN (SELECT part FROM location_part p WHERE p.event_id = c.event_id AND n = total - 1)
  END AS region,
  CASE WHEN total >= 3
       THEN (SELECT part FROM location_part p WHERE p.event_id = c.event_id AND n = total)
       ELSE ''
  END AS country
FROM (SELECT event_id, max(n) AS total FROM location_part GROUP BY event_id) AS c
UNION ALL
SELECT id, 'Unknown venue', '', NULL, '' FROM event
WHERE id NOT IN (SELECT event_id FROM location_part);

INSERT INTO venue (name, city, region, country)
SELECT DISTINCT name, city, region, country FROM location_split;

-- The event table without its location, pointing to its venue.
CREATE TABLE event_new (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL CHECK (date IS date(date)),
  venue_id INTEGER NOT NULL REFERENCES venue (id)
);
INSERT INTO event_new (id, date, venue_id)
SELECT e.id, e.date, v.id
FROM event e
JOIN location_split s ON s.event_id = e.id
JOIN venue v ON v.name = s.name AND v.city = s.city
  AND coalesce(v.region, '') = coalesce(s.region, '') AND v.country = s.country;
DROP TABLE event;
ALTER TABLE event_new RENAME TO event;
CREATE INDEX event_venue ON event (venue_id);

DROP TABLE location_part;
DROP TABLE location_split;
