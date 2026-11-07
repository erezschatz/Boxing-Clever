// The forms of task 08: what they make of what is typed (front/entry.ts),
// and what "End bout" sends, through the API as the page sends it. The
// dialogs' templates are not tested (SPEC Testing); they are checked in the
// browser.
import { deepStrictEqual, ok, strictEqual as assertEquals } from 'node:assert/strict';
import {
  changedFields,
  exactFighter,
  fieldsOnFound,
  fieldsUnfound,
  type FighterEntry,
  fighterFor,
  fillFromCards,
  findFighters,
  namedFighters,
  newFighterLabel,
  patchForFound,
  readDetails,
  readJudge,
  readRecord,
  readWeight,
  RECORD_KEYS,
  renameProblem,
  resolveTyped,
  roundAsked,
  titlesOffClass,
  updatesForExisting,
  weightText,
  winnerAfter,
  winnersFor,
} from '../../front/entry.ts';
import { entriesOf, type Entry, finalCard, lastTyped, reopenBody } from '../../front/scorecard.ts';
import type { BoutView, Fighter, Title } from '../../front/api.ts';
import { type Api, recordOf, testApi, usykFury } from '../helpers/api.ts';

Deno.test('a weight is typed in its unit and kept in pounds, as v1 kept it (D36)', () => {
  deepStrictEqual(readWeight('225.5', 'lbs'), { pounds: 225.5 });
  deepStrictEqual(readWeight('100', 'kg'), { pounds: 220.46 });
  deepStrictEqual(readWeight('9 5 3', 'st'), { pounds: 131.1875 }); // stones, pounds, ounces
  deepStrictEqual(readWeight('16', 'st'), { pounds: 224 });
  deepStrictEqual(readWeight('  ', 'lbs'), { pounds: null });
  // Kept to the hundredth it is shown back in, so saving an edit unchanged
  // changes nothing.
  deepStrictEqual(readWeight('225.555', 'lbs'), { pounds: 225.56 });
  deepStrictEqual(readWeight(weightText(225.56, 'lbs'), 'lbs'), { pounds: 225.56 });
  for (
    const [text, unit] of [['heavy', 'lbs'], ['-3', 'kg'], ['0', 'lbs'], ['9 x', 'st']] as const
  ) {
    ok('error' in readWeight(text, unit), `${text} ${unit}`);
  }
  assertEquals(weightText(131.1875, 'st'), '9 5 3');
  assertEquals(weightText(220.46, 'kg'), '100');
  assertEquals(weightText(225.5, 'lbs'), '225.5');
  assertEquals(weightText(null, null), '');
});

const fighter = (id: number, first: string, last: string, nickname: string | null = null) =>
  ({ id, first_name: first, last_name: last, nickname }) as Fighter;

Deno.test('a fighter is found by every word typed, in any order, accents ignored', () => {
  const all = [
    fighter(1, 'Saúl', 'Álvarez', 'Canelo'),
    fighter(2, 'Oleksandr', 'Usyk'),
    fighter(3, 'Tyson', 'Fury', 'The Gypsy King'),
    fighter(4, 'Mike', 'Tyson'),
  ];
  deepStrictEqual(findFighters(all, 'alv can').map((f) => f.id), [1]);
  deepStrictEqual(findFighters(all, 'USYK').map((f) => f.id), [2]);
  deepStrictEqual(findFighters(all, 'tyson').map((f) => f.id), [4, 3]); // shortest name first
  deepStrictEqual(findFighters(all, ''), []);
  deepStrictEqual(findFighters(all, 'tyson', 1).map((f) => f.id), [4]);
});

Deno.test('the cards fill a points decision until the user, or the bout, has chosen one (D41)', () => {
  const split = [{ a: 115, b: 113 }, { a: 113, b: 115 }, { a: 116, b: 112 }];
  deepStrictEqual(fillFromCards('UD', false, split), { decision_type: 'SD', winner: 'A' });
  // A decision picked by the user, or already on a finalised bout, is kept.
  assertEquals(fillFromCards('UD', true, split), null);
  // A generic DEC, a stoppage, a technical result and an NC are never filled.
  for (const code of ['DEC', 'KO', 'TKO', 'TD', 'T', 'NC'] as const) {
    assertEquals(fillFromCards(code, false, split), null, code);
  }
  assertEquals(fillFromCards('UD', false, [{ a: 115, b: null }, ...split.slice(1)]), null);
});

