// The front shell (task 06): how the browser app is served, and the parts of
// it that are plain functions. lit-html output is not tested (SPEC Testing);
// the pages are checked in the browser.
import { deepStrictEqual, match, ok, strictEqual as assertEquals } from 'node:assert/strict';
import chamber from '../../mod.ts';
import { matchRoute } from '../../front/router.ts';
import {
  boutWeightText,
  classText,
  dateText,
  fighterName,
  initialOf,
  missedWeight,
  recordText,
  resultText,
  titleText,
} from '../../front/format.ts';
import type { BoutView, WeightClass } from '../../front/api.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (path: string) => Deno.readTextFileSync(new URL(path, ROOT));

Deno.test('in development /app.js is front/app.ts bundled, with lit-html left to the import map', async () => {
  const was = Deno.env.get('BOXING_DEV');
  Deno.env.set('BOXING_DEV', '1');
  try {
    const res = await chamber.fetch(new Request('http://boxing.test/app.js'));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get('content-type'), 'text/javascript; charset=utf-8');
    const js = await res.text();
    match(js, /from "lit-html"/); // bare, for the page's import map (D7)
    match(js, /from "lit-html\/directives\/ref\.js"/);
    ok(!/from "\.\/[\w-]+\.ts"/.test(js), 'the pages and the rules are bundled in, not imported');
    ok(js.includes('/events/:id'), 'the route table is in the bundle');
    ok(js.includes('Unanimous Decision'), 'server/rules/ is in the bundle');
  } finally {
    if (was === undefined) Deno.env.delete('BOXING_DEV');
    else Deno.env.set('BOXING_DEV', was);
  }
});

Deno.test('index.html pins the lit-html the type-check uses', () => {
  const pinned = read('front/index.html').match(/esm\.sh\/lit-html@([\d.]+)"/)?.[1];
  const checked = read('deno.json').match(/"lit-html": "npm:lit-html@([\d.]+)"/)?.[1];
  ok(pinned, 'index.html pins lit-html');
  assertEquals(pinned, checked);
  assertEquals(read('front/index.html').match(/esm\.sh\/lit-html@([\d.]+)\/"/)?.[1], pinned);
});

Deno.test('matchRoute reads the parameters of a path that fits and refuses one that does not', () => {
  deepStrictEqual(matchRoute('/', '/'), {});
  deepStrictEqual(matchRoute('/events/:id', '/events/12'), { id: '12' });
  deepStrictEqual(matchRoute('/events/:id', '/events/12/'), { id: '12' });
  deepStrictEqual(matchRoute('/fighters', '/fighters'), {});
  for (
    const [pattern, path] of [
      ['/', '/fighters'],
      ['/events/:id', '/events'],
      ['/events/:id', '/events/12/bouts'],
      ['/fighters', '/fighters/3'],
      ['/events/:id', '/fighters/12'],
    ]
  ) {
    assertEquals(matchRoute(pattern, path), null, `${pattern} v ${path}`);
  }
});

Deno.test('the pages say names, records, dates and titles as v1 did', () => {
  assertEquals(
    fighterName({ first_name: 'Tyson', last_name: 'Fury', nickname: 'The Gypsy King' }),
    'Tyson "The Gypsy King" Fury',
  );
  assertEquals(
    fighterName({ first_name: 'Oleksandr', last_name: 'Usyk', nickname: null }),
    'Oleksandr Usyk',
  );
  assertEquals(recordText({ won: 34, lost: 0, draws: 1, nc: 0, kos: 24 }), '34-0-1 (24 KOs)');
  assertEquals(recordText({ won: 1, lost: 2, draws: 0, nc: 1, kos: 1 }), '1-2-0 (1 KO), 1 NC');
  assertEquals(initialOf('Fury'), 'F');
  assertEquals(initialOf('de la Hoya'), 'D');
  assertEquals(initialOf('Álvarez'), 'A');
  assertEquals(initialOf(''), '#');
  assertEquals(dateText('2024-05-18'), '18 May 2024');
  assertEquals(dateText('2024-01-01'), '1 Jan 2024'); // a calendar date, not a UTC instant
  const title = { id: 1, sanctioning_body: 'WBC', area: 'World', weight_class_id: 18 };
  // D42: interim is the one kind; Silver and the like are part of the area.
  assertEquals(titleText({ ...title, interim: 0 }), 'WBC World');
  assertEquals(titleText({ ...title, interim: 1 }), 'WBC Interim World');
  assertEquals(titleText({ ...title, area: 'World Silver', interim: 0 }), 'WBC World Silver');
});

Deno.test('the result on the card says who, how, and when it was stopped, never "draft"', () => {
  const bout = (
    result: BoutView['card']['result'],
    is_draft = false,
  ) => ({ card: { result, is_draft } }) as BoutView;
  assertEquals(resultText(bout(null), 'Usyk', 'Fury'), '');
  assertEquals(resultText(bout(null, true), 'Usyk', 'Fury'), ''); // the page offers "Score" (D39)
  const ud = { decision_type: 'UD', winner: 'A', round: null, time: null } as const;
  assertEquals(resultText(bout(ud), 'Usyk', 'Fury'), 'Usyk · UD');
  assertEquals(resultText(bout(ud, true), 'Usyk', 'Fury'), 'Usyk · UD · not final');
  const ko = { decision_type: 'KO', winner: 'B', round: 9, time: '2:52' } as const;
  assertEquals(resultText(bout(ko), 'Usyk', 'Dubois'), 'Dubois · KO 9 (2:52)');
  const draw = { decision_type: 'D', winner: 'draw', round: null, time: null } as const;
  assertEquals(resultText(bout(draw), 'Fury', 'Wilder'), 'D');
  const nc = { decision_type: 'NC', winner: 'none', round: 3, time: null } as const;
  assertEquals(resultText(bout(nc), 'A', 'B'), 'NC 3');
});

Deno.test('a bout says its class or its contracted weight; the class dropdown shows each limit as v1 did', () => {
  const fly: WeightClass = { id: 4, name: 'Flyweight', alternate_name: null, lbs: 112, kg: 50.802 };
  const heavy: WeightClass = {
    id: 18,
    name: 'Heavyweight',
    alternate_name: null,
    lbs: null,
    kg: null,
  };
  assertEquals(classText(fly), 'Flyweight (112 lbs / 50.802 kg)');
  assertEquals(classText(heavy), 'Heavyweight (no limit)'); // D17
  const classes = new Map([[4, fly], [18, heavy]]);
  assertEquals(
    boutWeightText({ weight_class_id: 4, contracted_weight: null }, classes),
    'Flyweight',
  );
  // D26: there is no catchweight class, only the weight agreed.
  assertEquals(
    boutWeightText({ weight_class_id: null, contracted_weight: 150.5 }, classes),
    'Contracted at 150.5 lbs',
  );
  const marks = { missed_weight_a: 0, missed_weight_b: 1 } as const;
  assertEquals(missedWeight(marks, 'A'), false);
  assertEquals(missedWeight(marks, 'B'), true);
});
