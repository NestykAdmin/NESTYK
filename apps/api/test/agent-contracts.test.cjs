const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentContractsService, validateContract, formatContractNo, parseContractSeq, contractNoPrefix, contractYear } = require('../src/agent/contracts/agent-contracts.service.ts');
const { AgentContractsController } = require('../src/agent/contracts/agent-contracts.controller.ts');
const { AgreementTemplateEntity } = require('../src/entities/agreement-template.entity.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { MasterContractEndReasonEntity } = require('../src/entities/master-contract-end-reason.entity.ts');
const { TenantEntity } = require('../src/entities/tenant.entity.ts');
const { validateAgreementData } = require('../src/agent/contracts/agreement-data.ts');
const { LeadEntity } = require('../src/entities/lead.entity.ts');
const { RentRoomEntity } = require('../src/entities/rent-room.entity.ts');
const { RoomTenancyEntity } = require('../src/entities/room-tenancy.entity.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const valid = { leadId: 1, startDate: '2026-10-01', endDate: '2027-09-30', monthlyRent: 15000, deposit: 30000 };

test('validates actual calendar dates, financial precision and required fields', () => {
  assert.deepEqual(validateContract({ ...valid, notes: ' hello ', status: 'active' }), { ...valid, notes: 'hello' });
  for (const patch of [{ leadId: 0 }, { leadId: '1' }, { startDate: '2026-02-30' }, { startDate: '01/10/2026' }, { endDate: '2026-10-01' }, { monthlyRent: 0 }, { monthlyRent: 1.111 }, { deposit: -1 }, { deposit: Infinity }, { notes: 7 }]) assert.throws(() => validateContract({ ...valid, ...patch }));
  assert.equal(validateContract({ ...valid, startDate: '2024-02-29', deposit: 0 }).deposit, 0);
});
test('formats standard contract numbers for reservation and lease', () => {
  assert.equal(contractNoPrefix('reservation'), 'RS');
  assert.equal(contractNoPrefix('lease'), 'LS');
  assert.equal(contractNoPrefix('broker_appointment'), 'BA');
  assert.equal(formatContractNo('LS', 2026, 1), 'LS202600001');
  assert.equal(formatContractNo('RS', 2026, 42), 'RS202600042');
  assert.equal(parseContractSeq('LS202600007'), 7);
  assert.equal(parseContractSeq('EC-11'), null);
  assert.equal(typeof contractYear(), 'number');
});
test('broker appointment defaults pick rent matching lead lease duration', () => {
  const { pickBrokerRentFromRoom } = require('../src/agent/contracts/broker-appointment.ts');
  assert.deepEqual(
    pickBrokerRentFromRoom(
      {
        price_rows: [
          { price: '18000', contract_type: { term_months: 12 } },
          { price: '16000', contract_type: { term_months: 6 } },
        ],
      },
      12,
    ),
    { monthlyRent: '18000', leaseMonths: '12' },
  );
  assert.deepEqual(
    pickBrokerRentFromRoom(
      {
        price_rows: [
          { price: '18000', contract_type: { term_months: 12 } },
          { price: '16000', contract_type: { term_months: 6 } },
        ],
      },
      null,
    ),
    { monthlyRent: '16000', leaseMonths: '6' },
  );
  assert.deepEqual(pickBrokerRentFromRoom(null, 12), {
    monthlyRent: '',
    leaseMonths: '12',
  });
});
test('lease agreement validates required dates and syncs sign names', () => {
  const {
    emptyLeaseAgreement,
    validateLeaseAgreement,
    pickLeaseRentFromRoom,
  } = require('../src/agent/contracts/lease-agreement.ts');
  const base = {
    ...emptyLeaseAgreement(),
    issueDate: '2026-10-01',
    landlordName: 'Owner',
    tenantName: 'Tenant',
    project: 'Project',
    termFrom: '2026-10-01',
    termTo: '2027-09-30',
    monthlyRent: '25000',
    depositAmount: '50000',
  };
  const ok = validateLeaseAgreement(base);
  assert.equal(ok.landlordSignName, 'Owner');
  assert.equal(ok.tenantSignName, 'Tenant');
  assert.throws(() => validateLeaseAgreement({ ...base, termTo: '2026-09-01' }));
  assert.deepEqual(
    pickLeaseRentFromRoom(
      {
        price_rows: [{ price: '20000', contract_type: { term_months: 12 } }],
        advance_rent_months: 1,
        deposit_months: 2,
      },
      12,
    ),
    {
      monthlyRent: '20000',
      termMonths: '12',
      advanceMonths: '1',
      depositMonths: '2',
    },
  );
});
const finalizedReservation = {
  status: 'active',
  document_url: '7/1/generated/reservation_letter/letter-v1/booked.pdf',
};
function fixture({ failInvoiceUpdate = false, status = 'booked', overlap = 0, foreignRoom = false, failSave = false, previous = null, successor = 0, draft = null, occupancy = null, endReason = { id: 77 }, reservations = [finalizedReservation], appointments = [[3, 2]] } = {}) {
  const saved = []; const calls = []; const uploads = []; const removed = []; let rolledBack = false;
  const qb = {};
  for (const key of ['leftJoin', 'where', 'andWhere', 'select', 'addSelect', 'distinct']) qb[key] = (...args) => { calls.push([key, ...args]); return qb; };
  // [room, tenant] pairs with a valid broker appointment, read inside the transaction (D1).
  qb.getRawMany = async () => appointments.map(([roomId, tenantId]) => ({ roomId, tenantId }));
  qb.getCount = async () => calls.some(c => c[1] === "c.previous_agreement_id = :previousId") ? successor : overlap;
  qb.getMany = async () => reservations;
  const manager = {
    findOne: async (entity, options) => {
      calls.push(['findOne', entity.name, options]);
      assert.equal(options.where.created_by_user_id, 7);
      assert.equal(options.lock.mode, 'pessimistic_write');
      if (entity === LeaseContractEntity) return options.where.id === draft?.id ? draft : previous;
      if (entity === LeadEntity) return { id: 1, status, tenant_id: 2, rent_room_id: 3 };
      if (entity === RentRoomEntity) return foreignRoom ? null : { id: 3, property_owner_id: 4, owner_id: 5 };
      if (entity === RoomTenancyEntity) return occupancy;
    },
    findOneBy: async (entity, options) => { if (entity === MasterContractEndReasonEntity) { assert.deepEqual(options, {code:'draft_cancelled',is_active:true}); return endReason; } if (entity === AgreementTemplateEntity) return { form_kind: previous?.form_kind ?? 'lease' }; if (entity !== TenantEntity) return null; assert.deepEqual(options, { id: 2, lead_id: 1, created_by_user_id: 7 }); return { id: 2, name: 'Original tenant' }; },
    update: async (entity, where, patch) => {
      calls.push(['update', entity.name, where, patch]);
      if (failInvoiceUpdate && patch.invoice_url) throw new Error('invoice DB failure');
      if (entity === LeaseContractEntity) Object.assign(saved.find(row => row.id === where.id) ?? draft, patch);
    },
    getRepository: () => ({ createQueryBuilder: () => qb }),
    query: async (sql) => {
      if (String(sql).includes('pg_advisory_xact_lock')) return [];
      if (String(sql).includes('contract_no')) return [];
      return [];
    },
    create: (_, data) => data,
    save: async (entity, data) => { if (failSave && entity !== RoomTenancyEntity) throw Error('database failure'); const row = { id: saved.length + 10, ...data }; saved.push(row); return row; },
  };
  // D2: no lead has a confirmed offer unless a test says so (withOffer).
  const { DealOfferEntity: Offer } = require('../src/entities/deal-offer.entity.ts');
  const service = new AgentContractsService({ getRepository: (entity) => entity === Offer ? { findOne: async () => null } : ({ findOneBy: async ({code, id, created_by_user_id}) => entity === LeaseContractEntity ? (draft?.id === id && created_by_user_id === draft.created_by_user_id ? draft : null) : ({ code, form_kind: code === 'reservation' ? 'reservation' : code === 'broker' ? 'broker_appointment' : code === 'lease_renewal' ? 'renewal' : 'lease' }), findOne: async ({where}) => ({id: 1, version: 1, form_kind: where.agreement_type_code === 'reservation' ? 'reservation' : where.agreement_type_code === 'broker' ? 'broker_appointment' : where.agreement_type_code === 'lease_renewal' ? 'renewal' : 'lease', data_schema: {type:'object'}}) }), transaction: async fn => { try { return await fn(manager); } catch (e) { saved.length = 0; rolledBack = true; throw e; } } }, {
    upload: async (agentId, contractId, kind, file) => {
      assert.equal(file.buffer.subarray(0, 4).toString(), '%PDF');
      const path = `${agentId}/${contractId}/${kind}/${uploads.length}.pdf`;
      uploads.push(path); return { path };
    },
    remove: async path => removed.push(path),
  });
  service.view = async (agentId, id) => { assert.equal(agentId, 7); return saved.find(c => c.id === id) ?? draft; };
  return { service, manager, saved, calls, uploads, removed, rolledBack: () => rolledBack };
}
test('creates tenancy and draft using server-owned identity and locked room', async () => {
  const f = fixture(); const c = await f.service.create(7, { ...valid, status: 'active', created_by_user_id: 99, tenantId: 99 });
  assert.equal(c.status, 'draft'); assert.equal(c.created_by_user_id, 7); assert.equal(c.tenant_id, 2); assert.equal(c.room_tenancy_id, 10); assert.equal(c.monthly_rent, '15000.00');
  assert.match(c.contract_no, /^LS\d{4}\d{5}$/);
  assert.equal(f.saved[0].status, 'prospect');
  assert.ok(f.calls.some(c => c[0] === 'andWhere' && c[1].includes('COALESCE(c.effective_end_date, c.end_date) >= :start')));
});
test('rejects unbooked leads, unauthorized rooms and overlapping contracts without writes', async () => {
  for (const options of [{ status: 'inprogress' }, { foreignRoom: true }, { overlap: 1 }]) { const f = fixture(options); await assert.rejects(() => f.service.create(7, valid)); assert.equal(f.saved.length, 0); }
});
test('failed contract save rolls back the tenancy transaction', async () => {
  const f = fixture({ failSave: true }); await assert.rejects(() => f.service.create(7, valid), /database failure/); assert.equal(f.saved.length, 0); assert.equal(f.rolledBack(), true);
});
test('list and detail scope records to the current agent and exclude private entity fields', async () => {
  const calls = []; const qb = {};
  for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[key] = (...args) => { calls.push([key, ...args]); return qb; };
  qb.getMany = async () => [{ id: 1, status: 'draft', rent_room: { property: { name: 'Test' }, owner_identity_number: 'SECRET' }, tenant: { name: 'A', phone: 'PRIVATE' }, monthly_rent: '15000' }];
  qb.getOne = async () => null;
  const service = new AgentContractsService({ getRepository: () => ({ createQueryBuilder: () => qb }) });
  const result = await service.list(7); assert.equal(result[0].monthlyRent, 15000); assert.ok(!JSON.stringify(result).includes('SECRET')); assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  await assert.rejects(() => service.view(9, 1), e => e.getStatus() === 404);
  assert.ok(calls.some(c => c[0] === 'where' && c[2].agentId === 7)); assert.ok(calls.some(c => c[0] === 'where' && c[2].agentId === 9));
});
test('HTTP endpoints require authentication and agent role', async t => {
  const previous = process.env.ALLOW_DEV_AUTH; process.env.ALLOW_DEV_AUTH = 'true';
  t.after(() => { if (previous === undefined) delete process.env.ALLOW_DEV_AUTH; else process.env.ALLOW_DEV_AUTH = previous; });
  class TestModule {}
  Module({ controllers: [AgentContractsController], providers: [
    { provide: AgentContractsService, useValue: { list: async id => [{ agentId: id }], candidates: async () => [], create: async (id, input) => ({ ...validateContract(input), agentId: id }), updateDraft: async (agentId, id, input) => ({ agentId, id, ...input }), cancelDraft: async (agentId, id, input) => ({ agentId, id, ...input }), draftTemplate: async (agentId, id) => ({ agentId, id }) } },
    { provide: AuthService, useValue: { findBySupabaseUserId: async id => ({ id: Number(id) }), loadUserWithRoles: async id => ({ id, roleNames: id === 7 ? ['agent'] : ['tenant'] }) } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false }); await app.listen(0, '127.0.0.1'); t.after(() => app.close());
  const base = await app.getUrl(); const path = `${base}/agent/contracts`;
  const headers = id => ({ Authorization: `Bearer dev|${id}|test@example.invalid`, 'Content-Type': 'application/json' });
  assert.equal((await fetch(path)).status, 401);
  assert.equal((await fetch(path, { headers: headers(8) })).status, 403);
  assert.deepEqual(await (await fetch(path, { headers: headers(7) })).json(), [{ agentId: 7 }]);
  assert.equal((await fetch(`${path}/candidates`, { headers: headers(7) })).status, 200);
  assert.equal((await fetch(path, { method: 'POST', headers: headers(7), body: '{}' })).status, 400);
  for (const endpoint of ['draft', 'cancel-draft']) {
    const url = `${path}/40/${endpoint}`;
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: headers(8), body: '{}' })).status, 403);
    const result = await fetch(url, { method: 'POST', headers: headers(7), body: JSON.stringify({ reason: 'Test' }) });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { agentId: 7, id: 40, reason: 'Test' });
  }
  const created = await fetch(path, { method: 'POST', headers: headers(7), body: JSON.stringify(valid) }); assert.equal(created.status, 201); assert.equal((await created.json()).agentId, 7);
});

