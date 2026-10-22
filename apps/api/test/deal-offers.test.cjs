// D2 (AC-2.1 to 2.4, round 1, Aof 22 Oct 2026): the offer a landlord confirms before the room is booked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { DealOffersService, validateDealOfferTerms, offerLeaseFields } = require('../src/agent/contracts/deal-offers.service.ts');
const { DealOffersController } = require('../src/agent/contracts/deal-offers.controller.ts');
const { PartyContractsController } = require('../src/agent/contracts/party-contracts.controller.ts');
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { AgreementAttachmentsService } = require('../src/agent/contracts/agreement-attachments.service.ts');
const { DealOfferEntity } = require('../src/entities/deal-offer.entity.ts');
const { LeadEntity } = require('../src/entities/lead.entity.ts');
const { RentRoomEntity } = require('../src/entities/rent-room.entity.ts');
const { UserEntity } = require('../src/entities/user.entity.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');

const terms = {
  monthlyRent: '15,000', termMonths: 12, startDate: '2026-11-01', depositAmount: 30000, contractDate: '2026-10-25',
  rentDueDay: 1, graceDay: 5, lateFeePerDay: '200', renewalNoticeDays: null, coBroke: false, coBrokeAgentName: null,
};

test('offer terms are normalised, blank notice days are 30, and bad values or unknown fields are refused', () => {
  assert.deepEqual(validateDealOfferTerms(terms), {
    monthly_rent: '15000.00', term_months: 12, start_date: '2026-11-01', deposit_amount: '30000.00', contract_date: '2026-10-25',
    rent_due_day: 1, grace_day: 5, late_fee_per_day: '200.00', renewal_notice_days: 30, co_broke: false, co_broke_agent_name: null,
  });
  const blanks = validateDealOfferTerms({ ...terms, graceDay: '', lateFeePerDay: ' ', renewalNoticeDays: '', termMonths: '6', rentDueDay: '31' });
  assert.deepEqual([blanks.grace_day, blanks.late_fee_per_day, blanks.renewal_notice_days, blanks.term_months, blanks.rent_due_day], [null, null, 30, 6, 31]);
  assert.equal(validateDealOfferTerms({ ...terms, renewalNoticeDays: 45 }).renewal_notice_days, 45);
  assert.equal(validateDealOfferTerms({ ...terms, depositAmount: '0' }).deposit_amount, '0.00', 'no deposit is allowed');
  assert.equal(validateDealOfferTerms({ ...terms, contractDate: '2026-11-01' }).contract_date, '2026-11-01', 'signed on the start day');
  const co = validateDealOfferTerms({ ...terms, coBroke: true, coBrokeAgentName: '  Other Agent  ' });
  assert.deepEqual([co.co_broke, co.co_broke_agent_name], [true, 'Other Agent']);
  for (const patch of [
    { monthlyRent: '0' }, { monthlyRent: '-1' }, { monthlyRent: 'abc' }, { monthlyRent: '1.234' }, { monthlyRent: null },
    { termMonths: 0 }, { termMonths: 121 }, { termMonths: 1.5 }, { termMonths: 'x' },
    { startDate: '2026-02-30' }, { startDate: '' }, { contractDate: '26-10-25' }, { contractDate: '2026-11-02' },
    { depositAmount: '-1' }, { depositAmount: undefined },
    { rentDueDay: 0 }, { rentDueDay: 32 }, { rentDueDay: null }, { graceDay: 32 }, { graceDay: 0 },
    { lateFeePerDay: '-5' }, { lateFeePerDay: 'x' }, { renewalNoticeDays: 0 }, { renewalNoticeDays: 366 },
    { coBroke: 'yes' }, { coBroke: undefined }, { coBroke: true, coBrokeAgentName: ' ' }, { coBroke: true, coBrokeAgentName: 'a'.repeat(121) },
    { coBroke: false, coBrokeAgentName: 'Someone' }, { status: 'confirmed' }, { created_by_user_id: 9 },
  ]) assert.throws(() => validateDealOfferTerms({ ...terms, ...patch }), (e) => e.getStatus() === 400, JSON.stringify(patch));
  for (const input of [null, [], 'x']) assert.throws(() => validateDealOfferTerms(input), (e) => e.getStatus() === 400);
});

