const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'change-password.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)((id) => {
  const file = path.join(__dirname, id.endsWith('.ts') ? id : `${id}.ts`);
  const childSource = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const child = { exports: {} };
  new Function('require', 'module', 'exports', childSource)(() => { throw new Error(id); }, child, child.exports);
  return child.exports;
}, mod, mod.exports);
const { changePassword, confirmCurrentPassword, WRONG_PASSWORD, WEAK_PASSWORD } = mod.exports;

function client({ signInError = null, updateError = null } = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      signInWithPassword: async (args) => { calls.push(['sign-in', args]); return { error: signInError }; },
      updateUser: async (args) => { calls.push(['update', args]); return { error: updateError }; },
      signOut: async (args) => { calls.push(['sign-out', args]); },
    },
  };
}

test('a wrong current password does not change the password', async () => {
  const auth = client({ signInError: { message: 'Invalid login credentials', code: 'invalid_credentials' } });
  await assert.rejects(
    () => changePassword(auth, 'Jom@Nestyk.com', 'old-secret', 'Newsecret1'),
    (error) => error.code === WRONG_PASSWORD,
  );
  assert.deepEqual(auth.calls, [['sign-in', { email: 'jom@nestyk.com', password: 'old-secret' }]]);
});

for (const signInError of [
  { message: 'captcha verification failed', code: 'captcha_failed' },
  { message: 'Too many requests', code: 'over_request_rate_limit' },
  { message: 'Failed to fetch' },
]) {
  test(`a sign-in failure keeps its cause instead of reporting a wrong password: ${signInError.code ?? 'network'}`, async () => {
    const auth = client({ signInError });
    await assert.rejects(
      () => changePassword(auth, 'jom@nestyk.com', 'old-secret', 'Newsecret1'),
      (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.code, signInError.code);
        assert.equal(error.message, signInError.message);
        return true;
      },
    );
    assert.deepEqual(auth.calls.map(([operation]) => operation), ['sign-in']);
  });
}

test('the current password is checked before the new password is stored', async () => {
  const auth = client();
  await changePassword(auth, 'jom@nestyk.com', 'old-secret', 'Newsecret1');
  assert.deepEqual(auth.calls, [
    ['sign-in', { email: 'jom@nestyk.com', password: 'old-secret' }],
    ['update', { password: 'Newsecret1' }],
    ['sign-out', { scope: 'others' }],
  ]);
});

test('other devices failing to sign out still leaves the new password saved', async () => {
  const auth = client();
  auth.auth.signOut = async () => { throw new Error('network'); };
  await changePassword(auth, 'jom@nestyk.com', 'old-secret', 'Newsecret1');
});

test('checking the current password includes the captcha token', async () => {
  const auth = client();
  await changePassword(auth, 'jom@nestyk.com', 'old-secret', 'Newsecret1', 'captcha-token');
  assert.deepEqual(auth.calls[0], ['sign-in', { email: 'jom@nestyk.com', password: 'old-secret', options: { captchaToken: 'captcha-token' } }]);
});

test('confirming the current password rejects a wrong password', async () => {
  const auth = client({ signInError: { message: 'Invalid login credentials', code: 'invalid_credentials' } });
  await assert.rejects(
    () => confirmCurrentPassword(auth, 'Jom@Nestyk.com', 'old-secret', 'captcha-token'),
    (error) => error.code === WRONG_PASSWORD,
  );
  assert.deepEqual(auth.calls, [['sign-in', { email: 'jom@nestyk.com', password: 'old-secret', options: { captchaToken: 'captcha-token' } }]]);
});

test('a weak new password is rejected before the current password is checked', async () => {
  const auth = client();
  await assert.rejects(
    () => changePassword(auth, 'jom@nestyk.com', 'old-secret', 'new-secret'),
    (error) => error.code === WEAK_PASSWORD,
  );
  assert.deepEqual(auth.calls, []);
});
