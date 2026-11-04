const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/auth/password-changed-email.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => ({ resendMailer: () => null }), mod, mod.exports);
const { notifyPasswordChanged, PASSWORD_CHANGED_SUBJECT } = mod.exports;

test('a password-change notice goes only to the account email', async () => {
  const sent = [];
  const mailer = async (to, subject, text) => { sent.push({ to, subject, text }); };
  assert.equal(await notifyPasswordChanged('Jom@nestyk.com', mailer), true);
  assert.equal(sent[0].to, 'Jom@nestyk.com');
  assert.equal(sent[0].subject, PASSWORD_CHANGED_SUBJECT);
  assert.match(sent[0].text, /ถูกเปลี่ยน/);
  assert.equal(await notifyPasswordChanged('', mailer), false);
  assert.equal(await notifyPasswordChanged('Jom@nestyk.com', null), false);
  assert.equal(sent.length, 1);
});

test('a mailer failure does not throw after the password has already changed', async () => {
  const mailer = async () => { throw new Error('Resend 500'); };
  assert.equal(await notifyPasswordChanged('jom@nestyk.com', mailer), false);
});
