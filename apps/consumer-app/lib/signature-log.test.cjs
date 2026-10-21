const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { fillTemplate } = require('../components/test-i18n.cjs');

function load(file) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', output)((id) => (id === '@nestyk/i18n' ? { fillTemplate } : require(id)), module, module.exports);
  return module.exports;
}
const { signatureChannelText } = load('signature-log.ts');
const copy = {
  signedVia: { app: 'ลงนามในแอป', link: 'ลงนามผ่านลิงก์', on_site: 'นายหน้ากดลงนามแทน', uploaded_file: 'แนบไฟล์ที่ลงนามแล้ว' },
  signedBy: 'โดย {name}',
};
const row = (patch) => ({ party: 'owner', channel: 'app', signedAt: '2026-10-21T03:00:00.000Z', signedBy: null, ...patch });

test('D17: each channel gets its own line, with who pressed sign when known', () => {
  assert.equal(signatureChannelText([row({ signedBy: 'Somchai Owner' })], 'owner', copy), 'ลงนามในแอป โดย Somchai Owner');
  assert.equal(signatureChannelText([row({ party: 'tenant', channel: 'link' })], 'tenant', copy), 'ลงนามผ่านลิงก์');
  assert.equal(signatureChannelText([row({ channel: 'on_site', signedBy: 'QA Agent' })], 'owner', copy), 'นายหน้ากดลงนามแทน โดย QA Agent');
  assert.equal(signatureChannelText([row({ channel: 'uploaded_file' })], 'owner', copy), 'แนบไฟล์ที่ลงนามแล้ว');
});

test('D17: no line for a party without a row, an old (legacy) signature, or a log that has not loaded', () => {
  assert.equal(signatureChannelText([row({ party: 'tenant' })], 'owner', copy), '');
  assert.equal(signatureChannelText([row({ channel: 'legacy' })], 'owner', copy), '');
  assert.equal(signatureChannelText(null, 'owner', copy), '');
  assert.equal(signatureChannelText([], 'owner', copy), '');
});