Deno.test('a name typed in full names its fighter without a click, unless two share it', () => {
  const all = [
    fighter(1, 'Saúl', 'Álvarez', 'Canelo'),
    fighter(3, 'Tyson', 'Fury', 'The Gypsy King'),
    fighter(5, 'Mike', 'Tyson'),
    fighter(6, 'Mike', 'Tyson'),
  ];
  assertEquals(exactFighter(all, 'tyson  fury')?.id, 3);
  assertEquals(exactFighter(all, 'Tyson "The Gypsy King" Fury')?.id, 3);
  assertEquals(exactFighter(all, 'saul canelo alvarez')?.id, 1); // no accents, no quotes
  assertEquals(exactFighter(all, 'Fury'), null); // part of one fighter's name is a search
  assertEquals(exactFighter(all, 'Mike Tyson'), null); // two of them: the user must pick
  assertEquals(exactFighter(all, ''), null);
});

Deno.test('a new fighter can be added before the name is known, or with what was typed', () => {
  assertEquals(newFighterLabel(''), '+ Fighter (new, or from your list)');
  assertEquals(newFighterLabel('   '), '+ Fighter (new, or from your list)');
  assertEquals(newFighterLabel(' Joe Nobody '), '+ Fighter "Joe Nobody"'); // found or added
});

Deno.test('the fighter form finds the fighter a typed name is, so none is added twice (D43)', () => {
  const all = [
    fighter(1, 'Oleksandr', 'Usyk'),
    fighter(5, 'Mike', 'Tyson'),
    fighter(6, 'Mike', 'Tyson'),
  ];
  deepStrictEqual(namedFighters(all, ' oleksandr', 'USYK ').map((f) => f.id), [1]);
  deepStrictEqual(namedFighters(all, 'Mike', 'Tyson').map((f) => f.id), [5, 6]); // the user picks
  deepStrictEqual(namedFighters(all, 'Joe', 'Nobody'), []); // new
});

Deno.test("saving the fighter form: someone's name takes them, never the other side, never a rename into them (D43)", () => {
  const all = [
    fighter(1, 'Oleksandr', 'Usyk'),
    fighter(5, 'Mike', 'Tyson'),
    fighter(6, 'Mike', 'Tyson'),
  ];
  deepStrictEqual(fighterFor(all, 'Oleksandr', 'Usyk', null, null), { use: all[0] });
  deepStrictEqual(fighterFor(all, 'Joe', 'Nobody', null, null), { add: true });
  // Side B, with Usyk already side A: his details must not be overwritten.
  deepStrictEqual(fighterFor(all, 'oleksandr', 'usyk', null, 1), {
    error: 'oleksandr usyk is already the other fighter',
  });
  deepStrictEqual(fighterFor(all, 'Mike', 'Tyson', null, null), {
    error: '2 fighters are called Mike Tyson; use one from the list above',
  });
  // Editing: keeping one's own name is fine; taking another's is refused.
  deepStrictEqual(fighterFor(all, 'Oleksandr', 'Usyk', 1, null), { add: true });
  deepStrictEqual(fighterFor(all, 'Oleksandr', 'Usyk', 5, null), {
    error: 'Oleksandr Usyk is already in your list; merge them on the fighters page instead',
  });
});

