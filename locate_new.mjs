
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});

vm.runInContext(
  fs.readFileSync('data.js', 'utf8') +
  '\n;globalThis.places=RESTAURANTS;globalThis.addresses=ADDRESSES;',
  ctx
);

vm.runInContext(
  fs.readFileSync('locations.js', 'utf8') +
  '\n;globalThis.pins=VERIFIED_LOCATIONS;',
  ctx
);

const places = ctx.places;
const addresses = ctx.addresses;
const pins = JSON.parse(JSON.stringify(ctx.pins));

const sleep = ms => new Promise(r => setTimeout(r, ms));

const clean = s => String(s || '')
  .toLocaleLowerCase('bg')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const street = address => String(address)
  .split(',')[0]
  .replace(/\b\d+\s*[А-Яа-яA-Za-z]?\b/g, '')
  .trim();

const inSofia = p =>
  Number(p.lat) > 42.58 &&
  Number(p.lat) < 42.77 &&
  Number(p.lon) > 23.19 &&
  Number(p.lon) < 23.49;

async function search(query) {
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      limit: '10',
      countrycodes: 'bg',
      q: query,
      viewbox: '23.19,42.77,23.49,42.58',
      bounded: '1'
    });

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'SofiaBeerSkara/1.0 (public hobby map)',
      'Accept-Language': 'bg,en'
    }
  });

  if (!res.ok) {
    throw new Error('HTTP ' + res.status);
  }

  return res.json();
}

let added = 0;

for (const r of places) {
  if (pins[r.id]) continue;

  const address = addresses[r.name];

  if (!address) {
    console.log('NO ADDRESS', r.id, r.name);
    continue;
  }

  const road = street(address);

  const queries = [
    address,
    road + ', София, България'
  ];

  let found = null;

  for (const query of queries) {
    try {
      const results = await search(query);

      // Accept a location on the correct street,
      // even when the exact building number is unavailable.
      const roadWords = clean(road)
        .split(' ')
        .filter(w =>
          w.length > 2 &&
          !['улица', 'булевард', 'площад'].includes(w)
        );

      found = results.find(p => {
        if (!inSofia(p)) return false;

        const named = clean([
          p.address?.road,
          p.address?.pedestrian,
          p.address?.residential,
          p.display_name
        ].filter(Boolean).join(' '));

        return roadWords.length > 0 &&
          roadWords.every(w => named.includes(w));
      });

      if (found) break;

    } catch (e) {
      console.log('LOOKUP ERROR', r.name, e.message);
    }

    await sleep(1200);
  }

  if (found) {
    pins[r.id] = {
      lat: Number(found.lat),
      lng: Number(found.lon),
      precision: 'address'
    };

    added++;

    console.log(
      'PIN',
      r.id,
      r.name,
      found.display_name
    );

  } else {
    console.log(
      'UNRESOLVED',
      r.id,
      r.name,
      address
    );
  }

  await sleep(1200);
}

fs.writeFileSync(
  'locations.js',
  '// Shared map pins. Some are approximate street-level indicators.\n' +
  'const VERIFIED_LOCATIONS = ' +
  JSON.stringify(pins, null, 2) +
  ';\n'
);

console.log(
  'New locations:', added,
  'Total located:', Object.keys(pins).length,
  'of', places.length
);
