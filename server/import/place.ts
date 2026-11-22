// A location string from v1 or the sheet, read as a venue (IMPORT.md,
// "Places"; D117, D129). Split at the separators as migration 007 split the
// locations typed before it: the first part the venue, the last the country,
// the one before it the city and anything between the region. Erez wrote
// American places the American way, ending with the state and no country,
// so a last part that is a US state code is the region and the country is
// USA (D129). A location that does not give a venue, a city and a country
// is refused, never guessed.
//
// Pure: no I/O.

export type Place = { name: string; city: string; region: string | null; country: string };

const US_STATES = new Set(
  ('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ ' +
    'NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC').split(' '),
);

// `separators` is ',' for v1 and ',.' for the sheet, which used both.
export function placeFromLocation(
  location: string,
  separators = ',',
): Place | { problem: string } {
  const parts = location.split(new RegExp(`[${separators}]`)).map((p) => p.trim()).filter(Boolean);
  const last = parts.at(-1) ?? '';
  const state = US_STATES.has(last.toUpperCase()) ? last.toUpperCase() : null;
  // Venue, city and country; or venue, city and a state, which names the country.
  if (parts.length < 3) {
    return { problem: `location "${location}" does not give a venue, a city and a country` };
  }
  if (state) {
    return {
      name: parts.slice(0, -2).join(', '),
      city: parts.at(-2)!,
      region: state,
      country: 'USA',
    };
  }
  // Three parts: venue, city, country. Four: a region between. More: the
  // extra stays in the venue's name, as migration 007 kept it.
  if (parts.length === 3) {
    return { name: parts[0], city: parts[1], region: null, country: parts[2] };
  }
  return {
    name: parts.slice(0, -3).join(', '),
    city: parts.at(-3)!,
    region: parts.at(-2)!,
    country: last,
  };
}
