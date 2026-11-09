const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve(__dirname, '../src/components/places-search-gate.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { placesSearchAction } = loaded.exports;

test('opening the room editor does not search the saved project name', () => {
  const applied = 'Noble Around';
  assert.equal(placesSearchAction('', applied), 'clear');
  assert.equal(placesSearchAction('Noble Around', applied), 'skip');
});

test('typing a new project name after opening the editor searches', () => {
  assert.equal(placesSearchAction('Noble Around 33', 'Noble Around'), 'search');
});

test('picking a place whose name matches the typed text still lets the next keystroke search', () => {
  const applied = 'Ideo Q';
  assert.equal(placesSearchAction('Ideo Q', applied), 'skip');
  assert.equal(placesSearchAction('Ideo Q ', applied), 'skip');
  assert.equal(placesSearchAction('Ideo Q S', applied), 'search');
});

test('names shorter than 2 characters clear the suggestions', () => {
  assert.equal(placesSearchAction('', null), 'clear');
  assert.equal(placesSearchAction(' N ', null), 'clear');
  assert.equal(placesSearchAction('No', null), 'search');
});
