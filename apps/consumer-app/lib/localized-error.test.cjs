// packages/i18n/src/error-message.ts: QA web role URL bug (4 Nov 2026) — users saw "Dev role grant is disabled" and
// "Required role: landlord". Messages written for developers always become the screen's translated fallback.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const file = path.join(__dirname, '../../../packages/i18n/src/error-message.ts');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)((id) => { throw new Error(`Unexpected dependency: ${id}`); }, mod, mod.exports);
const { localizedError } = mod.exports;

/** Like lib/api.ts ApiError. */
const apiError = (message, status, code) => Object.assign(new Error(message), { status, code });

test("the API's role checks (403 in English) are never shown, in any language", () => {
  for (const message of ['Required role: landlord', 'agent role required', 'Dev role grant is disabled']) {
    for (const locale of ['en', 'th', 'zh', 'ja']) {
      assert.equal(localizedError(apiError(message, 403), 'FALLBACK', locale), 'FALLBACK', `${message} (${locale})`);
    }
  }
});

test('a 403 written in Thai for users is still shown to Thai readers', () => {
  assert.equal(localizedError(apiError('เฉพาะนายหน้าเจ้าของดีล', 403), 'FALLBACK', 'th'), 'เฉพาะนายหน้าเจ้าของดีล');
});

test('an account without the agent role, and a bare "HTTP 409", get the fallback', () => {
  const noAgent = Object.assign(new Error('Agent role required'), { code: 'AGENT_ROLE_REQUIRED' });
  assert.equal(localizedError(noAgent, 'FALLBACK', 'en'), 'FALLBACK');
  assert.equal(localizedError(apiError('HTTP 409', 409), 'FALLBACK', 'en'), 'FALLBACK');
});

test('other messages behave as before: shown when already in the reader\'s language, else the fallback', () => {
  assert.equal(localizedError(apiError('Photo must be 10 MB or smaller', 400), 'FALLBACK', 'en'), 'Photo must be 10 MB or smaller');
  assert.equal(localizedError(apiError('Photo must be 10 MB or smaller', 400), 'FALLBACK', 'th'), 'FALLBACK');
  assert.equal(localizedError(new Error('สร้างบัญชีล็อกอินไม่สำเร็จ'), 'FALLBACK', 'th'), 'สร้างบัญชีล็อกอินไม่สำเร็จ');
  assert.equal(localizedError('not an error', 'FALLBACK', 'en'), 'FALLBACK');
  assert.equal(localizedError(new Error('   '), 'FALLBACK', 'en'), 'FALLBACK');
});
