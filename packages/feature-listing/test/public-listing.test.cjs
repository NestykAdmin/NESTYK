const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { formatPublicPrice, formatStationDistance, buildPublicRoomSpecs, getPublicAvailability, formatPublicAvailability } = require('../src/public-listing.ts');

const specLabels = {
  bedroom: { studio: 'Studio', one: '{count} bedroom', many: '{count} bedrooms' },
  bathroom: { one: '{count} bathroom', many: '{count} bathrooms' },
  area: '{count} sqm',
};
const availLabels = { now: 'Move in now', on: 'Available {date}' };

test('price is shown in baht with thousand separators and no decimals', () => {
  assert.equal(formatPublicPrice(15000), '฿15,000');
  assert.equal(formatPublicPrice(1250000), '฿1,250,000');
  assert.equal(formatPublicPrice(8999.6), '฿9,000');
  assert.equal(formatPublicPrice(0), '฿0');
});

test('missing or invalid price gives null instead of a fake number', () => {
  assert.equal(formatPublicPrice(null), null);
  assert.equal(formatPublicPrice(undefined), null);
  assert.equal(formatPublicPrice(NaN), null);
  assert.equal(formatPublicPrice(-100), null);
});

test('station distance switches from metres to kilometres at 1 km', () => {
  assert.equal(formatStationDistance(350), '350 m');
  assert.equal(formatStationDistance(999), '999 m');
  assert.equal(formatStationDistance(1000), '1 km');
  assert.equal(formatStationDistance(1240), '1.2 km');
  assert.equal(formatStationDistance(-5), null);
  assert.equal(formatStationDistance(null), null);
});

test('spec line lists bedrooms, bathrooms and area and skips the unknown ones', () => {
  assert.deepEqual(buildPublicRoomSpecs({ bedrooms: 2, bathrooms: 1, areaSqm: 56 }, specLabels), ['2 bedrooms', '1 bathroom', '56 sqm']);
  assert.deepEqual(buildPublicRoomSpecs({ bedrooms: 1, bathrooms: null, areaSqm: null }, specLabels), ['1 bedroom']);
  assert.deepEqual(buildPublicRoomSpecs({ bedrooms: null, bathrooms: null, areaSqm: null }, specLabels), []);
});

test('zero bedrooms is shown as studio', () => {
  assert.deepEqual(buildPublicRoomSpecs({ bedrooms: 0, bathrooms: 1, areaSqm: 24.5 }, specLabels), ['Studio', '1 bathroom', '24.5 sqm']);
});

test('availability is "now" when the date is missing, invalid or not in the future', () => {
  assert.deepEqual(getPublicAvailability(null, '2026-11-11'), { status: 'now' });
  assert.deepEqual(getPublicAvailability('not-a-date', '2026-11-11'), { status: 'now' });
  assert.deepEqual(getPublicAvailability('2026-11-11', '2026-11-11'), { status: 'now' });
  assert.deepEqual(getPublicAvailability('2026-10-01', '2026-11-11'), { status: 'now' });
});

test('availability keeps the date when the room frees up later', () => {
  assert.deepEqual(getPublicAvailability('2026-12-05', '2026-11-11'), { status: 'on', date: '2026-12-05' });
});

test('availability text uses the right sentence and the date in the viewer locale', () => {
  assert.equal(formatPublicAvailability({ status: 'now' }, availLabels, 'en'), 'Move in now');
  assert.equal(formatPublicAvailability({ status: 'on', date: '2026-12-05' }, availLabels, 'en'), 'Available 5 Dec 2026');
  assert.match(formatPublicAvailability({ status: 'on', date: '2026-12-05' }, availLabels, 'th'), /5 ธ\.ค\. 2026/);
});

test('dates use the Gregorian year in every language, Thai included (design v2.2)', () => {
  const on = { status: 'on', date: '2026-12-01' };
  const th = formatPublicAvailability(on, { now: 'x', on: 'พร้อมเข้าอยู่ {date}' }, 'th');
  assert.match(th, /2026/);
  assert.doesNotMatch(th, /2569/);
  assert.match(th, /ธ\.ค\./);
  for (const locale of ['en', 'ja', 'zh']) assert.match(formatPublicAvailability(on, availLabels, locale), /2026/);
});
