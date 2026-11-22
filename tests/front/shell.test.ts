// The front shell (task 06): how the browser app is served, and the parts of
// it that are plain functions. lit-html output is not tested (SPEC Testing);
// the pages are checked in the browser.
import { deepStrictEqual, match, ok, strictEqual as assertEquals } from 'node:assert/strict';
import chamber from '../../mod.ts';
import { matchRoute } from '../../front/router.ts';
import {
  boutWeightText,
  cardCounts,
  classText,
  dateText,
  dayAndMonth,
  fighterCount,
  fighterName,
  howItEnded,
  initialOf,
  missedWeight,
  missedWeightNote,
  myCardFor,
  outcomeFor,
  outcomeText,
  placeLines,
  plainName,
  recordText,
  resultText,
  shortStatus,
  sideOf,
  standingOnTheNight,
  titlesAtStake,
  titleText,
  venueText,
  watchedSince,
  weightOnTheNight,
} from '../../front/format.ts';
import type { BoutView, Fighter, Title, WeightClass } from '../../front/api.ts';

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

Deno.test('a side that missed weight gets a quiet note after its name, the other none (D47)', () => {
  const marks = { missed_weight_a: 1, missed_weight_b: 0 } as const;
  assertEquals(missedWeightNote(marks, 'A'), '(missed weight)');
  assertEquals(missedWeightNote(marks, 'B'), '');
});

Deno.test("the fighter card reads each bout from that fighter's side: W, L, D or NC, and my card with theirs first", () => {
  const bout = (
    result: BoutView['card']['result'],
    totals = { a: 0, b: 0 },
    scored = true,
  ) =>
    ({
      fighter_a_id: 1,
      fighter_b_id: 2,
      card: { result, is_draft: false, rounds: scored ? [{}] : [], totals },
    }) as unknown as BoutView;
  const ud = { decision_type: 'UD', winner: 'A', round: null, time: null } as const;
  assertEquals(sideOf(bout(ud), 1), 'A');
  assertEquals(sideOf(bout(ud), 2), 'B');
  assertEquals(outcomeFor(bout(ud), 'A'), 'W');
  assertEquals(outcomeFor(bout(ud), 'B'), 'L');
  const draw = { decision_type: 'MT', winner: 'draw', round: null, time: null } as const;
  assertEquals(outcomeFor(bout(draw), 'A'), 'D');
  assertEquals(outcomeFor(bout(draw), 'B'), 'D');
  const nc = { decision_type: 'NC', winner: 'none', round: 3, time: null } as const;
  assertEquals(outcomeFor(bout(nc), 'B'), 'NC');
  assertEquals(outcomeFor(bout(null), 'A'), ''); // not scored yet
  // My card, that fighter's total first; nothing when no round was scored.
  assertEquals(myCardFor(bout(ud, { a: 115, b: 111 }), 'A'), '115–111');
  assertEquals(myCardFor(bout(ud, { a: 115, b: 111 }), 'B'), '111–115');
  assertEquals(myCardFor(bout(ud, { a: 0, b: 0 }, false), 'A'), '');
  // How it ended, the same words as the event card's result.
  const ko = { decision_type: 'KO', winner: 'B', round: 7, time: '2:14' } as const;
  assertEquals(howItEnded(bout(ko)), 'KO 7 (2:14)');
  assertEquals(howItEnded(bout(ud)), 'UD');
  assertEquals(howItEnded(bout(null)), '');
});

Deno.test('the marquee says a weight in the unit it was typed in (D36), stone as st and lb', () => {
  assertEquals(weightOnTheNight(121.6, 'lbs'), '121.6 lbs');
  assertEquals(weightOnTheNight(121.6, 'kg'), '55.16 kg');
  assertEquals(weightOnTheNight(122, 'st'), '8 st 10 lb');
  assertEquals(weightOnTheNight(122.25, 'st'), '8 st 10 lb 4 oz');
  assertEquals(weightOnTheNight(null, 'lbs'), ''); // no weight taken
  assertEquals(weightOnTheNight(121.6, null), '');
});

Deno.test('an events row shows the day and the month in three capitals, never shifted by the time zone', () => {
  deepStrictEqual(dayAndMonth('2026-11-14'), { day: '14', month: 'NOV' });
  deepStrictEqual(dayAndMonth('2025-09-01'), { day: '1', month: 'SEP' }); // never "SEPT"
  deepStrictEqual(dayAndMonth('2024-01-31'), { day: '31', month: 'JAN' });
});

Deno.test('the events title says how many nights were watched since the first one', () => {
  assertEquals(
    watchedSince(['2026-11-14', '2024-05-18', '2021-11-13']),
    '3 nights watched since Nov 2021',
  );
  assertEquals(watchedSince(['2024-05-18']), '1 night watched since May 2024');
  assertEquals(watchedSince(['2021-11-13', '2026-11-14']), '2 nights watched since Nov 2021'); // in any order
  assertEquals(watchedSince([]), '');
});

