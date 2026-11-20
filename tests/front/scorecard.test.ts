// The scorecard page (task 07): what typing points does, what the totals
// say, what a draft save sends, and that a reload gives back what was
// saved. lit-html output is not tested (SPEC Testing); the page is checked
// in the browser. The round trips go through the API, as the page does.
import { deepStrictEqual, ok, strictEqual as assertEquals } from 'node:assert/strict';
import {
  beltsOf,
  deductionKinds,
  draftToSave,
  entriesOf,
  type Entry,
  finalCard,
  isAssumed,
  nextBox,
  rankOf,
  readPoints,
  runningTotals,
  scoredRounds,
} from '../../front/scorecard.ts';
import { rankText } from '../../front/format.ts';
import type { BoutView } from '../../front/api.ts';
import { type Api, HEAVYWEIGHT, testApi, usykFury } from '../helpers/api.ts';
import { insertTbrbRow } from '../../server/db/tbrb-snapshot.ts';

const e = (a: number | null, b: number | null): Entry => ({ a, b });
const blank = (n: number) => Array.from({ length: n }, () => e(null, null));
const get = async (api: Api, id: number) =>
  (await api.call('GET', `/api/bouts/${id}`)).json as BoutView;

Deno.test('points are whole numbers 0–10; focus moves on once the entry cannot grow', () => {
  deepStrictEqual(readPoints(''), { ok: true, points: null, complete: false });
  deepStrictEqual(readPoints('9'), { ok: true, points: 9, complete: true });
  deepStrictEqual(readPoints('0'), { ok: true, points: 0, complete: true });
  deepStrictEqual(readPoints('10'), { ok: true, points: 10, complete: true });
  // A lone 1 may become 10, so it waits (for a 0, or for Enter).
  deepStrictEqual(readPoints('1'), { ok: true, points: 1, complete: false });
  for (const text of ['11', '01', '00', '-1', 'a', '9.5', '100', ' ']) {
    assertEquals(readPoints(text).ok, false, text);
  }
});

Deno.test('after a score, focus goes across to the other fighter, or on to the next round (D39)', () => {
  // Round 1 started on A: across to B, then on to round 2's A.
  deepStrictEqual(nextBox([e(10, null), e(null, null)], 1, 'A'), { round: 1, side: 'B' });
  deepStrictEqual(nextBox([e(10, 9), e(null, null)], 1, 'B'), { round: 2, side: 'A' });
  // Started on B: across to A, then on to round 2's B.
  deepStrictEqual(nextBox([e(null, 9), e(null, null)], 1, 'B'), { round: 1, side: 'A' });
  deepStrictEqual(nextBox([e(10, 9), e(null, null)], 1, 'A'), { round: 2, side: 'B' });
  // After the last round there is nowhere to go.
  assertEquals(nextBox([e(10, 9)], 1, 'B'), null);
  // Across even when the next round is already scored.
  deepStrictEqual(nextBox([e(10, null), e(10, 9)], 1, 'A'), { round: 1, side: 'B' });
  // Correcting a round among rounds already scored: no box to go to is
  // empty, so focus stays, and the next key cannot overwrite a score.
  assertEquals(nextBox([e(9, 10), e(10, 9), e(10, 9)], 1, 'A'), null);
});

Deno.test('running totals follow the rules: points less deductions, empty boxes count nothing', () => {
  const entries = [e(10, 9), e(9, 10), e(10, null), e(null, null)];
  const deductions = [{ round_no: 2, side: 'A' as const, points: 1, reason: 'holding' as const }];
  const totals = runningTotals(entries, deductions);
  deepStrictEqual(totals.rounds, [
    { a: 10, b: 9 },
    { a: 8, b: 10 },
    { a: 10, b: null },
    { a: null, b: null },
  ]);
  assertEquals(totals.a, 28);
  assertEquals(totals.b, 19);

  // A deduction in a round whose boxes are empty still counts (§2).
  const cleared = runningTotals([e(10, 9), e(null, null)], [
    { round_no: 2, side: 'A', points: 1, reason: 'knockdown' },
  ]);
  deepStrictEqual(cleared.rounds[1], { a: -1, b: null });
  assertEquals(cleared.a, 9);
});