Deno.test("a weight typed before the name is read in the found fighter's unit, unless the unit was chosen (D43)", () => {
  const typed = (weight: string, unit: 'lbs' | 'kg' | 'st' = 'lbs') => ({
    nickname: '',
    colors: '',
    weight,
    unit,
  });
  // The form opened on lbs and was not touched; the fighter is kept in kg.
  deepStrictEqual(readDetails(typed('100'), false, 'kg'), {
    nickname: null,
    colors: null,
    weight: 220.46,
    weight_unit: 'kg',
  });
  // Kept in stone: "9 5 3" reads as stone.
  deepStrictEqual(readDetails(typed('9 5 3'), false, 'st'), {
    nickname: null,
    colors: null,
    weight: 131.1875,
    weight_unit: 'st',
  });
  // A unit chosen in the form wins.
  deepStrictEqual(readDetails(typed('100', 'lbs'), true, 'kg'), {
    nickname: null,
    colors: null,
    weight: 100,
    weight_unit: 'lbs',
  });
  // No weight: no unit either.
  deepStrictEqual(readDetails(typed('', 'kg'), true, 'lbs'), {
    nickname: null,
    colors: null,
    weight: null,
    weight_unit: null,
  });
});

Deno.test("a fighter found in the list keeps the record and takes tonight's details (D43)", async () => {
  const api = testApi();
  const { aId } = await usykFury(api); // Usyk: 225.5 lbs, Blue/Yellow, no nickname, 21-0-0
  const stored = (await api.call('GET', `/api/fighters/${aId}`)).json as Fighter;
  const before = recordOf(api.db, aId);
  const tonight = {
    nickname: 'The Cat',
    colors: 'White',
    weight: 226,
    weight_unit: 'lbs' as const,
  };
  const patch = updatesForExisting(stored, tonight);
  deepStrictEqual(patch, tonight); // all of it differs; never a record field
  const after = (await api.call('PATCH', `/api/fighters/${aId}`, patch)).json;
  assertEquals(after.weight, 226);
  assertEquals(after.colors, 'White');
  deepStrictEqual(recordOf(api.db, aId), before);
  // What was left empty keeps what is stored; the same values send nothing.
  deepStrictEqual(
    updatesForExisting(after, { nickname: null, colors: null, weight: null, weight_unit: null }),
    {},
  );
  deepStrictEqual(updatesForExisting(after, { ...tonight }), {});
  // A unit change alone is a change.
  deepStrictEqual(updatesForExisting(after, { ...tonight, weight_unit: 'kg' }), {
    weight: 226,
    weight_unit: 'kg',
  });
});

// The fighter form's boxes as Erez types them off the announcement: the
// details first, the name last.
const announced: FighterEntry = {
  first_name: 'Joe',
  last_name: '',
  nickname: '',
  colors: 'Gold and white',
  weight: '174.5',
  unit: 'lbs',
  won: '19',
  lost: '1',
  draws: '0',
  nc: '0',
  kos: '7',
};
const schmoe = {
  id: 7,
  first_name: 'Joe',
  last_name: 'Schmoe',
  nickname: 'Nobody',
  colors: 'Black',
  weight: 78.02, // 172 lbs, kept in kg
  weight_unit: 'kg',
  won: 18,
  lost: 1,
  draws: 0,
  nc: 0,
  kos: 6,
} as Fighter;

Deno.test("the record boxes read Won, KOs, Lost, Drawn, NC, as v1's form laid them out", () => {
  deepStrictEqual([...RECORD_KEYS], ['won', 'kos', 'lost', 'draws', 'nc']);
});