Deno.test('an event card row says who won and how, and leaves "not final" to a line of its own', () => {
  const bout = (result: BoutView['card']['result'], is_draft = false) =>
    ({ card: { result, is_draft } }) as BoutView;
  const ud = { decision_type: 'UD', winner: 'A', round: null, time: null } as const;
  assertEquals(outcomeText(bout(ud, true), 'Oleksandr Usyk', 'Tyson Fury'), 'Oleksandr Usyk · UD');
  const ko = { decision_type: 'KO', winner: 'B', round: 9, time: '2:52' } as const;
  assertEquals(outcomeText(bout(ko), 'Usyk', 'Dubois'), 'Dubois · KO 9 (2:52)');
  const draw = { decision_type: 'D', winner: 'draw', round: null, time: null } as const;
  assertEquals(outcomeText(bout(draw), 'Fury', 'Wilder'), 'D');
  assertEquals(outcomeText(bout(null, true), 'Usyk', 'Fury'), ''); // the row offers "Score"
  assertEquals(
    plainName({ first_name: 'Tyson', last_name: 'Fury', nickname: 'The Gypsy King' }),
    'Tyson Fury',
  );
});

Deno.test('an event card counts its bouts, those still to score, and those with a result not final', () => {
  const bout = (result: BoutView['card']['result'], is_draft: boolean) =>
    ({ card: { result, is_draft } }) as BoutView;
  const ud = { decision_type: 'UD', winner: 'A', round: null, time: null } as const;
  deepStrictEqual(
    cardCounts([bout(ud, false), bout(ud, true), bout(null, true), bout(null, true)]),
    { bouts: 4, toScore: 2, notFinal: 1 },
  );
  deepStrictEqual(cardCounts([]), { bouts: 0, toScore: 0, notFinal: 0 });
});

Deno.test('the fighters page counts fighters in words, one or many', () => {
  assertEquals(fighterCount(1), '1 fighter');
  assertEquals(fighterCount(48), '48 fighters');
});