// Rounds 1–8 saved as a draft, as the page would find them on a reload.
async function eightSaved(api: Api, deductions: object[] = []) {
  const { boutId } = await usykFury(api);
  const rounds = Array.from({ length: 8 }, (_, i) => ({ round_no: i + 1, a: 10, b: 9 }));
  const res = await api.call('PUT', `/api/bouts/${boutId}/card`, {
    rounds,
    deductions,
    result: null,
    is_draft: true,
  });
  assertEquals(res.status, 200);
  const bout = await get(api, boutId);
  return { boutId, bout, entries: entriesOf(bout) };
}

Deno.test('a draft saves every typed round, holding back only a new round with one side scored', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const bout = await get(api, boutId);

  const entries = blank(12);
  entries[0] = e(10, 9);
  entries[1] = e(9, 10);
  entries[2] = e(10, null); // the round being scored
  const { body, unsaved } = draftToSave(bout, entries, []);
  deepStrictEqual(body?.rounds, [
    { round_no: 1, a: 10, b: 9 },
    { round_no: 2, a: 9, b: 10 },
  ]);
  assertEquals(body?.is_draft, true);
  assertEquals(unsaved.length, 1);
  ok(unsaved[0].includes('round 3'), unsaved[0]);

  // Nothing typed is an empty draft, and nothing left over.
  deepStrictEqual(draftToSave(bout, blank(12), []), {
    body: { rounds: [], deductions: [], result: null, judges: bout.card.judges, is_draft: true },
    unsaved: [],
  });
});

Deno.test('a draft save never takes away a stored round by mistake: a card the rules refuse is not sent', async () => {
  const api = testApi();
  const { bout, entries } = await eightSaved(api);
  const refused = (change: (es: Entry[]) => void, words: string) => {
    const typed = entries.map((x) => ({ ...x }));
    change(typed);
    const { body, unsaved } = draftToSave(bout, typed, []);
    assertEquals(body, null, words);
    ok(unsaved.join(' ').includes(words), `${words}: ${unsaved}`);
  };
  refused((es) => (es[1] = e(9, 9)), 'round 2'); // a typo while correcting round 2
  refused((es) => (es[2] = e(null, 9)), 'round 3'); // a box cleared to retype it
  refused((es) => (es[7] = e(10, null)), 'round 8'); // the last stored round, half cleared
  refused((es) => (es[3] = e(null, null)), 'round 4'); // a stored round emptied mid-card
  refused((es) => (es[10] = e(10, 9)), 'round 9'); // a gap before a typed round

  // Clearing the last rounds on both sides is a choice: they go.
  const typed = entries.map((x) => ({ ...x }));
  typed[6] = e(null, null);
  typed[7] = e(null, null);
  assertEquals(draftToSave(bout, typed, []).body?.rounds.length, 6);
});

Deno.test('a round the page has since saved counts as stored, though its loaded copy is older', async () => {
  const api = testApi();
  const { bout, entries } = await eightSaved(api);
  // The page sent round 9 after it loaded rounds 1–8, then one side of
  // round 9 was cleared: that is a stored round half cleared, not a new one.
  const typed = entries.map((x) => ({ ...x }));
  typed[8] = e(10, null);
  assertEquals(draftToSave(bout, typed, [], 9).body, null);
  // Counting from the loaded copy alone would have held round 9 back.
  assertEquals(draftToSave(bout, typed, []).body?.rounds.length, 8);
});

Deno.test('a draft with a deduction or a result the typed rounds no longer fit is not sent', async () => {
  const api = testApi();
  const knockdown = { round_no: 8, side: 'B', points: 1, reason: 'knockdown' };
  const { bout, entries } = await eightSaved(api, [knockdown]);
  const typed = entries.map((x) => ({ ...x }));
  typed[7] = e(null, null);
  const kept = draftToSave(bout, typed, bout.card.deductions);
  assertEquals(kept.body, null);
  ok(kept.unsaved.join(' ').includes('deduction in round 8'), kept.unsaved.join(' '));

  // A draft holding a points decision goes the distance, so a partly
  // scored card is refused and says why rather than being cut back.
  const other = testApi();
  const { boutId } = await usykFury(other);
  const ud = { decision_type: 'UD', winner: 'A', round: 12, time: '3:00' };
  await other.call('PUT', `/api/bouts/${boutId}/card`, { rounds: [], result: ud, is_draft: true });
  const withResult = await get(other, boutId);
  const partly = blank(12);
  partly[0] = e(10, 9);
  const { body, unsaved } = draftToSave(withResult, partly, []);
  assertEquals(body, null);
  ok(unsaved.join(' ').includes('distance'), unsaved.join(' '));
});

