// The v1 import (IMPORT.md, Source B; task 10). One batch, one transaction:
// every bout of v1's `bout_detail` is written or goes on the rejects list
// with its reason, and a bout already here (same day, same two fighters) is
// left alone, so running the batch again writes nothing twice. A bout that
// is refused takes nothing else with it: it is written inside a savepoint,
// and whatever it had begun (a fighter, a venue, a title) goes with it.
//
// MySQL says who fought, where and over how many rounds; Mongo holds the
// card and, in the newer documents, the record on the night (D125, D128).
import type { Database } from '../db/connection.ts';
import {
  findBoutOnDay,
  insertBout,
  markNoSnapshot,
  setSideSnapshot,
  type SideSnapshot,
} from '../db/bout.ts';
import { insertBoutTitle } from '../db/bout-title.ts';
import { findFighterByName, getFighter, insertFighter, setFighterRecord } from '../db/fighter.ts';
import { findTitle, insertTitle } from '../db/title.ts';
import { listWeightClasses } from '../db/weight-class.ts';
import { applyDelta, type FightRecord, isNegative, recordDelta } from '../rules/records.ts';
import type { WeightUnit } from '../rules/weight.ts';
import { type BatchReport, eventAt, Reject, runBatch, writeCard } from './batch.ts';
import { placeFromLocation } from './place.ts';
import { v1Card, v1Decision, type V1Doc, v1Winner } from './v1-card.ts';

// A row of a MySQL table as `mysql --batch` printed it: text, or null.
export type Row = Record<string, string | null>;

export type V1Dumps = {
  events: Row[];
  fighters: Row[];
  weightClasses: Row[];
  titles: Row[];
  bouts: Row[]; // bout_detail
  boutTitles: Row[];
  docs: V1Doc[]; // Mongo's boutscores
};

export type ImportReport = BatchReport & {
  folded: string[]; // v1 fighters with one name, made one (D133)
};

// v1 moved records on a result only from this day (its commit 1630ec2); a
// result saved before it is not in v1's fighter row (D132).
const V1_COUNTS_RESULTS_FROM = '2026-05-30';

// `mysql --batch`: a header line, tab-separated fields, NULL for null, and
// tab, newline and backslash inside a value escaped with a backslash.
export function parseTsv(text: string): Row[] {
  const unescape = (field: string) =>
    field === 'NULL'
      ? null
      : field.replace(/\\([tn0\\])/g, (_, c: string) =>
        c === 't' ? '\t' : c === 'n' ? '\n' : c === '0' ? '\0' : '\\');
  const lines = text.split('\n').filter((line) => line !== '');
  if (lines.length === 0) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const fields = line.split('\t');
    return Object.fromEntries(header.map((name, i) => [name, unescape(fields[i] ?? 'NULL')]));
  });
}

const text = (row: Row, column: string): string => row[column] ?? '';
const nameKey = (row: Row) =>
  `${text(row, 'first_name').trim().toLowerCase()}|${text(row, 'last_name').trim().toLowerCase()}`;
const fullName = (row: Row) => `${text(row, 'first_name').trim()} ${text(row, 'last_name').trim()}`;
const units: (string | null | undefined)[] = ['lbs', 'kg', 'st'];
const unitOf = (u: string | null | undefined): WeightUnit | null =>
  units.includes(u) ? u as WeightUnit : null;
const savedOn = (doc: V1Doc): string =>
  (typeof doc.updatedAt === 'string' ? doc.updatedAt : doc.updatedAt?.$date ?? '').slice(0, 10);

