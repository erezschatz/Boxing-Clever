// Tier 1: a location string read as a venue (IMPORT.md "Places", D117, D129).
import { deepStrictEqual, ok } from 'node:assert/strict';
import { placeFromLocation } from '../../server/import/place.ts';

Deno.test('a location is venue, city and country, with a region between when there are four parts', () => {
  deepStrictEqual(placeFromLocation('O2 Arena, London, UK'), {
    name: 'O2 Arena',
    city: 'London',
    region: null,
    country: 'UK',
  });
  deepStrictEqual(
    placeFromLocation(' Gold Coast Convention Centre, Broadbeach, Queensland, Australia'),
    {
      name: 'Gold Coast Convention Centre',
      city: 'Broadbeach',
      region: 'Queensland',
      country: 'Australia',
    },
  );
  // More than four: the extra stays in the venue's name, as migration 007 kept it.
  deepStrictEqual(placeFromLocation('Hall 3, NEC, Birmingham, West Midlands, UK'), {
    name: 'Hall 3, NEC',
    city: 'Birmingham',
    region: 'West Midlands',
    country: 'UK',
  });
});

Deno.test('D129: a location ending in a US state is in the USA, however the state is cased', () => {
  const vegas = { name: 'T-Mobile Arena', city: 'Las Vegas', region: 'NV', country: 'USA' };
  deepStrictEqual(placeFromLocation('T-Mobile Arena, Las Vegas, NV'), vegas);
  deepStrictEqual(placeFromLocation('T-Mobile Arena, Las Vegas, Nv'), vegas);
  deepStrictEqual(placeFromLocation('The Theatre, MSG, New York, NY'), {
    name: 'The Theatre, MSG',
    city: 'New York',
    region: 'NY',
    country: 'USA',
  });
  // A two-letter last part that is no state is a country as written.
  deepStrictEqual(placeFromLocation('O2 Arena, London, UK'), {
    name: 'O2 Arena',
    city: 'London',
    region: null,
    country: 'UK',
  });
});

Deno.test('a location with no venue, city and country is refused, not guessed', () => {
  for (
    const location of ['Utilita Arena Newcastle, England', 'Las Vegas, NV', 'London', '', ' , ,']
  ) {
    ok('problem' in placeFromLocation(location), location);
  }
});

Deno.test('the sheet separates with full stops as well as commas', () => {
  deepStrictEqual(placeFromLocation('Honda Center. Anaheim. CA', ',.'), {
    name: 'Honda Center',
    city: 'Anaheim',
    region: 'CA',
    country: 'USA',
  });
  ok('problem' in placeFromLocation('Honda Center. Anaheim. CA'));
});
