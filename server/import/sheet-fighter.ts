// A fighter's row of the Numbers sheet: the name and what Erez wrote beside
// it, the record on the night and the weight (IMPORT.md, Source A; task 11).
// Each cell is read as one of the shapes the sheet really uses, or refused;
// nothing is guessed.
//
// Pure: no I/O.
import type { FightRecord } from '../rules/records.ts';
import { convertToPounds, parseStoneLbsOz, type WeightUnit } from '../rules/weight.ts';

export type SheetName = {
  name: string; // the fighter, with nothing beside it
  champion: boolean; // `(c)`: came in holding what the bout is for
  bodies: string[]; // `(WBC/WBA)`: the bodies whose belt they came in holding
};

// `Hamzah Sheeraz (c)`, `Canelo Alvarez (WBC/WBA/WBO) #1`, `Jack Cattarall
// #5`, `George Kambosos Jr. (8)`. `(c)` marks the champion; a bracket of
// letters names the bodies whose belts the fighter held; `#5` and a
// bracketed number are a ranking, which the sheet's import does not keep.
export function sheetName(raw: string): SheetName {
  let champion = false;
  const bodies: string[] = [];
  const name = raw
    .replace(/\(([^)]*)\)/g, (_, inside: string) => {
      const text = inside.trim();
      if (text.toLowerCase() === 'c') champion = true;
      else if (!/^\d+$/.test(text)) {
        bodies.push(...text.split('/').map((b) => b.trim().toUpperCase()).filter(Boolean));
      }
      return ' ';
    })
    .replace(/#\s*\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { name, champion, bodies };
}

// A new fighter's name in the two boxes the app keeps: the first word, and
// the rest ("Oscar" / "De La Hoya"). A name of one word is a last name.
export function splitName(name: string): { first_name: string; last_name: string } {
  const at = name.indexOf(' ');
  return at === -1
    ? { first_name: '', last_name: name }
    : { first_name: name.slice(0, at), last_name: name.slice(at + 1) };
}

// `14(11)-2-0`: won, of them by knockout, lost, drawn, and a fourth number
// for no-contests. The draws may be left out (`16(8)-1`), and so may the
// knockouts, which is how the sheet writes none (`0-0-0`, `1-0-0`).
export function sheetRecord(text: string): FightRecord | { problem: string } {
  const m = text.trim().match(/^(\d+)(?:\((\d+)\))?-(\d+)(?:-(\d+))?(?:-(\d+))?$/);
  if (!m) return { problem: `record "${text}" is not W(KO)-L-D` };
  const record = {
    won: Number(m[1]),
    kos: Number(m[2] ?? 0),
    lost: Number(m[3]),
    draws: Number(m[4] ?? 0),
    nc: Number(m[5] ?? 0),
  };
  if (record.kos > record.won) return { problem: `record "${text}" has more knockouts than wins` };
  return record;
}

export type SheetWeight = { pounds: number; unit: WeightUnit };

const round2 = (n: number) => Math.round(n * 100) / 100;

// `125.4lbs`, `72kg`, `14st 4lbs`, `10st 12lbs 8oz`, `18st 6oz`, `16st`,
// with the sheet's slips of the keyboard for the unit (`lb`, `lba`, `ox`).
// Stored in pounds with the unit it was written in (D36). An empty cell is
// no weight; anything else is refused.
export function sheetWeight(text: string): SheetWeight | null | { problem: string } {
  const t = text.trim().toLowerCase();
  if (t === '') return null;
  const problem = { problem: `weight "${text}" is not pounds, kilograms or stone` };
  const number = '(\\d+(?:\\.\\d*)?)';
  const kg = t.match(new RegExp(`^${number}\\s*kg$`));
  if (kg) return { pounds: convertToPounds(Number(kg[1]), 'kg'), unit: 'kg' };
  const lbs = t.match(new RegExp(`^${number}\\s*lb[a-z]?$`));
  if (lbs) return { pounds: round2(Number(lbs[1])), unit: 'lbs' };
  const st = t.match(
    new RegExp(`^(\\d+)\\s*st(?:\\s+${number}\\s*lb[a-z]?)?(?:\\s+${number}\\s*o[a-z])?$`),
  );
  if (!st) return problem;
  const pounds = parseStoneLbsOz(`${st[1]} ${st[2] ?? 0} ${st[3] ?? 0}`);
  return pounds === null ? problem : { pounds: round2(pounds), unit: 'st' };
}
