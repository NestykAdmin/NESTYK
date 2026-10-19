// Role change round 1 (docs/ROLE-CHANGE-PLAN.md, guard 3): the API must refuse to start when master_roles
// does not match the roles this code uses, and must never accept the retired role code 'owner' again.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => {
  const source = require('node:fs').readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    experimentalDecorators: true, emitDecoratorMetadata: true,
  }, fileName: filename }).outputText, filename);
};
const { roleCatalogProblems, RoleCatalogCheck } = require('../src/database/role-catalog.check.ts');
const { MASTER_ROLE_NAMES, RETIRED_ROLE_NAMES } = require('../src/entities/master-role.entity.ts');

// Rows after supabase/seed/masters.sql (id 2 renamed to landlord) — written out, not derived from the code under test.
const CURRENT = ['guest', 'landlord', 'tenant', 'agent', 'admin'];
// Rows before migration 20261016100000_rename_owner_role_to_landlord (seed of baseline 20261014100838).
const LEGACY = ['guest', 'owner', 'tenant', 'agent', 'admin'];

function fakeDataSource(names, schema = 'public') {
  const expected = new RegExp(`^SELECT name FROM "${schema}"\\.master_roles$`);
  return { driver: { escape: (n) => `"${n}"` }, query: async (sql) => {
    assert.match(sql, expected);
    return names.map((name) => ({ name }));
  } };
}

function withSchema(t, value) {
  const saved = process.env.DB_SCHEMA;
  if (value === undefined) delete process.env.DB_SCHEMA; else process.env.DB_SCHEMA = value;
  t.after(() => { if (saved === undefined) delete process.env.DB_SCHEMA; else process.env.DB_SCHEMA = saved; });
}

function check(names, schema) {
  const c = new RoleCatalogCheck(fakeDataSource(names, schema));
  const warnings = [];
  c.logger = { warn: (m) => warnings.push(m) };
  return { run: () => c.onApplicationBootstrap(), warnings };
}

/** Rejects with a plain Error whose message satisfies every pattern (not an AssertionError from the fake). */
async function rejectsWith(promise, patterns) {
  await assert.rejects(promise, (e) => {
    assert.ok(!(e instanceof assert.AssertionError), `fake assertion failed instead: ${e.message}`);
    for (const p of patterns) assert.match(e.message, p);
    return true;
  });
}

test('the code role list has landlord and never the retired owner', () => {
  assert.ok(MASTER_ROLE_NAMES.includes('landlord'));
  assert.ok(!MASTER_ROLE_NAMES.includes('owner'));
  assert.deepEqual([...RETIRED_ROLE_NAMES], ['owner']);
});

test('current catalog has no problems', () => {
  assert.deepEqual(roleCatalogProblems(CURRENT), { missing: [], retired: [], unknown: [] });
});

test('legacy catalog (before the landlord migration) is missing landlord and still has owner', () => {
  assert.deepEqual(roleCatalogProblems(LEGACY), { missing: ['landlord'], retired: ['owner'], unknown: [] });
});

test('a role added by a newer release is only unknown, not an error', () => {
  assert.deepEqual(roleCatalogProblems([...CURRENT, 'self_owner']), { missing: [], retired: [], unknown: ['self_owner'] });
});

test('startup check rejects a database that only lacks roles (no owner involved)', async (t) => {
  withSchema(t, undefined);
  await rejectsWith(check(['guest', 'tenant', 'landlord']).run(), [/ขาด: agent, admin →/]);
  const out = check(['guest', 'tenant', 'landlord']).run();
  await assert.rejects(out, (e) => !/เลิกใช้แล้ว/.test(e.message));
});

test('startup check rejects the legacy database with both reasons listed', async (t) => {
  withSchema(t, undefined);
  await rejectsWith(check(LEGACY).run(), [/ขาด: landlord →/, /เลิกใช้แล้ว: owner →/]);
});

test('startup check rejects a database that re-added owner next to landlord', async (t) => {
  withSchema(t, undefined);
  await rejectsWith(check([...CURRENT, 'owner']).run(), [/เลิกใช้แล้ว: owner →/]);
  await assert.rejects(check([...CURRENT, 'owner']).run(), (e) => !/ขาด:/.test(e.message));
});

test('startup check passes the current catalog without warnings', async (t) => {
  withSchema(t, undefined);
  const c = check(CURRENT);
  await c.run();
  assert.deepEqual(c.warnings, []);
});

test('startup check only warns about a role from a newer release', async (t) => {
  withSchema(t, undefined);
  const c = check([...CURRENT, 'self_owner']);
  await c.run();
  assert.equal(c.warnings.length, 1);
  assert.match(c.warnings[0], /self_owner/);
});

test('startup check reads the schema from DB_SCHEMA and says the migrations only cover public', async (t) => {
  withSchema(t, 'tenant_x');
  await check(CURRENT, 'tenant_x').run();
  await rejectsWith(check(LEGACY, 'tenant_x').run(), [/DB_SCHEMA=tenant_x/]);
});

test('an empty DB_SCHEMA falls back to public', async (t) => {
  withSchema(t, '');
  await check(CURRENT, 'public').run();
});
