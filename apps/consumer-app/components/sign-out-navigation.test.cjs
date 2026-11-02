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

function setup({ authenticated = true, signOut = async () => {} } = {}) {
  const calls = [];
  const dependencies = {
    isAuthenticated: authenticated,
    signOut: async () => { calls.push(['signOut']); await signOut(); },
    router: {
      push: route => calls.push(['push', route]),
      replace: route => calls.push(['replace', route]),
    },
    setDrawerOpen: value => calls.push(['drawer', value]),
    setPartyInbox: value => calls.push(['inbox', value]),
    setSelectedPartyRoom: value => calls.push(['room', value]),
    setOpenedPartyContract: value => calls.push(['contract', value]),
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
    ['role', 'guest'], ['tab', 'search'], ['alert', 'Sign out', 'Signed out'], ['replace', '/login'],
  ]);
});

test('the existing sign-out failure cleanup also ends at login', async () => {
  const { run, calls } = setup({ signOut: async () => { throw new Error('Sign out failed'); } });
  await run();
  assert.deepEqual(calls.slice(2), [
    ['inbox', false], ['room', null], ['contract', null], ['role', 'guest'],
    ['tab', 'search'], ['alert', 'Sign out', 'Signed out'], ['replace', '/login'],
  ]);
});

test('a guest opens login without attempting to sign out', async () => {
  const { run, calls } = setup({ authenticated: false });
  await run();
  assert.deepEqual(calls, [['drawer', false], ['push', '/login']]);
});
