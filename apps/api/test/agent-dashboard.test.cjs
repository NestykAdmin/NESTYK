const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);

function dashboard() {
  const filename = path.join(__dirname, '../src/agent/dashboard/agent-dashboard.service.ts');
  assert.ok(fs.existsSync(filename), 'agent dashboard aggregation is implemented');
  return require(filename).AgentDashboardService;
}
const at = value => new Date(value);
const now = at('2026-10-21T18:00:00Z'); // October 22, 01:00 Bangkok.
const dated = { created_at: at('2026-10-20T00:00:00Z'), updated_at: now };
const tenant = (id, agent = 7) => ({ ...dated, id, name: `Tenant ${id}`, created_by_user_id: agent });
const lead = (id, agent = 7, status = 'new') => ({ ...dated, id, name: `Lead ${id}`, status, created_by_user_id: agent });
const room = (id, agent = 7) => ({ ...dated, id, created_by_user_id: agent, is_scout_room: true, visibility: id % 2 ? 'published' : 'private', room_status: { code: id % 3 ? 'available' : 'occupied' }, listing_title: `Room ${id}`, room_id: String(id), property: { name: `Project ${id}`, district: 'Watthana' }, layout_values: [{ value: '2', layout: { code: 'bedroom' } }, { value: '48.5', layout: { code: 'room_size' } }], price_rows: [{ price: '12000.50' }] });
const contract = (id, tenantId, status, extra = {}) => ({ ...dated, id, tenant_id: tenantId, created_by_user_id: 7, status, start_date: '2026-10-01', end_date: '2026-11-01', previous_agreement_id: null, agreement_type_code: 'lease', template: { form_kind: 'lease' }, agreement_type: { form_kind: 'lease' }, tenant: tenant(tenantId), rent_room: room(tenantId), owner_delivered_at: null, tenant_delivered_at: null, ...extra });
const bill = (id, amount, status = 'pending', extra = {}) => ({ ...dated, id, amount, status, period: '2026-10', grace_until: '2026-10-21', tenant_id: 1, lease_contract_id: 1, tenant: tenant(1), lease_contract: contract(1, 1, 'active'), paid_at: null, payment_slip_path: null, slip_submitted_at: null, ...extra });
const viewing = (id, scheduledAt, status = 'scheduled', agent = 7, leadId = 1) => ({ ...dated, id, created_by_user_id: agent, lead_id: leadId, lead: lead(leadId, agent), rent_room: room(1, agent), scheduled_at: at(scheduledAt), status });

/** The external boundary is a read-only database. Evaluate the emitted ownership predicates. */
function fixture(data = {}, failing = []) {
  const sets = { RentRoomEntity: [], LeadEntity: [], LeadViewingEntity: [], TenantEntity: [], LeaseContractEntity: [], TenantBillEntity: [], ...data };
  const queries = [];
  const db = { getRepository(entity) {
    const denyWrite = () => assert.fail('dashboard must not mutate persisted data');
    return { save: denyWrite, update: denyWrite, insert: denyWrite, delete: denyWrite, createQueryBuilder(alias) {
      let conditions = []; let parameters = {}; let limit; let fields;
      const qb = {};
      for (const method of ['leftJoin', 'innerJoin']) qb[method] = () => qb;
      qb.select = selection => { fields = selection; return qb; };
      qb.where = (sql, params) => { conditions = [sql]; Object.assign(parameters, params); return qb; };
      qb.andWhere = (sql, params) => { conditions.push(sql); Object.assign(parameters, params); return qb; };
      for (const method of ['orderBy', 'addOrderBy']) qb[method] = () => qb;
      qb.take = number => { limit = number; return qb; };
      qb.getMany = async () => {
        queries.push({ entity: entity.name, alias, conditions, parameters, fields, limit });
        if (failing.includes(entity.name)) throw new Error('unavailable source');
        assert.ok(conditions.some(sql => sql.includes('created_by_user_id')), `${entity.name} must be agent scoped`);
        const agentId = parameters.agentId;
        const ownership = conditions.find(sql => sql.includes('created_by_user_id'));
        const aliases = [...ownership.matchAll(/(\w+)\.created_by_user_id = :agentId/g)].map(match => match[1]);
        let rows = sets[entity.name].filter(row => {
          const owned = aliases.map(owner => {
            const source = owner === alias ? row : owner === 'c' ? row.lease_contract : owner === 'tenant' ? row.tenant : null;
            return source?.created_by_user_id === agentId;
          });
          return ownership.includes(' OR ') ? owned.some(Boolean) : owned.every(Boolean);
        });
        if (entity.name === 'RentRoomEntity' && conditions.some(sql => sql.includes('is_scout_room'))) rows = rows.filter(row => row.is_scout_room);
        if (entity.name === 'TenantBillEntity') rows = rows.filter(row => ['lease', 'renewal'].includes(row.lease_contract.template?.form_kind ?? row.lease_contract.agreement_type?.form_kind));
        return limit ? rows.slice(0, limit) : rows;
      };
      return qb;
    } };
  }, transaction() { assert.fail('dashboard must not start a write transaction'); } };
  return { db, queries, service: new (dashboard())(db) };
}
const work = (data, kind) => data.actionRequired.items.find(item => item.kind === kind);