test('reservation validates booking fee independently from rent and deposit', () => {
  const body = { leadId: 1, agreementTypeCode: 'reservation', startDate: '2026-10-01', moveInDate: '2026-10-15', reservationFee: 5000 };
  const result = validateContract(body, 'reservation');
  assert.equal(result.reservationFee, 5000); assert.equal(result.monthlyRent, undefined); assert.equal(result.deposit, undefined);
  for (const reservationFee of [undefined, -1, 1.111, Infinity, '5000']) assert.throws(() => validateContract({...body, reservationFee}, 'reservation'));
});
test('reservation drafts persist their master code and booking fee without monthly rent', async () => {
  const f = fixture();
  const c = await f.service.create(7, { leadId: 1, agreementTypeCode: 'reservation', startDate: '2026-10-01', moveInDate: '2026-10-15', reservationFee: 5000 });
  assert.equal(c.end_date, null); assert.equal(c.move_in_date, '2026-10-15');
  assert.match(c.contract_no, /^RS\d{4}\d{5}$/);
  assert.ok(f.calls.some(call => call[2]?.start === '2026-10-15' && call[2]?.end === null));
  assert.equal(c.data.financialDocuments.invoice.items[0].unitPrice, 5000);
  assert.equal(c.data.financialDocuments.invoice.reference, c.contract_no);
  assert.equal(c.data.financialDocuments.invoice.documentNo, `INV-${c.contract_no}`);
  assert.equal(f.uploads.length, 1);
  assert.ok(c.invoice_url);
  assert.equal(c.agreement_type_code, 'reservation'); assert.equal(c.reservation_fee, '5000.00'); assert.equal(c.monthly_rent, null); assert.equal(c.deposit, null);
  assert.ok(f.calls.some(call => call[2]?.formKinds?.includes('reservation')));
});
test('overlap groups lease and renewal while reservation and broker can coexist', async () => {
  const f = fixture(); await f.service.create(7, valid);
  const clause = f.calls.find(call => call[1]?.includes?.('IN (:...formKinds)'));
  assert.deepEqual(clause[2].formKinds, ['lease', 'renewal']);
  assert.equal(f.calls.some(call => call[2]?.isLease != null), false);
});
test('a new lease requires a generated reservation letter for the same lead and room', async () => {
  const message = /ต้องสร้างหนังสือจองและออกเอกสารก่อนทำสัญญาเช่า/;
  for (const reservations of [
    [],
    [{ status: 'active', document_url: '7/1/mock/reservation_letter/mock-v2/preview.pdf' }],
    [{ status: 'cancelled', document_url: finalizedReservation.document_url }],
    [{ status: 'expired', document_url: finalizedReservation.document_url }],
    [{ status: 'terminated', document_url: finalizedReservation.document_url }],
  ]) {
    const f = fixture({ reservations });
    await assert.rejects(() => f.service.create(7, valid), message);
    assert.equal(f.saved.length, 0);
  }
  const booked = fixture();
  const created = await booked.service.create(7, valid);
  assert.equal(created.status, 'draft');
  assert.ok(created.owner_delivered_at instanceof Date);
  assert.equal(created.owner_user_id, 5);
});
test('renewing a lease does not require another reservation letter', async () => {
  const f = fixture({ previous: original, reservations: [] });
  const c = await f.service.create(7, renewalInput());
  assert.equal(c.agreement_kind, 'renewal');
});
test('Aof 29 Oct 2026: a lease is renewed by the renewal addendum only, and not when the stay is recorded as leaving', async () => {
  const full = fixture({ previous: original });
  await assert.rejects(() => full.service.create(7, { ...valid, previousAgreementId: 20 }), e => e.getStatus() === 400 && e.getResponse().code === 'RENEW_WITH_ADDENDUM');
  assert.equal(full.saved.length, 0);
  for (const data of [{ notRenewing: { recordedOn: '2026-09-01', recordedBy: 7 } }, { endsOn: { date: '2026-09-20', reason: 'x' } }]) {
    const f = fixture({ previous: { ...original, data } });
    await assert.rejects(() => f.service.create(7, renewalInput()), e => e.getStatus() === 400 && e.getResponse().code === 'STAY_LEAVING');
    assert.equal(f.saved.length, 0);
  }
});
test('inactive or unknown master type is rejected before transaction', async () => {
  const service = new AgentContractsService({ getRepository: () => ({findOneBy: async () => null}), transaction: () => assert.fail('Must not write') });
  await assert.rejects(() => service.create(7, {...valid, agreementTypeCode:'unknown'}), error => error.getStatus() === 400);
});
test('type catalog uses active master rows and preserves display order', async () => {
  const service = new AgentContractsService({getRepository: () => ({find: async options => {
    assert.deepEqual(options.where, {is_active:true}); assert.deepEqual(options.order, {sort_order:'ASC',id:'ASC'});
    return [{code:'reservation',name_th:'หนังสือจองห้อง',name_en:'Reservation',icon:'calendar',form_kind:'reservation'}];
  }})});
  assert.equal((await service.types())[0].nameTh, 'หนังสือจองห้อง');
});


