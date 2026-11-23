// The `Category/Title` cell of the Numbers sheet (IMPORT.md, Source A; task
// 11): what a bout was fought at, and for. It is one of
//   - a weight class (`Heavyweight`, `Junior Lightweight`, `W Featherweight`);
//   - a contracted weight (`Catchweight (150)`, `179lbs catchweight`; D26);
//   - a title line (`WBO/WBA/IBF/WBC World Super Middleweight Championship`,
//     `Vacant WBO Intercontinental Lightweight Title`): the class, and the
//     belts before it;
//   - an eliminator or a tournament bout, which is for no title and is read
//     as its class alone.
// Anything else is refused.
//
// Pure: no I/O.
import { beltSpelling, SHEET_BELTS } from './sheet-belts.ts';
import { sheetWeight } from './sheet-fighter.ts';

export type SheetBelt = { body: string; area: string; interim: boolean; vacant: boolean };

export type SheetCategory = {
  class_name: string | null; // one of the app's 18, by its name
  contracted_weight: number | null; // pounds, when there is no class (D26, D45)
  belts: SheetBelt[];
};

// The app's classes as the sheet names them: its own names, the "Junior"
// names, and the older names of four of them.
const CLASSES: Record<string, string> = {
  'atomweight': 'Atomweight',
  'minimumweight': 'Minimumweight',
  'strawweight': 'Minimumweight',
  'mini flyweight': 'Minimumweight',
  'light flyweight': 'Light Flyweight',
  'junior flyweight': 'Light Flyweight',
  'flyweight': 'Flyweight',
  'super flyweight': 'Super Flyweight',
  'junior bantamweight': 'Super Flyweight',
  'bantamweight': 'Bantamweight',
  'super bantamweight': 'Super Bantamweight',
  'junior featherweight': 'Super Bantamweight',
  'featherweight': 'Featherweight',
  'super featherweight': 'Super Featherweight',
  'junior lightweight': 'Super Featherweight',
  'lightweight': 'Lightweight',
  'super lightweight': 'Super Lightweight',
  'junior welterweight': 'Super Lightweight',
  'light welterweight': 'Super Lightweight',
  'welterweight': 'Welterweight',
  'super welterweight': 'Super Welterweight',
  'junior middleweight': 'Super Welterweight',
  'light middleweight': 'Super Welterweight',
  'middleweight': 'Middleweight',
  'super middleweight': 'Super Middleweight',
  'light heavyweight': 'Light Heavyweight',
  'cruiserweight': 'Cruiserweight',
  'junior heavyweight': 'Cruiserweight',
  'heavyweight': 'Heavyweight',
};

// A class anywhere in a line: an optional Super, Junior, Light or Mini, then
// the weight. `Super-Welterweight` and `Lightweights` are the sheet's.
const CLASS_IN_LINE =
  /\b(?:(?:super|junior|jr\.?|light|mini)[ -])?(?:atom|minimum|straw|fly|bantam|feather|light|welter|middle|heavy|cruiser)weights?\b/i;

const className = (text: string): string | null =>
  CLASSES[
    text.toLowerCase().replace(/-/g, ' ').replace(/\bjr\.?/, 'junior').replace(/s$/, '')
      .replace(/\s+/g, ' ').trim()
  ] ?? null;

const none = { class_name: null, contracted_weight: null, belts: [] };

export function sheetCategory(cell: string): SheetCategory | { problem: string } {
  const text = cell.trim();
  if (text === '') return { problem: 'no category or title above the two fighters' };

  // A contracted weight: the word with a number, or a weight alone. A bare
  // number is pounds.
  if (/catchweight/i.test(text) || /^\d/.test(text)) {
    const figure = text.replace(/catchweight/i, '').replace(/[()]/g, ' ').trim();
    const weight = sheetWeight(/^\d+(\.\d+)?$/.test(figure) ? `${figure}lbs` : figure);
    if (weight === null || 'problem' in weight) {
      return { problem: `"${text}" gives no weight the bout was made at` };
    }
    return { ...none, contracted_weight: weight.pounds };
  }

  const found = text.match(CLASS_IN_LINE);
  const class_name = found ? className(found[0]) : null;
  if (!found || class_name === null) return { problem: `"${text}" names no weight class` };
  // The women's bouts are marked `W` before the class; the class is the same.
  const head = text.slice(0, found.index).trim().replace(/\s+W$/, '').replace(/^W$/, '');
  const tail = text.slice(found.index! + found[0].length).trim().toLowerCase().replace(/\.$/, '');
  if (head === '' && tail === '') return { ...none, class_name };

  // For no title: an eliminator, or a tournament's bout.
  if (/^(world )?(title )?eliminat\w*$/.test(tail) || /^tournament\b/.test(tail)) {
    return { ...none, class_name };
  }
  const title = tail.match(/^(world )?(championship|champtionship|champion|titles?)$/);
  if (!title || head === '') return { problem: `"${text}" is not a class or a title line` };

  // The belts, in the order written. `Commonwealth/Vacant British`: each
  // says for itself whether it is vacant or interim.
  const parts = head.split(/\/|\.\s|\s&\s|,\s/).map((p) => p.trim()).filter(Boolean);
  const named = parts.map((part) => ({
    part,
    name: SHEET_BELTS[beltSpelling(part)],
    interim: /\binterim\b/i.test(part),
    vacant: /\bvacant\b/i.test(part),
  }));
  const unknown = named.find((n) => !n.name);
  if (unknown) {
    return { problem: `"${unknown.part}" is not a belt the import knows (sheet-belts.ts)` };
  }

  const belts: SheetBelt[] = [];
  for (const [i, n] of named.entries()) {
    // A body alone takes the area of the next belt that has one, then the
    // line's own "World". Only a body that can stand alone lends its area:
    // `WBA/Commonwealth` does not make a WBA Commonwealth title.
    // nor does `WBA/NABF`, which is the WBC's, make a WBA NABF one: the
    // lender is written as a world body and its area (`WBC World`).
    const lender = named.slice(i + 1).find((later) =>
      later.name.area !== null && SHEET_BELTS[later.name.body.toLowerCase()]?.area === null &&
      beltSpelling(later.part).startsWith(`${later.name.body.toLowerCase()} `)
    );
    const area = n.name.area ?? lender?.name.area ?? (title[1] ? 'World' : null);
    if (area === null) return { problem: `"${text}" does not say which ${n.name.body} title` };
    const same = (b: SheetBelt) =>
      b.body === n.name.body && b.area === area && b.interim === n.interim;
    if (!belts.some(same)) {
      belts.push({ body: n.name.body, area, interim: n.interim, vacant: n.vacant });
    }
  }
  return { class_name, contracted_weight: null, belts };
}
