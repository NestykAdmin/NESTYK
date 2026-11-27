const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { IsNull, FindOperator } = require('typeorm');
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { TenantBillingService } = require('../src/billing/tenant-billing.service.ts');
const { ContractRemindersService } = require('../src/agent/reminders/contract-reminders.service.ts');
const { AGENT_ROOM_ONLY } = require('../src/agent/contracts/contract-room.ts');

const FILTER = 'self_owner_room_id IS NULL';

/** Query builder that records the SQL of every where/andWhere call; any other chained call returns the builder. */
function recorder(rows = []) {
  const sql = [];
  const qb = new Proxy({}, {
    get(_t, name) {
      if (name === 'sql') return sql;
      if (name === 'where' || name === 'andWhere') return (text) => { sql.push(String(text)); return qb; };
      if (name === 'getRawMany' || name === 'getMany') return async () => rows;
      if (name === 'then') return undefined;
      return () => qb;
    },
  });
  return qb;
}

test('the shared constant is the agent-only room filter on alias c', () => {
  assert.equal(AGENT_ROOM_ONLY, 'c.self_owner_room_id IS NULL');
});

test('agent query excludes self owner contracts', () => {
  const qb = recorder();
  const service = new AgentContractsService({ getRepository: () => ({ createQueryBuilder: () => qb }) });
  service.query(7);
  assert.ok(qb.sql.some((s) => s.includes(FILTER)), qb.sql.join(' | '));
  assert.ok(qb.sql.some((s) => s.includes('created_by_user_id')), 'still scoped to the agent');
});

test('rent bill scan skips self owner leases', () => {
  const qb = recorder();
  const service = new TenantBillingService({ getRepository: () => ({ createQueryBuilder: () => qb }) });
  service.activeLeases();
  assert.ok(qb.sql.some((s) => s.includes(FILTER)), qb.sql.join(' | '));
});

test('daily close skips self owner leases', async () => {
  const qb = recorder([]);
  const service = new TenantBillingService({ getRepository: () => ({ createQueryBuilder: () => qb }) });
  assert.equal(await service.persistEndedLeases('2027-01-16'), 0);
  assert.ok(qb.sql.some((s) => s.includes(FILTER)), qb.sql.join(' | '));
});

function reminderService() {
  const finds = [];
  const refunds = recorder();
  const db = {
    getRepository: (entity) => entity.name === 'DealCancellationEntity'
      ? { createQueryBuilder: () => refunds }
      : { find: async (options) => { finds.push(options.where); return []; } },
  };
  return { service: new ContractRemindersService(db), finds, refunds };
}

test('reminder scan skips self owner contracts', async () => {
  const { service, finds } = reminderService();
  await service.due('2027-01-16');
  assert.ok(finds[0].self_owner_room_id instanceof FindOperator);
  assert.deepEqual(finds[0].self_owner_room_id, IsNull());
});

test('agent reminders skip self owner contracts too', async () => {
  const { service, finds } = reminderService();
  await service.due('2027-01-16', { agentId: 7 });
  assert.equal(finds[0].created_by_user_id, 7);
  assert.deepEqual(finds[0].self_owner_room_id, IsNull());
});

test('landlord reminders are unchanged', async () => {
  const { service, finds } = reminderService();
  await service.due('2027-01-16', { landlordUserId: 5 });
  assert.equal(finds[0].owner_user_id, 5);
  assert.equal('self_owner_room_id' in finds[0], false);
});

test('open refunds scan skips self owner contracts', async () => {
  const { service, refunds } = reminderService();
  await service.due('2027-01-16');
  assert.ok(refunds.sql.some((s) => s.includes(FILTER)), refunds.sql.join(' | '));
});