test('reservation has a booking date and move-in date, allows same day and rejects missing or earlier move-in', () => {
  const base = { leadId: 1, startDate: '2026-10-01', moveInDate: '2026-10-01', reservationFee: 5000 };
  const result = validateContract(base, 'reservation');
  assert.equal(result.moveInDate, base.startDate);
  assert.equal(result.endDate, undefined);
  for (const moveInDate of [undefined, '2026-09-30', '2026-02-30', '15/10/2026']) {
    assert.throws(() => validateContract({...base, moveInDate}, 'reservation'));
  }
  assert.equal(validateContract({...base, endDate: '2030-01-01'}, 'reservation').endDate, undefined);
});

test('reservation DTO never exposes an expiry date', () => {
  const service = new AgentContractsService({});
  const dto = service.serialize({ id: 1, agreement_type: { form_kind: 'reservation' }, start_date: '2026-10-01', move_in_date: '2026-10-15', end_date: null });
  assert.equal(dto.bookingDate, '2026-10-01');
  assert.equal(dto.moveInDate, '2026-10-15');
  assert.equal(dto.endDate, null);
});

const original = { id: 20, template_id: 1, tenant_id: 2, rent_room_id: 3, lead_id: 1, status: 'active', end_date: '2026-09-30', root_agreement_id: 20 };
// The renewal addendum of `original` (ends 30 Sep 2026): starts the day after, for 12 months.
function renewalInput(patch = {}) {
  const { emptyLeaseRenewal } = require('../src/agent/contracts/lease-renewal.ts');
  return { ...valid, agreementTypeCode: 'lease_renewal', previousAgreementId: 20, startDate: '2026-10-01', endDate: '2027-09-30', ...patch,
    data: { leaseRenewal: { ...emptyLeaseRenewal(), issueDate: '2026-09-15', landlordName: 'Owner', tenantName: 'Tenant', propertyLine: 'Room A',
      originalLeaseNo: 'LS202500020', originalLeaseDate: '2025-10-01', originalExpiryDate: '2026-09-30',
      renewMonths: '12', startDate: '2026-10-01', endDate: '2027-09-30', monthlyRent: '15000', depositCarried: '30000' }, renewalCommission: '7500' } };
}
test('renewal is a fresh draft linked to predecessor and root, with independent terms and no signatures', async () => {
  const f = fixture({ previous: original });
  const c = await f.service.create(7, renewalInput({ previousAgreementId: 20 }));
  assert.equal(c.agreement_kind, 'renewal'); assert.equal(c.previous_agreement_id, 20); assert.equal(c.root_agreement_id, 20);
  assert.equal(c.status, 'draft'); assert.equal(c.owner_signed_at, undefined);
  assert.equal(c.template_id, 1); assert.equal(c.data.monthlyRent, 15000);
  assert.equal(c.party_snapshot.tenantName, 'Original tenant');
  assert.equal(original.status, 'active');
});
test('second renewal retains original root', async () => {
  const f = fixture({ previous: {...original, id: 21} });
  const c = await f.service.create(7, renewalInput({ previousAgreementId: 21 }));
  assert.equal(c.previous_agreement_id, 21); assert.equal(c.root_agreement_id, 20);
});
test('continuous renewal reuses active occupancy, but a gap or moved-out occupancy creates a new tenancy', async () => {
  // A renewal addendum always starts the day after (a gap is refused), so only the occupancy decides.
  for (const [status, reuse] of [['active',true], ['moved_out',false]]) {
    const f = fixture({ previous: {...original,room_tenancy_id:9}, occupancy:{id:9,status} });
    const c = await f.service.create(7,renewalInput({previousAgreementId:20}));
    assert.equal(c.room_tenancy_id === 9,reuse);
    assert.equal(f.saved.some(row=>row.status==='prospect'),!reuse);
  }
});
test('renewal rejects missing/foreign originals, mismatched parties, invalid dates, reservation and duplicate successors', async () => {
  for (const previous of [null, {...original, tenant_id: 99}, {...original, rent_room_id: 99}, {...original, lead_id: 99}, {...original, status:'draft'}, {...original, end_date:null}, {...original, end_date:valid.startDate}, {...original, form_kind:'reservation'}]) {
    const f = fixture({ previous });
    await assert.rejects(() => f.service.create(7, renewalInput({previousAgreementId:20}))); assert.equal(f.saved.length, 0);
  }
  const gap = fixture({ previous: original });
  const gapInput = renewalInput({ startDate: '2026-10-02', endDate: '2027-10-01' });
  Object.assign(gapInput.data.leaseRenewal, { startDate: '2026-10-02', endDate: '2027-10-01' });
  await assert.rejects(() => gap.service.create(7, gapInput), e => e.getStatus() === 400 && /วันถัดจาก/.test(e.message), 'a gap');
  assert.equal(gap.saved.length, 0);
  const f = fixture({previous: original, successor: 1});
  await assert.rejects(() => f.service.create(7, renewalInput({previousAgreementId:20})), e => e.getStatus() === 409);
});
test('template data validates required custom fields and prevents overriding operational terms', () => {
  const schema = {type:'object', required:['guarantor'], properties:{guarantor:{type:'string',minLength:1}, monthlyRent:{type:'number',minimum:1}}};
  assert.throws(() => validateAgreementData(schema, {}, valid, 'lease'));
  assert.throws(() => validateAgreementData(schema, {guarantor:3}, valid, 'lease'));
  const data = validateAgreementData(schema, {guarantor:'A', monthlyRent:1}, valid, 'lease');
  assert.equal(data.monthlyRent,15000); assert.equal(data.guarantor,'A');
});
test('root contract points to itself and DTO uses frozen tenant identity and template label', async () => {
  const f = fixture(); const c = await f.service.create(7, valid);
  assert.equal(c.root_agreement_id, c.id);
  const dto = f.service.serialize({...c, template:{version:1,name:'Lease v1',form_kind:'lease'}, tenant:{name:'Changed'}});
  assert.equal(dto.tenant,'Original tenant'); assert.equal(dto.agreementTypeName,'Lease v1');
});

