// QA web role URL bug (4 Nov 2026): POST /auth/dev/roles lets a signed-in account give itself landlord, tenant, agent or
// admin. It works only on a local API (NODE_ENV=development) that also sets ALLOW_DEV_ROLE_GRANT=true. Railway starts the
// API with NODE_ENV=production, so a stray ALLOW_DEV_ROLE_GRANT=true there grants nothing.
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
const { AuthService } = require('../src/auth/auth.service.ts');

function service() {
  const saved = [], deleted = [];
  const users = { findOne: async () => ({ id: 7, email: 'a@example.test', first_name: 'A', last_name: 'B', user_roles: [] }) };
  const roles = { findOne: async ({ where }) => ({ id: 3, name: where.name }) };
  const userRoles = {
    findOne: async () => null,
    create: (row) => row,
    save: async (row) => { saved.push(row); return row; },
    delete: async (row) => { deleted.push(row); },
  };
  return { auth: new AuthService(users, roles, userRoles, {}), saved, deleted };
}

async function withEnv(env, fn) {
  const keys = ['NODE_ENV', 'ALLOW_DEV_ROLE_GRANT'];
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { return await fn(); } finally {
    for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; }
  }
}

for (const env of [
  { NODE_ENV: 'production', ALLOW_DEV_ROLE_GRANT: 'true' },
  { NODE_ENV: undefined, ALLOW_DEV_ROLE_GRANT: 'true' },
  { NODE_ENV: 'development', ALLOW_DEV_ROLE_GRANT: undefined },
  { NODE_ENV: 'development', ALLOW_DEV_ROLE_GRANT: 'false' },
]) {
  test(`no role is granted or removed with NODE_ENV=${env.NODE_ENV} ALLOW_DEV_ROLE_GRANT=${env.ALLOW_DEV_ROLE_GRANT}`, async () => {
    const { auth, saved, deleted } = service();
    await withEnv(env, async () => {
      for (const role of ['agent', 'admin']) {
        await assert.rejects(() => auth.grantDevRole(7, role), (e) => e.getStatus?.() === 403);
        await assert.rejects(() => auth.revokeDevRole(7, role), (e) => e.getStatus?.() === 403);
      }
    });
    assert.deepEqual(saved, []);
    assert.deepEqual(deleted, []);
  });
}

test('a local development API that opts in still grants a role', async () => {
  const { auth, saved } = service();
  await withEnv({ NODE_ENV: 'development', ALLOW_DEV_ROLE_GRANT: 'true' }, () => auth.grantDevRole(7, 'agent'));
  assert.deepEqual(saved, [{ user_id: 7, role_id: 3 }]);
});