test('lease fields from an offer: a blank grace day or late fee stays blank, a deposit of whole months gives the months', () => {
  const row = validateDealOfferTerms({ ...terms, graceDay: null, lateFeePerDay: null });
  assert.deepEqual(offerLeaseFields(row), {
    monthlyRent: '15000', termMonths: '12', termFrom: '2026-11-01', termTo: '2027-10-31', advanceMonths: '1', advanceAmount: '15000',
    depositMonths: '2', depositAmount: '30000', rentDueDay: '1', graceDay: '', latePenalty: '',
  });
  assert.equal(offerLeaseFields(validateDealOfferTerms({ ...terms, depositAmount: '0' })).depositMonths, '0');
  assert.equal(offerLeaseFields(validateDealOfferTerms({ ...terms, depositAmount: '20000' })).depositMonths, '');
  assert.equal(offerLeaseFields(validateDealOfferTerms({ ...terms, depositAmount: '195000' })).depositMonths, '', 'over 12 months is left blank');
});

// An in-memory database: rows by entity, TypeORM's In / IsNull / Not in where clauses, pessimistic locks logged
// with the number of the transaction they ran in, and a rollback like Postgres.
function harness() {
  const state = {
    leads: [
      { id: 1, name: 'Lead A', created_by_user_id: 7, status: 'viewing', rent_room_id: null, booking_released_at: null },
      { id: 2, name: 'Lead B', created_by_user_id: 7, status: 'booked', rent_room_id: 4, booking_released_at: null },
      { id: 3, name: 'Lead C', created_by_user_id: 7, status: 'lost', rent_room_id: null, booking_released_at: null },
      { id: 9, name: 'Other agent lead', created_by_user_id: 8, status: 'viewing', rent_room_id: null, booking_released_at: null },
      // Booked once, the booking released: still a tenant, so it cannot be booked again.
      { id: 10, name: 'Lead D', created_by_user_id: 7, status: 'booked', rent_room_id: 3, booking_released_at: new Date('2026-10-01'), tenant_id: 20 },
    ],
    rooms: [
      { id: 3, created_by_user_id: 7, owner_id: 50, room_id: '1201', listing_title: null, property: { name: 'Aria' } },
      { id: 4, created_by_user_id: 7, owner_id: null, room_id: '0905', listing_title: 'Scout room', property: null },
      { id: 5, created_by_user_id: 8, owner_id: 51, room_id: '1', listing_title: null, property: null },
    ],
    users: [{ id: 7, first_name: 'Agent', last_name: 'Seven' }, { id: 50, first_name: 'Land', last_name: 'Lord' }],
    offers: [],
  };
  const table = (entity) => (entity === DealOfferEntity ? state.offers : entity === LeadEntity ? state.leads
    : entity === RentRoomEntity ? state.rooms : entity === UserEntity ? state.users : assert.fail(`unexpected entity ${entity?.name}`));
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && value._type === 'in') return value._value.includes(row[key]);
    if (value && typeof value === 'object' && value._type === 'isNull') return row[key] == null;
    if (value && typeof value === 'object' && value._type === 'not') return row[key] !== value._value;
    if (value && typeof value === 'object') assert.fail(`unsupported where ${key}`);
    return row[key] === value;
  });
  const copy = (row) => (row ? structuredClone(row) : null);
  const locks = [], writes = [];
  let tx = 0, txCount = 0, nextId = 100;
  const repo = (entity) => ({
    findOneBy: async (where) => copy(table(entity).find((row) => matches(row, where))),
    findOne: async ({ where }) => copy(table(entity).find((row) => matches(row, where))),
    find: async ({ where, order } = {}) => {
      const rows = table(entity).filter((row) => matches(row, where)).map(copy);
      return order?.id === 'DESC' ? rows.sort((a, b) => b.id - a.id) : rows;
    },
  });
  const manager = {
    getRepository: repo,
    findOne: async (entity, { where, lock }) => {
      if (lock) { assert.equal(lock.mode, 'pessimistic_write'); locks.push(`tx${tx}:${entity.name}`); }
      return copy(table(entity).find((row) => matches(row, where)));
    },
    findOneBy: async (entity, where) => copy(table(entity).find((row) => matches(row, where))),
    findOneByOrFail: async (entity, where) => copy(table(entity).find((row) => matches(row, where))) ?? assert.fail('missing'),
    create: (_entity, value) => ({ ...value }),
    save: async (entity, value) => {
      assert.equal(entity, DealOfferEntity); writes.push(`tx${tx}:insert`);
      const row = { ...value, id: nextId++, sent_at: null, confirmed_at: null, confirmed_by_user_id: null, confirmation_channel: null,
        confirmation_method: null, confirmation_note: null, closed_at: null };
      state.offers.push(row);
      return copy(row);
    },
    update: async (entity, where, patch) => {
      assert.equal(entity, DealOfferEntity); writes.push(`tx${tx}:update`);
      for (const row of state.offers.filter((r) => matches(r, where))) Object.assign(row, patch);
    },
  };
  const db = {
    getRepository: repo,
    transaction: async (fn) => {
      const before = structuredClone(state);
      tx = ++txCount;
      try { return await fn(manager); } catch (e) { Object.assign(state, before); throw e; } finally { tx = 0; }
    },
  };
  return { service: new DealOffersService(db), state, locks, writes };
}
const create = (h, patch = {}) => h.service.create(7, { ...terms, leadId: 1, rentRoomId: 3, ...patch });

