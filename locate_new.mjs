
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});

vm.runInContext(
  fs.readFileSync('locations.js', 'utf8') +
  '\n;globalThis.pins=VERIFIED_LOCATIONS;',
  context
);

const pins = JSON.parse(JSON.stringify(context.pins));

const fixes = [
  {
    id: 18,
    name: 'Бирария Стамболовъ',
    street: 'Свети Наум',
    number: 1,
    address: 'бул. Свети Наум 1, Лозенец, София',
    bounds: [42.65, 42.70, 23.29, 23.36]
  },
  {
    id: 29,
    name: 'Царевеца',
    street: 'Цар Иван Асен',
    number: 32,
    address: 'ул. Цар Иван Асен II 32, Яворов, София',
    bounds: [42.67, 42.71, 23.32, 23.38]
  },
  {
    id: 33,
    name: 'Скара при Гелето',
    street: 'Брегалница',
    number: 63,
    address: 'ул. Брегалница 63, София',
    bounds: [42.68, 42.73, 23.27, 23.33]
  },
  {
    id: 35,
    name: 'Бирария При Миле',
    street: 'Столетов',
    number: 22,
    address: 'бул. Генерал Николай Столетов 22, Банишора, София',
    bounds: [42.69, 42.74, 23.27, 23.34]
  },
  {
    id: 37,
    name: 'Сръбски ресторант При Братовчеда',
    street: 'Цариградско шосе',
    number: 129,
    address: 'бул. Цариградско шосе 129, Младост 1, София',
    bounds: [42.62, 42.69, 23.34, 23.44]
  },
  {
    id: 41,
    name: 'The GOAT Sports Bar',
    street: '6-ти септември',
    number: 4,
    address: 'ул. 6-ти септември 4, Център, София',
    bounds: [42.68, 42.72, 23.31, 23.36]
  },
  {
    id: 43,
    name: 'Механа Мамин Кольо 2',
    street: 'Цар Борис',
    number: 24,
    address: 'бул. Цар Борис III 24, Хиподрума, София',
    bounds: [42.65, 42.70, 23.27, 23.34]
  }
];

const normalize = text => String(text || '')
  .toLocaleLowerCase('bg')
  .replace(/[„“"'.,()]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function insideBounds(candidate, bounds) {
  const [minLat, maxLat, minLng, maxLng] = bounds;
  return candidate.lat >= minLat &&
    candidate.lat <= maxLat &&
    candidate.lng >= minLng &&
    candidate.lng <= maxLng;
}

async function geocode(query) {
  const params = new URLSearchParams({
    SingleLine: query,
    f: 'json',
    outFields: 'Match_addr,Addr_type',
    maxLocations: '15',
    countryCode: 'BGR'
  });

  const url =
    'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?' +
    params;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'SofiaBeerSkara/1.0' }
  });

  if (!response.ok) {
    throw Error('Geocoding HTTP ' + response.status);
  }

  const data = await response.json();

  return (data.candidates || []).map(c => ({
    lat: Number(c.location?.y),
    lng: Number(c.location?.x),
    label: c.address || '',
    score: Number(c.score || 0),
    type: c.attributes?.Addr_type || ''
  }));
}

function selectBest(candidates, place) {
  const expected = normalize(place.street)
    .replace(/^(ул|бул|улица|булевард)\s+/, '');

  const words = expected.split(' ')
    .filter(w => w.length >= 3);

  return candidates
    .filter(c => insideBounds(c, place.bounds))
    .map(c => {
      const label = normalize(c.label);
      const streetMatches =
        words.filter(w => label.includes(w)).length;

      const streetOK =
        streetMatches >= Math.max(
          1,
          Math.ceil(words.length * 0.65)
        );

      const numberPattern = new RegExp(
        '(^|\\s)' + place.number + '([а-яa-z]?)(\\s|,|$)',
        'i'
      );

      const numberOK = numberPattern.test(label);

      return {
        ...c,
        streetOK,
        numberOK,
        rank: c.score +
          (streetOK ? 35 : -100) +
          (numberOK ? 55 : -20)
      };
    })
    .filter(c => c.streetOK && c.numberOK)
    .sort((a, b) => b.rank - a.rank)[0] || null;
}

let corrected = 0;
let added = 0;
let failed = 0;

for (const place of fixes) {
  console.log('\nSEARCHING', place.id, place.name);

  try {
    const queries = [
      place.address + ', България',
      place.street + ' ' + place.number + ', София, България'
    ];

    let found = null;

    for (const query of queries) {
      const candidates = await geocode(query);
      found = selectBest(candidates, place);

      if (found) break;
      await sleep(1200);
    }

    if (!found) {
      console.log(
        'NOT MATCHED - needs review:',
        place.id,
        place.address
      );
      failed++;
      continue;
    }

    const existing = Boolean(pins[place.id]);

    pins[place.id] = {
      lat: found.lat,
      lng: found.lng,
      precision: 'address'
    };

    if (existing) corrected++;
    else added++;

    console.log(
      'SUCCESS',
      place.id,
      place.name,
      found.lat,
      found.lng,
      found.label
    );
  } catch (error) {
    console.log('ERROR', place.id, error.message);
    failed++;
  }

  await sleep(1200);
}

fs.writeFileSync(
  'locations.js',
  '// Restaurant map coordinates.\n' +
  'const VERIFIED_LOCATIONS = ' +
  JSON.stringify(pins, null, 2) +
  ';\n'
);

console.log('\n======= FINAL RESULTS =======');
console.log('Corrected:', corrected);
console.log('New pins:', added);
console.log('Not matched:', failed);
console.log('Total pins:', Object.keys(pins).length);
console.log('=============================');

