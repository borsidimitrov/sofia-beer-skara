

import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});

vm.runInContext(
  fs.readFileSync('data.js', 'utf8') +
  '\n;globalThis.places=RESTAURANTS;globalThis.addresses=ADDRESSES;',
  context
);

vm.runInContext(
  fs.readFileSync('locations.js', 'utf8') +
  '\n;globalThis.pins=VERIFIED_LOCATIONS;',
  context
);

const places = context.places;
const addresses = context.addresses;
const pins = JSON.parse(JSON.stringify(context.pins));

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

const normalize = value => String(value || '')
  .toLocaleLowerCase('bg')
  .replace(/[„“"'.,()]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const insideSofia = (lat, lng) =>
  lat > 42.58 && lat < 42.77 &&
  lng > 23.19 && lng < 23.49;

const houseNumber = address => {
  const part = String(address).split(',')[0];
  const match = part.match(/\b\d+\s*[А-Яа-яA-Za-z]?\b/);
  return match ? normalize(match[0]).replace(/\s/g, '') : '';
};

const roadName = address =>
  String(address || '')
    .split(',')[0]
    .replace(/\d+\s*[А-Яа-яA-Za-z]?\s*$/, '')
    .trim();

const distance = (a, b) => {
  const x = (a.lat - b.lat) * 111000;
  const y = (a.lng - b.lng) * 82000;
  return Math.sqrt(x * x + y * y);
};

const requestJSON = async (url, headers = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SofiaBeerSkara/1.0',
        ...headers
      }
    });

    if (!response.ok) throw Error('HTTP ' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

// First choice: ArcGIS address geocoder.
// Unlike our previous approach, it can estimate a
// building position even without an exact OSM match.
async function arcgis(query) {
  const url =
    'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?';

  // Use the public ArcGIS World Geocoding endpoint.
  const publicUrl =
    'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';

  const params = new URLSearchParams({
    SingleLine: query,
    f: 'json',
    outFields: 'Match_addr,Addr_type,PlaceName',
    maxLocations: '8',
    searchExtent: '23.19,42.58,23.49,42.77'
  });

  const alternate =
    'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?' +
    params;

  const legacy =
    'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?' +
    params;

  let data;
  try {
    data = await requestJSON(alternate);
    if (data.error || !data.candidates) throw Error('ArcGIS unavailable');
  } catch {
    data = await requestJSON(legacy);
  }

  return (data.candidates || [])
    .map(c => ({
      lat: Number(c.location?.y),
      lng: Number(c.location?.x),
      score: Number(c.score || 0),
      label: c.address || '',
      type: c.attributes?.Addr_type || '',
      source: 'ArcGIS'
    }))
    .filter(c => insideSofia(c.lat, c.lng));
}

// Second choice: OpenStreetMap's Nominatim.
async function nominatim(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '10',
    countrycodes: 'bg',
    viewbox: '23.19,42.77,23.49,42.58',
    bounded: '1'
  });

  const data = await requestJSON(
    'https://nominatim.openstreetmap.org/search?' + params,
    { 'Accept-Language': 'bg,en' }
  );

  return data.map(c => ({
    lat: Number(c.lat),
    lng: Number(c.lon),
    score: c.address?.house_number ? 95 : 65,
    label: c.display_name || '',
    type: c.type || '',
    source: 'OpenStreetMap',
    details: c.address || {}
  })).filter(c => insideSofia(c.lat, c.lng));
}

// Third choice: Photon, another OpenStreetMap search service.
async function photon(query) {
  const params = new URLSearchParams({
    q: query,
    lat: '42.6977',
    lon: '23.3219',
    limit: '10',
    lang: 'en'
  });

  const data = await requestJSON(
    'https://photon.komoot.io/api/?' + params
  );

  return (data.features || []).map(f => ({
    lat: Number(f.geometry?.coordinates?.[1]),
    lng: Number(f.geometry?.coordinates?.[0]),
    score: f.properties?.housenumber ? 90 : 60,
    label: [
      f.properties?.name,
      f.properties?.street,
      f.properties?.housenumber,
      f.properties?.city
    ].filter(Boolean).join(', '),
    type: f.properties?.type || '',
    source: 'Photon',
    details: f.properties || {}
  })).filter(c => insideSofia(c.lat, c.lng));
}

