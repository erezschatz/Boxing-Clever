// What the two imports share (IMPORT.md): one batch in one transaction, each
// bout written inside a savepoint or put on the rejects list with its reason,
// and the same way of writing an event's place and a card.
import { type Database, transaction } from '../db/connection.ts';
import { type Judges, setBoutResult, setJudges } from '../db/bout.ts';
import { insertDeduction } from '../db/deduction.ts';
import { findEvent, insertEvent } from '../db/event.ts';
import { finishImportBatch, type ImportSource, startImportBatch } from '../db/import-batch.ts';
import { insertImportReject } from '../db/import-reject.ts';
import { insertRoundScore } from '../db/round-score.ts';
import { findVenue, insertVenue } from '../db/venue.ts';
import type { Card } from '../rules/scoring.ts';
import type { Place } from './place.ts';

// The importer refusing a bout, with the reason for the list.
export class Reject extends Error {}

export type BatchReport = {
  batch_id: number;
  read: number;
  written: number;
  already: number; // here before this batch ran
  rejects: { row_text: string; reason: string }[];
};

// Runs a batch: `place` writes one bout, says it was here already, or
// throws. A bout that is refused takes nothing else with it: whatever it had
// begun (a fighter, a venue, a title) is rolled back with it.
export function runBatch<T>(
  db: Database,
  source: ImportSource,
  now: string,
  items: T[],
  place: (item: T) => 'written' | 'already',
  describe: (item: T) => string,
): BatchReport {
  return transaction(db, () => {
    const batchId = startImportBatch(db, source, now);
    const report: BatchReport = {
      batch_id: batchId,
      read: items.length,
      written: 0,
      already: 0,
      rejects: [],
    };
    for (const item of items) {
      db.exec('SAVEPOINT import_bout');
      try {
        report[place(item)]++;
        db.exec('RELEASE import_bout');
      } catch (err) {
        db.exec('ROLLBACK TO import_bout');
        db.exec('RELEASE import_bout');
        // A Reject is the importer's own; anything else is the database
        // refusing the row, and is reported with its message.
        const reason = err instanceof Error ? err.message : String(err);
        const row_text = describe(item);
        insertImportReject(db, batchId, row_text, reason);
        report.rejects.push({ row_text, reason });
      }
    }
    finishImportBatch(db, batchId, now, {
      rows_read: report.read,
      rows_written: report.written,
      rows_rejected: report.rejects.length,
    });
    return report;
  });
}

// The event on that day at that place, made if it is not here: a venue with
// the same four parts is one place, and a day at it one event (D117).
export function eventAt(db: Database, date: string, place: Place): number {
  const venueId = findVenue(db, place)?.id ?? insertVenue(db, place);
  return findEvent(db, date, venueId)?.id ?? insertEvent(db, { date, venue_id: venueId });
}

// A card the rules have passed, written as PUT /api/bouts/:id/card leaves it.
export function writeCard(db: Database, boutId: number, card: Card, judges: Judges): void {
  for (const r of card.rounds) {
    insertRoundScore(db, { bout_id: boutId, round_no: r.round_no, side: 'A', points: r.a });
    insertRoundScore(db, { bout_id: boutId, round_no: r.round_no, side: 'B', points: r.b });
  }
  for (const d of card.deductions) {
    insertDeduction(db, { bout_id: boutId, ...d, note: d.note ?? null });
  }
  setBoutResult(db, boutId, {
    decision_type: card.result?.decision_type ?? null,
    winner: card.result?.winner ?? null,
    result_round: card.result?.round ?? null,
    result_time: card.result?.time ?? null,
    is_draft: card.is_draft ? 1 : 0,
  });
  setJudges(db, boutId, judges);
}