test('template catalog filters active versions and orders newest first', async () => {
  const service = new AgentContractsService({getRepository: entity => entity === AgreementTemplateEntity
    ? {find: async options => {assert.deepEqual(options.where,{agreement_type_code:'lease',is_active:true}); assert.deepEqual(options.order,{version:'DESC'});return [{id:2,agreement_type_code:'lease',version:2,name:'Lease v2',form_kind:'lease',data_schema:{type:'object'}}];}}
    : {findOneBy: async () => ({code:'lease'})}});
  assert.equal((await service.templates('lease'))[0].version,2);
});
test('invalid template and predecessor IDs are rejected', async () => {
  for (const patch of [{templateId:0},{templateId:'1'},{previousAgreementId:-1},{previousAgreementId:1.1}]) {
    const f = fixture(); await assert.rejects(()=>f.service.create(7,{...valid,...patch}),e=>e.getStatus()===400); assert.equal(f.saved.length,0);
  }
});

test('create rejects non-object bodies before loading a template', async () => {
  const f = fixture();
  for (const input of [null, undefined, [], 'lease', 1]) await assert.rejects(()=>f.service.create(7,input), e=>e.getStatus()===400);
});

test('D11: editing a reservation draft after its slip was returned keeps the reason for the tenant', async () => {
  const reservation = { leadId: 1, startDate: '2026-10-01', moveInDate: '2026-10-15', reservationFee: 1000, agreementTypeCode: 'reservation' };
  const returned = { returnNote: 'ยอดไม่ตรง', returnedAt: '2026-10-22T03:00:00.000Z', returnedBy: 7 };
  const f = fixture({ draft: draftRow({ agreement_type_code: 'reservation', invoice_url: 'invoice.pdf', data: { reservationPayment: returned } }) });
  const result = await f.service.updateDraft(7, 40, reservation);
  assert.deepEqual(result.data.reservationPayment, returned);
  assert.ok(result.data.financialDocuments.invoice, 'the invoice is made again as before');
  // Nothing to keep when no slip was returned.
  const plain = fixture({ draft: draftRow({ agreement_type_code: 'reservation', invoice_url: 'invoice.pdf' }) });
  assert.equal('reservationPayment' in (await plain.service.updateDraft(7, 40, reservation)).data, false);
});

