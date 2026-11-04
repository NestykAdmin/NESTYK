// A (Jom, 3 Nov 2026; QA account-deletion doc): scheduling or making a deletion needs an authentication in the last
// 5 minutes, read from the `amr` claim of the token AuthGuard already verified. A refreshed token does not count.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
};
const { lastAuthenticatedAt, recentlyAuthenticated, REAUTH_WINDOW_SECONDS } = require('../src/auth/recent-auth.ts');
const { RecentAuthGuard } = require('../src/auth/guards/recent-auth.guard.ts');
const { AuthController } = require('../src/auth/auth.controller.ts');
const { AuthGuard } = require('../src/auth/guards/auth.guard.ts');

const now = 1_762_160_000; // seconds
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (payload) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`;
const context = (authorization) => ({ switchToHttp: () => ({ getRequest: () => ({ headers: authorization === undefined ? {} : { authorization } }) }) });
const reauth = (e) => e.getStatus() === 401 && e.getResponse().code === 'REAUTH_REQUIRED';

test('the last authentication is the newest amr entry that is not a token refresh', () => {
  assert.equal(REAUTH_WINDOW_SECONDS, 300);
  assert.equal(lastAuthenticatedAt({ amr: [{ method: 'password', timestamp: now - 100 }] }), now - 100);
  assert.equal(lastAuthenticatedAt({ amr: [{ method: 'password', timestamp: now - 900 }, { method: 'otp', timestamp: now - 60 }] }), now - 60);
  assert.equal(lastAuthenticatedAt({ amr: [{ method: 'password', timestamp: now - 900 }, { method: 'token_refresh', timestamp: now - 5 }] }), now - 900);
  for (const payload of [{}, { amr: [] }, { amr: 'password' }, { amr: [{ method: 'password' }] }, { amr: [{ method: 'token_refresh', timestamp: now }] }, null])
    assert.equal(lastAuthenticatedAt(payload), null, JSON.stringify(payload));
});

test('within 5 minutes passes; past it, a refresh only, no amr, or a malformed token does not', () => {
  assert.equal(recentlyAuthenticated(token({ amr: [{ method: 'password', timestamp: now - 299 }] }), now), true);
  assert.equal(recentlyAuthenticated(token({ amr: [{ method: 'password', timestamp: now - 300 }] }), now), true, 'exactly 5 minutes');
  assert.equal(recentlyAuthenticated(token({ amr: [{ method: 'password', timestamp: now - 301 }] }), now), false);
  assert.equal(recentlyAuthenticated(token({ amr: [{ method: 'password', timestamp: now - 3600 }, { method: 'token_refresh', timestamp: now - 1 }] }), now), false);
  assert.equal(recentlyAuthenticated(token({ iat: now }), now), false, 'iat alone is not an authentication');
  for (const bad of ['', 'abc', 'a.b', 'a.%%%.c', 'dev|00000000-0000-4000-8000-000000000001|a@b.test'])
    assert.equal(recentlyAuthenticated(bad, now), false, bad);
});

test('the guard answers 401 REAUTH_REQUIRED unless the bearer token authenticated in the last 5 minutes', (t) => {
  const realNow = Date.now;
  Date.now = () => now * 1000;
  t.after(() => { Date.now = realNow; });
  const guard = new RecentAuthGuard();
  assert.equal(guard.canActivate(context(`Bearer ${token({ amr: [{ method: 'password', timestamp: now - 10 }] })}`)), true);
  for (const header of [undefined, 'Basic x', `Bearer ${token({ amr: [{ method: 'password', timestamp: now - 600 }] })}`, 'Bearer dev|uuid|a@b.test'])
    assert.throws(() => guard.canActivate(context(header)), reauth, String(header));
});

test('scheduling and deleting now need a recent authentication; cancelling a schedule does not', () => {
  const guards = (method) => Reflect.getMetadata('__guards__', AuthController.prototype[method]) ?? [];
  for (const method of ['scheduleAccountDeletion', 'deleteAccount']) assert.deepEqual(guards(method), [AuthGuard, RecentAuthGuard], method);
  assert.deepEqual(guards('cancelAccountDeletion'), [AuthGuard]);
  assert.deepEqual(guards('deletionPreview'), [AuthGuard]);
});
