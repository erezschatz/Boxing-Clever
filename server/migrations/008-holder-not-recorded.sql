-- D127 (task holder-not-recorded): who brought a title into a bout may be
-- not recorded. v1 never stored it, so its title bouts arrive from the
-- import with holder_side NULL, as corner_a is NULL for a corner nobody
-- wrote down. SQLite cannot lift NOT NULL in place, so the table is
-- rebuilt; nothing refers to bout_title, and every row is copied as it is.

CREATE TABLE bout_title_new (
  id INTEGER PRIMARY KEY,
  bout_id INTEGER NOT NULL REFERENCES bout (id) ON DELETE CASCADE,
  title_id INTEGER NOT NULL REFERENCES title (id),
  holder_side TEXT CHECK (holder_side IN ('A', 'B', 'vacant')), -- null: not recorded (imports)
  UNIQUE (bout_id, title_id)
);

INSERT INTO bout_title_new (id, bout_id, title_id, holder_side)
SELECT id, bout_id, title_id, holder_side FROM bout_title;

DROP TABLE bout_title;
ALTER TABLE bout_title_new RENAME TO bout_title;