test('the agent makes an offer for a lead and a room; lead then room are locked; it starts as a draft', async () => {
  const h = harness();
  const offer = await create(h);
  assert.deepEqual(h.locks, ['tx1:LeadEntity', 'tx1:RentRoomEntity']);
  assert.deepEqual(h.writes, ['tx1:insert']);
  assert.equal(h.state.offers[0].created_by_user_id, 7);
  assert.deepEqual(
    [offer.status, offer.revision, offer.leadId, offer.leadName, offer.rentRoomId, offer.roomLabel, offer.monthlyRent, offer.reservationAmount,
      offer.depositAmount, offer.endDate, offer.renewalNoticeDays, offer.graceDay, offer.lateFeePerDay, offer.landlordInApp, offer.confirmedAt],
    ['draft', 1, 1, 'Lead A', 3, 'Aria · ห้อง 1201', '15000', '15000', '30000', '2027-10-31', 30, 5, '200', true, null]);
  // The lead's offers, newest first; a closed one does not block a new one.
  await h.service.cancel(7, offer.id, { revision: 1 });
  const again = await create(h, { monthlyRent: '14000' });
  assert.deepEqual((await h.service.listForLead(7, 1)).map((o) => [o.id, o.status]), [[again.id, 'draft'], [offer.id, 'cancelled']]);
  await assert.rejects(() => h.service.listForLead(7, 9), (e) => e.getStatus() === 404, 'another agent\'s lead');
});

test('no offer for a lost lead, a booked lead, a booked room, someone else\'s lead or room, or a second open offer', async () => {
  const cases = [
    [{ leadId: 9 }, 404], [{ rentRoomId: 5 }, 404], [{ leadId: 3 }, 400], [{ leadId: 2 }, 409, 'LEAD_ALREADY_BOOKED'],
    [{ rentRoomId: 4 }, 409, 'ROOM_ALREADY_BOOKED'], [{ leadId: 0 }, 400], [{ rentRoomId: '3' }, 400], [{ leadId: undefined }, 400],
    [{ leadId: 10 }, 409, 'LEAD_HAS_TENANT'],
  ];
  for (const [patch, status, code] of cases) {
    const h = harness();
    await assert.rejects(() => create(h, patch), (e) => e.getStatus() === status && (!code || e.getResponse().code === code), JSON.stringify(patch));
    assert.deepEqual(h.state.offers, []);
  }
  // A released booking does not block an offer on the room.
  const released = harness();
  released.state.leads[1].booking_released_at = new Date();
  await create(released, { rentRoomId: 4 });
  const h = harness();
  await create(h);
  await assert.rejects(() => create(h), (e) => e.getStatus() === 409 && e.getResponse().code === 'OFFER_EXISTS');
  assert.equal(h.state.offers.length, 1);
});