Deno.test('the page names its icon and manifest, and the chamber serves them as images and JSON', async () => {
  const index = read('front/index.html');
  match(index, /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32.png">/);
  match(index, /<link rel="apple-touch-icon" href="\/apple-touch-icon.png">/);
  match(index, /<link rel="manifest" href="\/manifest.json">/);
  const get = (path: string) => chamber.fetch(new Request(`http://boxing.test${path}`));
  for (const icon of ['/favicon-32.png', '/apple-touch-icon.png']) {
    const res = await get(icon);
    assertEquals(res.headers.get('content-type'), 'image/png', icon);
    await res.body?.cancel();
  }
  const res = await get('/manifest.json');
  assertEquals(res.headers.get('content-type'), 'application/json');
  const manifest = await res.json();
  assertEquals(manifest.name, 'Boxing Clever');
  // Relative, so the installed window starts wherever the chamber is mounted.
  assertEquals(manifest.start_url, './');
  for (const { src, sizes } of manifest.icons) {
    const icon = await get(`/${src}`);
    assertEquals(icon.headers.get('content-type'), 'image/png', src);
    await icon.body?.cancel();
    ok(['192x192', '512x512'].includes(sizes), sizes);
  }
});

Deno.test('the header carries the grid mark and the name, a slot for a page bar, and the chamber serves the mark', async () => {
  const index = read('front/index.html');
  const header = index.slice(index.indexOf('<header'), index.indexOf('</header>'));
  // The mark is decoration beside the name, which the link is called by.
  match(header, /<a class="brand" href="\/"><img src="\/mark.png" alt=""[^>]*>Boxing Clever<\/a>/);
  match(header, /<a href="\/">Events<\/a>/); // the sections stay beside it
  match(header, /<a href="\/fighters">Fighters<\/a>/);
  match(header, /<div id="page-bar"><\/div>/); // where the scorecard puts its bar
  const res = await chamber.fetch(new Request('http://boxing.test/mark.png'));
  assertEquals(res.headers.get('content-type'), 'image/png');
  await res.body?.cancel();
});

Deno.test('the header stays at the top of the window, and what scrolls to a box stops below it', () => {
  const css = read('front/style.css');
  const rule = (selector: string) => {
    const at = css.indexOf(`\n${selector} {`);
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
  };
  match(rule('header.top'), /position: sticky;/);
  match(rule('header.top'), /top: 0;/);
  match(rule('header.top'), /background: #fff;/); // the page does not show through it
  match(rule('html'), /scroll-padding-top: \d/);
});

Deno.test("the scorecard's save line in the header is its first words, the rest left to the tooltip", () => {
  assertEquals(
    shortStatus('Unsaved changes; round 1 is saved once both sides are scored'),
    'Unsaved changes',
  );
  assertEquals(shortStatus('Unsaved changes'), 'Unsaved changes');
  assertEquals(
    shortStatus('Progress saved; round 3 is saved once both sides are scored'),
    'Progress saved',
  );
  assertEquals(shortStatus('Not saved: the server is not answering'), 'Not saved');
  assertEquals(shortStatus('Cannot be saved: round 2 is half scored'), 'Cannot be saved');
  assertEquals(shortStatus('Finalised'), 'Finalised');
  assertEquals(shortStatus(''), '');
});

Deno.test("a scorecard's marquee shows the fighter as they stand until the first save takes the snapshot, then the snapshot", () => {
  const fighter = {
    id: 7,
    first_name: 'Denzel',
    last_name: 'Bentley',
    nickname: null,
    colors: 'Olive/Black',
    weight: 159.6,
    weight_unit: 'lbs',
    won: 21,
    lost: 3,
    draws: 1,
    nc: 0,
    kos: 17,
  } as Fighter;
  const unsaved = {
    a_won: null,
    a_weight: null,
    a_weight_unit: null,
    a_colors: null,
    b_won: null,
    is_draft: 1,
    card: { result: null },
  } as unknown as BoutView;
  deepStrictEqual(standingOnTheNight(unsaved, 'a', fighter), {
    record: '21-3-1 (17 KOs)',
    weight: '159.6 lbs',
    colours: 'Olive/Black',
  });
  // Once taken, the snapshot, even where it differs from the fighter now.
  const saved = {
    a_won: 20,
    a_lost: 3,
    a_draws: 1,
    a_nc: 0,
    a_kos: 16,
    a_weight: 160,
    a_weight_unit: 'lbs',
    a_colors: null,
  } as BoutView;
  deepStrictEqual(standingOnTheNight(saved, 'a', fighter), {
    record: '20-3-1 (16 KOs)',
    weight: '160 lbs',
    colours: null,
  });
  // A finalised bout with no snapshot (an import) already counts in the
  // fighter's record; the first save takes it off, and so does the marquee.
  const imported = {
    ...unsaved,
    is_draft: 0,
    card: { result: { decision_type: 'KO', winner: 'A', round: 3, time: '1:10' } },
  } as unknown as BoutView;
  assertEquals(standingOnTheNight(imported, 'a', fighter).record, '20-3-1 (16 KOs)');
  assertEquals(
    standingOnTheNight(imported, 'b', { ...fighter, lost: 4 }).record,
    '21-3-1 (17 KOs)',
  );
  // A draft has nothing counted yet.
  const draft = { ...imported, is_draft: 1 } as unknown as BoutView;
  assertEquals(standingOnTheNight(draft, 'a', fighter).record, '21-3-1 (17 KOs)');

  // No fighter loaded and no snapshot: nothing to show.
  deepStrictEqual(standingOnTheNight(unsaved, 'a', undefined), {
    record: null,
    weight: '',
    colours: null,
  });
});

Deno.test('the scorecard names the titles fought for under the class, or nothing', () => {
  const titles = new Map<number, Title>([
    [1, { id: 1, sanctioning_body: 'WBC', area: 'World', interim: 0 } as Title],
    [2, { id: 2, sanctioning_body: 'IBF', area: 'World', interim: 0 } as Title],
  ]);
  const fought = (ids: number[]) =>
    ({ titles: ids.map((title_id) => ({ title_id, holder_side: null })) }) as unknown as BoutView;
  assertEquals(titlesAtStake(fought([]), titles), '');
  assertEquals(titlesAtStake(fought([1]), titles), 'WBC World title');
  assertEquals(titlesAtStake(fought([1, 2]), titles), 'WBC World · IBF World titles');
});

Deno.test('My card says nothing for a draft holding only a round under way, and counts its deduction once rounds are scored', () => {
  const kd = { round_no: 2, side: 'B', points: 1, reason: 'knockdown', note: null };
  const draft = (
    rounds: { round_no: number; a: number; b: number }[],
    totals: { a: number; b: number },
  ) =>
    ({
      scheduled_rounds: 12,
      card: {
        rounds,
        deductions: [{ ...kd, round_no: rounds.at(-1)!.round_no }],
        result: null,
        is_draft: true,
        totals,
      },
    }) as unknown as BoutView;
  assertEquals(myCardFor(draft([{ round_no: 1, a: 0, b: 0 }], { a: 0, b: -1 }), 'A'), '');
  assertEquals(
    myCardFor(
      draft([{ round_no: 1, a: 10, b: 9 }, { round_no: 2, a: 0, b: 0 }], { a: 10, b: 8 }),
      'A',
    ),
    '10–8',
  );
});

Deno.test('a venue reads as the design sets it: the city large, the venue, region and country under it', () => {
  const vegas = { id: 1, name: 'T-Mobile Arena', city: 'Las Vegas', region: 'NV', country: 'USA' };
  const london = { id: 2, name: 'O2 Arena', city: 'London', region: null, country: 'UK' };
  deepStrictEqual(placeLines(vegas), { city: 'Las Vegas', venue: 'T-Mobile Arena · NV, USA' });
  deepStrictEqual(placeLines(london), { city: 'London', venue: 'O2 Arena · UK' });
  assertEquals(venueText(vegas), 'T-Mobile Arena, Las Vegas, NV, USA');
  assertEquals(venueText(london), 'O2 Arena, London, UK');
  // A location the migration could not split: its name large, nothing twice.
  const unsplit = { id: 3, name: 'Riyadh', city: '', region: null, country: '' };
  deepStrictEqual(placeLines(unsplit), { city: 'Riyadh', venue: '' });
  assertEquals(venueText(unsplit), 'Riyadh');
});
