-- Every table in SPEC "Data model". Dates are ISO text; ids INTEGER PRIMARY KEY.
-- The checks refuse shapes no valid card could have; the scoring rules that
-- judge a card as a whole (winner kind per decision type, no gaps, the
-- stoppage round) live in server/rules/ and run before anything is written (D18).

-- Heavyweight has no upper limit, so lbs/kg are nullable (D17).
CREATE TABLE weight_class (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  alternate_name TEXT,
  lbs REAL,
  kg REAL
);

-- The record is stored derived data (D13): moved on finalise, recomputable.
CREATE TABLE fighter (
  id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT,
  colors TEXT,
  weight REAL,
  weight_unit TEXT CHECK (weight_unit IN ('lbs', 'kg', 'st')),
  won INTEGER NOT NULL DEFAULT 0 CHECK (won >= 0),
  lost INTEGER NOT NULL DEFAULT 0 CHECK (lost >= 0),
  draws INTEGER NOT NULL DEFAULT 0 CHECK (draws >= 0),
  nc INTEGER NOT NULL DEFAULT 0 CHECK (nc >= 0),
  kos INTEGER NOT NULL DEFAULT 0 CHECK (kos >= 0)
);

-- An alias names exactly one fighter, so an exact match is never ambiguous (D19).
CREATE TABLE fighter_alias (
  id INTEGER PRIMARY KEY,
  fighter_id INTEGER NOT NULL REFERENCES fighter (id) ON DELETE CASCADE,
  alias TEXT NOT NULL UNIQUE
);
CREATE INDEX fighter_alias_fighter ON fighter_alias (fighter_id);

CREATE TABLE event (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL CHECK (date IS date(date)),
  location TEXT NOT NULL
);

-- status is v1's title kind (Active, Interim, Silver, Diamond...), unchecked
-- text as in v1. Who held the title coming in is bout_title.holder_side.
CREATE TABLE title (
  id INTEGER PRIMARY KEY,
  sanctioning_body TEXT NOT NULL,
  area TEXT NOT NULL,
  weight_class_id INTEGER NOT NULL REFERENCES weight_class (id),
  status TEXT NOT NULL,
  UNIQUE (sanctioning_body, area, weight_class_id, status)
);

-- The a_*/b_* columns are the as-of snapshot (SPEC Scoring §7, D4): null until
-- the first save, then never changed. a_tbrb_rank 0 is champion, null unranked.
-- A fighter with bouts cannot be deleted (no ON DELETE): merge repoints first.
CREATE TABLE bout (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES event (id) ON DELETE CASCADE,
  card_order INTEGER NOT NULL,
  weight_class_id INTEGER NOT NULL REFERENCES weight_class (id),
  scheduled_rounds INTEGER NOT NULL CHECK (scheduled_rounds BETWEEN 1 AND 15),
  fighter_a_id INTEGER NOT NULL REFERENCES fighter (id),
  fighter_b_id INTEGER NOT NULL REFERENCES fighter (id),
  corner_a TEXT CHECK (corner_a IN ('red', 'blue')), -- null: not recorded (imports)

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
    'UD', 'MD', 'SD', 'DEC', 'KO', 'TKO', 'RTD', 'TD', 'DQ', 'NC', 'MT', 'T', 'D'
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
  CHECK ((decision_type IS NULL) = (winner IS NULL)),
  -- Finalise is is_draft = 0 with a result (SPEC API, PUT /card).
  CHECK (is_draft = 1 OR decision_type IS NOT NULL)
);
CREATE INDEX bout_event ON bout (event_id, card_order);
CREATE INDEX bout_fighter_a ON bout (fighter_a_id);
CREATE INDEX bout_fighter_b ON bout (fighter_b_id);

-- One row per side per round actually scored; the stoppage round has points 0
-- (SPEC Scoring §1, §4). 10-8 is a deduction, never points.
CREATE TABLE round_score (
  id INTEGER PRIMARY KEY,
  bout_id INTEGER NOT NULL REFERENCES bout (id) ON DELETE CASCADE,
  round_no INTEGER NOT NULL CHECK (round_no >= 1),
  side TEXT NOT NULL CHECK (side IN ('A', 'B')),
  points INTEGER NOT NULL CHECK (points BETWEEN 0 AND 10),
  UNIQUE (bout_id, round_no, side)
);

-- A deduction belongs to a recorded round of that side, so none can exist
-- after the stoppage round (SPEC Scoring §4).
CREATE TABLE deduction (
  id INTEGER PRIMARY KEY,
  bout_id INTEGER NOT NULL,
  round_no INTEGER NOT NULL,
  side TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points BETWEEN 1 AND 10),
  reason TEXT NOT NULL CHECK (reason IN ('knockdown', 'low blow', 'holding', 'headbutt', 'other')),
  note TEXT,
  FOREIGN KEY (bout_id, round_no, side)
    REFERENCES round_score (bout_id, round_no, side) ON DELETE CASCADE
);
CREATE INDEX deduction_round ON deduction (bout_id, round_no, side);

-- Champion and title-for-title fall out of holder_side.
CREATE TABLE bout_title (
  id INTEGER PRIMARY KEY,
  bout_id INTEGER NOT NULL REFERENCES bout (id) ON DELETE CASCADE,
  title_id INTEGER NOT NULL REFERENCES title (id),
  holder_side TEXT NOT NULL CHECK (holder_side IN ('A', 'B', 'vacant')),
  UNIQUE (bout_id, title_id)
);

-- One row per ranked name per snapshot; rank 0 is champion. fighter_id is set
-- only through an exact alias match (D14, TBRB.md).
CREATE TABLE tbrb_snapshot (
  id INTEGER PRIMARY KEY,
  snapshot_date TEXT NOT NULL CHECK (snapshot_date IS date(snapshot_date)),
  weight_class_id INTEGER NOT NULL REFERENCES weight_class (id),
  rank INTEGER NOT NULL CHECK (rank >= 0),
  fighter_name TEXT NOT NULL,
  fighter_id INTEGER REFERENCES fighter (id) ON DELETE SET NULL,
  UNIQUE (snapshot_date, weight_class_id, fighter_name)
);
CREATE INDEX tbrb_snapshot_class_date ON tbrb_snapshot (weight_class_id, snapshot_date);
CREATE INDEX tbrb_snapshot_fighter ON tbrb_snapshot (fighter_id);
CREATE INDEX tbrb_snapshot_name ON tbrb_snapshot (fighter_name);

-- The staged importer's audit trail (IMPORT.md).
CREATE TABLE import_batch (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('v1', 'sheet')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  rows_read INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  rows_rejected INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE import_reject (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES import_batch (id) ON DELETE CASCADE,
  row_text TEXT NOT NULL,
  reason TEXT NOT NULL
);
CREATE INDEX import_reject_batch ON import_reject (batch_id);