test('dashboard counts all agent scout inventory and open leads beyond 50 without leaking another agent', async () => {
  const f = fixture({ RentRoomEntity: [...Array.from({ length: 63 }, (_, i) => room(i + 1)), room(99, 8), { ...room(100), is_scout_room: false }], LeadEntity: [...Array.from({ length: 61 }, (_, i) => lead(i + 1)), lead(99, 8), lead(100, 7, 'lost'), lead(101, 7, 'booked')] });
  const result = await f.service.getDashboard(7, now);
  assert.equal(result.business.totalListings, 63);
  assert.equal(result.business.availableListings, 42);
  assert.equal(result.business.openLeads, 61);
  assert.equal(work(result, 'lead_follow_up').count, 61);
  assert.equal(result.inventory.published, 32);
  assert.equal(result.inventory.private, 31);
  assert.deepEqual(result.inventory.preview.map(item => item.id), [63, 62, 61, 60, 59]);
  assert.equal(result.inventory.preview[0].beds, 2);
  assert.equal(result.inventory.preview[0].area, 'Watthana');
  assert.equal(result.inventory.preview[0].price, 12000.5);
  assert.equal(result.activity.items.length, 8);
  assert.ok(!JSON.stringify(result).includes('phone'));
  const other = await f.service.getDashboard(8, now);
  assert.equal(other.business.totalListings, 1);
  assert.equal(other.business.openLeads, 1);
  assert.equal(other.inventory.preview[0].id, 99);
  assert.ok(f.queries.every(query => !query.limit), 'counts must never inherit list pagination');
});

test('empty persisted data is a real empty dashboard with commission explicitly unavailable', async () => {
  const result = await fixture().service.getDashboard(7, now);
  assert.equal(result.generatedAt, '2026-10-21T18:00:00.000Z');
  assert.equal(result.business.status, 'available');
  assert.equal(result.business.currentClients, 0);
  assert.equal(result.inventory.available, 0);
  assert.deepEqual(result.schedule.items, []);
  assert.equal(result.clients.renewal, null);
  assert.equal(result.rent.periodYear, 2026);
  assert.equal(result.rent.periodMonth, 10);
  assert.equal(result.rent.totalDue, 0);
  assert.equal(result.commission.status, 'not_configured');
  assert.ok(!('greetingName' in result));
  assert.ok(!('isDemoPreview' in result));
});

test('today schedule uses inclusive Bangkok start and exclusive next day and follow-up excludes future scheduled viewings', async () => {
  const f = fixture({ LeadEntity: [lead(1), lead(2, 7, 'inprogress'), lead(3, 7, 'inprogress')], LeadViewingEntity: [
    viewing(1, '2026-10-21T16:59:59.999Z'), viewing(2, '2026-10-21T17:00:00Z'), viewing(3, '2026-10-22T16:59:59.999Z'), viewing(4, '2026-10-22T17:00:00Z'), viewing(5, '2026-10-22T10:00:00Z', 'cancelled', 7, 2), viewing(6, '2026-10-22T11:00:00Z', 'done', 7, 3), viewing(7, '2026-10-22T10:00:00Z', 'scheduled', 8),
  ] });
  const result = await f.service.getDashboard(7, now);
  assert.deepEqual(result.schedule.items.map(item => item.id), ['2', '3']);
  assert.ok(result.schedule.items.every(item => item.kind === 'viewing' && item.status === 'confirmed'));
  assert.equal(work(result, 'lead_follow_up').count, 2);
});

