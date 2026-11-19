// Who holds a title, as witnessed (SPEC Scoring §8). The app knows a belt
// only through the bouts watched with it on the line, so the last finalised
// one decides: its winner takes it; a draw or a no contest leaves it with
// whoever brought it in, and a vacant belt stays vacant. A side marked as
// having missed weight (D26) can neither take nor keep it: the belt goes
// vacant (Erez, 2026-11-19).
//
// Pure: imports nothing outside server/rules/.
import type { Side, Winner } from './decisions.ts';

// One title on the line in one finalised bout, in fight order (event date,
// then card order). `holder_side` is who brought it in (bout_title).
export type TitleLine = {
  title_id: number;
  holder_side: Side | 'vacant';
  winner: Winner;
  fighter_a_id: number;
  fighter_b_id: number;
  missed_weight_a: 0 | 1;
  missed_weight_b: 0 | 1;
};

// §8: the fighter a line leaves the title with, or null when it is vacant.
export function holderAfter(line: TitleLine): number | null {
  const side = line.winner === 'A' || line.winner === 'B' ? line.winner : line.holder_side;
  if (side === 'A') return line.missed_weight_a ? null : line.fighter_a_id;
  if (side === 'B') return line.missed_weight_b ? null : line.fighter_b_id;
  return null;
}

// §8: the titles `fighterId` holds after every line, in the order each was
// first seen. The lines must be in fight order; a later line for a title
// overrides an earlier one.
export function titlesHeld(fighterId: number, lines: TitleLine[]): number[] {
  const holder = new Map<number, number | null>();
  for (const line of lines) holder.set(line.title_id, holderAfter(line));
  return [...holder].filter(([, who]) => who === fighterId).map(([title]) => title);
}
