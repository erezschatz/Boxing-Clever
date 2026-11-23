// The Numbers sheet's import (IMPORT.md, Source A; task 11). One batch, one
// transaction: every bout of the export is written or goes on the rejects
// list with its reason and its line in the file, and a bout already here
// (same day, same two fighters) is left alone, so running the batch again
// writes nothing twice. The cells are read by the pure modules beside this
// one; this file finds or makes the rows they name.
import type { Database } from '../db/connection.ts';
import {
  findBoutOnDay,
  insertBout,
  setSideSnapshot,
  type SideSnapshot,
  unmarkNoSnapshot,
} from '../db/bout.ts';
import { insertBoutTitle } from '../db/bout-title.ts';
import {
  findFighterByFullName,
  getFighter,
  insertFighter,
  setFighterRecord,
} from '../db/fighter.ts';
import { findFighterIdByAlias, insertAlias } from '../db/fighter-alias.ts';
import { findTitle, insertTitle } from '../db/title.ts';
import { listWeightClasses } from '../db/weight-class.ts';
import { applyDelta, type FightRecord, recordDelta } from '../rules/records.ts';
import { type BatchReport, eventAt, Reject, runBatch, writeCard } from './batch.ts';
import { placeFromLocation } from './place.ts';
import { type Colour, type Colours, sheetCard } from './sheet-card.ts';
import { sheetCategory } from './sheet-category.ts';
import {
  sheetName,
  sheetRecord,
  type SheetWeight,
  sheetWeight,
  splitName,
} from './sheet-fighter.ts';
import {
  parseCsv,
  type SheetBout,
  sheetBouts,
  sheetDate,
  type SheetFighterRow,
} from './sheet-rows.ts';

export type SheetReport = BatchReport & {
  // Bouts already here with no record on the night (v1's), given the sheet's.
  snapshots: string[];
};

type Stray = { line: number; text: string };
type Item = SheetBout | Stray;

const nameKey = (row: SheetFighterRow) => sheetName(row.name).name.toLowerCase();
const sameRecord = (x: FightRecord, y: FightRecord) =>
  x.won === y.won && x.lost === y.lost && x.draws === y.draws && x.nc === y.nc && x.kos === y.kos;

// sheet-colours.csv: `row,round,colour,boxer`, one line per coloured round
// cell (D64). `boxer` is the row's `Boxer Name`, and must be: a colours file
// read from another state of the sheet would colour the wrong fighters.
export function sheetColours(text: string, rows: string[][]): Colours {
  const colours: Colours = new Map();
  for (const [line, round, colour, boxer] of parseCsv(text).slice(1)) {
    if (colour !== 'red' && colour !== 'blue') {
      throw new Error(`sheet-colours.csv: colour "${colour}" on row ${line} is not red or blue`);
    }
    const found = (rows[Number(line) - 1]?.[2] ?? '').trim();
    if (found !== boxer.trim()) {
      throw new Error(
        `sheet-colours.csv does not match sheet.csv: row ${line} is "${found}", not "${boxer}"`,
      );
    }
    colours.set(`${line}:${round}`, colour as Colour);
  }
  return colours;
}