function draftRow(patch = {}) {
  return { id: 40, created_by_user_id: 7, status: 'draft', template_id: 1,
    agreement_type_code: 'lease', lead_id: 1, tenant_id: 2, rent_room_id: 3,
    room_tenancy_id: 9, contract_no: 'LS202600040', data: {},
    root_agreement_id: 40, previous_agreement_id: null, updated_at: new Date(), ...patch };
}
test('editing each draft kind preserves identity and tenancy, invalidates documents and revokes invites', async () => {
  for (const code of ['lease', 'reservation', 'broker']) {
    const draft = draftRow({ agreement_type_code: code, document_url: 'preview.pdf', invoice_url: 'invoice.pdf' });
    const f = fixture({ draft });
    const payload = code === 'reservation' ? { leadId: 1, startDate: '2026-10-01', moveInDate: '2026-10-15', reservationFee: 1000 } : valid;
    const result = await f.service.updateDraft(7, 40, { ...payload, agreementTypeCode: code, notes: 'Updated' });
    assert.equal(result.id, 40); assert.equal(result.contract_no, draft.contract_no);
    assert.equal(result.room_tenancy_id, 9); assert.equal(result.notes, 'Updated');
    assert.equal(result.document_url, null);
    if (code === 'reservation') {
      assert.ok(result.invoice_url);
      assert.equal(result.data.financialDocuments.invoice.items[0].unitPrice, 1000);
    } else assert.equal(result.invoice_url, null);
    assert.equal(result.status, 'draft'); assert.ok(result.data.draftRevision);
    assert.equal(f.saved.length, 1);
    assert.ok(f.calls.some(c => c[0] === 'andWhere' && c[1] === 'c.id <> :editingId' && c[2].editingId === 40));
    assert.ok(f.calls.some(c => c[0] === 'update' && c[1] === 'AgreementSignInviteEntity' && c[2].agreement_id === 40));
  }
});
test('draft edits reject changed identity, signed/closed drafts and overlaps', async () => {
  for (const patch of [{ status: 'active' }, { status: 'cancelled' }, { owner_signed_at: new Date() }, { tenant_signature_url: 'sig.png' }]) {
    const f = fixture({ draft: draftRow(patch) });
    await assert.rejects(() => f.service.updateDraft(7, 40, { ...valid, agreementTypeCode: 'lease' }));
    assert.equal(f.saved.length, 0);
  }
  for (const patch of [{ leadId: 99 }, { agreementTypeCode: 'reservation' }, { templateId: 9 }, { previousAgreementId: 8 }]) {
    const f = fixture({ draft: draftRow() });
    await assert.rejects(() => f.service.updateDraft(7, 40, { ...valid, agreementTypeCode: 'lease', ...patch }));
  }
  const f = fixture({ draft: draftRow(), overlap: 1 });
  await assert.rejects(() => f.service.updateDraft(7, 40, { ...valid, agreementTypeCode: 'lease' }), e => e.getStatus() === 409);
  const foreign = fixture({ draft: draftRow({ created_by_user_id: 8 }) });
  await assert.rejects(() => foreign.service.updateDraft(7, 40, { ...valid, agreementTypeCode: 'lease' }), e => e.getStatus() === 404);
});
test('cancelling a draft retains identity and records reason while revoking links', async () => {
  const draft = draftRow(); const f = fixture({ draft });
  const result = await f.service.cancelDraft(7, 40, { reason: '  Customer changed plans  ' });
  assert.equal(result.status, 'cancelled'); assert.equal(result.id, 40);
  assert.equal(result.data.draftCancellation.reason, 'Customer changed plans');
  assert.equal(result.data.draftCancellation.by, 7);
  assert.equal(result.end_reason_id, 77, 'selects the master by code rather than hard-coding its ID');
  assert.equal(result.end_reason_note, 'Customer changed plans');
  assert.equal(result.end_recorded_by_user_id, 7);
  assert.equal(result.end_recorded_at.toISOString(), result.data.draftCancellation.at);
  assert.match(result.effective_end_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(f.calls.some(c => c[0] === 'update' && c[1] === 'AgreementSignInviteEntity'));
  assert.equal(f.saved.length, 0);
});
test('draft cancellation refuses a missing or disabled reason before changing the contract', async () => {
  const f = fixture({draft:draftRow(),endReason:null});
  await assert.rejects(()=>f.service.cancelDraft(7,40,{reason:'Cancel'}),e=>e.getStatus()===400);
  assert.equal(f.calls.some(c=>c[0]==='update'),false);
});
test('cancellation requires a reason and refuses signed or closed contracts', async () => {
  for (const reason of ['', ' ', 'x'.repeat(1001), 5]) {
    await assert.rejects(() => fixture({ draft: draftRow() }).service.cancelDraft(7, 40, { reason }));
  }
  for (const patch of [{ owner_signed_at: new Date() }, { status: 'cancelled' }, { status: 'active' }]) {
    await assert.rejects(() => fixture({ draft: draftRow(patch) }).service.cancelDraft(7, 40, { reason: 'Cancel' }));
  }
});

test('stale draft revisions cannot overwrite a newer edit', async () => {
  const f = fixture({ draft: draftRow({ data: { draftRevision: 'new-version' } }) });
  await assert.rejects(() => f.service.updateDraft(7, 40, { ...valid, agreementTypeCode: 'lease', expectedDraftRevision: 'old-version' }), e => e.getStatus() === 409);
  assert.equal(f.saved.length, 0);
  const result = await f.service.updateDraft(7, 40, { ...valid, agreementTypeCode: 'lease', expectedDraftRevision: 'new-version' });
  assert.notEqual(result.data.draftRevision, 'new-version');
});


test('reservation invoice upload is cleaned up and draft rolls back if linking fails', async () => {
  const f = fixture({ failInvoiceUpdate: true });
  await assert.rejects(() => f.service.create(7, {
    leadId: 1, agreementTypeCode: 'reservation', startDate: '2026-10-01',
    moveInDate: '2026-10-15', reservationFee: 5000,
  }), /invoice DB failure/);
  assert.equal(f.saved.length, 0);
  assert.equal(f.rolledBack(), true);
  assert.deepEqual(f.removed, f.uploads);
});

test('editing a booking draft keeps its invoice identity and updates the amount', async () => {
  const draft = draftRow({ agreement_type_code: 'reservation', contract_no: 'RS202600040',
    invoice_url: '7/40/invoice/old.pdf', data: { financialDocuments: { invoice: {
      documentNo: 'INV-RS202600040', issueDate: '2026-09-01', dueDate: '2026-09-03',
    } } } });
  const f = fixture({ draft });
  const result = await f.service.updateDraft(7, 40, {
    leadId: 1, agreementTypeCode: 'reservation', startDate: '2026-10-01',
    moveInDate: '2026-10-15', reservationFee: 6000,
  });
  const invoice = result.data.financialDocuments.invoice;
  assert.equal(invoice.documentNo, 'INV-RS202600040');
  assert.equal(invoice.issueDate, '2026-09-01');
  assert.equal(invoice.items[0].unitPrice, 6000);
  assert.equal(f.uploads.length, 1);
  assert.deepEqual(f.removed, ['7/40/invoice/old.pdf']);
});

test('draft payment records cannot be forged, edited away or cancelled', async () => {
  for (const key of ['financialDocuments', 'reservationPayment', 'documentFileNames']) {
    const f = fixture();
    await assert.rejects(() => f.service.create(7, { ...valid, data: { [key]: {} } }), /สถานะระบบ/);
    assert.equal(f.saved.length, 0);
  }
  for (const patch of [{ data: { reservationPayment: { slipPath: 'slip.jpg' } } }, { receipt_url: 'receipt.pdf' }]) {
    const f = fixture({ draft: draftRow(patch) });
    await assert.rejects(() => f.service.updateDraft(7, 40, { ...valid, agreementTypeCode: 'lease' }), /ชำระเงิน/);
    await assert.rejects(() => f.service.cancelDraft(7, 40, { reason: 'cancel' }), /ชำระเงิน/);
    assert.equal(f.saved.length, 0);
  }
});


test('lease defaults preserve finalized booking move-in and negotiated money instead of the latest room price', async () => {
  const booked = { ...finalizedReservation, move_in_date: '2026-11-01', monthly_rent: '15000.00', deposit: '30000.00', data: { reservationLetter: { termMonths: '12', advanceMonths: '0', advanceAmount: '0', depositMonths: '2' } } };
  const qb = { getMany: async () => [booked] };
  for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[key] = () => qb;
  const lead = { lease_duration_months: 12, rent_room: { price_rows: [{ price: '18000', contract_type: { term_months: 12 } }], advance_rent_months: 1, deposit_months: 2 } };
  const service = new AgentContractsService({ getRepository: () => ({ findOne: async () => lead, createQueryBuilder: () => qb }) });
  service.reservationDefaults = async () => ({ issueDate: '2026-10-14' });
  const data = await service.leaseDefaults(7, 1);
  assert.equal(data.termFrom, '2026-11-01'); assert.equal(data.termTo, '2027-10-31');
  assert.equal(data.monthlyRent, '15000'); assert.equal(data.depositAmount, '30000');
  assert.equal(data.advanceMonths, '0'); assert.equal(data.advanceAmount, '0');
});

test('cancelling the last unsigned rental draft releases booking; a sibling keeps the booking', async () => {
  for (const remaining of [0, 1]) {
    const f = fixture({ draft: draftRow(), overlap: remaining });
    await f.service.cancelDraft(7, 40, { reason: 'Customer cancelled' });
    const release = f.calls.find(c => c[0] === 'update' && c[1] === 'LeadEntity' && c[3].booking_released_at);
    assert.equal(!!release, remaining === 0);
  }
});


test('cancelling a broker appointment does not release the rental booking', async () => {
  const f = fixture({ draft: draftRow(), previous: { form_kind: 'broker_appointment' } });
  await f.service.cancelDraft(7, 40, { reason: 'Cancel appointment only' });
  assert.equal(f.calls.some(c => c[0] === 'update' && c[1] === 'LeadEntity'), false);
});

test('D1: a new reservation letter needs a valid broker appointment for the room and tenant, checked before any login and again with the lead locked', async () => {
  const body = { leadId: 1, agreementTypeCode: 'reservation', startDate: '2026-10-01', moveInDate: '2026-10-15', reservationFee: 5000 };
  const appointmentQuery = (pairs, asked) => () => {
    const qb = {}; for (const k of ['leftJoin', 'select', 'addSelect', 'distinct', 'where', 'andWhere']) qb[k] = (...args) => { asked.push([k, ...args]); return qb; };
    qb.getRawMany = async () => pairs.map(([roomId, tenantId]) => ({ roomId: String(roomId), tenantId: String(tenantId) })); return qb;
  };
  const withLookup = (f, pairs, asked) => {
    const base = f.service.db.getRepository;
    f.service.db.getRepository = (entity) => {
      if (entity === LeadEntity) return { findOneBy: async (where) => { assert.deepEqual(where, { id: 1, created_by_user_id: 7 }); return { id: 1, rent_room_id: 3, tenant_id: 2 }; } };
      if (entity === LeaseContractEntity) return { ...base(entity), createQueryBuilder: appointmentQuery(pairs, asked) };
      return base(entity);
    };
  };
  // No appointment: refused before the letter is read or any login is made.
  const refused = fixture(); const asked = [];
  withLookup(refused, [], asked);
  refused.service.reservationDefaults = () => assert.fail('D1 must refuse before reading the letter or creating logins');
  await assert.rejects(() => refused.service.create(7, { ...body, data: { reservationLetter: {} } }),
    (e) => e.getStatus() === 400 && e.getResponse().code === 'BROKER_APPOINTMENT_REQUIRED');
  assert.equal(refused.calls.some((c) => c[0] === 'findOne'), false, 'the transaction never started');
  assert.ok(asked.some((c) => c[0] === 'where' && c[2]?.agentId === 7));
  assert.ok(asked.some((c) => c[0] === 'andWhere' && c[1] === "c.status = 'active'"));
  assert.ok(asked.some((c) => c[0] === 'andWhere' && c[1] === "COALESCE(template.form_kind, agreementType.form_kind) = 'broker_appointment'"));
  assert.ok(asked.some((c) => c[0] === 'andWhere' && c[2]?.roomIds?.[0] === 3));
  assert.ok(asked.some((c) => c[0] === 'andWhere' && c[2]?.tenantIds?.[0] === 2));
  assert.ok(asked.some((c) => c[0] === 'andWhere' && c[1] === "c.start_date + INTERVAL '1 year' > CAST(:today AS date)" && /^\d{4}-\d{2}-\d{2}$/.test(c[2]?.today)),
    'only appointments under 1 year old count');
  // A valid appointment for the same room but another tenant does not count.
  const otherTenant = fixture(); withLookup(otherTenant, [[3, 9]], []);
  otherTenant.service.reservationDefaults = () => assert.fail('another tenant\'s appointment must not let the letter start');
  await assert.rejects(() => otherTenant.service.create(7, { ...body, data: { reservationLetter: {} } }), (e) => e.getResponse().code === 'BROKER_APPOINTMENT_REQUIRED');
  // Appointment valid for this room and tenant: the draft is created.
  const allowed = fixture(); withLookup(allowed, [[3, 2]], []);
  assert.match((await allowed.service.create(7, body)).contract_no, /^RS/);
  assert.ok(allowed.calls.some((c) => c[0] === 'andWhere' && c[2]?.roomIds?.[0] === 3), 'the locked check asks about the lead\'s room');
  assert.ok(allowed.calls.some((c) => c[0] === 'andWhere' && c[2]?.tenantIds?.[0] === 2), 'the locked check asks about the lead\'s tenant');
  // The check inside the transaction (lead locked) uses the appointments read there: here the only one belongs to another tenant, so it refuses too.
  const raced = fixture({ appointments: [[3, 9]] }); withLookup(raced, [[3, 2]], []);
  await assert.rejects(() => raced.service.create(7, body), (e) => e.getResponse().code === 'BROKER_APPOINTMENT_REQUIRED');
  assert.equal(raced.rolledBack(), true);
  // An unknown lead is a 404 before any login.
  const missing = fixture(); const base = missing.service.db.getRepository;
  missing.service.db.getRepository = (entity) => (entity === LeadEntity ? { findOneBy: async () => null } : base(entity));
  missing.service.reservationDefaults = () => assert.fail('a missing lead must be refused before reading the letter');
  await assert.rejects(() => missing.service.create(7, { ...body, data: { reservationLetter: {} } }), (e) => e.getStatus() === 404);
});

test('D1: the broker appointment lookup builds valid SQL with the real entities', async () => {
  // The other D1 tests mock the query builder, so they cannot see the SQL TypeORM writes. This one builds the
  // real query (no database connection) and checks it, e.g. that DISTINCT comes first in the SELECT list.
  const fs = require('node:fs'); const path = require('node:path'); const { DataSource } = require('typeorm');
  const dir = path.join(__dirname, '../src/entities');
  const entities = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))
    .flatMap((f) => Object.values(require(path.join(dir, f))).filter((v) => typeof v === 'function'));
  const ds = new DataSource({ type: 'postgres', entities });
  await ds.buildMetadatas();
  const built = [];
  const db = { getRepository: (entity) => { const repo = ds.getRepository(entity); return { createQueryBuilder: (alias) => {
    const qb = repo.createQueryBuilder(alias); qb.getRawMany = async () => { built.push(qb.getQueryAndParameters()); return []; }; return qb; } }; } };
  const service = new AgentContractsService(db);
  await service.activeBrokerAppointments(7);
  await service.activeBrokerAppointments(7, { roomIds: [3], tenantIds: [2] });
  for (const [sql] of built) {
    assert.match(sql, /^SELECT DISTINCT "c"\."rent_room_id" AS "roomId", "c"\."tenant_id" AS "tenantId" FROM "lease_contracts" "c" /);
    assert.equal((sql.match(/DISTINCT/g) ?? []).length, 1);
    assert.match(sql, /"c"\."start_date" \+ INTERVAL '1 year' > CAST\(\$2 AS date\)/);
  }
  assert.deepEqual(built[0][1].slice(0, 1), [7]);
  assert.match(built[1][0], /"c"\."rent_room_id" IN \(\$3\) AND "c"\."tenant_id" IN \(\$4\)$/);
  assert.deepEqual(built[1][1].slice(2), [3, 2]);
});

