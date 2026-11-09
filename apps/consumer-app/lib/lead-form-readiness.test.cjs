// W17 (Mos 6 Nov 2026): agent web add/edit lead side panel. Same rules as CreateLeadForm (save) and leadMatchReady (matching).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file, deps = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((name) => {
    if (name in deps) return deps[name];
    throw new Error(`unexpected import ${name}`);
  }, mod, mod.exports);
  return mod.exports;
}
const { leadFormReadiness } = loadTs(path.join(__dirname, 'lead-form-readiness.ts'));
const { leadMatchReady } = loadTs(path.join(__dirname, 'lead-match-preview.ts'), new Proxy({}, { has: () => true, get: () => ({}) }));

const draft = (over = {}) => ({ firstName: 'Nalin', phoneDigits: '812345678', budgetMax: '18000', pinCount: 1, tab: 'profile', ...over });

test('save needs a first name and phone digits (as CreateLeadForm)', () => {
  assert.equal(leadFormReadiness(draft()).canSave, true);
  assert.equal(leadFormReadiness(draft({ firstName: '   ' })).canSave, false);
  assert.equal(leadFormReadiness(draft({ phoneDigits: '' })).canSave, false);
  assert.equal(leadFormReadiness(draft({ budgetMax: '', pinCount: 0 })).canSave, true);
});

test('matching needs a max budget above 0 and at least one pin', () => {
  for (const budgetMax of ['', '0', '-5', 'abc', '   ']) {
    assert.equal(leadFormReadiness(draft({ budgetMax })).matchReady, false, budgetMax);
  }
  assert.equal(leadFormReadiness(draft({ budgetMax: ' 18000 ' })).matchReady, true);
  assert.equal(leadFormReadiness(draft({ pinCount: 0 })).matchReady, false);
});

test('items: first name, phone, max budget, pins, each with its tab and done flag', () => {
  const r = leadFormReadiness(draft({ phoneDigits: '', pinCount: 0 }));
  assert.deepEqual(r.items, [
    { key: 'firstName', tab: 'profile', done: true },
    { key: 'phone', tab: 'profile', done: false },
    { key: 'budgetMax', tab: 'matching', done: true },
    { key: 'pins', tab: 'matching', done: false },
  ]);
});

test('matchReady agrees with leadMatchReady once saved (radius is always set with pins)', () => {
  for (const [budgetMax, pinCount] of [['18000', 1], ['18000', 0], ['0', 2], ['25000.5', 3]]) {
    const lead = { budgetMax: Number(budgetMax), pins: Array.from({ length: pinCount }, () => ({})), radiusKm: pinCount ? 3 : null };
    assert.equal(leadFormReadiness(draft({ budgetMax, pinCount })).matchReady, leadMatchReady(lead), `${budgetMax}/${pinCount}`);
  }
});