test('Bangkok month boundary uses current persisted billing period rather than UTC month', async () => {
  const f = fixture({ TenantBillEntity: [bill(1, '10.00', 'paid', { period: '2026-10' }), bill(2, '22.00', 'paid', { period: '2026-11' })] });
  const result = await f.service.getDashboard(7, at('2026-10-31T17:00:00Z'));
  assert.equal(result.rent.periodMonth, 11);
  assert.equal(result.rent.totalDue, 22);
  assert.equal(result.rent.received, 22);
});

test('tenant stage and renewal work count tenants once and suppress ended stays and successor renewals', async () => {
  const f = fixture({ TenantEntity: Array.from({ length: 7 }, (_, i) => tenant(i + 1)), LeaseContractEntity: [
    contract(1, 1, 'active'), contract(2, 1, 'active', { end_date: '2026-11-10' }),
    contract(3, 2, 'draft'), contract(4, 3, 'awaiting_signatures'), contract(5, 3, 'awaiting_agent_review'),
    contract(6, 4, 'expired'), contract(7, 5, 'expired'), contract(8, 5, 'draft', { template: { form_kind: 'reservation' } }),
    contract(9, 6, 'active', { end_date: '2026-10-25' }), contract(10, 6, 'draft', { template: { form_kind: 'renewal' }, previous_agreement_id: 9, start_date: '2026-10-26', end_date: '2027-10-25' }),
    contract(11, 7, 'active', { end_date: '2026-10-21' }), contract(12, 99, 'awaiting_signatures', { created_by_user_id: 8 }),
  ] });
  const result = await f.service.getDashboard(7, now);
  assert.equal(result.clients.tenants, 3);
  assert.equal(result.clients.draft, 2);
  assert.equal(result.clients.signing, 1);
  assert.equal(result.business.currentClients, 6);
  assert.equal(result.business.tenantsCount, 3);
  assert.equal(work(result, 'awaiting_signature').count, 2);
  assert.equal(work(result, 'renewal').count, 1);
  assert.deepEqual(result.clients.renewal, { id: '2', title: 'Project 1', endsAt: '2026-11-10', daysLeft: 19 });
});

test('rent sums exact cents, only confirmed paid is received and overdue work includes old persisted bills and unconfirmed slips', async () => {
  const paid = bill(1, '0.10', 'paid', { paid_at: at('2026-10-20T01:00:00Z') });
  const f = fixture({ TenantBillEntity: [paid, bill(2, '0.20'), bill(3, '100.50', 'pending', { payment_slip_path: 'private-slip', slip_submitted_at: now }), bill(4, '40.00', 'pending', { period: '2026-09' }), bill(5, '50.00', 'pending', { grace_until: '2026-10-22' }), bill(6, '9999.00', 'paid', { tenant: tenant(1, 8), lease_contract: contract(1, 1, 'active', { created_by_user_id: 8 }) }), bill(7, '0.20', 'paid'), bill(8, '15.00', 'paid', { lease_contract: contract(1, 1, 'active', { created_by_user_id: 8 }) })] });
  const result = await f.service.getDashboard(7, now);
  assert.equal(result.rent.totalDue, 166);
  assert.equal(result.rent.received, 15.3);
  assert.equal(result.rent.overdue, 100.7);
  assert.equal(work(result, 'overdue_payment').count, 3);
  assert.equal(work(result, 'overdue_payment').amount, 140.7);
  assert.ok(!JSON.stringify(result).includes('private-slip'));
});

test('activity uses delivery, creation and paid timestamps and never turns updated_at or draft creation into events', async () => {
  const f = fixture({ LeadEntity: [lead(1)], LeaseContractEntity: [contract(1, 1, 'draft'), contract(2, 1, 'awaiting_signatures', { owner_delivered_at: at('2026-10-21T10:00:00Z'), tenant_delivered_at: at('2026-10-21T11:00:00Z') })], TenantBillEntity: [bill(1, '10.00', 'paid', { paid_at: at('2026-10-21T12:00:00Z') }), bill(2, '20.00', 'pending', { paid_at: now })] });
  const result = await f.service.getDashboard(7, now);
  assert.deepEqual(result.activity.items.map(item => [item.kind, item.at]), [
    ['payment_recorded', '2026-10-21T12:00:00.000Z'], ['contract_sent', '2026-10-21T11:00:00.000Z'], ['contract_sent', '2026-10-21T10:00:00.000Z'], ['lead_added', '2026-10-20T00:00:00.000Z'],
  ]);
});