async function lookup(query) {
  const results = [];

  for (const [name, service] of [
    ['ArcGIS', arcgis],
    ['Nominatim', nominatim],
    ['Photon', photon]
  ]) {
    try {
      results.push(...await service(query));
    } catch (error) {
      console.log(name + ' error:', error.message);
    }

    await sleep(1100);
  }

  return results;
}

function chooseAddress(results, address) {
  const wantedRoad = normalize(roadName(address))
    .replace(/^(ул|бул|булевард|улица|пл)\s+/, '');

  const words = wantedRoad.split(' ')
    .filter(w => w.length >= 3);

  const wantedNumber = houseNumber(address);

  const ranked = results.map(c => {
    const label = normalize(c.label);
    let score = c.score;

    const matchingWords =
      words.filter(w => label.includes(w)).length;

    const roadMatch =
      words.length > 0 &&
      matchingWords >= Math.max(1, Math.ceil(words.length * 0.65));

    if (roadMatch) score += 35;
    else score -= 55;

    const foundNumber = houseNumber(c.label);

    if (wantedNumber && foundNumber === wantedNumber) {
      score += 65;
    } else if (wantedNumber && foundNumber) {
      // A nearby house number is better than a distant one.
      const a = parseInt(wantedNumber, 10);
      const b = parseInt(foundNumber, 10);

      if (Number.isFinite(a) && Number.isFinite(b)) {
        score += Math.max(-20, 20 - Math.abs(a - b) * 3);
      }
    }

    // Avoid selecting the centre of a very long road.
    if (/street|road|residential|highway/i.test(c.type)) {
      score -= 15;
    }

    return { ...c, rank: score, roadMatch };
  });

  ranked.sort((a, b) => b.rank - a.rank);

  // Require the correct street, not just any Sofia result.
  return ranked.find(c => c.roadMatch && c.rank >= 65) || null;
}

function chooseRestaurant(results, restaurant) {
  const name = normalize(restaurant.name)
    .replace(/[^а-яa-z0-9 ]/gi, ' ')
    .trim();

  const words = name.split(' ').filter(w => w.length >= 4);

  return results
    .map(c => {
      const label = normalize(c.label);
      const matches = words.filter(w => label.includes(w)).length;

      return {
        ...c,
        rank: c.score + matches * 25,
        matches
      };
    })
    .filter(c => c.matches >= Math.max(1, Math.ceil(words.length / 2)))
    .sort((a, b) => b.rank - a.rank)[0] || null;
}

// The old pin for Mamin Kolio 2 was found in Buxton.
// Search again rather than keeping that incorrect street pin.
const replaceIds = new Set([43]);

let added = 0;
let corrected = 0;
let unresolved = 0;

for (const restaurant of places) {
  const id = restaurant.id;

  if (pins[id] && !replaceIds.has(id)) continue;

  const address = addresses[restaurant.name];
  let match = null;

  console.log('\nSEARCHING', id, restaurant.name);

  if (address) {
    const queries = [
      address + ', България',
      restaurant.name + ', ' + address + ', България',
      roadName(address) + ', София, България'
    ];

    for (const query of queries) {
      const results = await lookup(query);
      match = chooseAddress(results, address);

      if (match) break;
    }
  } else {
    // No address? Try the restaurant's name instead.
    const results = await lookup(
      restaurant.name + ', София, България'
    );

    match = chooseRestaurant(results, restaurant);
  }

  if (match) {
    const wasExisting = Boolean(pins[id]);

    pins[id] = {
      lat: match.lat,
      lng: match.lng,
      precision: 'address'
    };

    if (wasExisting) corrected++;
    else added++;

    console.log(
      'PIN',
      id,
      restaurant.name,
      match.lat,
      match.lng,
      match.source,
      match.label
    );
  } else {
    unresolved++;

    console.log(
      'UNRESOLVED',
      id,
      restaurant.name,
      address || '(no saved address)'
    );
  }
}

// Publish coordinates without changing how the pins look.
fs.writeFileSync(
  'locations.js',
  '// Restaurant map coordinates.\n' +
  'const VERIFIED_LOCATIONS = ' +
  JSON.stringify(pins, null, 2) +
  ';\n'
);

console.log('\n========== RESULTS ==========');
console.log('New pins:', added);
console.log('Corrected pins:', corrected);
console.log('Still unresolved:', unresolved);
console.log('Total mapped:', Object.keys(pins).filter(id =>
  places.some(p => p.id === Number(id))
).length, 'of', places.length);
console.log('=============================');
