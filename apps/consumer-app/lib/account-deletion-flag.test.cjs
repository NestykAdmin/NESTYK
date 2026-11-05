// Delete account hidden at launch (L5, Mos 4 Nov 2026).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'account-deletion-flag.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function load(env) {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'process', source)(() => { throw new Error('no imports'); }, mod, mod.exports, { env });
  return mod.exports;
}

test('only "true" turns delete account on; unset, empty or anything else keeps it hidden', () => {
  const { accountDeletionFlag } = load({});
  for (const on of ['true', 'TRUE', ' true ']) assert.equal(accountDeletionFlag(on), true, on);
  for (const off of [undefined, null, '', 'false', '1', 'yes', 'on', true]) assert.equal(accountDeletionFlag(off), false, String(off));
  assert.equal(load({}).ACCOUNT_DELETION_ENABLED, false, 'production default');
  assert.equal(load({ EXPO_PUBLIC_ENABLE_ACCOUNT_DELETION: 'true' }).ACCOUNT_DELETION_ENABLED, true, 'QA build');
});

test('the menu shows when enabled, or when a deletion is already scheduled (so it can be cancelled); never signed out', () => {
  const { showAccountDeletion } = load({});
  assert.equal(showAccountDeletion(true, true, null), true);
  assert.equal(showAccountDeletion(true, false, null), false);
  assert.equal(showAccountDeletion(true, false, '2026-12-05T00:00:00Z'), true);
  assert.equal(showAccountDeletion(false, true, '2026-12-05T00:00:00Z'), false);
});

test('wiring: both account menus (web workspace + phone drawer) get the delete callbacks only through the flag', () => {
  const index = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  assert.match(index, /const accountDeletionMenu = showAccountDeletion\(isAuthenticated, ACCOUNT_DELETION_ENABLED, deletionScheduledFor\);/);
  for (const name of ['onLoadAccountDeletion', 'onDeleteAccount', 'onScheduleAccountDeletion', 'onCancelAccountDeletion']) {
    const uses = index.match(new RegExp(`${name}=\\{([^}]*)\\}`, 'g')) || [];
    assert.equal(uses.length, 2, name);
    for (const use of uses) assert.match(use, /=\{accountDeletionMenu \? /, use);
  }
  assert.match(fs.readFileSync(path.join(__dirname, 'account-deletion-flag.ts'), 'utf8'), /process\.env\.EXPO_PUBLIC_ENABLE_ACCOUNT_DELETION/, 'literal name, so Expo inlines it');
});
