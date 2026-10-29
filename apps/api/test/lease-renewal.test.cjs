const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const root = require('node:path').resolve(__dirname, '../../..');
const requireRepo = createRequire(`${root}/package.json`);
const ts = requireRepo('typescript');
requireRepo('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentContractsService } = requireRepo('./apps/api/src/agent/contracts/agent-contracts.service.ts');
const { emptyLeaseRenewal, firstLeaseFields } = requireRepo('./apps/api/src/agent/contracts/lease-renewal.ts');
const { emptyLeaseAgreement } = requireRepo('./apps/api/src/agent/contracts/lease-agreement.ts');
const { LeaseContractEntity: Contract } = requireRepo('./apps/api/src/entities/lease-contract.entity.ts');
const { AgreementTemplateEntity: Template } = requireRepo('./apps/api/src/entities/agreement-template.entity.ts');
const { LeadEntity: Lead } = requireRepo('./apps/api/src/entities/lead.entity.ts');
const { TenantEntity: Tenant } = requireRepo('./apps/api/src/entities/tenant.entity.ts');
const { RentRoomEntity: Room } = requireRepo('./apps/api/src/entities/rent-room.entity.ts');
const { currentRentContracts, openRentBills } = requireRepo('./apps/api/src/billing/tenant-billing.service.ts');
let now = '2026-10-12T05:00:00Z';
const RealDate = Date;
global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return new RealDate(now).getTime(); } };
const prior = { id: 20, contract_no: 'LS202500020', template_id: 1, tenant_id: 2, rent_room_id: 3, lead_id: 1, status: 'active', start_date: '2025-11-01', end_date: '2026-10-31', root_agreement_id: 20, data: { leaseAgreement: { issueDate: '2025-10-20' } } };
const renewal = { ...emptyLeaseRenewal(), issueDate: '2026-10-12', landlordName: 'Owner', tenantName: 'Tenant', propertyLine: 'Room A', originalLeaseNo: prior.contract_no, originalLeaseDate: '2025-10-20', originalExpiryDate: prior.end_date, renewMonths: '12', startDate: '2026-11-01', endDate: '2027-10-31', monthlyRent: '15000', depositCarried: '30000' };
function serviceFixture(extra = []) {
  const saved = [];
  const templates = { lease: { id: 1, form_kind: 'lease', data_schema: { type: 'object' } }, lease_renewal: { id: 2, form_kind: 'renewal', data_schema: { type: 'object' } } };
  const manager = {
    findOne: async (entity, options) => entity === Contract ? prior : entity === Lead ? { id: 1, status: 'booked', tenant_id: 2, rent_room_id: 3 } : entity === Room ? { id: 3, properties_id: 4, owner_id: 5 } : null,
    findOneBy: async (entity, options) => entity === Template ? templates.lease : entity === Tenant ? { id: 2, name: 'Tenant' } : null,
    getRepository: () => ({ createQueryBuilder: () => {
      const params = {}; const clauses = [];
      const qb = {};
      for (const name of ['where', 'andWhere', 'leftJoin', 'orderBy']) qb[name] = (sql, args) => { clauses.push(sql); Object.assign(params, args); return qb; };
      qb.getCount = async () => clauses.includes('c.previous_agreement_id = :previousId') ? 0 : extra.filter(c => !params.closed.includes(c.status) && params.formKinds.includes(c.formKind) && c.start_date <= params.end && (c.effective_end_date ?? c.end_date ?? '9999-12-31') >= params.start).length;
      qb.getMany = async () => [{ status: 'active', document_url: '7/1/generated/reservation_letter/letter-v1/booked.pdf' }];
      qb.getOne = async () => null;
      return qb;
    }}),
    query: async () => [], create: (_, data) => data,
    save: async (entity, data) => { const row = { id: saved.length + 100, ...data }; saved.push(row); return row; },
    update: async () => ({ affected: 1 }),
  };
  const service = new AgentContractsService({ getRepository: () => ({ findOneBy: async ({code}) => ({ code, form_kind: code === 'lease_renewal' ? 'renewal' : 'lease' }), findOne: async ({where}) => templates[where.agreement_type_code] }), transaction: fn => fn(manager) });
  service.view = async (agent, id) => saved.find(c => c.id === id);
  return service;
}
function createRenewal(service, changes = {}) { return service.create(7, { leadId: 1, agreementTypeCode: 'lease_renewal', previousAgreementId: prior.id, startDate: renewal.startDate, endDate: renewal.endDate, monthlyRent: 15000, deposit: 30000, data: { leaseRenewal: { ...renewal, ...changes } } }); }
test('renewal gate rejects 31 days early and accepts exactly 30 days without moving the new term', async () => {
  now = '2026-09-30T05:00:00Z';
  try {
    await assert.rejects(() => createRenewal(serviceFixture()), /30/);
    now = '2026-10-01T05:00:00Z';
    const c = await createRenewal(serviceFixture());
    assert.equal(c.start_date, '2026-11-01');
    assert.equal(c.end_date, '2027-10-31');
  } finally { now = '2026-10-12T05:00:00Z'; }
});
test('Aof 29 Oct 2026: the full-lease renewal route is closed; renewals go by the renewal addendum', async () => {
  const input = { leadId: 1, previousAgreementId: prior.id, startDate: '2026-11-01', endDate: '2027-10-31', monthlyRent: 15000, deposit: 30000 };
  await assert.rejects(() => serviceFixture().create(7, input), e => e.getStatus() === 400 && e.getResponse().code === 'RENEW_WITH_ADDENDUM');
});
test('rejects overlapping leases and renewals, including drafts, before saving a renewal', async () => {
  for (const formKind of ['lease', 'renewal']) {
    const occupied = { formKind, status: 'draft', start_date: '2026-11-01', end_date: '2027-10-31' };
    await assert.rejects(() => createRenewal(serviceFixture([occupied])), e => e.getStatus() === 409);
  }
  const c = await createRenewal(serviceFixture([{ formKind: 'broker_appointment', start_date: '2026-11-01', end_date: '2027-10-31' }]));
  assert.equal(c.status, 'draft');
});
test('a new lease cannot bypass an existing renewal, but cancelled renewals do not block it', async () => {
  const input = { leadId: 1, startDate: '2026-11-01', endDate: '2027-10-31', monthlyRent: 15000, deposit: 30000 };
  const occupied = { formKind: 'renewal', status: 'active', start_date: input.startDate, end_date: input.endDate };
  await assert.rejects(() => serviceFixture([occupied]).create(7,input), e => e.getStatus() === 409);
  assert.equal((await serviceFixture([{ ...occupied, status: 'cancelled' }]).create(7,input)).status,'draft');
});
test('successive renewals reference the predecessor issue date rather than its future start date', () => {
  const renewal = { contract_no: 'RN202600001', start_date: '2026-11-01', end_date: '2027-10-31', data: { leaseRenewal: { issueDate: '2026-10-12' } } };
  assert.equal(firstLeaseFields(renewal).firstLeaseDate,'2026-10-12');
});
test('renewal stores predecessor reference and original root from the server, ignoring forged references', async () => {
  const c = await createRenewal(serviceFixture(), { originalLeaseNo: 'UNRELATED-CONTRACT', originalLeaseDate: '2020-01-01', firstLeaseNo: 'FAKE-ROOT' });
  assert.equal(c.data.leaseRenewal.originalLeaseNo, prior.contract_no);
  assert.equal(c.data.leaseRenewal.originalLeaseDate, '2025-10-20');
  assert.equal(c.data.leaseRenewal.originalExpiryDate, prior.end_date);
  assert.equal(c.data.leaseRenewal.firstLeaseNo, prior.contract_no);
  assert.equal(c.previous_agreement_id, prior.id);
  assert.equal(c.root_agreement_id, prior.id);
});
test('renewal rejects impossible dates in the document, not just top-level lease dates', async () => {
  for (const changes of [{ issueDate: '2026-02-30' }, { originalLeaseDate: '2025-02-29' }, { issueDate: '2026-13-01' }]) {
    await assert.rejects(() => createRenewal(serviceFixture(), changes), e => e.getStatus() === 400);
  }
});
test('lease overlays cannot bypass real-date or financial precision validation', async () => {
  const base = { ...emptyLeaseAgreement(), issueDate: '2026-10-01', landlordName: 'Owner', tenantName: 'Tenant', project: 'Project', termFrom: '2026-10-01', termTo: '2027-09-30', monthlyRent: '15000', depositAmount: '30000' };
  for (const changes of [{ termFrom: '2026-02-30' }, { monthlyRent: '15000.111' }, { depositAmount: '30000.111' }]) {
    await assert.rejects(() => serviceFixture().create(7, { leadId: 1, startDate: '2026-10-01', endDate: '2027-09-30', monthlyRent: 15000, deposit: 30000, data: { leaseAgreement: { ...base, ...changes } } }), e => e.getStatus() === 400);
  }
});
test('renewal rejects a gap, overlap, wrong anniversary, invalid months and mismatched actual predecessor expiry', async () => {
  for (const changes of [{ startDate: '2026-10-31' }, { startDate: '2026-11-02' }, { endDate: '2027-11-01' }, { renewMonths: '0' }, { originalExpiryDate: '2026-11-30', startDate: '2026-12-01', endDate: '2027-11-30' }]) {
    await assert.rejects(() => createRenewal(serviceFixture(), changes), e => e.getStatus() === 400);
  }
});
test('signed renewal keeps current rent until its term and switches to its own rent afterwards', () => {
  const old = { id: 1, start_date: '2025-11-01', end_date: '2026-10-31', tenant_id: 2, previous_agreement_id: null, monthly_rent: '15000', data: {} };
  const next = { ...old, id: 2, start_date: '2026-11-01', end_date: '2027-10-31', previous_agreement_id: 1, monthly_rent: '17000', data: { leaseRenewal: { dueDay: '1' } } };
  assert.deepEqual(currentRentContracts([old,next], '2026-10-12').map(c=>c.id), [1,2]);
  assert.deepEqual(currentRentContracts([old,next], '2026-11-01').map(c=>c.id), [2]);
  assert.deepEqual(openRentBills(next, '2026-10-12'), []);
  assert.equal(openRentBills(next, '2026-11-01')[0].amount, '17000.00');
});


