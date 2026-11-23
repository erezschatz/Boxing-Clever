// The belts of the Numbers sheet's title lines (task 11's decisions): each
// way the sheet spells one, as the sanctioning body and area this app keeps
// a title under. A spelling is the words before the weight class, lower
// case, hyphens and full stops read as spaces, and "vacant", "interim" and
// the women's "W" taken out, since those are said separately.
//
// A body alone (`wbc`) has no area here: it takes the area of the belt
// written after it on the line (`WBO/WBA/IBF/WBC World`), or "World" when
// the line says world after the class. A spelling that is not in this table
// is refused, for Erez to add here or to enter the bout by hand.
//
// Erez: this table is yours to correct. The left side is the sheet, the
// right side is what the title is filed under.
//
// Pure: no I/O.

export type BeltName = { body: string; area: string | null };

const belt = (body: string, area: string | null = null): BeltName => ({ body, area });

export const SHEET_BELTS: Record<string, BeltName> = {
  // The world bodies, alone and with an area.
  'wba': belt('WBA'),
  'wbc': belt('WBC'),
  'ibf': belt('IBF'),
  'wbo': belt('WBO'),
  'ibo': belt('IBO'),
  'iba': belt('IBA'),
  'wba world': belt('WBA', 'World'),
  'wba super world': belt('WBA', 'World'),
  'wba normal world': belt('WBA', 'World Regular'),
  'wbc world': belt('WBC', 'World'),
  'ibf world': belt('IBF', 'World'),
  'wbo world': belt('WBO', 'World'),
  'ibo world': belt('IBO', 'World'),
  'iba world': belt('IBA', 'World'),

  // WBA
  'wba continental': belt('WBA', 'Continental'),
  'wba continental americas': belt('WBA', 'Continental Americas'),
  'wba continental gold': belt('WBA', 'Continental Gold'),
  'wba continental latino': belt('WBA', 'Continental Latino'),
  'wba continental north american': belt('WBA', 'Continental North America'),
  'wba continental us': belt('WBA', 'Continental USA'),
  'wba inter continental': belt('WBA', 'Inter-Continental'),
  'wba intercontinental': belt('WBA', 'Inter-Continental'),
  'wba international': belt('WBA', 'International'),
  'wba naba': belt('WBA', 'NABA'),
  'wba oceania': belt('WBA', 'Oceania'),
  'wba pan africa': belt('WBA', 'Pan African'),

  // WBC
  'wbc continental americas': belt('WBC', 'Continental Americas'),
  'wbc diamond': belt('WBC', 'World Diamond'),
  'wbc silver': belt('WBC', 'World Silver'),
  'wbc silver world': belt('WBC', 'World Silver'),
  'wbc international': belt('WBC', 'International'),
  'wbc international silver': belt('WBC', 'International Silver'),
  'wbc latino': belt('WBC', 'Latino'),
  'wbc australian': belt('WBC', 'Australian'),
  'nabf': belt('WBC', 'NABF'),
  'junior nabf': belt('WBC', 'NABF Junior'),
  'wbc usa': belt('WBC', 'USA'),
  'wbc us': belt('WBC', 'USA'),
  'us wbc': belt('WBC', 'USA'),
  'uswbc': belt('WBC', 'USA'),
  'wbc usa silver': belt('WBC', 'USA Silver'),
  'wbc us silver': belt('WBC', 'USA Silver'),
  'wbc usnbc': belt('WBC', 'USNBC'),
  'wbc usnbc silver': belt('WBC', 'USNBC Silver'),
  'wbc us nbc silver': belt('WBC', 'USNBC Silver'),

  // IBF
  'ibf australasian': belt('IBF', 'Australasian'),
  'ibf european': belt('IBF', 'European'),
  'ibf int': belt('IBF', 'International'),
  'ibf international': belt('IBF', 'International'),
  'ibf inter continental': belt('IBF', 'Inter-Continental'),
  'ibf intercontinental': belt('IBF', 'Inter-Continental'),
  'ibf north american': belt('IBF', 'North American'),
  'ibf pan pacific': belt('IBF', 'Pan-Pacific'),
  'ibf youth': belt('IBF', 'World Youth'),
  'ibf world youth': belt('IBF', 'World Youth'),
  'usba': belt('IBF', 'USBA'),

  // WBO
  'wbo asia pacific': belt('WBO', 'Asia Pacific'),
  'wbo asia pacific youth': belt('WBO', 'Asia Pacific Youth'),
  'wbo european': belt('WBO', 'European'),
  'wbo global': belt('WBO', 'Global'),
  'wbo inter continental': belt('WBO', 'Intercontinental'),
  'wbo intercontinental': belt('WBO', 'Intercontinental'),
  'wbo international': belt('WBO', 'International'),
  'wbo latino': belt('WBO', 'Latino'),
  'latino wbo': belt('WBO', 'Latino'),
  'wbo oriental': belt('WBO', 'Oriental'),
  'nabo': belt('WBO', 'NABO'),
  'wbo nabo': belt('WBO', 'NABO'),

  // IBO, IBA
  'ibo continental': belt('IBO', 'Continental'),
  'ibo intercontinental': belt('IBO', 'Inter-Continental'),
  'ibo international': belt('IBO', 'International'),
  'ibo youth world': belt('IBO', 'World Youth'),
  'iba asia pacific': belt('IBA', 'Asia Pacific'),

  // Regional and national bodies.
  'ebu': belt('EBU', 'European'),
  'ebu european': belt('EBU', 'European'),
  'european': belt('EBU', 'European'),
  'ebp': belt('EBP', 'Eurasian'),
  'eurasian boxing parliament': belt('EBP', 'Eurasian'),
  'commonwealth': belt('CBC', 'Commonwealth'),
  'commonwealth silver': belt('CBC', 'Commonwealth Silver'),
  'british': belt('BBBOFC', 'British'),
  'english': belt('BBBOFC', 'English'),
  'southern area': belt('BBBOFC', 'Southern Area'),
  'bbbc southern area': belt('BBBOFC', 'Southern Area'),
  'central area': belt('BBBOFC', 'Central Area'),
  'oriental and pacific boxing federation': belt('OBPF', 'Asia-Pacific'),
  'wbc oriental and pacific boxing federation': belt('OBPF', 'Asia-Pacific'),
  'japan': belt('JBC', 'Japan'),
  'australian': belt('ANBF', 'Australian'),
  'queensland': belt('ANBF', 'Queensland'),
  'italian': belt('FPI', 'Italian'),
  'spanish': belt('FEB', 'Spanish'),
  'nba america': belt('NBA', 'America'),
  'nba continental americas': belt('NBA', 'Continental Americas'),
};

// A belt as written before the class, as the key of the table above.
export function beltSpelling(text: string): string {
  return text.toLowerCase().replace(/[-.]/g, ' ').split(/\s+/)
    .filter((word) => word !== '' && !['vacant', 'interim', 'w'].includes(word)).join(' ');
}