export function importSheet(
  db: Database,
  csv: string,
  coloursCsv: string,
  now: string,
): SheetReport {
  const rows = parseCsv(csv);
  const { bouts, stray } = sheetBouts(rows);
  const colours = sheetColours(coloursCsv, rows);
  const dayOf = (bout: SheetBout): string => {
    const read = sheetDate(bout.dateCell);
    return 'problem' in read ? '' : read.date;
  };
  const classIds = new Map(listWeightClasses(db).map((c) => [c.name, c.id]));
  const snapshots: string[] = [];

  // A fighter's latest bout in the sheet, and their row in it: that row's
  // record is the one a new fighter arrives with (task 11's decisions, as
  // D137 for v1). The table is not in date order, so the day decides.
  // A night whose record or weight cannot be read is passed over, so that
  // one bad cell rejects its own bout and not the fighter's others.
  const latest = new Map<string, { bout: SheetBout; row: SheetFighterRow; day: string }>();
  const readable = (row: SheetFighterRow) => {
    const weight = sheetWeight(row.weight);
    return !('problem' in sheetRecord(row.record)) && (weight === null || !('problem' in weight));
  };
  for (const bout of bouts) {
    const day = dayOf(bout);
    for (const row of [bout.a, bout.b].filter(readable)) {
      const before = latest.get(nameKey(row));
      if (!before || day >= before.day) latest.set(nameKey(row), { bout, row, day });
    }
  }

  const fighterFor = (row: SheetFighterRow): number => {
    const { name } = sheetName(row.name);
    if (name === '') throw new Reject(`"${row.name}" is not a name`);
    const found = findFighterByFullName(db, name)?.id ?? findFighterIdByAlias(db, name);
    let id = found;
    if (id === undefined) {
      // New here: the record, weight and colours of their latest night
      // that can be read. With none, this bout's own cells say why.
      const last = latest.get(nameKey(row))?.row;
      if (!last) {
        snapshotOf(row); // refuses with the cell's own reason
        throw new Reject(`${name}: no record in the sheet that can be read`);
      }
      const record = sheetRecord(last.record) as FightRecord;
      const weight = sheetWeight(last.weight) as SheetWeight | null;
      id = insertFighter(db, {
        ...splitName(name),
        nickname: null,
        colors: last.colors || null,
        weight: weight?.pounds ?? null,
        weight_unit: weight?.unit ?? null,
      });
      setFighterRecord(db, id, record);
    }
    // The sheet's spelling names this fighter from now on (D14, D19).
    if (findFighterIdByAlias(db, name) === undefined) insertAlias(db, id, name);
    return id;
  };

  const snapshotOf = (row: SheetFighterRow): SideSnapshot => {
    const { name } = sheetName(row.name);
    const record = sheetRecord(row.record);
    const weight = sheetWeight(row.weight);
    if ('problem' in record) throw new Reject(`${name}: ${record.problem}`);
    if (weight !== null && 'problem' in weight) throw new Reject(`${name}: ${weight.problem}`);
    return {
      ...record,
      weight: weight?.pounds ?? null,
      weight_unit: weight?.unit ?? null,
      colors: row.colors || null,
      tbrb_rank: null,
    };
  };

  // Writes one bout, or says it was here already. Throws Reject.
  const place = (item: Item): 'written' | 'already' => {
    if (!('a' in item)) throw new Reject('a fighter row with no opponent in the row under it');
    const bout = item;
    const when = sheetDate(bout.dateCell);
    if (bout.dateCell === '') throw new Reject('no Date/Location cell above this bout');
    if ('problem' in when) throw new Reject(when.problem);
    const where = placeFromLocation(when.location, ',.');
    if ('problem' in where) throw new Reject(where.problem);
    const category = sheetCategory(bout.category);
    if ('problem' in category) throw new Reject(category.problem);
    const classId = category.class_name === null ? null : classIds.get(category.class_name);
    if (classId === undefined) throw new Reject(`no weight class "${category.class_name}"`);

    const a = fighterFor(bout.a);
    const b = fighterFor(bout.b);
    if (a === b) throw new Reject('both rows are the same fighter');

    const here = findBoutOnDay(db, when.date, a, b);
    if (here) {
      // One of v1's, which holds the card. v1 kept no record on the night
      // for its oldest bouts (D128, D138); where the sheet has both, they
      // are the bout's snapshot, and it is a bout like any other.
      // A side that has one keeps it; a side whose cells cannot be read
      // stays without, and the bout stays marked.
      const flipped = here.fighter_a_id !== a;
      const sides = [
        { side: 'a' as const, has: here.a_won !== null, row: flipped ? bout.b : bout.a },
        { side: 'b' as const, has: here.b_won !== null, row: flipped ? bout.a : bout.b },
      ];
      let filled = 0;
      for (const s of sides.filter((s) => !s.has && readable(s.row))) {
        setSideSnapshot(db, here.id, s.side, snapshotOf(s.row));
        s.has = true;
        filled++;
      }
      if (filled > 0) snapshots.push(describe(bout));
      if (sides.every((s) => s.has)) unmarkNoSnapshot(db, here.id);
      return 'already';
    }

    const snapA = snapshotOf(bout.a);
    const snapB = snapshotOf(bout.b);
    const read = sheetCard(bout.a, bout.b, colours);
    if ('problems' in read) throw new Reject(read.problems.join('; '));

    const eventId = eventAt(db, when.date, where);
    const id = insertBout(db, {
      event_id: eventId,
      card_order: bout.order, // its place under the date cell, whatever was refused above it
      weight_class_id: classId,
      contracted_weight: category.contracted_weight,
      scheduled_rounds: read.card.scheduled_rounds,
      fighter_a_id: a,
      fighter_b_id: b,
      corner_a: null, // not recorded before v2
      missed_weight_a: 0, // the sheet has no mark for it (D26)
      missed_weight_b: 0,
    });

    // Who brought each belt in: nobody when it is vacant; the fighter whose
    // name carries the body (`(WBC/WBA)`); else the one marked `(c)`; else
    // it is not recorded (D127).
    const [nameA, nameB] = [sheetName(bout.a.name), sheetName(bout.b.name)];
    for (const belt of category.belts) {
      const fields = {
        sanctioning_body: belt.body,
        area: belt.area,
        weight_class_id: classId!,
        interim: belt.interim ? 1 as const : 0 as const,
      };
      const [claimsA, claimsB] = [
        nameA.bodies.includes(belt.body),
        nameB.bodies.includes(belt.body),
      ];
      const holder_side = belt.vacant
        ? 'vacant' as const
        : claimsA !== claimsB
        ? (claimsA ? 'A' as const : 'B' as const)
        : !claimsA && nameA.champion !== nameB.champion
        ? (nameA.champion ? 'A' as const : 'B' as const)
        : null;
      insertBoutTitle(db, {
        bout_id: id,
        title_id: findTitle(db, fields)?.id ?? insertTitle(db, fields),
        holder_side,
      });
    }
    setSideSnapshot(db, id, 'a', snapA);
    setSideSnapshot(db, id, 'b', snapB);
    writeCard(db, id, read.card, read.judges);

    // A fighter's record is the one the sheet wrote for their latest bout,
    // plus that bout's result, added here once. It is added only while the
    // record is still the one the sheet wrote: a fighter v1 brought in, or
    // one Erez has corrected, keeps theirs.
    const delta = recordDelta(read.card.result!);
    for (
      const [fighterId, row, snap, change] of [
        [a, bout.a, snapA, delta.a],
        [b, bout.b, snapB, delta.b],
      ] as const
    ) {
      if (latest.get(nameKey(row))?.bout !== bout) continue;
      const { won, lost, draws, nc, kos } = getFighter(db, fighterId)!;
      if (sameRecord({ won, lost, draws, nc, kos }, snap)) {
        setFighterRecord(db, fighterId, applyDelta(snap, change));
      }
    }
    return 'written';
  };

  const describe = (item: Item): string => {
    if (!('a' in item)) return `sheet line ${item.line}: ${item.text}`;
    const names = `${sheetName(item.a.name).name} v ${sheetName(item.b.name).name}`;
    return `sheet line ${item.line}, ${dayOf(item) || 'no date'}: ${names}`;
  };

  // In fight order, so a card's bouts are written in the order of the sheet
  // and a fighter's earlier nights before their later ones.
  const inOrder = [...bouts].sort((x, y) => dayOf(x).localeCompare(dayOf(y)) || x.line - y.line);
  const report = runBatch<Item>(db, 'sheet', now, [...inOrder, ...stray], place, describe);
  return { ...report, snapshots };
}
