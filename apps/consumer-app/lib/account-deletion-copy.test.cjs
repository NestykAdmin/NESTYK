// QA Aof, 3 Nov 2026: each reason the account cannot be deleted says what to do next, in all four languages.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const locales = path.join(__dirname, '../../../packages/i18n/src/locales');
const REASONS = ['open_contract', 'open_agent_contract', 'unpaid_bill', 'bill_awaiting_review', 'unrefunded_deposit'];

for (const lang of ['th', 'en', 'zh', 'ja']) {
  test(`${lang}: every deletion blocker has its own next-step message, and the parties are sent to their agent, not support`, () => {
    const account = require(path.join(locales, `${lang}.ts`))[lang].mobile.account;
    assert.deepEqual(Object.keys(account.deleteAccountReasons).sort(), [...REASONS].sort());
    const texts = REASONS.map((r) => account.deleteAccountReasons[r]);
    for (const text of texts) assert.ok(text && text.trim().length > 0);
    assert.equal(new Set(texts).size, REASONS.length, 'no two reasons share a message');
    for (const text of [account.deleteAccountBlocked, ...texts]) assert.doesNotMatch(text, /support@/);
  });
}
