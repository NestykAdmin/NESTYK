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
function fixture({ failInvoiceUpdate = false, status = 'booked', overlap = 0, foreignRoom = false, failSave = false, previous = null, successor = 0, draft = null, occupancy = null, endReason = { id: 77 }, reservations = [finalizedReservation] } = {}) {
  const saved = []; const calls = []; const uploads = []; const removed = []; let rolledBack = false;
  const qb = {};
  for (const key of ['leftJoin', 'where', 'andWhere']) qb[key] = (...args) => { calls.push([key, ...args]); return qb; };
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
  const service = new AgentContractsService({ getRepository: (entity) => ({ findOneBy: async ({code, id, created_by_user_id}) => entity === LeaseContractEntity ? (draft?.id === id && created_by_user_id === draft.created_by_user_id ? draft : null) : ({ code, form_kind: code === 'reservation' ? 'reservation' : code === 'broker' ? 'broker_appointment' : 'lease' }), findOne: async ({where}) => ({id: 1, version: 1, form_kind: where.agreement_type_code === 'reservation' ? 'reservation' : where.agreement_type_code === 'broker' ? 'broker_appointment' : 'lease', data_schema: {type:'object'}}) }), transaction: async fn => { try { return await fn(manager); } catch (e) { saved.length = 0; rolledBack = true; throw e; } } }, {
    upload: async (agentId, contractId, kind, file) => {
      assert.equal(file.buffer.subarray(0, 4).toString(), '%PDF');
      const path = `${agentId}/${contractId}/${kind}/${uploads.length}.pdf`;
      uploads.push(path); return { path };
    },
    remove: async path => removed.push(path),
  });
  service.view = async (agentId, id) => { assert.equal(agentId, 7); return saved.find(c => c.id === id) ?? draft; };
  return { service, saved, calls, uploads, removed, rolledBack: () => rolledBack };
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
  const c = await f.service.create(7, { ...valid, previousAgreementId: 20 });
  assert.equal(c.agreement_kind, 'renewal');
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
test('renewal is a fresh draft linked to predecessor and root, with independent terms and no signatures', async () => {
  const f = fixture({ previous: original });
  const c = await f.service.create(7, {...valid, previousAgreementId: 20});
  assert.equal(c.agreement_kind, 'renewal'); assert.equal(c.previous_agreement_id, 20); assert.equal(c.root_agreement_id, 20);
  assert.equal(c.status, 'draft'); assert.equal(c.owner_signed_at, undefined);
  assert.equal(c.template_id, 1); assert.equal(c.data.monthlyRent, 15000);
  assert.equal(c.party_snapshot.tenantName, 'Original tenant');
  assert.equal(original.status, 'active');
});
test('second renewal retains original root', async () => {
  const f = fixture({ previous: {...original, id: 21} });
  const c = await f.service.create(7, {...valid, previousAgreementId: 21});
  assert.equal(c.previous_agreement_id, 21); assert.equal(c.root_agreement_id, 20);
});
test('continuous renewal reuses active occupancy, but a gap or moved-out occupancy creates a new tenancy', async () => {
  for (const [startDate, status, reuse] of [
    ['2026-10-01','active',true], ['2026-10-02','active',false], ['2026-10-01','moved_out',false],
  ]) {
    const f = fixture({ previous: {...original,room_tenancy_id:9}, occupancy:{id:9,status} });
    const c = await f.service.create(7,{...valid,startDate,previousAgreementId:20});
    assert.equal(c.room_tenancy_id === 9,reuse);
    assert.equal(f.saved.some(row=>row.status==='prospect'),!reuse);
  }
});
test('renewal rejects missing/foreign originals, mismatched parties, invalid dates, reservation and duplicate successors', async () => {
  for (const previous of [null, {...original, tenant_id: 99}, {...original, rent_room_id: 99}, {...original, lead_id: 99}, {...original, status:'draft'}, {...original, end_date:null}, {...original, end_date:valid.startDate}, {...original, form_kind:'reservation'}]) {
    const f = fixture({ previous });
    await assert.rejects(() => f.service.create(7, {...valid, previousAgreementId:20})); assert.equal(f.saved.length, 0);
  }
  const f = fixture({previous: original, successor: 1});
  await assert.rejects(() => f.service.create(7, {...valid, previousAgreementId:20}), e => e.getStatus() === 409);
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
