-- migrate: rebuilds a referenced table
-- D42: a title is regular or interim, nothing else. Vacancy belongs to the
-- fight (bout_title.holder_side), never to the belt; Silver, Diamond and
-- the like are part of the area ("World Silver"). v1's kinds become:
-- Active, Vacant or nothing regular; Interim interim, and "Interim Silver"
-- interim with Silver in the area; anything else appended to the area.
-- Rows that turn out to be the same belt, compared ignoring case and spacing,
-- are merged into the lowest id, and their bouts point at it. A bout that
-- listed two of them keeps the one naming a holder over "vacant", else its
-- first.

CREATE TEMP TABLE title_kind AS
SELECT id, sanctioning_body, area, weight_class_id,
  trim(status) AS kind, lower(trim(status)) AS low
FROM title;

CREATE TEMP TABLE title_as_now AS
SELECT
  id,
  trim(sanctioning_body) AS sanctioning_body,
  CASE
    WHEN rest = '' THEN trim(area)
    WHEN trim(area) = '' THEN rest
    ELSE trim(area) || ' ' || rest
  END AS area,
  weight_class_id,
  interim
FROM (
  SELECT
    id, sanctioning_body, area, weight_class_id,
    CASE WHEN low = 'interim' OR low LIKE 'interim %' THEN 1 ELSE 0 END AS interim,
    CASE
      WHEN low IN ('active', 'vacant', 'interim', '') THEN ''
      WHEN low LIKE 'interim %' THEN trim(substr(kind, 9))
      ELSE kind
    END AS rest
  FROM title_kind
);

-- The same belt: body and area compared as words, ignoring case.
CREATE TEMP TABLE title_keeper AS
SELECT a.id AS old_id, min(b.id) AS new_id
FROM title_as_now a
JOIN title_as_now b
  ON lower(b.sanctioning_body) = lower(a.sanctioning_body)
  AND lower(replace(b.area, '  ', ' ')) = lower(replace(a.area, '  ', ' '))
  AND b.weight_class_id = a.weight_class_id AND b.interim = a.interim
GROUP BY a.id;

CREATE TABLE title_new (
  id INTEGER PRIMARY KEY,
  sanctioning_body TEXT NOT NULL,
  area TEXT NOT NULL,
  weight_class_id INTEGER NOT NULL REFERENCES weight_class (id),
  interim INTEGER NOT NULL DEFAULT 0 CHECK (interim IN (0, 1)),
  UNIQUE (sanctioning_body, area, weight_class_id, interim)
);

INSERT INTO title_new (id, sanctioning_body, area, weight_class_id, interim)
SELECT t.id, t.sanctioning_body, t.area, t.weight_class_id, t.interim
FROM title_as_now t JOIN title_keeper k ON k.old_id = t.id
WHERE k.new_id = t.id;

-- A bout that listed two rows of one belt keeps the one naming a holder,
-- else its first.
DELETE FROM bout_title
WHERE id NOT IN (
  SELECT id FROM (
    SELECT bt.id, row_number() OVER (
      PARTITION BY bt.bout_id, k.new_id
      ORDER BY bt.holder_side = 'vacant', bt.id
    ) AS n
    FROM bout_title bt JOIN title_keeper k ON k.old_id = bt.title_id
  )
  WHERE n = 1
);

UPDATE bout_title
SET title_id = (SELECT new_id FROM title_keeper WHERE old_id = bout_title.title_id);

DROP TABLE title;
ALTER TABLE title_new RENAME TO title;
DROP TABLE title_kind;
DROP TABLE title_as_now;
DROP TABLE title_keeper;