export function importV1(db: Database, dumps: V1Dumps, now: string): ImportReport {
  const events = new Map(dumps.events.map((e) => [e.id, e]));
  const fighters = new Map(dumps.fighters.map((f) => [f.id, f]));
  const titles = new Map(dumps.titles.map((t) => [t.id, t]));
  const docs = new Map(dumps.docs.map((d) => [String(d.bout_id), d]));
  // The fight day is the date part of MySQL's datetime (IMPORT.md).
  const dayOf = (bout: Row) => text(events.get(bout.event_id) ?? {}, 'date').slice(0, 10);
  const inFightOrder = (x: Row, y: Row) =>
    dayOf(x).localeCompare(dayOf(y)) || Number(x.card_order) - Number(y.card_order) ||
    Number(x.id) - Number(y.id);
  const bouts = [...dumps.bouts].sort(inFightOrder);

  // v1's classes are this app's 18, matched by name.
  const classIds = new Map<string | null, number>();
  const ours = listWeightClasses(db);
  for (const c of dumps.weightClasses) {
    const match = ours.find((o) => o.name.toLowerCase() === text(c, 'name').trim().toLowerCase());
    if (match) classIds.set(c.id, match.id);
  }

  // D133: v1 rows with one name are one fighter. The row kept is the one
  // whose latest bout is the latest; `bouts` is in fight order, so the last
  // bout seen for a name names that row.
  const kept = new Map<string, Row>(); // name → the row kept
  const latestBout = new Map<string, Row>(); // name → that row's latest bout
  for (const bout of bouts) {
    for (const column of ['fighterA_id', 'fighterB_id']) {
      const row = fighters.get(bout[column]);
      if (row) {
        kept.set(nameKey(row), row);
        latestBout.set(nameKey(row), bout);
      }
    }
  }
  const folded: string[] = [];
  for (const [key, row] of kept) {
    const others = dumps.fighters.filter((f) => nameKey(f) === key && f.id !== row.id);
    if (others.length > 0) {
      folded.push(
        `${fullName(row)}: v1 fighters ${[...others.map((o) => o.id), row.id].join(', ')} ` +
          `are one fighter; row ${row.id} is kept`,
      );
    }
  }

  // What v1 added to a side's record for this document, if it counted it.
  const v1Counted = (bout: Row, side: 'A' | 'B'): FightRecord | null => {
    const doc = docs.get(text(bout, 'id'));
    const type = doc?.result?.decision?.type ?? '';
    if (!doc || type === '' || savedOn(doc) < V1_COUNTS_RESULTS_FROM) return null;
    const code = type === 'TD' ? 'TD' : v1Decision(type);
    if (typeof code !== 'string') return null;
    const winner = v1Winner(code, doc.result?.decision?.winner);
    if (winner === null) return null;
    const delta = recordDelta({ decision_type: code, winner });
    return side === 'A' ? delta.a : delta.b;
  };

  // The record a fighter had going into their latest v1 bout: v1's row,
  // less that bout's result where v1 had already counted it (D137). The
  // result comes back when the bout is written as final, below.
  const recordGoingIn = (row: Row): FightRecord => {
    const record = {
      won: Number(row.won),
      lost: Number(row.lost),
      draws: Number(row.draws),
      nc: Number(row.nc),
      kos: Number(row.kos),
    };
    const latest = latestBout.get(nameKey(row))!;
    const counted = v1Counted(latest, latest.fighterA_id === row.id ? 'A' : 'B');
    if (!counted) return record;
    const before = applyDelta(record, {
      won: -counted.won,
      lost: -counted.lost,
      draws: -counted.draws,
      nc: -counted.nc,
      kos: -counted.kos,
    });
    if (isNegative(before)) {
      throw new Reject(`${fullName(row)}: v1's record does not hold the result v1 counted`);
    }
    return before;
  };

  const fighterFor = (v1Id: string | null): number => {
    const named = fighters.get(v1Id);
    if (!named) throw new Reject(`v1 has no fighter ${v1Id}`);
    const row = kept.get(nameKey(named))!;
    const found = findFighterByName(db, text(row, 'first_name'), text(row, 'last_name'));
    if (found) return found.id;
    const weight = row.weight === null ? null : Number(row.weight);
    const unit = unitOf(row.weight_unit);
    const id = insertFighter(db, {
      first_name: text(row, 'first_name').trim(),
      last_name: text(row, 'last_name').trim(),
      nickname: text(row, 'nickname').trim() || null,
      colors: text(row, 'colors').trim() || null,
      weight: unit === null ? null : weight,
      weight_unit: weight === null ? null : unit,
    });
    setFighterRecord(db, id, recordGoingIn(row));
    return id;
  };

  const eventFor = (bout: Row): { id: number; date: string } => {
    const event = events.get(bout.event_id);
    if (!event) throw new Reject(`v1 has no event ${bout.event_id}`);
    const date = dayOf(bout);
    const place = placeFromLocation(text(event, 'location'));
    if ('problem' in place) throw new Reject(place.problem);
    return { id: eventAt(db, date, place), date };
  };

  // D42, as migration 003: Active and Vacant are the regular belt, Interim
  // the flag, any other kind joins the area. A v1 "Vacant" title is a
  // vacant holder; under any other the holder is not recorded (D127).
  const titleFor = (v1Id: string | null) => {
    const t = titles.get(v1Id);
    if (!t) throw new Reject(`v1 has no title ${v1Id}`);
    const kind = text(t, 'status').trim();
    const low = kind.toLowerCase();
    const interim = low === 'interim' || low.startsWith('interim ') ? 1 : 0;
    const rest = ['active', 'vacant', 'interim', ''].includes(low)
      ? ''
      : low.startsWith('interim ')
      ? kind.slice(8).trim()
      : kind;
    const classId = classIds.get(t.weight_class_id);
    if (classId === undefined) throw new Reject(`title ${v1Id}: no class ${t.weight_class_id}`);
    const fields = {
      sanctioning_body: text(t, 'sanctioning_body').trim(),
      area: [text(t, 'area').trim(), rest].filter(Boolean).join(' '),
      weight_class_id: classId,
      interim: interim as 0 | 1,
    };
    return {
      title_id: findTitle(db, fields)?.id ?? insertTitle(db, fields),
      holder_side: low === 'vacant' ? 'vacant' as const : null,
    };
  };

  const snapshot = (doc: V1Doc | undefined, side: 'fighterA' | 'fighterB'): SideSnapshot | null => {
    const f = doc?.fighters?.[side];
    if (!f?.record) return null; // the older documents kept none (D128)
    const unit = unitOf(f.weight_unit);
    return {
      ...f.record,
      weight: unit === null ? null : f.weight ?? null,
      weight_unit: f.weight == null ? null : unit,
      colors: f.colors?.trim() || null,
      tbrb_rank: null,
    };
  };

  // Writes one bout, or says it was here already. Throws Reject.
  const place = (bout: Row): 'written' | 'already' => {
    const event = eventFor(bout);
    const classId = classIds.get(bout.weight_class_id);
    if (classId === undefined) throw new Reject(`no weight class ${bout.weight_class_id}`);
    const a = fighterFor(bout.fighterA_id);
    const b = fighterFor(bout.fighterB_id);
    if (a === b) throw new Reject('both sides are the same fighter');
    if (findBoutOnDay(db, event.date, a, b)) return 'already';

    const scheduled = Number(bout.rounds);
    const doc = docs.get(text(bout, 'id'));
    const read = doc ? v1Card(doc, scheduled) : null;
    if (read && 'problems' in read) throw new Reject(read.problems.join('; '));

    const id = insertBout(db, {
      event_id: event.id,
      card_order: Number(bout.card_order),
      weight_class_id: classId,
      contracted_weight: null, // v1 had none (D26)
      scheduled_rounds: scheduled,
      fighter_a_id: a,
      fighter_b_id: b,
      corner_a: null, // not recorded before v2
      missed_weight_a: 0,
      missed_weight_b: 0,
    });
    const lines = new Map<number, 'vacant' | null>();
    for (const line of dumps.boutTitles.filter((l) => l.boutId === bout.id)) {
      const { title_id, holder_side } = titleFor(line.titleId);
      // Two v1 rows of one belt on a bout: the one that is not "Vacant"
      // is kept, as migration 003 kept the row naming a holder (D42).
      if (!lines.has(title_id) || holder_side === null) lines.set(title_id, holder_side);
    }
    for (const [title_id, holder_side] of lines) {
      insertBoutTitle(db, { bout_id: id, title_id, holder_side });
    }
    const snapA = snapshot(doc, 'fighterA');
    const snapB = snapshot(doc, 'fighterB');
    if (snapA) setSideSnapshot(db, id, 'a', snapA);
    if (snapB) setSideSnapshot(db, id, 'b', snapB);
    if (!read) return 'written'; // no document: an unscored bout
    // A card with no record on the night: none is taken later either (D138).
    if (!snapA || !snapB) markNoSnapshot(db, id);

    const { card, judges } = read;
    writeCard(db, id, card, judges);

    // D137: a fighter arrives with the record they had going into their
    // latest v1 bout, and that bout's result is added here, once, when it
    // is written as final. An earlier bout's result is already in the
    // record v1 holds, typed or counted, and is not added again.
    if (card.result && !card.is_draft) {
      const delta = recordDelta(card.result);
      for (
        const [fighterId, column, change] of [[a, 'fighterA_id', delta.a], [
          b,
          'fighterB_id',
          delta.b,
        ]] as const
      ) {
        const row = fighters.get(bout[column])!;
        const isKeptRow = kept.get(nameKey(row))!.id === row.id;
        if (isKeptRow && latestBout.get(nameKey(row))!.id === bout.id) {
          const { won, lost, draws, nc, kos } = getFighter(db, fighterId)!;
          setFighterRecord(db, fighterId, applyDelta({ won, lost, draws, nc, kos }, change));
        }
      }
    }
    return 'written';
  };

  const describe = (bout: Row) => {
    const names = ['fighterA_id', 'fighterB_id'].map((c) => {
      const f = fighters.get(bout[c]);
      return f ? fullName(f) : `fighter ${bout[c]}`;
    });
    return `v1 bout ${bout.id}, ${dayOf(bout) || 'no date'}: ${names.join(' v ')}`;
  };
  return { ...runBatch(db, 'v1', now, bouts, place, describe), folded };
}
