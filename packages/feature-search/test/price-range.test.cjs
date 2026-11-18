const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { RENT_PRICE_LIMIT, RENT_PRICE_STEP, RENT_PRICE_PRESETS, snapRentPrice, isRentPreset } = require('../src/price-range.ts');

test('one monthly-rent scale for the web and the app: ฿0 – ฿100,000 in ฿1,000 steps', () => {
  assert.equal(RENT_PRICE_LIMIT, 100000);
  assert.equal(RENT_PRICE_STEP, 1000);
  assert.equal(snapRentPrice(15499), 15000);
  assert.equal(snapRentPrice(15500), 16000);
  assert.equal(snapRentPrice(-20), 0);
  assert.equal(snapRentPrice(250000), 100000);
});

test('six presets: all, up to 10k, 10–20k, 20–30k, 30–50k, 50k and up', () => {
  assert.deepEqual(RENT_PRICE_PRESETS, [{}, { max: 10000 }, { min: 10000, max: 20000 }, { min: 20000, max: 30000 }, { min: 30000, max: 50000 }, { min: 50000 }]);
});

test('a price filter matches a preset when both ends agree; no minimum equals 0, no maximum equals open', () => {
  assert.ok(isRentPreset(undefined, undefined, {}));
  assert.ok(isRentPreset(0, undefined, {}));
  assert.ok(isRentPreset(10000, 20000, { min: 10000, max: 20000 }));
  assert.ok(isRentPreset(50000, undefined, { min: 50000 }));
  assert.equal(isRentPreset(10000, 25000, { min: 10000, max: 20000 }), false);
  assert.equal(isRentPreset(undefined, 10000, {}), false);
});
