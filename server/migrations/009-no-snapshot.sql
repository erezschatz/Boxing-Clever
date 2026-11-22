-- D128, D138 (task 10): v1's oldest bouts arrive with no as-of snapshot, and
-- none can be taken later: the record on a night long past is not today's
-- less one result. no_snapshot marks such a bout, so that saving its card
-- again, as a draft or as final, leaves the snapshot empty. Only the v1
-- import sets it; every bout made in the app has 0 and is snapshotted at
-- its first save as before (SPEC Scoring §7).
ALTER TABLE bout ADD COLUMN no_snapshot INTEGER NOT NULL DEFAULT 0 CHECK (no_snapshot IN (0, 1));
