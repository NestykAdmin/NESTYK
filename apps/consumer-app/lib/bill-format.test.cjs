// QA Aof, 16 Nov 2026 (Q8): the late fee due date was only checked for the YYYY-MM-DD shape, so 2026-13-45 passed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const loaded = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, 'bill-format.ts'), 'utf8');
new Function('require', 'module', 'exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(require, loaded, loaded.exports);
const { isCalendarDay } = loaded.exports;

test('Q8: only a real calendar day in YYYY-MM-DD passes', () => {
  for (const value of ['2026-12-31', '2028-02-29', '2027-01-01']) assert.equal(isCalendarDay(value), true, value);
  for (const value of ['2026-13-45', '2026-02-30', '2026-04-31', '2026-00-10', '2026-12-00', '2025-02-29', '2026-1-05', '', '31/12/2026'])
    assert.equal(isCalendarDay(value), false, value);
});