test('D1: contract candidates say which booked tenants can start a reservation letter', async () => {
  const leads = [{ id: 1, tenant: { id: 2, name: 'A' }, rent_room: { id: 3, room_id: '301', property: { name: 'P' } } },
    { id: 4, tenant: { id: 5, name: 'B' }, rent_room: { id: 6, room_id: '601', property: null, listing_title: 'L' } }];
  const leadQb = {}; for (const k of ['innerJoinAndSelect', 'leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) leadQb[k] = () => leadQb;
  leadQb.getMany = async () => leads;
  const asked = [];
  const appointmentQb = {}; for (const k of ['leftJoin', 'select', 'addSelect', 'distinct', 'where', 'andWhere']) appointmentQb[k] = (...args) => { asked.push([k, ...args]); return appointmentQb; };
  // Room 6 has an appointment, but for another tenant.
  appointmentQb.getRawMany = async () => [{ roomId: '3', tenantId: '2' }, { roomId: '6', tenantId: '9' }];
  const service = new AgentContractsService({ getRepository: (entity) => ({ createQueryBuilder: () => (entity === LeadEntity ? leadQb : appointmentQb) }) }, {});
  const rows = await service.candidates(7);
  assert.deepEqual(rows.map((r) => [r.leadId, r.brokerAppointmentReady]), [[1, true], [4, false]]);
  assert.deepEqual(rows.map((r) => r.rentRoomId), [3, 6], 'D2: the booked room, to find its confirmed offer');
  assert.ok(asked.some((c) => c[0] === 'andWhere' && JSON.stringify(c[2]?.roomIds) === '[3,6]'));
  assert.ok(asked.some((c) => c[0] === 'andWhere' && JSON.stringify(c[2]?.tenantIds) === '[2,5]'));
});

function withLeadNoOffer(f) {
  const { DealOfferEntity } = require('../src/entities/deal-offer.entity.ts');
  const base = f.service.db.getRepository;
  f.service.db.getRepository = (entity) => (entity === LeadEntity
    ? { findOneBy: async () => ({ id: 1, rent_room_id: 3, tenant_id: 2, created_by_user_id: 7 }) }
    : entity === DealOfferEntity ? { findOne: async () => null } : base(entity));
}
test('D1: other document kinds and an existing reservation draft are not checked', async () => {
  for (const agreementTypeCode of ['lease', 'broker']) {
    const f = fixture({ appointments: [] });
    // D2 reads the lead for its confirmed offer (none here). The lead has a room and a tenant, so the broker
    // appointment check would run if it applied to these drafts.
    withLeadNoOffer(f);
    f.service.hasBrokerAppointment = () => assert.fail(`${agreementTypeCode} drafts are not checked`);
    await f.service.create(7, { ...valid, agreementTypeCode });
  }
  // A reservation draft saved before the rule can still be edited with no appointment.
  const draft = { id: 40, lead_id: 1, created_by_user_id: 7, status: 'draft', agreement_type_code: 'reservation', template_id: 1, previous_agreement_id: null,
    data: {}, updated_at: new Date('2026-10-01T00:00:00Z'), tenant_id: 2, rent_room_id: 3 };
  const f = fixture({ draft, appointments: [] });
  withLeadNoOffer(f);
  f.service.hasBrokerAppointment = () => assert.fail('an existing draft is not checked');
  await f.service.updateDraft(7, 40, { leadId: 1, agreementTypeCode: 'reservation', startDate: '2026-10-01', moveInDate: '2026-10-15', reservationFee: 5000 });
});

// D2 (Aof, 22 Oct 2026): the numbers of an offer the landlord confirmed flow into the lease and the letter.
const confirmedOfferRow = {
  id: 30, revision: 2, lead_id: 1, rent_room_id: 3, status: 'confirmed', monthly_rent: '15000.00', term_months: 12, start_date: '2026-11-01',
  deposit_amount: '30000.00', contract_date: '2026-10-25', rent_due_day: 1, grace_day: 5, late_fee_per_day: '200.00',
  renewal_notice_days: 30, co_broke: false, co_broke_agent_name: null,
};
// `latest` is the offer read again inside the transaction, after the lead is locked (the same one unless a test says so).
function withOffer(f, offer, latest = offer) {
  const { DealOfferEntity } = require('../src/entities/deal-offer.entity.ts');
  const base = f.service.db.getRepository;
  f.service.db.getRepository = (entity) => {
    if (entity === LeadEntity) return { findOneBy: async (where) => { assert.deepEqual(where, { id: 1, created_by_user_id: 7 }); return { id: 1, rent_room_id: 3, tenant_id: 2 }; } };
    if (entity === DealOfferEntity) return { findOne: async ({ where }) => { assert.deepEqual(where, { lead_id: 1, rent_room_id: 3, status: 'confirmed' }); return offer; } };
    return base(entity);
  };
  const inside = f.manager.getRepository;
  f.manager.getRepository = (entity) => entity === DealOfferEntity
    ? { findOne: async ({ where }) => { assert.deepEqual(where, { lead_id: 1, rent_room_id: 3, status: 'confirmed' }); f.calls.push(['offer read in transaction']); return latest; } }
    : inside(entity);
}
test('D2: a lease draft takes rent, term, deposit, due day, grace day and late fee from the confirmed offer, whatever was typed', async () => {
  const { emptyLeaseAgreement } = require('../src/agent/contracts/lease-agreement.ts');
  const typed = { ...emptyLeaseAgreement(), issueDate: '2026-10-01', landlordName: 'Owner', tenantName: 'Tenant', project: 'Project',
    termMonths: '12', termFrom: '2026-10-01', termTo: '2027-09-30', monthlyRent: '99999', depositAmount: '1', depositMonths: '',
    advanceMonths: '0', advanceAmount: '0', rentDueDay: '9', graceDay: '', latePenalty: '' };
  const f = fixture(); withOffer(f, confirmedOfferRow);
  const c = await f.service.create(7, { ...valid, data: { leaseAgreement: typed } });
  const lease = c.data.leaseAgreement;
  assert.deepEqual(
    [lease.issueDate, lease.monthlyRent, lease.termMonths, lease.termFrom, lease.termTo, lease.depositAmount, lease.depositMonths, lease.advanceMonths, lease.advanceAmount, lease.rentDueDay, lease.graceDay, lease.latePenalty],
    ['2026-10-01', '15000', '12', '2026-11-01', '2027-10-31', '30000', '2', '1', '15000', '1', '5', '200'], 'the lease\'s date stays as typed (the signing may move)');
  assert.equal(c.monthly_rent, '15000.00'); assert.equal(c.deposit, '30000.00');
  assert.equal(c.start_date, '2026-11-01'); assert.equal(c.end_date, '2027-10-31');
  assert.equal(lease.landlordName, 'Owner', 'the other fields stay as typed');
  // No confirmed offer (a deal booked before offers existed): the typed numbers stay.
  const old = fixture(); withOffer(old, null);
  const kept = (await old.service.create(7, { ...valid, data: { leaseAgreement: typed } })).data.leaseAgreement;
  assert.deepEqual([kept.monthlyRent, kept.termFrom, kept.rentDueDay, kept.graceDay], ['99999', '2026-10-01', '9', '']);
  // D2 round 2: the offer was changed between reading it and locking the lead: refused, nothing saved.
  const raced = fixture(); withOffer(raced, confirmedOfferRow, { ...confirmedOfferRow, revision: 3, monthly_rent: '14000.00' });
  await assert.rejects(() => raced.service.create(7, { ...valid, data: { leaseAgreement: typed } }),
    (e) => e.getStatus() === 409 && e.getResponse().code === 'OFFER_CHANGED');
  assert.deepEqual(raced.saved, []);
  assert.ok(raced.calls.findIndex((c) => c[0] === 'offer read in transaction') > raced.calls.findIndex((c) => c[0] === 'findOne' && c[1] === 'LeadEntity'),
    'read again after the lead is locked');
});
test('D2: lease and letter defaults show the confirmed offer\'s numbers', async () => {
  const { DealOfferEntity } = require('../src/entities/deal-offer.entity.ts');
  const qb = { getMany: async () => [] };
  for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[key] = () => qb;
  const lead = { id: 1, lease_duration_months: 12, rent_room: { id: 3, price_rows: [{ price: '18000', contract_type: { term_months: 12 } }], advance_rent_months: 1, deposit_months: 1 } };
  let offer = { ...confirmedOfferRow, grace_day: null, late_fee_per_day: null, deposit_amount: '25000.00' };
  const service = new AgentContractsService({ getRepository: (entity) => entity === DealOfferEntity
    ? { findOne: async ({ where }) => { assert.deepEqual(where, { lead_id: 1, rent_room_id: 3, status: 'confirmed' }); return offer; } }
    : { findOne: async () => lead, createQueryBuilder: () => qb } });
  service.reservationDefaults = async () => ({ issueDate: '2026-10-14' });
  const data = await service.leaseDefaults(7, 1);
  assert.deepEqual(
    [data.issueDate, data.monthlyRent, data.termFrom, data.termTo, data.depositAmount, data.depositMonths, data.rentDueDay, data.graceDay, data.latePenalty],
    ['2026-10-25', '15000', '2026-11-01', '2027-10-31', '25000', '', '1', '', ''], 'the contract date starts the lease\'s date; a deposit that is not whole months leaves the months blank');
  offer = null;
  const room = await service.leaseDefaults(7, 1);
  assert.equal(room.monthlyRent, '18000', 'no offer: the room price as before');
  // The letter: rent, term, reservation = 1 month of rent (AC-2.2), deposit.
  const { offerReservationFields } = require('../src/agent/contracts/deal-offers.service.ts');
  assert.deepEqual(offerReservationFields(confirmedOfferRow), {
    monthlyRent: '15000', termMonths: '12', termFrom: '2026-11-01', termTo: '2027-10-31', advanceMonths: '1', advanceAmount: '15000',
    reservationPayment: '15000', depositAmount: '30000', depositMonths: '2', applyToAdvance: true, applyToDeposit: false, balanceDue: '30000',
  });
  // Whole months are counted in satang: 30,001.50 is exactly 2 x 15,000.75, and 0.30 is 3 x 0.10.
  assert.equal(offerReservationFields({ ...confirmedOfferRow, monthly_rent: '15000.75', deposit_amount: '30001.50' }).depositMonths, '2');
  assert.equal(offerReservationFields({ ...confirmedOfferRow, monthly_rent: '0.10', deposit_amount: '0.30' }).depositMonths, '3', 'no floating point miss');
});
test('D2: a reservation draft takes the confirmed offer\'s numbers, and its booking fee and move-in date follow', async () => {
  const { emptyReservationLetter } = require('../src/agent/contracts/reservation-letter.ts');
  // No real accounts in this test: the letter's logins are stubbed (the module is read at call time).
  const login = require('../src/agent/contracts/party-login.ts'); const real = login.ensurePartyLogin;
  login.ensurePartyLogin = async (_db, input) => (input.role === 'tenant' ? 60 : 61);
  try {
    const letter = { ...emptyReservationLetter(), issueDate: '2026-10-14', tenantName: 'Tenant One', tenantFirstName: 'Tenant', tenantLastName: 'One',
      tenantPhone: '0812345678', tenantEmail: 'tenant@example.invalid', tenantId: 'A1234567', tenantNationality: 'British',
      landlordName: 'Owner', landlordPhone: '0811111111', landlordEmail: 'owner@example.invalid', project: 'Condo',
      termMonths: '6', termFrom: '2026-10-15', termTo: '2027-04-14', monthlyRent: '99999', advanceMonths: '0', advanceAmount: '0',
      depositMonths: '0', depositAmount: '0', reservationPayment: '5000', paymentMethod: 'transfer' };
    const make = (offer) => {
      const f = fixture(); withOffer(f, offer);
      const base = f.service.db.getRepository;
      f.service.db.getRepository = (entity) => (entity === LeaseContractEntity
        ? { ...base(entity), createQueryBuilder: () => { const qb = {}; for (const k of ['leftJoin', 'select', 'addSelect', 'distinct', 'where', 'andWhere']) qb[k] = () => qb; qb.getRawMany = async () => [{ roomId: '3', tenantId: '2' }]; return qb; } }
        : base(entity));
      f.service.reservationDefaults = async () => letter;
      return f;
    };
    const body = { leadId: 1, agreementTypeCode: 'reservation', startDate: '2026-10-14', moveInDate: '2026-10-15', reservationFee: 5000, data: { reservationLetter: letter } };
    const c = await make(confirmedOfferRow).service.create(7, body);
    const saved = c.data.reservationLetter;
    assert.deepEqual(
      [saved.monthlyRent, saved.termMonths, saved.termFrom, saved.termTo, saved.advanceMonths, saved.advanceAmount, saved.reservationPayment, saved.depositAmount, saved.depositMonths, saved.applyToAdvance, saved.applyToDeposit, saved.balanceDue],
      ['15000', '12', '2026-11-01', '2027-10-31', '1', '15000', '15000', '30000', '2', true, false, '30000']);
    assert.equal(c.reservation_fee, '15000.00', 'the booking invoice is 1 month of rent');
    assert.equal(c.data.financialDocuments.invoice.items[0].unitPrice, 15000);
    assert.equal(c.move_in_date, '2026-11-01');
    assert.equal(saved.project, 'Condo', 'the other fields stay as typed');
    // No confirmed offer: the typed letter and fee stay.
    const old = await make(null).service.create(7, body);
    // (The letter is dated today, and a move-in before the letter's date moves to it, as before.)
    const issued = old.data.reservationLetter.issueDate;
    assert.deepEqual([old.data.reservationLetter.monthlyRent, old.reservation_fee, old.move_in_date], ['99999', '5000.00', issued > '2026-10-15' ? issued : '2026-10-15']);
  } finally {
    login.ensurePartyLogin = real;
  }
});
test('D2: drafts saved without their form still take the offer\'s rent, deposit, dates and booking fee', async () => {
  const lease = fixture(); withOffer(lease, confirmedOfferRow);
  const c = await lease.service.create(7, { ...valid, monthlyRent: 99999, deposit: 1, startDate: '2026-10-01', endDate: '2027-09-30' });
  assert.deepEqual([c.monthly_rent, c.deposit, c.start_date, c.end_date], ['15000.00', '30000.00', '2026-11-01', '2027-10-31']);
  const plain = fixture(); withOffer(plain, null);
  const kept = await plain.service.create(7, { ...valid, monthlyRent: 99999 });
  assert.equal(kept.monthly_rent, '99999.00', 'no offer: as typed');
  // A reservation without its letter: the booking invoice is still 1 month of rent, and the move-in is the start date.
  const reservation = fixture(); withOffer(reservation, confirmedOfferRow);
  const base = reservation.service.db.getRepository;
  reservation.service.db.getRepository = (entity) => (entity === LeaseContractEntity
    ? { ...base(entity), createQueryBuilder: () => { const qb = {}; for (const k of ['leftJoin', 'select', 'addSelect', 'distinct', 'where', 'andWhere']) qb[k] = () => qb; qb.getRawMany = async () => [{ roomId: '3', tenantId: '2' }]; return qb; } }
    : base(entity));
  const r = await reservation.service.create(7, { leadId: 1, agreementTypeCode: 'reservation', startDate: '2026-10-14', moveInDate: '2026-10-15', reservationFee: 5000 });
  assert.deepEqual([r.reservation_fee, r.move_in_date, r.data.financialDocuments.invoice.items[0].unitPrice], ['15000.00', '2026-11-01', 15000]);
});
test('D2: the letter defaults carry the confirmed offer\'s numbers for the lead\'s room', async () => {
  const { DealOfferEntity } = require('../src/entities/deal-offer.entity.ts');
  const { PropertyOwnerEntity } = require('../src/entities/property-owner.entity.ts');
  const { UserEntity } = require('../src/entities/user.entity.ts');
  const { RentRoomContactEntity } = require('../src/entities/rent-room-contact.entity.ts');
  const lead = { id: 1, created_by_user_id: 7, tenant: { id: 2, name: 'Tenant One', first_name: 'Tenant', last_name: 'One', phone: '0812345678', email: 't@example.invalid', identity_number: 'A1234567', nationality: 'British' },
    rent_room: { id: 3, room_id: '1201', listing_title: null, owner_id: null, property_owner_id: null, advance_rent_months: 2, deposit_months: 1, property: { name: 'Aria', address: '1 Road' } } };
  let offer = confirmedOfferRow; const asked = [];
  const service = new AgentContractsService({ getRepository: (entity) => {
    if (entity === LeadEntity) return { findOne: async ({ where }) => { assert.deepEqual(where, { id: 1, created_by_user_id: 7 }); return lead; } };
    if (entity === DealOfferEntity) return { findOne: async ({ where }) => { asked.push(where); return offer; } };
    if (entity === PropertyOwnerEntity || entity === UserEntity) return { findOneBy: async () => null };
    if (entity === RentRoomContactEntity) return { find: async () => [] };
    return assert.fail(`unexpected repository ${entity?.name}`);
  } });
  const letter = await service.reservationDefaults(7, 1);
  assert.deepEqual(asked, [{ lead_id: 1, rent_room_id: 3, status: 'confirmed' }]);
  assert.deepEqual([letter.monthlyRent, letter.reservationPayment, letter.termFrom, letter.termTo, letter.advanceMonths, letter.depositAmount, letter.balanceDue, letter.project],
    ['15000', '15000', '2026-11-01', '2027-10-31', '1', '30000', '30000', 'Aria']);
  offer = null;
  const room = await service.reservationDefaults(7, 1);
  assert.deepEqual([room.advanceMonths, room.depositMonths, room.reservationPayment], ['2', '1', ''], 'no offer: the room\'s months as before');
});

test('H1/H2 (Aof 29 Oct 2026): the status shown is the stored one; past its end a lease stays active until the daily close or the agent ends it', () => {
  const service = new AgentContractsService({});
  const lease = { id: 1, status: 'active', agreement_kind: 'new', template: { form_kind: 'lease' }, start_date: '2019-01-01', end_date: '2019-12-31', data: {} };
  assert.equal(service.serialize(lease).status, 'active', 'past its end, no decision (AC-8.7)');
  assert.equal(service.serialize({ ...lease, end_date: '2030-12-31', data: { endsOn: { date: '2020-06-30' } } }).status, 'active', 'an early end past, before the daily close');
  assert.equal(service.serialize({ ...lease, status: 'terminated' }).status, 'terminated');
  const renewal = { ...lease, status: 'awaiting_agent_review', agreement_kind: 'renewal', template: { form_kind: 'renewal' }, start_date: '2020-01-01', end_date: '2020-12-31', data: { renewalSignedOn: '2019-12-01' } };
  assert.equal(service.serialize(renewal).status, 'active', 'a signed renewal from its first day');
});

test('AC-8.1 (Aof 29 Oct 2026): the renewal commission is typed with the renewal, kept for the agent and the landlord only', async () => {
  const { parseRenewalCommission } = require('../src/agent/contracts/lease-renewal.ts');
  assert.equal(parseRenewalCommission('7,500'), '7500.00'); assert.equal(parseRenewalCommission(0), '0.00'); assert.equal(parseRenewalCommission('12.5'), '12.50');
  for (const bad of [undefined, '', '-1', 'abc', '1.234', '100000000']) assert.throws(() => parseRenewalCommission(bad), (e) => e.getStatus() === 400);
  const f = fixture({ previous: original });
  const c = await f.service.create(7, renewalInput());
  assert.equal(c.data.renewalCommission, '7500.00');
  assert.equal(c.data.leaseRenewal.renewalCommission, undefined, 'not in the PDF fields');
  const missing = renewalInput(); delete missing.data.renewalCommission;
  await assert.rejects(() => fixture({ previous: original }).service.create(7, missing), (e) => e.getStatus() === 400);
  const service = new AgentContractsService({});
  const view = { id: 1, formKind: 'renewal', data: { renewalCommission: '7500.00', leaseRenewal: {} } };
  assert.equal(service['forParty'](view, ['owner']).data.renewalCommission, '7500.00');
  assert.equal(service['forParty'](view, ['tenant']).data.renewalCommission, undefined, 'the tenant does not see it');
});
