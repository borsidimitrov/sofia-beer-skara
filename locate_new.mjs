
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync('data.js', 'utf8') +
  '\n;globalThis.__places=RESTAURANTS;globalThis.__addresses=ADDRESSES;',
  context
);
vm.runInContext(
  fs.readFileSync('locations.js', 'utf8') +
  '\n;globalThis.__pins=VERIFIED_LOCATIONS;',
  context
);

const places = context.__places;
const addresses = context.__addresses;
const pins = JSON.parse(JSON.stringify(context.__pins));

const normalize = value => String(value || '')
  .toLocaleLowerCase('bg')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[„“"'.,()]/g, ' ')
  .replace(/\b(улица|ул|булевард|бул|площад|пл)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const number = value =>
  (String(value || '').match(/\d+\s*[а-яa-z]?/i) || [''])[0]
    .replace(/\s+/g, '')
    .toLowerCase();

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function search(query) {
  const url = 'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      limit: '10',
      countrycodes: 'bg',
      q: query
    });

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SofiaBeerSkara/1.0 (community restaurant map)',
      'Accept-Language': 'bg,en'
    }
  });

  if (!response.ok) throw Error('HTTP ' + response.status);
  return response.json();
}

function acceptable(candidate, address) {
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lon);
  const details = candidate.address || {};

  if (!(lat > 42.55 && lat < 42.85 &&
        lng > 23.1 && lng < 23.6)) return false;

  const requestedNumber = number(address);
  const returnedNumber = number(details.house_number);

  if (!requestedNumber || requestedNumber !== returnedNumber) return false;

  const road = normalize(
    details.road || details.pedestrian ||
    details.residential || details.street || ''
  );

  const requestedStreet = normalize(address.split(',')[0])
    .replace(/\d+\s*[а-яa-z]?/gi, '')
    .trim();

  if (!road || !requestedStreet) return false;

  const roadWords = road.split(' ').filter(x => x.length >= 3);
  const requestedWords = requestedStreet.split(' ');

  return roadWords.length > 0 &&
    roadWords.every(word => requestedWords.includes(word));
}

let added = 0;

for (const restaurant of places) {
  if (pins[restaurant.id]) continue;

  const address = addresses[restaurant.name];
  if (!address) {
    console.log('NO ADDRESS', restaurant.id, restaurant.name);
    continue;
  }

  const variants = [
    address,
    address.replace(/,\s*София.*$/i, '') + ', Sofia, Bulgaria',
    address.replace(/,\s*София.*$/i, '') + ', България'
  ];

  let match = null;

  for (const query of [...new Set(variants)]) {
    try {
      const candidates = await search(query);
      match = candidates.find(c => acceptable(c, address));

      if (match) break;
    } catch (error) {
      console.log('LOOKUP ERROR', restaurant.name, error.message);
    }

    await pause(1200);
  }

  if (match) {
    pins[restaurant.id] = {
      lat: Number(match.lat),
      lng: Number(match.lon),
      precision: 'address'
    };
    added++;
    console.log('MATCH', restaurant.id, restaurant.name, match.display_name);
  } else {
    console.log('UNRESOLVED', restaurant.id, restaurant.name, address);
  }
}

fs.writeFileSync(
  'locations.js',
  '// Published restaurant locations; address matches are approximate.\n' +
  'const VERIFIED_LOCATIONS = ' + JSON.stringify(pins, null, 2) + ';\n'
);

console.log(
  'New locations:', added,
  'Total located:', Object.keys(pins).length,
  'of', places.length
);