test('before confirmation the agent edits with the revision; sending waits for the landlord, who confirms the latest terms', async () => {
  const h = harness();
  const offer = await create(h);
  const changed = (e) => e.getStatus() === 409 && e.getResponse().code === 'OFFER_CHANGED';
  const edited = await h.service.update(7, offer.id, { ...terms, monthlyRent: '16000', revision: 1 });
  assert.deepEqual([edited.revision, edited.monthlyRent, edited.status], [2, '16000', 'draft']);
  await assert.rejects(() => h.service.update(7, offer.id, { ...terms, revision: 1 }), changed);
  await assert.rejects(() => h.service.update(7, offer.id, { ...terms }), (e) => e.getStatus() === 400, 'the revision is required');
  await assert.rejects(() => h.service.update(7, offer.id, { ...terms, revision: 2, leadId: 2 }), (e) => e.getStatus() === 400, 'the lead cannot change');
  await assert.rejects(() => h.service.send(7, offer.id, { revision: 1 }), changed);
  const sent = await h.service.send(7, offer.id, { revision: 2 });
  assert.equal(sent.status, 'awaiting_landlord'); assert.ok(sent.sentAt);
  await assert.rejects(() => h.service.send(7, offer.id, { revision: 2 }), (e) => e.getStatus() === 409 && e.getResponse().code === 'OFFER_LOCKED');
  const resent = await h.service.update(7, offer.id, { ...terms, monthlyRent: '15500', revision: 2 });
  assert.deepEqual([resent.status, resent.revision], ['awaiting_landlord', 3], 'still with the landlord');
  // The landlord saw revision 2: stale.
  await assert.rejects(() => h.service.confirmAsLandlord(50, offer.id, { revision: 2 }), changed);
  const confirmed = await h.service.confirmAsLandlord(50, offer.id, { revision: 3 });
  assert.deepEqual(
    [confirmed.status, confirmed.monthlyRent, confirmed.confirmationChannel, confirmed.confirmationMethod, confirmed.confirmationNote, confirmed.confirmedByName],
    ['confirmed', '15500', 'app', null, null, 'Land Lord'], 'a confirmation in the app keeps the landlord\'s own name');
  assert.ok(confirmed.confirmedAt);
  assert.equal(h.state.offers[0].confirmed_by_user_id, 50);
  // Round 1: a confirmed offer is locked; the agent cancels and makes a new one.
  await assert.rejects(() => h.service.update(7, offer.id, { ...terms, revision: 3 }),
    (e) => e.getStatus() === 409 && e.getResponse().code === 'OFFER_LOCKED' && /ยกเลิก/.test(e.getResponse().message));
  await assert.rejects(() => h.service.confirmAsLandlord(50, offer.id, { revision: 3 }), (e) => e.getStatus() === 409);
  // Another agent cannot touch it.
  for (const step of ['update', 'send', 'cancel'])
    await assert.rejects(() => h.service[step](8, offer.id, { ...terms, revision: 3 }), (e) => e.getStatus() === 404, step);
});

