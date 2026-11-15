-- migrate: rebuilds a referenced table
-- D55: there is no RTD code. A corner retirement after round X is a TKO at
-- 3:00 of round X, and that round is scored. Every stored RTD becomes a TKO
-- with its time set to 3:00; its round is kept, so a card that had round X
-- at 0–0 (D22's interim) now needs that round scored before it saves again.
-- The rebuild is only to drop 'RTD' from the decision check; every other
-- column is copied as it is.

CREATE TABLE bout_new (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES event (id) ON DELETE CASCADE,
  card_order INTEGER NOT NULL,
  weight_class_id INTEGER REFERENCES weight_class (id),
  contracted_weight REAL CHECK (contracted_weight > 0), -- pounds (D36)
  scheduled_rounds INTEGER NOT NULL CHECK (scheduled_rounds BETWEEN 1 AND 15),
  fighter_a_id INTEGER NOT NULL REFERENCES fighter (id),
  fighter_b_id INTEGER NOT NULL REFERENCES fighter (id),
  corner_a TEXT CHECK (corner_a IN ('red', 'blue')), -- null: not recorded (imports)
  missed_weight_a INTEGER NOT NULL DEFAULT 0 CHECK (missed_weight_a IN (0, 1)),
  missed_weight_b INTEGER NOT NULL DEFAULT 0 CHECK (missed_weight_b IN (0, 1)),

  a_won INTEGER,
  a_lost INTEGER,
  a_draws INTEGER,
  a_nc INTEGER,
  a_kos INTEGER,
  a_weight REAL,
  a_weight_unit TEXT CHECK (a_weight_unit IN ('lbs', 'kg', 'st')),
  a_colors TEXT,
  a_tbrb_rank INTEGER CHECK (a_tbrb_rank >= 0),

  b_won INTEGER,
  b_lost INTEGER,
  b_draws INTEGER,
  b_nc INTEGER,
  b_kos INTEGER,
  b_weight REAL,
  b_weight_unit TEXT CHECK (b_weight_unit IN ('lbs', 'kg', 'st')),
  b_colors TEXT,
  b_tbrb_rank INTEGER CHECK (b_tbrb_rank >= 0),

  -- SPEC Scoring §5: the wire and the table carry the code, never a label.
  decision_type TEXT CHECK (decision_type IN (
    'UD', 'MD', 'SD', 'DEC', 'KO', 'TKO', 'TD', 'DQ', 'NC', 'MT', 'T', 'D'
  )),
  winner TEXT CHECK (winner IN ('A', 'B', 'draw', 'none')),
  result_round INTEGER CHECK (result_round >= 1),
  result_time TEXT,

  judge1_a INTEGER,
  judge1_b INTEGER,
  judge2_a INTEGER,
  judge2_b INTEGER,
  judge3_a INTEGER,
  judge3_b INTEGER,

  is_draft INTEGER NOT NULL DEFAULT 1 CHECK (is_draft IN (0, 1)),

  CHECK (fighter_a_id <> fighter_b_id),
  -- A class or a contracted weight, never both and never neither (D26, D45).
  CHECK ((weight_class_id IS NULL) <> (contracted_weight IS NULL)),
  CHECK ((decision_type IS NULL) = (winner IS NULL)),
  -- Finalise is is_draft = 0 with a result (SPEC API, PUT /card).
  CHECK (is_draft = 1 OR decision_type IS NOT NULL)
);

INSERT INTO bout_new (
  id, event_id, card_order, weight_class_id, contracted_weight, scheduled_rounds,
  fighter_a_id, fighter_b_id, corner_a, missed_weight_a, missed_weight_b,
  a_won, a_lost, a_draws, a_nc, a_kos, a_weight, a_weight_unit, a_colors, a_tbrb_rank,
  b_won, b_lost, b_draws, b_nc, b_kos, b_weight, b_weight_unit, b_colors, b_tbrb_rank,
  decision_type, winner, result_round, result_time,
  judge1_a, judge1_b, judge2_a, judge2_b, judge3_a, judge3_b,
  is_draft
)
SELECT
  id, event_id, card_order, weight_class_id, contracted_weight, scheduled_rounds,
  fighter_a_id, fighter_b_id, corner_a, missed_weight_a, missed_weight_b,
  a_won, a_lost, a_draws, a_nc, a_kos, a_weight, a_weight_unit, a_colors, a_tbrb_rank,
  b_won, b_lost, b_draws, b_nc, b_kos, b_weight, b_weight_unit, b_colors, b_tbrb_rank,
  CASE decision_type WHEN 'RTD' THEN 'TKO' ELSE decision_type END,
  winner, result_round,
  CASE decision_type WHEN 'RTD' THEN '3:00' ELSE result_time END,
  judge1_a, judge1_b, judge2_a, judge2_b, judge3_a, judge3_b,
  is_draft
FROM bout;

DROP TABLE bout;
ALTER TABLE bout_new RENAME TO bout;
CREATE INDEX bout_event ON bout (event_id, card_order);
CREATE INDEX bout_fighter_a ON bout (fighter_a_id);
CREATE INDEX bout_fighter_b ON bout (fighter_b_id);
