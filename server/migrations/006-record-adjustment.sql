-- D23, D57: a finalised bout deleted with "keep the records" leaves its
-- result in both fighters' records with no bout behind it. The kept result
-- is stored here, one row per fighter, so scripts/recompute-records.ts (D13)
-- adds it to what it rebuilds from bouts and a recompute cannot undo the
-- keep. The counts are what the result added to that fighter's record (SPEC
-- Scoring §6); the opponent, description and date say which fight it was.
-- The opponent is kept so a merge can refuse two fighters who met in a
-- deleted fight, as it refuses two who met in a kept bout (D31, D62).
-- No cascade: a fighter is deleted only by a merge, which moves these rows
-- to the target first (D31), so a delete that would lose one is refused.
CREATE TABLE record_adjustment (
  id INTEGER PRIMARY KEY,
  fighter_id INTEGER NOT NULL REFERENCES fighter (id),
  opponent_id INTEGER NOT NULL REFERENCES fighter (id),
  won INTEGER NOT NULL,
  lost INTEGER NOT NULL,
  draws INTEGER NOT NULL,
  nc INTEGER NOT NULL,
  kos INTEGER NOT NULL,
  bout_description TEXT NOT NULL,
  bout_date TEXT NOT NULL
);
CREATE INDEX record_adjustment_fighter ON record_adjustment (fighter_id);
CREATE INDEX record_adjustment_opponent ON record_adjustment (opponent_id);
