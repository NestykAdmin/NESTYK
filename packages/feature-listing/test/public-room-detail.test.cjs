// S7.3 room page (plan project-docs/nestyk-guest-room-detail-s73-plan-20261119.md, D2): amenity groups from a fixed
// code → group table (the public API sends codes only), price options in a fixed order, and the room page path.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const detail = require('../src/public-room-detail.ts');
const labels = require('../../i18n/src/amenities-catalog-labels.ts');

const th = labels.AMENITIES_FACILITY_LABELS.th;

test('every amenity code that has a label belongs to one of the six picker groups', () => {
  const groups = new Set(labels.AMENITIES_CATALOG_GROUP_ORDER);
  for (const code of Object.keys(th)) {
    const group = detail.AMENITY_CODE_GROUP[code];
    assert.ok(group, `${code} has a group`);
    assert.ok(groups.has(group), `${code} → ${group} is a picker group`);
  }
});

test('the table follows master_facilities for the current codes', () => {
  const seed = fs.readFileSync(path.resolve(__dirname, '../../../supabase/seed/masters.sql'), 'utf8');
  const groupIds = { 8: 'furniture', 9: 'appliances', 10: 'room_features', 11: 'parking', 12: 'project_facilities', 13: 'security_services' };
  let checked = 0;
  for (const match of seed.matchAll(/\(\d+, (\d+), '([a-z0-9_]+)', \d+, (?:true|false)\)/g)) {
    const group = groupIds[Number(match[1])];
    if (!group) continue; // the old pop_/liv_/sec_/srv_ groups are mapped by meaning, checked above
    assert.equal(detail.AMENITY_CODE_GROUP[match[2]], group, match[2]);
    checked += 1;
  }
  assert.ok(checked >= 50, `checked ${checked} codes`);
});

test('groups come in picker order, with labels, no repeats and no unknown codes', () => {
  const groups = detail.groupAmenityCodes(['pop_01', 'gym', 'air_conditioning', 'shared_pool', 'srv_08', 'bed_01', 'no_such_code', 'wardrobe'], th);
  assert.deepEqual(groups, [
    { group: 'furniture', labels: ['ตู้เสื้อผ้า'] },
    { group: 'appliances', labels: ['แอร์'] },
    { group: 'project_facilities', labels: ['สระว่ายน้ำ', 'ฟิตเนส'] },
  ]);
});

test('no codes gives no groups', () => {
  assert.deepEqual(detail.groupAmenityCodes([], th), []);
});

test('price options read 12 → 6 → 3 months and mark the lowest monthly price once', () => {
  const sorted = detail.sortedPriceOptions([
    { durationMonths: 3, pricePerMonth: 21000, depositAmount: 42000 },
    { durationMonths: 12, pricePerMonth: 18000, depositAmount: 36000 },
    { durationMonths: 6, pricePerMonth: 18000, depositAmount: null },
  ]);
  assert.deepEqual(sorted.map((o) => o.durationMonths), [12, 6, 3]);
  assert.deepEqual(sorted.map((o) => o.lowest), [true, false, false]);
  assert.equal(detail.defaultPriceOption(sorted).durationMonths, 12);
});

test('one or no price option', () => {
  assert.deepEqual(detail.sortedPriceOptions([]), []);
  assert.equal(detail.defaultPriceOption([]), null);
  const one = detail.sortedPriceOptions([{ durationMonths: 1, pricePerMonth: 25000, depositAmount: null }]);
  assert.equal(one[0].lowest, true);
});

test('room page path encodes the public id', () => {
  assert.equal(detail.roomPagePath('42'), '/rooms/42');
  assert.equal(detail.roomPagePath('a b/c'), '/rooms/a%20b%2Fc');
});

test('review R5: two prices for the same contract length show once, at the lower price', () => {
  const sorted = detail.sortedPriceOptions([
    { durationMonths: 12, pricePerMonth: 19000, depositAmount: 38000 },
    { durationMonths: 12, pricePerMonth: 18000, depositAmount: 36000 },
    { durationMonths: 6, pricePerMonth: 20000, depositAmount: null },
  ]);
  assert.deepEqual(sorted.map((o) => [o.durationMonths, o.pricePerMonth]), [[12, 18000], [6, 20000]]);
});
