// QA (5 Nov 2026): GET /bills/mine, /bills/mine/next, /bills/received and /bills/agent/tenants/:id issued bills before
// answering, so opening a page wrote to the database. They now only read; POST /bills/mine/refresh and
// POST /bills/received/refresh (called by the app before it reads) issue the bills that are due.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
  fileName: filename,
}).outputText, filename);
const { TenantBillingService } = require('../src/billing/tenant-billing.service.ts');
const { BillRefreshController } = require('../src/billing/bill-refresh.controller.ts');
const { BillingModule } = require('../src/billing/billing.module.ts');

/** A query builder stand-in: every chain call returns itself; getMany/getOne return the given rows. */
function query(rows = []) {
  const qb = new Proxy({}, { get: (_t, key) => {
    if (key === 'getMany') return async () => rows;
    if (key === 'getOne') return async () => rows[0] ?? null;
    if (key === 'then') return undefined;
    return () => qb;
  } });
  return qb;
}

function service() {
  const writes = [];
  const db = {
    getRepository: () => ({ findOneBy: async () => ({ id: 2 }), find: async () => [], createQueryBuilder: () => query() }),
    transaction: async () => { writes.push('transaction'); },
  };
  const s = new TenantBillingService(db);
  s.activeLeases = () => query([]);
  s.billsQuery = () => query([]);
  s.agentBills = () => query([]);
  const insertBills = s.insertBills.bind(s);
  s.insertBills = async (leases, today) => { writes.push('insertBills'); return insertBills(leases, today); };
  return { s, writes };
}

test('the four GET routes only read: no bills are issued and no transaction is opened', async () => {
  const { s, writes } = service();
  await s.listMine(8);
  await s.nextForUser(8);
  await s.listReceived(10);
  await s.listForAgentTenant(7, 2);
  assert.deepEqual(writes, []);
});

test('the refresh POSTs issue the due bills: tenant for their own leases, landlord for theirs', async () => {
  const { s, writes } = service();
  const leases = [];
  s.activeLeases = () => query(leases);
  s.ownerLeases = () => query(leases);
  assert.deepEqual(await s.refreshForTenant(8), { issued: 0 });
  assert.deepEqual(await s.refreshForOwner(10), { issued: 0 });
  assert.deepEqual(writes, ['insertBills', 'insertBills']);
});

test('routes: POST mine/refresh needs the tenant role, POST received/refresh the landlord role; both answer 200', () => {
  const route = (name) => {
    const handler = BillRefreshController.prototype[name];
    return { path: Reflect.getMetadata('path', handler), method: Reflect.getMetadata('method', handler),
      code: Reflect.getMetadata('__httpCode__', handler), roles: Reflect.getMetadata('roles', handler) };
  };
  assert.deepEqual(route('tenant'), { path: 'mine/refresh', method: 1, code: 200, roles: ['tenant'] }); // 1 = POST
  assert.deepEqual(route('landlord'), { path: 'received/refresh', method: 1, code: 200, roles: ['landlord'] });
  assert.equal(Reflect.getMetadata('path', BillRefreshController), 'bills');
  assert.ok(Reflect.getMetadata('controllers', BillingModule).includes(BillRefreshController), 'registered in BillingModule');
});
