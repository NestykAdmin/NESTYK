const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
};
const { AuthService } = require('../src/auth/auth.service.ts');
const { AuthGuard } = require('../src/auth/guards/auth.guard.ts');
const { UserEntity } = require('../src/entities/user.entity.ts');
const { MasterRoleEntity } = require('../src/entities/master-role.entity.ts');
const ALL = ['guest', 'tenant', 'landlord', 'agent', 'admin'];

function setup({ existing = false, missing } = {}) {
  const identity = { supabaseUserId: randomUUID(), email: `${randomUUID()}@example.test`, selfRegistered: true };
  const roles = ALL.map((name, i) => ({ id: i + 1, name })).filter(r => r.name !== missing);
  let users = existing ? [{ id: 1, supabase_user_id: identity.supabaseUserId, email: identity.email, first_name: 'Member', last_name: '', profile_completed: false }] : [];
  let links = existing ? [{ user_id: 1, role_id: 1 }] : [];
  const manager = {
    query: async () => {},
    create: (_entity, data) => ({ ...data }),
    find: async (entity) => { assert.equal(entity, MasterRoleEntity); return roles; },
    findOne: async (entity, { where }) => {
      if (entity === MasterRoleEntity) return roles.find(r => r.name === where.name) ?? null;
      assert.equal(entity, UserEntity);
      const row = users.find(u => where.id ? u.id === where.id : u.supabase_user_id === where.supabase_user_id);
      return row ? { ...row, user_roles: links.filter(l => l.user_id === row.id).map(l => ({ ...l, role: roles.find(r => r.id === l.role_id) })) } : null;
    },
    save: async (value) => {
      if (Array.isArray(value)) return Promise.all(value.map(manager.save));
      if ('role_id' in value) { links.push(value); return value; }
      const user = { id: users.length + 1, ...value }; users.push(user); return user;
    },
  };
  const db = { transaction: async fn => {
    const before = { users: [...users], links: [...links] };
    try { return await fn(manager); } catch (e) { users = before.users; links = before.links; throw e; }
  } };
  return { service: new AuthService({}, {}, {}, db), identity, counts: () => [users.length, links.length] };
}

test('self-registration provisions all five roles once; a retry creates neither user nor role duplicates', async () => {
  const { service, identity, counts } = setup();
  const first = await service.sync(identity);
  assert.deepEqual([...first.roles].sort(), [...ALL].sort());
  assert.equal(first.provisioned, true);
  const second = await service.sync(identity);
  assert.deepEqual([...second.roles].sort(), [...ALL].sort());
  assert.equal(second.provisioned, false);
  assert.deepEqual(counts(), [1, 5]);
});

test('an existing user cannot get extra roles by setting registration metadata', async () => {
  const { service, identity, counts } = setup({ existing: true });
  assert.deepEqual((await service.sync(identity)).roles, ['guest']);
  assert.deepEqual(counts(), [1, 1]);
});

test('ordinary login/provisioning still receives only guest', async () => {
  const { service, identity } = setup();
  delete identity.selfRegistered;
  assert.deepEqual((await service.sync(identity)).roles, ['guest']);
});

test('a missing registration role rolls back the entire profile instead of giving partial permissions', async () => {
  const { service, identity, counts } = setup({ missing: 'agent' });
  await assert.rejects(service.sync(identity), /agent/);
  assert.deepEqual(counts(), [0, 0]);
});

test('the guard derives registration policy from a verified Supabase user, not client role names', async () => {
  const guard = new AuthGuard({});
  const user = { id: randomUUID(), email: `${randomUUID()}@example.test`, user_metadata: { registration_source: 'self_service', full_name: 'New Member', roles: ['arbitrary_role'] } };
  const token = randomBytes(24).toString('hex');
  guard.supabase = { auth: { getUser: async supplied => { assert.equal(supplied, token); return { data: { user }, error: null }; } } };
  const identity = await guard.resolveIdentity(token);
  assert.equal(identity.selfRegistered, true);
  assert.equal(identity.firstName, 'New');
  assert.equal(identity.roles, undefined);
  user.user_metadata.registration_source = 'other';
  assert.equal((await guard.resolveIdentity(token)).selfRegistered, false);
});

test('the guard preserves separate multi-word names, supports legacy full_name, and keeps an explicit empty surname', async () => {
  const guard = new AuthGuard({});
  const cases = [
    [{ first_name: ' Mary Ann ', last_name: ' Van Buren ', full_name: 'Different Legacy Name' }, 'Mary Ann', 'Van Buren'],
    [{ full_name: 'Legacy Family Name' }, 'Legacy', 'Family Name'],
    [{ first_name: 'Single', last_name: '', full_name: 'Single Incorrect' }, 'Single', ''],
  ];
  for (const [user_metadata, firstName, lastName] of cases) {
    guard.supabase = { auth: { getUser: async () => ({ data: { user: { id: randomUUID(), user_metadata } }, error: null }) } };
    const identity = await guard.resolveIdentity(randomBytes(24).toString('hex'));
    assert.equal(identity.firstName, firstName);
    assert.equal(identity.lastName, lastName);
  }
});
