// "ใหม่" tag on a lead until its first change (Mos 5 Nov 2026).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'lead-fresh.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => { throw new Error('no imports'); }, mod, mod.exports);
const { leadIsFresh } = mod.exports;

const created = '2026-11-05T05:00:00.000Z';
const plus = (ms) => new Date(Date.parse(created) + ms).toISOString();

test('a lead nobody changed since it was created is fresh (same time or a few ms later)', () => {
  assert.equal(leadIsFresh({ status: 'new', createdAt: created, updatedAt: created }), true);
  assert.equal(leadIsFresh({ status: 'new', createdAt: created, updatedAt: plus(40) }), true);
});

test('any later change (edit, match run, viewing) ends the tag', () => {
  assert.equal(leadIsFresh({ status: 'new', createdAt: created, updatedAt: plus(5_000) }), false);
  assert.equal(leadIsFresh({ status: 'new', createdAt: created, updatedAt: plus(60 * 60_000) }), false);
});

test('a lead whose status moved on is never fresh, even with equal dates', () => {
  for (const status of ['inprogress', 'booked', 'lost']) assert.equal(leadIsFresh({ status, createdAt: created, updatedAt: created }), false, status);
});

test('missing or broken dates never show the tag (old API without updatedAt)', () => {
  assert.equal(leadIsFresh({ status: 'new', createdAt: created }), false);
  assert.equal(leadIsFresh({ status: 'new', createdAt: created, updatedAt: null }), false);
  assert.equal(leadIsFresh({ status: 'new', createdAt: 'x', updatedAt: created }), false);
});
