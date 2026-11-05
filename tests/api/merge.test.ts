// Tier 3: merging a duplicate fighter moves everything that names them to the
// target — bouts, aliases, TBRB rows — and deletes the duplicate, or, if any
// step fails, changes nothing at all (SPEC Testing).
import { deepStrictEqual, strictEqual as assertEquals } from 'node:assert/strict';
import { type Api, HEAVYWEIGHT, testApi, usyk, usykFury } from '../helpers/api.ts';
import { getBout } from '../../server/db/bout.ts';
import { getFighter } from '../../server/db/fighter.ts';
import { insertAlias, listAliases } from '../../server/db/fighter-alias.ts';
import { insertTbrbRow, listTbrbRowsForFighter } from '../../server/db/tbrb-snapshot.ts';

// A duplicate Usyk with a bout of his own, an alias and a TBRB row.
async function withDuplicate(api: Api) {
  const ids = await usykFury(api);
  const { json: dup } = await api.call('POST', '/api/fighters', {
    ...usyk,
    first_name: 'Aleksandr',
  });
  const { json: event } = await api.call('POST', '/api/events', {
    date: '2023-08-26',
    location: 'Wroclaw',
  });
  const { json: other } = await api.call('POST', '/api/fighters', {
    first_name: 'Daniel',
    last_name: 'Dubois',
  });
  const { json: bout } = await api.call('POST', '/api/bouts', {
    event_id: event.id,
    weight_class_id: HEAVYWEIGHT,
    scheduled_rounds: 12,
    fighter_a_id: dup.id,
    fighter_b_id: other.id,
  });
  insertAlias(api.db, ids.aId, 'Oleksandr Usyk');
  insertAlias(api.db, dup.id, 'Aleksandr Usyk');
  insertTbrbRow(api.db, {
    snapshot_date: '2023-08-01',
    weight_class_id: HEAVYWEIGHT,
    rank: 0,
    fighter_name: 'Aleksandr Usyk',
    fighter_id: dup.id,
  });
  return { ...ids, dupId: dup.id as number, dupBoutId: bout.id as number };
}

Deno.test('merge repoints bouts, aliases and TBRB rows, then deletes the duplicate', async () => {
  const api = testApi();
  const { aId, dupId, dupBoutId } = await withDuplicate(api);
  assertEquals((await api.call('POST', `/api/fighters/${dupId}/merge/${aId}`)).status, 200);
  assertEquals(getFighter(api.db, dupId), undefined);
  assertEquals(getBout(api.db, dupBoutId)?.fighter_a_id, aId);
  deepStrictEqual(listAliases(api.db, aId).map((a) => a.alias), [
    'Aleksandr Usyk',
    'Oleksandr Usyk',
  ]);
  deepStrictEqual(listTbrbRowsForFighter(api.db, aId).map((r) => r.fighter_name), [
    'Aleksandr Usyk',
  ]);
});

Deno.test('merge is all or nothing: a failure at the last step leaves everything as it was', async () => {
  const api = testApi();
  const { aId, dupId, dupBoutId } = await withDuplicate(api);
  // Make the final step, deleting the duplicate, fail after the repoints ran.
  // Test-only fault injection, so it is set up here rather than in server/db/.
  api.db.exec(`CREATE TRIGGER refuse_delete BEFORE DELETE ON fighter
    BEGIN SELECT RAISE(ABORT, 'refused for the test'); END`);

  const { status } = await api.call('POST', `/api/fighters/${dupId}/merge/${aId}`);
  assertEquals(status, 500);
  assertEquals(getFighter(api.db, dupId)?.id, dupId);
  assertEquals(getBout(api.db, dupBoutId)?.fighter_a_id, dupId);
  deepStrictEqual(listAliases(api.db, dupId).map((a) => a.alias), ['Aleksandr Usyk']);
  deepStrictEqual(listTbrbRowsForFighter(api.db, dupId).map((r) => r.fighter_name), [
    'Aleksandr Usyk',
  ]);
  deepStrictEqual(listAliases(api.db, aId).map((a) => a.alias), ['Oleksandr Usyk']);
});