Deno.test('finding a fighter makes the form theirs and loses nothing typed (D44)', () => {
  const { fields, typedRecord } = fieldsOnFound(announced, false, schmoe);
  // Their name; tonight's details as typed; their unit, since none was chosen.
  assertEquals(fields.first_name, 'Joe');
  assertEquals(fields.last_name, 'Schmoe');
  assertEquals(fields.colors, 'Gold and white');
  assertEquals(fields.weight, '174.5');
  assertEquals(fields.nickname, ''); // empty keeps the stored one (D43)
  assertEquals(fields.unit, 'kg');
  // The record boxes are theirs; what was announced is kept beside them.
  deepStrictEqual([fields.won, fields.lost, fields.draws, fields.nc, fields.kos], [
    '18',
    '1',
    '0',
    '0',
    '6',
  ]);
  deepStrictEqual(typedRecord, { won: 19, lost: 1, draws: 0, nc: 0, kos: 7 });
  // A unit chosen in the form stays chosen.
  assertEquals(fieldsOnFound(announced, true, schmoe).fields.unit, 'lbs');
  // The same record, or none typed, is not offered back.
  const same = { ...announced, won: '18', kos: '6' };
  assertEquals(fieldsOnFound(same, false, schmoe).typedRecord, null);
  const none = { ...announced, won: '0', lost: '0', kos: '0' };
  assertEquals(fieldsOnFound(none, false, schmoe).typedRecord, null);
  // Not them: the name and record as typed, the details as they stand now.
  const back = fieldsUnfound({ ...fields, colors: 'Gold' }, announced);
  assertEquals(back.first_name, 'Joe');
  assertEquals(back.last_name, '');
  assertEquals(back.won, '19');
  assertEquals(back.kos, '7');
  assertEquals(back.colors, 'Gold');
});

Deno.test("saving a found fighter sends tonight's details, and the name and record only where corrected (D44)", async () => {
  const bound = fieldsOnFound(announced, false, schmoe).fields;
  // As found: the weight is read in their unit, the colours taken, the
  // empty nickname kept, the record untouched.
  deepStrictEqual(patchForFound(schmoe, bound, false), {
    patch: { colors: 'Gold and white', weight: 384.71, weight_unit: 'kg' },
  });
  // Nothing typed but the name: nothing to send.
  const blank = { ...bound, colors: '', weight: '' };
  deepStrictEqual(patchForFound(schmoe, blank, false), { patch: {} });
  // The record taken from the announcement is a correction, and goes.
  const corrected = { ...bound, won: '19', kos: '7' };
  deepStrictEqual(patchForFound(schmoe, corrected, false), {
    patch: { won: 19, kos: 7, colors: 'Gold and white', weight: 384.71, weight_unit: 'kg' },
  });
  // A name fixed in the boxes goes too; a bad record box is named.
  deepStrictEqual(patchForFound(schmoe, { ...blank, last_name: 'Schmo' }, false), {
    patch: { last_name: 'Schmo' },
  });
  deepStrictEqual(patchForFound(schmoe, { ...blank, won: 'x' }, false), {
    error: 'Won is a whole number',
  });
  deepStrictEqual(readRecord({ ...blank, nc: '' }), { error: 'NC is a whole number' });

  // Through the API: the patch applies, and the stored record moves only
  // when it was corrected.
  const api = testApi();
  const { aId } = await usykFury(api); // Usyk, 21-0-0
  const usyk = (await api.call('GET', `/api/fighters/${aId}`)).json as Fighter;
  const before = recordOf(api.db, aId);
  const tonight = fieldsOnFound({ ...announced, won: '22', kos: '15' }, false, usyk);
  deepStrictEqual(tonight.typedRecord, { won: 22, lost: 1, draws: 0, nc: 0, kos: 15 });
  const kept = patchForFound(usyk, tonight.fields, false);
  ok('patch' in kept);
  const after = (await api.call('PATCH', `/api/fighters/${aId}`, kept.patch)).json as Fighter;
  assertEquals(after.colors, 'Gold and white');
  assertEquals(after.weight, 174.5);
  deepStrictEqual(recordOf(api.db, aId), before);
  const used = patchForFound(after, { ...tonight.fields, won: '22' }, false);
  ok('patch' in used);
  deepStrictEqual(used.patch, { won: 22 });
  await api.call('PATCH', `/api/fighters/${aId}`, used.patch);
  deepStrictEqual(recordOf(api.db, aId), { ...before, won: 22 });
});