Deno.test('what a draft save sends, the API takes, and a reload gives back the same card', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const entries = blank(12);
  entries[0] = e(10, 9);
  entries[1] = e(10, 10);
  entries[2] = e(9, 10);
  const deductions = [{
    round_no: 3,
    side: 'A' as const,
    points: 1,
    reason: 'knockdown' as const,
    note: null,
  }];
  const { body } = draftToSave(await get(api, boutId), entries, deductions);
  const saved = await api.call('PUT', `/api/bouts/${boutId}/card`, body);
  assertEquals(saved.status, 200);

  const reloaded = await get(api, boutId);
  deepStrictEqual(entriesOf(reloaded), entries);
  deepStrictEqual(reloaded.card.deductions, deductions);
  deepStrictEqual(runningTotals(entriesOf(reloaded), reloaded.card.deductions), {
    rounds: [{ a: 10, b: 9 }, { a: 10, b: 10 }, { a: 8, b: 10 }, ...blank(9)],
    a: 28,
    b: 29,
  });
  // The totals the page computes are the ones the server answers.
  assertEquals(reloaded.card.totals.a, 28);
  assertEquals(reloaded.card.totals.b, 29);
});

Deno.test('a draft keeps the judges and a result already on the card', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const judges = [{ a: 115, b: 113 }, { a: 114, b: 114 }, { a: 113, b: 115 }];
  const twelve = Array.from({ length: 12 }, (_, i) => ({ round_no: i + 1, a: 10, b: 9 }));
  const result = { decision_type: 'SD', winner: 'A', round: 12, time: '3:00' };
  await api.call('PUT', `/api/bouts/${boutId}/card`, {
    rounds: twelve,
    result,
    judges,
    is_draft: true,
  });
  const bout = await get(api, boutId);
  const { body, unsaved } = draftToSave(bout, entriesOf(bout), bout.card.deductions);
  deepStrictEqual(body?.judges, judges);
  deepStrictEqual(body?.result, result);
  deepStrictEqual(unsaved, []);
});

Deno.test('an imported deduction whose reason was guessed is marked', () => {
  ok(isAssumed({ note: 'reason assumed (import)' })); // the importer's words, D24
  ok(!isAssumed({ note: null }));
  ok(!isAssumed({ note: 'warned twice first' }));
});

Deno.test('the header: belts a side brought make it champion; TBRB rank once the snapshot is taken', async () => {
  const api = testApi();
  const { boutId, bId, eventId } = await usykFury(api);
  const wbc = (await api.call('POST', '/api/titles', {
    sanctioning_body: 'WBC',
    area: 'World',
    weight_class_id: HEAVYWEIGHT,
    interim: false,
  })).json;
  const ibf = (await api.call('POST', '/api/titles', {
    sanctioning_body: 'IBF',
    area: 'World',
    weight_class_id: HEAVYWEIGHT,
    interim: false,
  })).json;
  await api.call('PATCH', `/api/bouts/${boutId}`, {
    titles: [{ title_id: wbc.id, holder_side: 'B' }, { title_id: ibf.id, holder_side: 'vacant' }],
  });
  const event = (await api.call('GET', `/api/events/${eventId}`)).json;
  insertTbrbRow(api.db, {
    snapshot_date: event.date,
    weight_class_id: HEAVYWEIGHT,
    rank: 0,
    fighter_name: 'Tyson Fury',
    fighter_id: bId,
  });

  const before = await get(api, boutId);
  deepStrictEqual(beltsOf(before, 'A'), []);
  deepStrictEqual(beltsOf(before, 'B'), [wbc.id]);
  assertEquals(rankOf(before, 'B'), null); // no snapshot yet
  // A rank on a side with no snapshot is not said (SPEC §7: the rank is the
  // snapshot's).
  assertEquals(rankOf({ ...before, b_won: null, b_tbrb_rank: 3 }, 'B'), null);

  await api.call('PUT', `/api/bouts/${boutId}/card`, { rounds: [], result: null, is_draft: true });
  const after = await get(api, boutId);
  assertEquals(rankOf(after, 'B'), 0);
  assertEquals(rankOf(after, 'A'), null); // unranked
  assertEquals(rankText(0), 'TBRB champion');
  assertEquals(rankText(4), 'TBRB #4');
});

