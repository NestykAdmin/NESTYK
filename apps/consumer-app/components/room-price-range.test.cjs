const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
// The scale now comes from @nestyk/feature-search (TypeScript), so the file is loaded with a .ts require hook.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const exportsForTest = require(path.join(__dirname, 'room-price-range.ts'));
const {
  movePrice,
  pricePosition,
  matchesPreset,
  validPriceRange,
  PRICE_PRESETS,
  parsePriceInput,
  formatPriceInput,
  isPriceBeyondScale,
  nearestPriceThumb,
  formatPriceSummary,
} = exportsForTest;

test('six presets match their own values, including unlimited and zero', () => {
  assert.equal(PRICE_PRESETS.length, 6);
  for (const [minPrice, maxPrice] of PRICE_PRESETS) assert.ok(matchesPreset({ minPrice, maxPrice }, minPrice, maxPrice));
  assert.ok(matchesPreset({ minPrice: '0', maxPrice: '' }, '', ''));
  assert.equal(matchesPreset({ minPrice: '15000', maxPrice: '45000' }, '20000', '30000'), false);
});

test('drag snaps at 1000 and cannot cross the opposite bound', () => {
  const range = { minPrice: '10000', maxPrice: '30000' };
  assert.equal(movePrice(range, 'min', 15500).minPrice, '16000');
  assert.equal(movePrice(range, 'min', 90000).minPrice, '30000');
  assert.equal(movePrice(range, 'max', 0).maxPrice, '10000');
  assert.equal(movePrice(range, 'min', -5000).minPrice, '0');
});

test('right endpoint is unlimited and moving back restores a cap', () => {
  const range = movePrice({ minPrice: '20000', maxPrice: '30000' }, 'max', 100000);
  assert.equal(range.maxPrice, '');
  assert.equal(movePrice(range, 'max', 99000).maxPrice, '99000');
});

test('manual amounts beyond the track remain valid and are not overwritten', () => {
  const range = { minPrice: '150000', maxPrice: '250000' };
  assert.ok(validPriceRange(range));
  assert.equal(pricePosition(range.maxPrice, 0), 100000);
  assert.equal(movePrice(range, 'min', 50000).maxPrice, '250000');
  assert.equal(movePrice(range, 'max', 90000).maxPrice, '150000');
});

test('invalid and reversed prices rejected; single-sided and equal ranges allowed', () => {
  for (const range of [{ minPrice: '-1', maxPrice: '' }, { minPrice: 'NaN', maxPrice: '' }, { minPrice: '2', maxPrice: '1' }, { minPrice: '1.234', maxPrice: '' }]) assert.equal(validPriceRange(range), false);
  for (const range of [{ minPrice: '', maxPrice: '10000' }, { minPrice: '50000', maxPrice: '' }, { minPrice: '10000', maxPrice: '10000' }]) assert.ok(validPriceRange(range));
});

test('parse and format price input with commas', () => {
  assert.equal(parsePriceInput('20,000'), '20000');
  assert.equal(parsePriceInput('46,000.5'), '46000.5');
  assert.equal(formatPriceInput('20000', 'en-US'), '20,000');
  assert.equal(formatPriceInput('', 'en-US'), '');
});

test('beyond-scale detection and nearest thumb', () => {
  assert.equal(isPriceBeyondScale({ minPrice: '20000', maxPrice: '46000' }), false);
  assert.equal(isPriceBeyondScale({ minPrice: '120000', maxPrice: '' }), true);
  assert.equal(nearestPriceThumb({ minPrice: '10000', maxPrice: '40000' }, 12000), 'min');
  assert.equal(nearestPriceThumb({ minPrice: '10000', maxPrice: '40000' }, 38000), 'max');
});

test('price summary includes grouping and unit', () => {
  assert.equal(
    formatPriceSummary({ minPrice: '20000', maxPrice: '46000' }, 'en-US', {
      unlimited: 'No limit',
      perMonth: 'THB/month',
    }),
    '20,000–46,000 THB/month',
  );
});