Deno.test("a found or edited fighter keeps a shared name; only a change into someone else's is refused (D44)", () => {
  const smiths = [fighter(2, 'Joe', 'Smith'), fighter(3, 'Joe', 'Smith'), schmoe];
  const one = smiths[0];
  // Picked from the list and saved as is: theirs, whoever else is a Joe Smith.
  assertEquals(renameProblem(smiths, { first_name: 'Joe', last_name: 'Smith' }, one, null), null);
  // Renamed into a free name: fine. Into Schmoe's: refused, with merge as the way.
  assertEquals(renameProblem(smiths, { first_name: 'Joe', last_name: 'Smyth' }, one, null), null);
  assertEquals(
    renameProblem(smiths, { first_name: 'Joe', last_name: 'Schmoe' }, one, null),
    'Joe Schmoe is already in your list; merge them on the fighters page instead',
  );
});

Deno.test('a name typed in full is the top match, so Enter and Save take the same fighter', () => {
  const all = [fighter(1, 'Joe', 'Leeds'), fighter(2, 'Joe', 'Lee', 'Bomber')];
  deepStrictEqual(findFighters(all, 'joe lee').map((f) => f.id), [2, 1]);
});

Deno.test('what a typed name comes to on Save is judged against every fighter (D38)', () => {
  const many = Array.from({ length: 12 }, (_, i) => fighter(100 + i, 'Joe', `Smith${i}`));
  const smith = fighter(9, 'Joe', 'Smith', 'The Very Long Nickname Indeed');
  const all = [
    ...many,
    smith,
    fighter(3, 'Tyson', 'Fury'),
    fighter(5, 'Mike', 'Tyson'),
    fighter(6, 'Mike', 'Tyson'),
  ];
  const pick = (typed: string, otherId: number | null = null) => resolveTyped(all, typed, otherId);

  // Found though twelve shorter names would fill the list first.
  deepStrictEqual(pick('Joe Smith'), { fighter: smith });
  // Already chosen on the other side: said so, never "not in the list".
  deepStrictEqual(pick('Tyson Fury', 3), {
    error: '"Tyson Fury" is already the other fighter',
    absent: false,
  });
  // A shared name stays the user's choice, whichever side is chosen.
  deepStrictEqual(pick('Mike Tyson', 5), {
    error: '2 fighters are called "Mike Tyson"; pick one from the list',
    absent: false,
  });
  deepStrictEqual(pick('Fury'), {
    error: 'pick "Fury" from the list (click, or Enter)',
    absent: false,
  });
  deepStrictEqual(pick('Joe Nobody'), {
    error: '"Joe Nobody" is not in the list; add them with + New fighter',
    absent: true,
  });
  deepStrictEqual(pick('  '), { error: 'type a name and pick from the list', absent: false });
});

Deno.test('the decision dialog offers the winners and asks for the round each code allows (§5)', () => {
  deepStrictEqual(winnersFor('UD'), ['A', 'B']);
  deepStrictEqual(winnersFor('KO'), ['A', 'B']);
  deepStrictEqual(winnersFor('MT'), ['draw']);
  deepStrictEqual(winnersFor('NC'), ['none']);
  assertEquals(roundAsked('KO'), 'needed');
  assertEquals(roundAsked('TD'), 'needed');
  assertEquals(roundAsked('UD'), 'last');
  assertEquals(roundAsked('NC'), 'optional');
  // A winner the new code still allows stays chosen; one it does not, goes.
  assertEquals(winnerAfter('TKO', 'A'), 'A');
  assertEquals(winnerAfter('UD', 'B'), 'B');
  assertEquals(winnerAfter('D', 'A'), 'draw');
  assertEquals(winnerAfter('UD', 'draw'), null);
  assertEquals(winnerAfter('KO', null), null);
  assertEquals(readJudge(''), null);
  assertEquals(readJudge('115'), 115);
  assertEquals(readJudge('11.5'), undefined);
});

const e = (a: number | null, b: number | null): Entry => ({ a, b });
const get = async (api: Api, id: number) =>
  (await api.call('GET', `/api/bouts/${id}`)).json as BoutView;
const noJudges = [{ a: null, b: null }, { a: null, b: null }, { a: null, b: null }] as BoutView[
  'card'
]['judges'];