Deno.test('a deduction box says why: KD for a knockdown, FOUL for any other reason, both when mixed (D63)', () => {
  const d = (reason: string) => ({ reason });
  deepStrictEqual(deductionKinds([]), { kd: false, foul: false });
  deepStrictEqual(deductionKinds([d('knockdown')]), { kd: true, foul: false });
  for (const foul of ['low blow', 'holding', 'headbutt', 'other']) {
    deepStrictEqual(deductionKinds([d(foul)]), { kd: false, foul: true }, foul);
  }
  deepStrictEqual(deductionKinds([d('knockdown'), d('holding')]), { kd: true, foul: true });
});

Deno.test('a knockdown logged before its round is scored is kept by a save and a reload, and stays when the bout is ended in that round', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const bout = await get(api, boutId);
  const kd = {
    round_no: 2,
    side: 'B' as const,
    points: 1,
    reason: 'knockdown' as const,
    note: null,
  };
  const entries = entriesOf(bout);
  entries[0] = e(10, 9);

  // Round 1 scored, the knockdown in round 2: the draft carries round 2
  // under way, 0–0 (Erez, 2026-11-20: the KD vanished on leaving the page).
  const draft = draftToSave(bout, entries, [kd]);
  deepStrictEqual(draft.body?.rounds, [{ round_no: 1, a: 10, b: 9 }, { round_no: 2, a: 0, b: 0 }]);
  const saved = await api.call('PUT', `/api/bouts/${boutId}/card`, draft.body);
  assertEquals(saved.status, 200);

  // A reload: the knockdown is there, round 2's boxes are empty, and the
  // server holds one scored round.
  const back = await get(api, boutId);
  deepStrictEqual(back.card.deductions.map((d) => [d.round_no, d.side, d.reason]), [[
    2,
    'B',
    'knockdown',
  ]]);
  deepStrictEqual(entriesOf(back).slice(0, 2), [e(10, 9), e(null, null)]);
  assertEquals(scoredRounds(back.card), 1);

  // Round 2 half typed: held back as before, the knockdown still sent, and
  // the server still holds round 2 under way.
  const half = entriesOf(back);
  half[1] = e(10, null);
  const halfDraft = draftToSave(back, half, back.card.deductions, scoredRounds(back.card));
  deepStrictEqual(halfDraft.body?.rounds.at(-1), { round_no: 2, a: 0, b: 0 });
  assertEquals((await api.call('PUT', `/api/bouts/${boutId}/card`, halfDraft.body)).status, 200);
  const halfBack = await get(api, boutId);
  deepStrictEqual(entriesOf(halfBack).slice(0, 2), [e(10, 9), e(null, null)]);
  assertEquals(halfBack.card.deductions.length, 1);

  // Round 2 scored after all: it replaces the round under way.
  const scored = entriesOf(back);
  scored[1] = e(10, 8);
  const scoredDraft = draftToSave(back, scored, back.card.deductions, scoredRounds(back.card));
  // 10–8 is not points (§1); 10–9 with the knockdown is the round.
  assertEquals(scoredDraft.body, null);
  scored[1] = e(10, 9);
  const scoredBody = draftToSave(back, scored, back.card.deductions, scoredRounds(back.card)).body;
  deepStrictEqual(scoredBody?.rounds.at(-1), { round_no: 2, a: 10, b: 9 });
  assertEquals((await api.call('PUT', `/api/bouts/${boutId}/card`, scoredBody)).status, 200);
  const scoredBack = await get(api, boutId);
  deepStrictEqual(entriesOf(scoredBack).slice(0, 2), [e(10, 9), e(10, 9)]);
  assertEquals(scoredRounds(scoredBack.card), 2);
  assertEquals(scoredBack.card.deductions.length, 1);
  // Back to the round under way, for the stoppage below.
  assertEquals((await api.call('PUT', `/api/bouts/${boutId}/card`, draft.body)).status, 200);

  // Ended in round 2 instead: the stoppage round keeps the knockdown.
  const ko = { decision_type: 'KO' as const, winner: 'A' as const, round: 2, time: '0:20' };
  const none = { a: null, b: null };
  const noJudges: BoutView['card']['judges'] = [none, none, none];
  const final = finalCard(back, entriesOf(back), back.card.deductions, ko, noJudges);
  const ended = await api.call('PUT', `/api/bouts/${boutId}/card`, final.body);
  assertEquals(ended.status, 200);
  const done = await get(api, boutId);
  deepStrictEqual(done.card.rounds, [{ round_no: 1, a: 10, b: 9 }, { round_no: 2, a: 0, b: 0 }]);
  deepStrictEqual(done.card.deductions.map((d) => [d.round_no, d.side]), [[2, 'B']]);
});