test('rebooking cannot backdate a lease into an ended stay, but may begin after its actual end', async () => {
  const old = { formKind: 'lease', status: 'terminated', start_date: '2026-09-01', end_date: '2027-08-31', effective_end_date: '2026-10-12' };
  const input = { leadId: 1, startDate: '2026-10-01', endDate: '2027-09-30', monthlyRent: 15000, deposit: 30000 };
  await assert.rejects(() => serviceFixture([old]).create(7, input), e => e.getStatus() === 409);
  assert.equal((await serviceFixture([old]).create(7, { ...input, startDate: '2026-10-13' })).status, 'draft');
  assert.equal((await serviceFixture([{ ...old, status: 'cancelled' }]).create(7, input)).status, 'draft');
  await assert.rejects(() => serviceFixture([{ ...old, status: 'expired', effective_end_date: '2026-10-12' }]).create(7, input), e => e.getStatus() === 409);
});


test('renewal rejects corrupt money and day-of-month values instead of persisting inconsistent documents', async () => {
  for (const patch of [{ monthlyRent: '-1' }, { monthlyRent: 'NaN' }, { monthlyRent: 'Infinity' }, { monthlyRent: '10000000000' }, { depositCarried: '-1' }, { dueDay: '00' }, { dueDay: '99' }]) {
    await assert.rejects(() => createRenewal(serviceFixture(), patch), e => e.getStatus() === 400);
  }
  const c = await createRenewal(serviceFixture(), { monthlyRent: '15,500.50', depositCarried: '0', dueDay: '31' });
  assert.equal(c.monthly_rent, '15500.50'); assert.equal(c.deposit, '0.00');
});

test('AC-8.2 (Aof 29 Oct 2026): a renewal is signed on the Bangkok day of its last signature', () => {
  const { renewalSignedOn } = requireRepo('./apps/api/src/agent/contracts/agent-contracts.service.ts');
  // Tenant signs 30 Oct 23:30 Bangkok (16:30 UTC), the landlord on 1 Nov: signed on 1 Nov, whenever the PDF is made.
  assert.equal(renewalSignedOn({ owner_signed_at: new Date('2026-11-01T02:00:00Z'), tenant_signed_at: new Date('2026-10-30T16:30:00Z'), agent_signed_at: null }, '2026-11-05'), '2026-11-01');
  assert.equal(renewalSignedOn({ owner_signed_at: null, tenant_signed_at: new Date('2026-10-30T17:30:00Z'), agent_signed_at: null }, '2026-11-05'), '2026-10-31', 'Bangkok, not UTC');
  assert.equal(renewalSignedOn({ owner_signed_at: null, tenant_signed_at: null, agent_signed_at: null }, '2026-11-05'), '2026-11-05', 'no time stored: today');
});