Deno.test('End bout on a KO: the rules shape the card, the API takes it, and the records move once', async () => {
  const api = testApi();
  const { boutId, aId, bId } = await usykFury(api);
  const bout = await get(api, boutId);
  const entries = entriesOf(bout);
  entries[0] = e(10, 9);
  entries[1] = e(10, 9);
  entries[2] = e(10, null); // round 3 half typed when the stoppage came
  const knockdown = { round_no: 3, side: 'B' as const, points: 1, reason: 'knockdown' as const };
  assertEquals(lastTyped(entries), 3);

  const ko = { decision_type: 'KO' as const, winner: 'A' as const, round: 3, time: '2:01' };
  const { body, problems } = finalCard(bout, entries, [knockdown], ko, noJudges);
  deepStrictEqual(problems, []);
  deepStrictEqual(body?.rounds, [
    { round_no: 1, a: 10, b: 9 },
    { round_no: 2, a: 10, b: 9 },
    { round_no: 3, a: 0, b: 0 },
  ]);
  const res = await api.call('PUT', `/api/bouts/${boutId}/card`, body);
  assertEquals(res.status, 200);
  assertEquals(res.json.card.totals.b, 17); // 9 + 9 + (0 − 1)
  deepStrictEqual(recordOf(api.db, aId), { won: 22, lost: 0, draws: 0, nc: 0, kos: 15 });
  deepStrictEqual(recordOf(api.db, bId), { won: 34, lost: 1, draws: 1, nc: 0, kos: 24 });
});

Deno.test('End bout says why it cannot finalise: a points decision on a half-scored card', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const bout = await get(api, boutId);
  const entries = entriesOf(bout);
  entries[0] = e(10, 9);
  const ud = { decision_type: 'UD' as const, winner: 'A' as const, round: 12, time: null };
  const { body, problems } = finalCard(bout, entries, [], ud, noJudges);
  assertEquals(body, null);
  ok(problems.join(' ').includes('distance'), problems.join(' '));
});

Deno.test('a reopened bout keeps its card and result but not its count; End bout finalises it again (D32, D37)', async () => {
  const api = testApi();
  const { boutId, aId, bId } = await usykFury(api);
  const before = { a: recordOf(api.db, aId), b: recordOf(api.db, bId) };
  const ud = { decision_type: 'UD' as const, winner: 'A' as const, round: 12, time: '3:00' };
  const all = entriesOf(await get(api, boutId)).map(() => e(10, 9));
  const first = finalCard(await get(api, boutId), all, [], ud, noJudges);
  await api.call('PUT', `/api/bouts/${boutId}/card`, first.body);
  assertEquals(recordOf(api.db, aId).won, before.a.won + 1);

  const reopened = await api.call(
    'PUT',
    `/api/bouts/${boutId}/card`,
    reopenBody((await get(api, boutId)).card),
  );
  assertEquals(reopened.status, 200);
  assertEquals(reopened.json.is_draft, 1);
  deepStrictEqual(reopened.json.card.result, ud); // the card's shape depends on it
  deepStrictEqual(recordOf(api.db, aId), before.a);
  deepStrictEqual(recordOf(api.db, bId), before.b);

  // A round corrected while reopened still saves as a draft, and End bout
  // finalises the corrected card.
  const fixed = entriesOf(reopened.json);
  fixed[4] = e(9, 10);
  const again = finalCard(reopened.json, fixed, [], ud, noJudges);
  await api.call('PUT', `/api/bouts/${boutId}/card`, again.body);
  assertEquals(recordOf(api.db, aId).won, before.a.won + 1);
});

Deno.test('End bout on a round-1 KO after a knockdown, with nothing typed, records round 1 at 0–0', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const bout = await get(api, boutId);
  const kd = { round_no: 1, side: 'B' as const, points: 1, reason: 'knockdown' as const };
  assertEquals(lastTyped(entriesOf(bout), [kd]), 1); // the dialog offers round 1
  const ko = { decision_type: 'KO' as const, winner: 'A' as const, round: 1, time: '2:59' };
  const { body } = finalCard(bout, entriesOf(bout), [kd], ko, noJudges);
  deepStrictEqual(body?.rounds, [{ round_no: 1, a: 0, b: 0 }]);
  const res = await api.call('PUT', `/api/bouts/${boutId}/card`, body);
  assertEquals(res.status, 200);
  assertEquals(res.json.card.totals.b, -1);
  // Reopening a KO card keeps it valid: round 1 is 0–0 only because of the KO.
  const reopened = await api.call('PUT', `/api/bouts/${boutId}/card`, reopenBody(res.json.card));
  assertEquals(reopened.status, 200);
});

