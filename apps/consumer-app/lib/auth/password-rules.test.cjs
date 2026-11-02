const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'password-rules.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => { throw new Error('unexpected import'); }, mod, mod.exports);

test('a password needs 8 characters with a digit, a lowercase letter and an uppercase letter', () => {
  const { passwordIsStrong } = mod.exports;
  assert.equal(passwordIsStrong('1234567'), false);
  assert.equal(passwordIsStrong('12345678'), false);
  assert.equal(passwordIsStrong('abcdefgh'), false);
  assert.equal(passwordIsStrong('ABCDEFGH'), false);
  assert.equal(passwordIsStrong('Abcdefgh'), false);
  assert.equal(passwordIsStrong('Abcdefg1'), true);
});