test('the landlord confirms only an offer sent to them, for their own room; someone else\'s offer reads as missing', async () => {
  const h = harness();
  const offer = await create(h);
  await assert.rejects(() => h.service.confirmAsLandlord(50, offer.id, { revision: 1 }), (e) => e.getStatus() === 409, 'a draft is not sent yet');
  await h.service.send(7, offer.id, { revision: 1 });
  for (const user of [51, 7]) await assert.rejects(() => h.service.confirmAsLandlord(user, offer.id, { revision: 1 }), (e) => e.getStatus() === 404, `user ${user}`);
  await assert.rejects(() => h.service.confirmAsLandlord(50, 999, { revision: 1 }), (e) => e.getStatus() === 404);
  await assert.rejects(() => h.service.confirmAsLandlord(50, offer.id, { revision: 1, status: 'x' }), (e) => e.getStatus() === 400);
  assert.equal(h.state.offers[0].status, 'awaiting_landlord');
  assert.deepEqual((await h.service.listForLandlord(50)).map((o) => [o.id, o.status]), [[offer.id, 'awaiting_landlord']]);
  assert.deepEqual(await h.service.listForLandlord(51), []);
  assert.deepEqual(await h.service.listForLandlord(99), [], 'no rooms');
  // Drafts, cancelled and room_taken offers are not in the landlord's list; confirmed ones are.
  const other = harness();
  const base = { lead_id: 1, rent_room_id: 3, created_by_user_id: 7, revision: 1, ...validateDealOfferTerms(terms), sent_at: new Date(), confirmed_at: null,
    confirmed_by_user_id: null, confirmation_channel: null, confirmation_method: null, confirmation_note: null, closed_at: null };
  other.state.offers.push(
    { ...base, id: 1, status: 'draft', sent_at: null },
    { ...base, id: 2, status: 'cancelled', closed_at: new Date() },
    { ...base, id: 3, status: 'room_taken', closed_at: new Date() },
    { ...base, id: 4, status: 'confirmed', confirmed_at: new Date(), confirmed_by_user_id: 7, confirmation_channel: 'agent_recorded', confirmation_method: 'phone',
      confirmation_note: 'agent note', co_broke: true, co_broke_agent_name: 'Other Agent' },
    { ...base, id: 5, status: 'awaiting_landlord' },
  );
  const listed = await other.service.listForLandlord(50);
  assert.deepEqual(listed.map((o) => [o.id, o.status]), [[5, 'awaiting_landlord'], [4, 'confirmed']]);
  // The landlord does not get the agent's note, who recorded it, or the other agent's name.
  const recorded = listed.find((o) => o.id === 4);
  assert.deepEqual([recorded.confirmationNote, recorded.confirmedByName, recorded.coBrokeAgentName, recorded.coBroke, recorded.confirmationMethod],
    [null, null, null, true, 'phone']);
  assert.equal(recorded.leadName, 'Lead A', 'the tenant\'s name is shown (Aof: the landlord sees who the offer is for)');
});

test('an offer for a room whose landlord has no app account cannot be sent; the agent records the confirmation', async () => {
  const h = harness();
  h.state.leads[1].booking_released_at = new Date();
  const offer = await create(h, { rentRoomId: 4 });
  assert.equal(offer.landlordInApp, false);
  await assert.rejects(() => h.service.send(7, offer.id, { revision: 1 }), (e) => e.getStatus() === 400 && e.getResponse().code === 'OFFER_NO_LANDLORD_APP');
  assert.equal(h.state.offers[0].status, 'draft');
});

test('the agent records the landlord\'s confirmation with how it was given and a note', async () => {
  const h = harness();
  const offer = await create(h);
  for (const body of [{ revision: 1, method: 'fax', note: 'x' }, { revision: 1, method: 'phone', note: ' ' }, { revision: 1, method: 'phone', note: 'a'.repeat(501) },
    { revision: 1, method: 'phone' }, { revision: 1, method: 'phone', note: 'ok', channel: 'app' }])
    await assert.rejects(() => h.service.recordConfirmation(7, offer.id, body), (e) => e.getStatus() === 400, JSON.stringify(body));
  await assert.rejects(() => h.service.recordConfirmation(7, offer.id, { revision: 2, method: 'phone', note: 'ok' }), (e) => e.getStatus() === 409);
  // From a draft (the landlord has no account) or after sending.
  const confirmed = await h.service.recordConfirmation(7, offer.id, { revision: 1, method: 'line', note: '  Landlord said yes on LINE 22 Oct  ' });
  assert.deepEqual(
    [confirmed.status, confirmed.confirmationChannel, confirmed.confirmationMethod, confirmed.confirmationNote, confirmed.confirmedByName],
    ['confirmed', 'agent_recorded', 'line', 'Landlord said yes on LINE 22 Oct', 'Agent Seven']);
  await assert.rejects(() => h.service.recordConfirmation(7, offer.id, { revision: 1, method: 'line', note: 'again' }), (e) => e.getStatus() === 409);
  const sent = harness();
  const o2 = await create(sent);
  await sent.service.send(7, o2.id, { revision: 1 });
  assert.equal((await sent.service.recordConfirmation(7, o2.id, { revision: 1, method: 'in_person', note: 'Met at the room' })).status, 'confirmed');
});