Deno.test('End bout never drops what was typed: it says what to clear or correct', async () => {
  const api = testApi();
  const { boutId } = await usykFury(api);
  const bout = await get(api, boutId);
  const ko3 = { decision_type: 'KO' as const, winner: 'A' as const, round: 3, time: null };
  const refused = (
    entries: Entry[],
    deductions: Parameters<typeof finalCard>[2],
    words: string,
  ) => {
    const { body, problems } = finalCard(bout, entries, deductions, ko3, noJudges);
    assertEquals(body, null, words);
    ok(problems.join(' ').includes(words), `${words}: ${problems}`);
  };
  const typed = (rows: [number | null, number | null][]) => {
    const entries = entriesOf(bout);
    rows.forEach(([a, b], i) => (entries[i] = e(a, b)));
    return entries;
  };
  // One column typed and the other not: not an unscored card.
  refused(typed([[10, null], [10, null], [10, null]]), [], 'round 1 has one side empty');
  // Round 4 typed, but the KO was in 3 (the round the dialog offered was wrong).
  refused(typed([[10, 9], [10, 9], [10, 9], [10, 9]]), [], 'round 4 has points');
  // A knockdown in round 4 with the KO put in round 3.
  refused(typed([[10, 9], [10, 9], [10, 9]]), [{
    round_no: 4,
    side: 'B',
    points: 1,
    reason: 'knockdown',
  }], 'a deduction in round 4');
  // The stoppage round itself may be half typed: it becomes 0–0.
  const ok3 = finalCard(bout, typed([[10, 9], [10, 9], [10, null]]), [], ko3, noJudges);
  deepStrictEqual(ok3.body?.rounds.at(-1), { round_no: 3, a: 0, b: 0 });
});

Deno.test('saving the same finalised card again does not move the records twice (§6)', async () => {
  const api = testApi();
  const { boutId, aId } = await usykFury(api);
  const bout = await get(api, boutId);
  const entries = entriesOf(bout);
  entries[0] = e(10, 9);
  const ko = { decision_type: 'KO' as const, winner: 'A' as const, round: 2, time: '0:30' };
  const { body } = finalCard(bout, entries, [], ko, noJudges);
  await api.call('PUT', `/api/bouts/${boutId}/card`, body);
  const once = recordOf(api.db, aId);
  await api.call('PUT', `/api/bouts/${boutId}/card`, body);
  deepStrictEqual(recordOf(api.db, aId), once);
});

Deno.test('the bout form refuses a title of another class; the fighter form sends only what changed', () => {
  const title = (id: number, weight_class_id: number) =>
    ({ id, sanctioning_body: 'WBC', area: 'World', weight_class_id, interim: 0 }) as Title;
  const titles = [title(1, 18), title(2, 9)];
  deepStrictEqual(titlesOffClass([{ title_id: 1 }, { title_id: 2 }], titles, 18), [title(2, 9)]);
  deepStrictEqual(titlesOffClass([{ title_id: 1 }], titles, 18), []);

  const stored = { first_name: 'Tyson', weight: 281, weight_unit: 'st', won: 35, lost: 0 };
  // The form was opened on a list from before Fury's 35th win, and only the
  // weight was changed: the record is not sent back.
  deepStrictEqual(
    changedFields({ ...stored, won: 34 }, {
      first_name: 'Tyson',
      weight: 280,
      weight_unit: 'st',
      won: 34,
      lost: 0,
    }),
    { weight: 280 },
  );
  deepStrictEqual(changedFields(stored, { ...stored }), {});
});
