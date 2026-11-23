// SEO-1, room page part (Mos 19 Nov 2026): JSON-LD of a room. project-docs/nestyk-guest-seo-plan-20261111.md
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const seo = require('./guest-room-seo.ts');

const SITE = 'https://nestyk.com';
const room = (over = {}) => ({
  id: '31',
  title: 'Ideo Q Ari',
  propertyType: 'condo',
  projectName: 'Ideo Q Ari',
  district: 'พญาไท',
  priceFrom: 17000,
  bedrooms: 0,
  bathrooms: 1,
  areaSqm: 28.5,
  coverImageUrl: 'https://cdn.example.com/cover.jpg',
  latitude: 13.78,
  longitude: 100.544,
  nearestStation: { type: 'BTS', name: 'อารีย์', distanceMeters: 300 },
  availableFrom: '2026-12-01',
  petFriendly: false,
  shortTermAvailable: true,
  isNew: false,
  description: 'สตูดิโอใหม่ ติด BTS',
  imageUrls: ['https://cdn.example.com/1.jpg', 'https://cdn.example.com/2.jpg'],
  amenityCodes: [],
  priceOptions: [{ durationMonths: 12, pricePerMonth: 17000, depositAmount: 34000 }],
  floor: 12,
  ...over,
});
const input = (over = {}) => ({ origin: SITE, locale: 'th', path: '/rooms/31', title: 'Ideo Q Ari สตูดิโอ', homeName: 'หน้าแรก', room: room(), ...over });
const node = (data, type) => data['@graph'].find((item) => item['@type'] === type);

test('a room is a RealEstateListing with its page address, pictures and a monthly price in baht', () => {
  const data = seo.roomJsonLd(input());
  assert.equal(data['@context'], 'https://schema.org');
  const listing = node(data, 'RealEstateListing');
  assert.equal(listing.url, `${SITE}/rooms/31`);
  assert.equal(listing.name, 'Ideo Q Ari สตูดิโอ');
  assert.equal(listing.description, 'สตูดิโอใหม่ ติด BTS');
  assert.equal('inLanguage' in listing, false, "the agent's text is not translated, so no language is claimed");
  assert.deepEqual(listing.image, ['https://cdn.example.com/1.jpg', 'https://cdn.example.com/2.jpg']);
  assert.equal(listing.offers.price, 17000);
  assert.equal(listing.offers.priceCurrency, 'THB');
  assert.equal(listing.offers.priceSpecification.unitCode, 'MON');
  assert.equal(listing.offers.availabilityStarts, '2026-12-01');
  const place = listing.about;
  assert.equal(place['@type'], 'Apartment');
  assert.equal(place.numberOfBedrooms, 0);
  assert.equal(place.numberOfBathroomsTotal, 1);
  assert.deepEqual(place.floorSize, { '@type': 'QuantitativeValue', value: 28.5, unitCode: 'MTK' });
  assert.equal(place.address.addressLocality, 'พญาไท');
  assert.equal(place.address.addressCountry, 'TH');
  assert.equal(place.petsAllowed, false);
});

test('the room position is never put in JSON-LD (the page shows only a rough area)', () => {
  const text = seo.jsonLdScript(seo.roomJsonLd(input()));
  assert.doesNotMatch(text, /geo|latitude|longitude|13\.78|100\.544/);
});

test('the breadcrumb matches the page: home, then the room', () => {
  const crumbs = node(seo.roomJsonLd(input({ locale: 'en', homeName: 'Home' })), 'BreadcrumbList').itemListElement;
  assert.deepEqual(crumbs.map((c) => [c.position, c.name, c.item]), [
    [1, 'Home', `${SITE}/en`],
    [2, 'Ideo Q Ari สตูดิโอ', `${SITE}/en/rooms/31`],
  ]);
});

test('missing facts are left out, not written as null', () => {
  const listing = node(
    seo.roomJsonLd(input({ room: room({ priceFrom: null, priceOptions: [], areaSqm: null, district: null, bathrooms: null, imageUrls: [], coverImageUrl: null, availableFrom: null, propertyType: null, description: '  ' }) })),
    'RealEstateListing',
  );
  assert.equal(listing.offers, undefined, 'no price: no offer');
  assert.equal(listing.image, undefined);
  assert.equal(listing.description, undefined);
  assert.equal(listing.about['@type'], 'Accommodation');
  assert.equal(listing.about.floorSize, undefined);
  assert.equal(listing.about.address, undefined);
  assert.doesNotMatch(JSON.stringify(listing), /null/);
});

test('only https pictures are listed; the cover is used when the room has no gallery', () => {
  const listing = node(seo.roomJsonLd(input({ room: room({ imageUrls: ['http://x/a.jpg', 'javascript:alert(1)'] }) })), 'RealEstateListing');
  assert.deepEqual(listing.image, ['https://cdn.example.com/cover.jpg']);
});

test('no site address (env not set): no JSON-LD at all', () => {
  assert.equal(seo.roomJsonLd(input({ origin: '' })), null);
});

test('the agent text cannot close the script tag (XSS)', () => {
  const text = seo.jsonLdScript(seo.roomJsonLd(input({ room: room({ description: '</script><script>alert(1)</script>' }) })));
  assert.doesNotMatch(text, /<\/script/i);
  assert.doesNotMatch(text, /</);
  assert.equal(node(JSON.parse(text), 'RealEstateListing').description, '</script><script>alert(1)</script>', 'still the same text once parsed');
});

test('sitemap room ids: page through the search until the total, without repeats, up to a page cap', async () => {
  const all = Array.from({ length: 100 }, (_, i) => String(i + 1));
  const calls = [];
  const fetchPage = async (page) => {
    calls.push(page);
    const items = all.slice((page - 1) * 48, page * 48).map((id) => ({ id }));
    return { items: page === 2 ? [...items, { id: '1' }] : items, total: all.length };
  };
  const ids = await seo.collectRoomIds(fetchPage, 48, 50);
  assert.deepEqual(ids, all);
  assert.deepEqual(calls, [1, 2, 3]);

  const capped = [];
  const endless = async (page) => {
    capped.push(page);
    return { items: Array.from({ length: 48 }, (_, i) => ({ id: `${page}-${i}` })), total: 99999 };
  };
  const some = await seo.collectRoomIds(endless, 48, 2);
  assert.equal(some.length, 96);
  assert.deepEqual(capped, [1, 2]);

  const none = await seo.collectRoomIds(async () => ({ items: [], total: 0 }), 48, 50);
  assert.deepEqual(none, []);
});
