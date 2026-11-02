-- The 18 classes in v1's seed order, lightest first, with explicit ids.
-- v1's seed had none, so its live ids are not guaranteed to match: the
-- importer matches by name. Names and alternate names as v1.
-- kg is lbs × 0.45359237 to three decimals; v1's hand-typed kg were off in
-- the third decimal for six classes. Heavyweight has no limit (D17).
INSERT INTO weight_class (id, name, alternate_name, lbs, kg) VALUES
  (1, 'Atomweight', NULL, 102, 46.266),
  (2, 'Minimumweight', 'Mini Flyweight', 105, 47.627),
  (3, 'Light Flyweight', 'Jr Flyweight', 108, 48.988),
  (4, 'Flyweight', NULL, 112, 50.802),
  (5, 'Super Flyweight', 'Jr Bantamweight', 115, 52.163),
  (6, 'Bantamweight', NULL, 118, 53.524),
  (7, 'Super Bantamweight', 'Jr Featherweight', 122, 55.338),
  (8, 'Featherweight', NULL, 126, 57.153),
  (9, 'Super Featherweight', 'Jr Lightweight', 130, 58.967),
  (10, 'Lightweight', NULL, 135, 61.235),
  (11, 'Super Lightweight', 'Jr Welterweight', 140, 63.503),
  (12, 'Welterweight', NULL, 147, 66.678),
  (13, 'Super Welterweight', 'Jr Middleweight', 154, 69.853),
  (14, 'Middleweight', NULL, 160, 72.575),
  (15, 'Super Middleweight', NULL, 168, 76.204),
  (16, 'Light Heavyweight', NULL, 175, 79.379),
  (17, 'Cruiserweight', 'Jr Heavyweight', 200, 90.718),
  (18, 'Heavyweight', NULL, NULL, NULL);
