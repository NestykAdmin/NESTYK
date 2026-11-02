// R1 (entity analysis 5.2 and 5.3, Mos 2 Nov 2026): agents sign up by themselves. The landlord search gives back only
// what this agent typed in this agent's own reservation letters, never the account behind an email, and an agent's
// letter never rewrites an account that already exists. The SQL was also run on Postgres 16 in the lab (review record).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { AgentContractsController } = require('../src/agent/contracts/agent-contracts.controller.ts');
const { ensurePartyLogin } = require('../src/agent/contracts/party-login.ts');
const { UserEntity } = require('../src/entities/user.entity.ts');
const { MasterRoleEntity } = require('../src/entities/master-role.entity.ts');
const { UserRoleEntity } = require('../src/entities/user-role.entity.ts');

function service(rows = []) {
  const calls = [];
  const db = { query: async (sql, params) => { calls.push({ sql, params }); return rows; } };
  return { svc: new AgentContractsService(db), calls };
}

test('R1: the search reads only the landlord this agent typed in this agent\'s own reservation letters', async () => {
  const { svc, calls } = service([{ id: 9, email: 'l@x.test', phone: '0811', first_name: 'Lan', last_name: 'Lord', name: 'Lan Lord', identity_number: '1234567890123', nationality: 'Thai' }]);
  const rows = await svc.searchOwnerUsers(7, 'lan');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ['%lan%', 7]);
  assert.match(calls[0].sql, /WHERE lc\.created_by_user_id = \$2/);
  assert.match(calls[0].sql, /lc\.data->'reservationLetter'/);
  // Nothing comes from the accounts table, so naming someone's email in a draft shows nothing of that account.
  assert.doesNotMatch(calls[0].sql, /\bFROM users\b|\bJOIN users\b/);
  // The agent's own landlord is still filled in completely, identity number included.
  assert.deepEqual(rows[0], { id: 9, name: 'Lan Lord', firstName: 'Lan', lastName: 'Lord', email: 'l@x.test', phone: '0811', identityNumber: '1234567890123', nationality: 'Thai' });
});

test('R1: an older letter with only a full name still shows that name', async () => {
  const { svc } = service([{ id: null, email: 'o@x.test', phone: null, first_name: null, last_name: null, name: 'Old Name', identity_number: null, nationality: null }]);
  const [row] = await svc.searchOwnerUsers(7, 'old');
  assert.deepEqual(row, { id: null, name: 'Old Name', firstName: '', lastName: '', email: 'o@x.test', phone: '', identityNumber: '', nationality: '' });
});

test('R1: an identity number is not a search key', async () => {
  const { svc, calls } = service();
  await svc.searchOwnerUsers(7, '12345');
  assert.doesNotMatch(calls[0].sql, /landlordId'\)?[^,\n]*ILIKE|identity_number[^,\n]*ILIKE/);
});

test('R1: no agent id, an empty or too long query reaches no SQL', async () => {
  const { svc, calls } = service();
  for (const [agentId, q] of [[0, 'a'], [NaN, 'a'], [undefined, 'a'], [7, '   '], [7, 'x'.repeat(81)]]) {
    assert.deepEqual(await svc.searchOwnerUsers(agentId, q), []);
  }
  assert.equal(calls.length, 0);
});

test('R1: the route passes the signed-in agent to the search', async () => {
  const seen = [];
  const controller = new AgentContractsController({ searchOwnerUsers: (...args) => { seen.push(args); return []; } });
  controller.ownerUsers({ id: 42 }, 'som');
  controller.ownerUsers({ id: 43 }, undefined);
  assert.deepEqual(seen, [[42, 'som'], [43, '']]);
});

function loginDb(existing) {
  const saved = [];
  const user = existing && { ...existing };
  const manager = {
    findOne: async (entity, { where }) => {
      if (entity === UserEntity) return user ?? null;
      assert.equal(entity, UserRoleEntity); return null;
    },
    findOneBy: async (entity) => { assert.equal(entity, MasterRoleEntity); return { id: 3, name: 'landlord' }; },
    create: (_entity, data) => ({ ...data }),
    save: async (row) => { saved.push({ ...row }); return row; },
  };
  return {
    db: { getRepository: () => ({ findOneBy: async () => user ?? null }), transaction: async (fn) => fn(manager) },
    saved,
  };
}
const letterLandlord = { email: 'Real@Owner.test', phone: '0899999999', firstName: 'Typed', lastName: 'ByAgent', identityNumber: '9999999999999', nationality: 'Other', role: 'landlord', who: 'ผู้ให้เช่า' };

test('R1 (5.3): a letter naming an existing account never rewrites its name, identity number, nationality or phone', async () => {
  const { db, saved } = loginDb({ id: 5, email: 'real@owner.test', supabase_user_id: 'sb-5', first_name: 'Real', last_name: 'Owner', phone: '0811111111', identity_number: '1111111111111', nationality: 'Thai' });
  assert.equal(await ensurePartyLogin(db, letterLandlord), 5);
  const account = saved.find((row) => row.id === 5);
  assert.deepEqual(
    { first: account.first_name, last: account.last_name, id: account.identity_number, nat: account.nationality, phone: account.phone },
    { first: 'Real', last: 'Owner', id: '1111111111111', nat: 'Thai', phone: '0811111111' },
  );
});

test('R1 (5.3): an existing account with empty fields gets only those fields filled', async () => {
  const { db, saved } = loginDb({ id: 6, email: 'real@owner.test', supabase_user_id: 'sb-6', first_name: '', last_name: '', phone: null, identity_number: null, nationality: 'Thai' });
  await ensurePartyLogin(db, letterLandlord);
  const account = saved.find((row) => row.id === 6);
  assert.deepEqual(
    { first: account.first_name, last: account.last_name, id: account.identity_number, nat: account.nationality, phone: account.phone },
    { first: 'Typed', last: 'ByAgent', id: '9999999999999', nat: 'Thai', phone: '0899999999' },
  );
});