test('an offer is cancelled before booking; once the room is booked on it, it cannot be', async () => {
  const h = harness();
  const offer = await create(h);
  await h.service.recordConfirmation(7, offer.id, { revision: 1, method: 'phone', note: 'ok' });
  h.state.leads[0].status = 'booked'; h.state.leads[0].rent_room_id = 3;
  await assert.rejects(() => h.service.cancel(7, offer.id, { revision: 1 }), (e) => e.getStatus() === 409 && e.getResponse().code === 'OFFER_BOOKED');
  assert.equal(h.state.offers[0].status, 'confirmed');
  // Booked on another room, or the booking was released: it can be cancelled.
  h.state.leads[0].booking_released_at = new Date();
  const cancelled = await h.service.cancel(7, offer.id, { revision: 1 });
  assert.equal(cancelled.status, 'cancelled'); assert.ok(cancelled.closedAt);
  await assert.rejects(() => h.service.cancel(7, offer.id, { revision: 1 }), (e) => e.getStatus() === 409 && e.getResponse().code === 'OFFER_LOCKED');
});

test('every write locks the offer in the same transaction it changes it', async () => {
  const h = harness();
  const offer = await create(h);
  h.locks.length = 0; h.writes.length = 0;
  await h.service.update(7, offer.id, { ...terms, revision: 1 });
  await h.service.send(7, offer.id, { revision: 2 });
  await h.service.confirmAsLandlord(50, offer.id, { revision: 2 });
  await h.service.cancel(7, offer.id, { revision: 2 });
  assert.deepEqual(h.locks, ['tx2:DealOfferEntity', 'tx3:DealOfferEntity', 'tx4:DealOfferEntity', 'tx5:DealOfferEntity']);
  assert.deepEqual(h.writes, ['tx2:update', 'tx3:update', 'tx4:update', 'tx5:update']);
});

test('D14: a reservation\'s attachment list adds the co-broke file when its confirmed offer names another agent, without blocking signing', async () => {
  const { AgreementTemplateEntity } = require('../src/entities/agreement-template.entity.ts');
  const { AgreementDocumentEntity, AgreementDocumentRequirementEntity, MasterDocumentTypeEntity } = require('../src/entities/agreement-document.entity.ts');
  let offer = { id: 30, co_broke: true }, formKind = 'reservation';
  const docs = [];
  const db = {
    getRepository: (entity) => entity === DealOfferEntity
      ? { findOne: async ({ where }) => { assert.deepEqual(where, { lead_id: 1, rent_room_id: 3, status: 'confirmed' }); return offer; } }
      : entity === AgreementTemplateEntity ? { findOneBy: async ({ id }) => (id === 2 ? { id: 2, form_kind: formKind } : null) }
      : assert.fail('unexpected repository'),
    manager: { find: async (entity) => entity === AgreementDocumentRequirementEntity ? [] : entity === MasterDocumentTypeEntity ? [] : assert.fail('unexpected find') },
  };
  const service = new AgreementAttachmentsService(db, {});
  service.rows = async () => docs;
  const c = { id: 11, template_id: 2, lead_id: 1, rent_room_id: 3, status: 'draft' };
  let list = await service.checklistForContract(c);
  assert.deepEqual(list.requirements.map((r) => [r.groupKey, r.subject, r.documentTypeCodes, r.complete]),
    [['co_broke', 'property', ['agent_commission_agreement'], false]]);
  assert.equal(list.readyToSign, true, 'needed before the letter is issued, not before signing');
  docs.push({ id: 1, subject: 'property', document_type_code: 'agent_commission_agreement', removed_at: null, supersedes_document_id: null, created_at: new Date(), review_status: 'pending' });
  list = await service.checklistForContract(c);
  assert.equal(list.requirements[0].complete, true);
  for ([offer, formKind] of [[{ id: 31, co_broke: false }, 'reservation'], [null, 'reservation'], [{ id: 30, co_broke: true }, 'lease']])
    assert.deepEqual((await service.checklistForContract(c)).requirements, [], JSON.stringify([offer, formKind]));
});

