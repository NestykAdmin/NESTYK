const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute the screen's actual handler without mounting its unrelated feature screens.
const source = fs.readFileSync(path.resolve(__dirname, '../app/index.tsx'), 'utf8');
const ast = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleAuthAction') {
    handler = node.initializer.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(handler, 'home screen has an auth action');

// AFTER_SIGN_OUT_PATH (app/index.tsx): '/login' on mobile, '/' (guest home) on the web (Mos 4 Nov 2026).
function setup({ authenticated = true, signOut = async () => {}, afterSignOutPath = '/login' } = {}) {
  const calls = [];
  const dependencies = {
    isAuthenticated: authenticated,
    AFTER_SIGN_OUT_PATH: afterSignOutPath,
    signOut: async () => { calls.push(['signOut']); await signOut(); },
    router: {
      push: route => calls.push(['push', route]),
      replace: route => calls.push(['replace', route]),
    },
    setDrawerOpen: value => calls.push(['drawer', value]),
    setPartyInbox: value => calls.push(['inbox', value]),
    setSelectedPartyRoom: value => calls.push(['room', value]),
    setOpenedPartyContract: value => calls.push(['contract', value]),
    // Web, SIGN_OUT_TO=login: keeps the shell's reset to guest from pushing "/" over /login (A0.1 9 Nov 2026).
    holdGuestHomeForSignOut: () => calls.push(['hold']),
    setActiveRole: value => calls.push(['role', value]),
    setActiveTab: value => calls.push(['tab', value]),
    getDefaultTabForRole: () => 'search',
    Alert: { alert: (...args) => calls.push(['alert', ...args]) },
    t: { common: { signOut: 'Sign out' }, mobile: { auth: { signedOut: 'Signed out' } } },
  };
  return {
    run: new Function(...Object.keys(dependencies), `return (${handler});`)(...Object.values(dependencies)),
    calls,
  };
}

test('sign out waits for completion, clears workspace state, then replaces the route with login', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const { run, calls } = setup({ signOut: () => pending });
  const result = run();
  assert.deepEqual(calls, [['drawer', false], ['signOut']]);
  finish();
  await result;
  assert.deepEqual(calls, [
    ['drawer', false], ['signOut'], ['inbox', false], ['room', null], ['contract', null],
    ['hold'], ['role', 'guest'], ['tab', 'search'], ['alert', 'Sign out', 'Signed out'], ['replace', '/login'],
  ]);
});

test('the existing sign-out failure cleanup also ends at login', async () => {
  const { run, calls } = setup({ signOut: async () => { throw new Error('Sign out failed'); } });
  await run();
  assert.deepEqual(calls.slice(2), [
    ['inbox', false], ['room', null], ['contract', null], ['hold'], ['role', 'guest'],
    ['tab', 'search'], ['alert', 'Sign out', 'Signed out'], ['replace', '/login'],
  ]);
});

test('web: sign out lands on the guest home instead of login', async () => {
  const { run, calls } = setup({ afterSignOutPath: '/' });
  await run();
  assert.deepEqual(calls.at(-1), ['replace', '/']);
  const failing = setup({ afterSignOutPath: '/', signOut: async () => { throw new Error('Sign out failed'); } });
  await failing.run();
  assert.deepEqual(failing.calls.at(-1), ['replace', '/']);
});

test('a guest opens login without attempting to sign out', async () => {
  const { run, calls } = setup({ authenticated: false });
  await run();
  assert.deepEqual(calls, [['drawer', false], ['push', '/login']]);
});