test('independent source errors mark affected sections error while preserving usable true sections', async () => {
  const f = fixture({ LeadEntity: [lead(1)], TenantBillEntity: [bill(1, '12.30', 'paid')] }, ['RentRoomEntity']);
  const result = await f.service.getDashboard(7, now);
  assert.equal(result.inventory.status, 'error');
  assert.equal(result.business.status, 'error');
  assert.equal(result.business.openLeads, 1);
  assert.equal(result.rent.status, 'available');
  assert.equal(result.rent.received, 12.3);
  assert.equal(result.schedule.status, 'available');
  const billError = await fixture({}, ['TenantBillEntity']).service.getDashboard(7, now);
  assert.equal(billError.rent.status, 'error');
  assert.equal(billError.actionRequired.status, 'error');
  assert.equal(billError.activity.status, 'error');
  assert.equal(billError.inventory.status, 'available');
});

test('GET agent dashboard enforces authentication and agent role and uses the current user id', async t => {
  const Service = dashboard();
  const { AgentDashboardController } = require('../src/agent/dashboard/agent-dashboard.controller.ts');
  const { AuthGuard } = require('../src/auth/guards/auth.guard.ts');
  const { AuthService } = require('../src/auth/auth.service.ts');
  const { Module, UnauthorizedException } = require('@nestjs/common');
  const { NestFactory } = require('@nestjs/core');
  const original = AuthGuard.prototype.canActivate;
  // Override the authentication boundary: no credentials or access tokens are created or stored.
  AuthGuard.prototype.canActivate = async function(context) {
    const request = context.switchToHttp().getRequest();
    if (!request.headers['x-test-user']) throw new UnauthorizedException();
    request.user = { id: Number(request.headers['x-test-user']), roleNames: [request.headers['x-test-role']] };
    return true;
  };
  t.after(() => { AuthGuard.prototype.canActivate = original; });
  const f = fixture({ LeadEntity: [lead(1), lead(2, 8)] });
  class TestModule {}
  Module({ controllers: [AgentDashboardController], providers: [{ provide: Service, useValue: f.service }, { provide: AuthService, useValue: {} }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const url = (await app.getUrl()) + '/agent/dashboard';
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { 'x-test-user': '7', 'x-test-role': 'tenant' } })).status, 403);
  const response = await fetch(url, { headers: { 'x-test-user': '8', 'x-test-role': 'agent' } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.business.openLeads, 1);
  assert.equal(result.activity.items[0].subject, 'Lead 2');
});


test('read queries compile against real entity metadata with narrow projections and no database connection', async () => {
  const { DataSource } = require('typeorm');
  const { ALL_ENTITIES } = require('../src/entities/index.ts');
  const db = new DataSource({ type: 'postgres', entities: ALL_ENTITIES });
  await db.buildMetadatas();
  const queries = [];
  const readonlyDb = { getRepository(entity) {
    const repository = db.getRepository(entity);
    return { createQueryBuilder(alias) {
      const qb = repository.createQueryBuilder(alias);
      qb.getMany = async () => { queries.push(qb.getQueryAndParameters()); return []; };
      return qb;
    } };
  } };
  const result = await new (dashboard())(readonlyDb).getDashboard(7, now);
  assert.equal(result.business.status, 'available');
  assert.equal(queries.length, 6);
  for (const [sql, parameters] of queries) {
    assert.match(sql, /^SELECT /);
    assert.deepEqual(parameters, [7]);
    assert.doesNotMatch(sql, /\b(?:LIMIT|OFFSET|INSERT|UPDATE|DELETE)\b/);
    assert.doesNotMatch(sql, /"(?:phone|identity_number|data|party_snapshot|document_url|payment_slip_path|owner_signature_url)"/);
  }
  const billsSql = queries.find(([sql]) => sql.includes('FROM "tenant_bills"'))[0];
  assert.match(billsSql, /"c"\."created_by_user_id" = \$1 OR "tenant"\."created_by_user_id" = \$1/);
  assert.match(billsSql, /COALESCE\("template"\."form_kind", "agreementType"\."form_kind"\) IN \('lease', 'renewal'\)/);
});