test('offer routes: the agent\'s need the agent role, the landlord\'s the landlord role, and pass the caller\'s id', async (t) => {
  const previous = process.env.ALLOW_DEV_AUTH; process.env.ALLOW_DEV_AUTH = 'true';
  t.after(() => { if (previous === undefined) delete process.env.ALLOW_DEV_AUTH; else process.env.ALLOW_DEV_AUTH = previous; });
  const calls = [];
  const offers = Object.fromEntries(['listForLead', 'create', 'update', 'send', 'recordConfirmation', 'cancel', 'listForLandlord', 'confirmAsLandlord']
    .map((name) => [name, async (...args) => { calls.push([name, ...args]); return { ok: name }; }]));
  class TestModule {}
  Module({ controllers: [DealOffersController, PartyContractsController], providers: [
    { provide: DealOffersService, useValue: offers },
    { provide: AgentContractsService, useValue: {} },
    { provide: AgreementAttachmentsService, useValue: {} },
    { provide: AuthService, useValue: { findBySupabaseUserId: async (id) => ({ id: Number(id) }),
      loadUserWithRoles: async (id) => ({ id, roleNames: id === 7 ? ['agent'] : id === 50 ? ['landlord'] : ['tenant'] }) } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false }); await app.listen(0, '127.0.0.1'); t.after(() => app.close());
  const base = await app.getUrl();
  const as = (id, method = 'GET', body) => ({ method, headers: { Authorization: `Bearer dev|${id}|u@example.invalid`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : body && JSON.stringify(body) });
  const agentRoutes = [['GET', '/agent/leads/1/deal-offers'], ['POST', '/agent/deal-offers'], ['PUT', '/agent/deal-offers/5'],
    ['POST', '/agent/deal-offers/5/send'], ['POST', '/agent/deal-offers/5/confirm'], ['POST', '/agent/deal-offers/5/cancel']];
  for (const [method, path] of agentRoutes) {
    assert.equal((await fetch(base + path, { method })).status, 401, path);
    assert.equal((await fetch(base + path, as(50, method, {}))).status, 403, `${path} landlord`);
    assert.ok([200, 201].includes((await fetch(base + path, as(7, method, { revision: 1 }))).status), path);
  }
  assert.deepEqual(calls.map((c) => [c[0], c[1], c[2]]), [['listForLead', 7, 1], ['create', 7, { revision: 1 }], ['update', 7, 5],
    ['send', 7, 5], ['recordConfirmation', 7, 5], ['cancel', 7, 5]]);
  calls.length = 0;
  for (const [method, path] of [['GET', '/contracts/mine/deal-offers'], ['POST', '/contracts/mine/deal-offers/5/confirm']]) {
    assert.equal((await fetch(base + path, as(9, method, {}))).status, 403, `${path} tenant`);
    assert.equal((await fetch(base + path, as(7, method, {}))).status, 403, `${path} agent`);
    assert.equal((await fetch(base + path, as(50, method, { revision: 2 }))).status, 200, path);
  }
  assert.deepEqual(calls, [['listForLandlord', 50], ['confirmAsLandlord', 50, 5, { revision: 2 }]]);
});
