// D8 (AC-1.2, 3.1, 6.3, 7.7, 8.4, C.4; Aof 27 Oct 2026): a room's status follows its deals and the Bangkok date.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { roomDealStatus } = require('../src/agent/rooms/room-deal-status.ts');
const { AgentListingsService } = require('../src/agent/listings/agent-listings.service.ts');
const { RentRoomEntity } = require('../src/entities/rent-room.entity.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { LeadEntity } = require('../src/entities/lead.entity.ts');

const c = (formKind, status, patch = {}) => ({ leadId: 1, formKind, status, agreementKind: formKind === 'renewal' ? 'renewal' : 'new', endDate: null, effectiveEndDate: null, ...patch });
const booked = (id = 1, released = null) => ({ id, status: 'booked', bookingReleasedAt: released });
const at = (today, contracts, leads = [], code = 'available') => roomDealStatus(today, code, contracts, leads);
const st = (...args) => at(...args).status;

test('a deal walks the room from available to booked to rented (TC-1.01, 3.01, 6.01, 6.02)', () => {
  assert.equal(st('2026-10-27', []), 'available', 'TC-1.01');
  assert.equal(st('2026-10-27', [], [booked()]), 'booked', 'the lead booked it');
  assert.equal(st('2026-10-27', [c('broker_appointment', 'active'), c('reservation', 'draft')], [booked()]), 'booked');
  assert.equal(st('2026-10-27', [c('reservation', 'active')]), 'booked', 'TC-3.01: the letter in force');
  for (const status of ['draft', 'awaiting_signatures', 'awaiting_deposit', 'awaiting_handover'])
    assert.equal(st('2026-10-27', [c('reservation', 'active'), c('lease', status, { endDate: '2027-10-31' })], [booked()]), 'booked', `TC-6.02 ${status}`);
  assert.deepEqual(at('2026-10-27', [c('reservation', 'active'), c('lease', 'active', { endDate: '2027-10-31' })], [booked()]), { status: 'rented', vacantFrom: null }, 'TC-6.01');
  assert.equal(st('2026-10-27', [], [], 'pending_verification'), 'pending_verification', 'not recorded fully: as stored');
  assert.equal(st('2026-10-27', [c('lease', 'active')], [], 'needs_edit'), 'needs_edit');
});

test('a cancelled deal gives the room back (TC-C.01, C.12): the released booking and the cancelled letter do not count', () => {
  assert.equal(st('2026-10-27', [c('broker_appointment', 'active'), c('reservation', 'cancelled')], [booked(1, '2026-10-26T03:00:00Z')]), 'available');
  assert.equal(st('2026-10-27', [c('reservation', 'cancelled'), c('lease', 'cancelled')], []), 'available');
});

test('soon vacant: ended early or not renewing, until 00:00 of the day after the last day (TC-7.06, C.13, C.14, 8.09)', () => {
  const ended = c('lease', 'terminated', { endDate: '2027-10-31', effectiveEndDate: '2027-01-15' });
  assert.deepEqual(at('2027-01-15', [ended], [booked()]), { status: 'soon_vacant', vacantFrom: '2027-01-16', nextBooked: false }, 'TC-7.06 on 15 Jan');
  assert.equal(st('2027-01-16', [ended], [booked()]), 'available', 'TC-7.06 from 00:00 of 16 Jan (its own lead is not a new booking)');
  // D15/D16 will record these; the status already takes them.
  const leaving = c('lease', 'active', { endDate: '2027-10-31', notRenewing: true });
  assert.deepEqual(at('2027-10-31', [leaving], [booked()]), { status: 'soon_vacant', vacantFrom: '2027-11-01', nextBooked: false });
  assert.equal(st('2027-10-20', [c('lease', 'active', { endDate: '2027-10-31', endsOn: '2027-10-20' })]), 'soon_vacant');
  // A new tenant books it: soon vacant until the day after, then booked (TC-8.09); cancelled, back as before (TC-C.13, C.14).
  const next = [leaving, c('reservation', 'active', { leadId: 2 })];
  assert.deepEqual(at('2027-10-31', next, [booked(1)]), { status: 'soon_vacant', vacantFrom: '2027-11-01', nextBooked: true }, 'TC-8.09 on 31 Oct');
  assert.equal(st('2027-11-01', next, [booked(1)]), 'booked', 'TC-8.09 on 1 Nov');
  const cancelled = [leaving, c('reservation', 'cancelled', { leadId: 2 })];
  assert.equal(st('2027-10-31', cancelled, [booked(1)]), 'soon_vacant', 'TC-C.13');
  assert.equal(st('2027-11-01', cancelled, [booked(1)]), 'available', 'TC-C.14');
  // A new tenant's booking alone makes a let room soon vacant (the current lease will not be renewed).
  assert.equal(st('2027-06-01', [c('lease', 'active', { endDate: '2027-10-31' })], [booked(1), booked(3)]), 'soon_vacant');
  assert.equal(st('2027-06-01', [c('lease', 'active', { endDate: '2027-10-31' })], [booked(1)]), 'rented', 'its own lead is no new booking');
});

test('a lease past its end with no decision stays rented (AC-8.7); a renewal keeps it let; a room let outside stays rented', () => {
  assert.equal(st('2027-10-31', [c('lease', 'active', { endDate: '2027-10-31' })], [booked()]), 'rented', 'its last day');
  assert.equal(st('2027-11-01', [c('lease', 'active', { endDate: '2027-10-31' })], [booked()]), 'rented', 'TC-8.11: no renew or not-renew record yet');
  assert.deepEqual(at('2027-11-05', [c('lease', 'active', { endDate: '2027-10-31', notRenewing: true, notRenewingOn: '2027-11-05' })], [booked()]),
    { status: 'soon_vacant', vacantFrom: '2027-11-06', nextBooked: false }, 'TC-8.11 recorded on 5 Nov');
  assert.equal(st('2027-11-06', [c('lease', 'active', { endDate: '2027-10-31', notRenewing: true, notRenewingOn: '2027-11-05' })], [booked()]), 'available');
  const renewed = [c('lease', 'expired', { endDate: '2027-10-31', effectiveEndDate: '2027-10-31' }), c('renewal', 'active', { endDate: '2028-10-31' })];
  assert.equal(st('2027-11-01', renewed, [booked()]), 'rented');
  assert.equal(st('2027-10-27', [], [], 'rented'), 'rented', 'set by hand, no deal in the system');
  assert.equal(st('2027-10-27', [c('reservation', 'cancelled')], [], 'rented'), 'rented', 'a cancelled deal is no deal');
  assert.equal(st('2027-11-01', [c('lease', 'expired', { endDate: '2027-10-31', effectiveEndDate: '2027-10-31' })], [], 'rented'), 'available', 'a deal in the system decides');
});

// The service with a database stub: rooms 1 to 4 of agent 7; the stored code of each, its contracts and booked leads.
function service({ statusFilterIds } = {}) {
  const rooms = [{ id: 1, code: 'available' }, { id: 2, code: 'available' }, { id: 3, code: 'rented' }, { id: 4, code: 'available' }];
  const contracts = [
    { rent_room_id: 2, lead_id: 5, status: 'active', template: { form_kind: 'reservation' }, agreement_kind: 'new' },
    { rent_room_id: 4, lead_id: 6, status: 'terminated', template: { form_kind: 'lease' }, agreement_kind: 'new', end_date: '2099-10-31', effective_end_date: '2099-01-15' },
  ];
  const leads = [{ id: 5, rent_room_id: 2, status: 'booked', booking_released_at: null }, { id: 6, rent_room_id: 4, status: 'booked', booking_released_at: null }];
  const inIds = (where) => where.id?._value ?? where.rent_room_id?._value;
  const db = { getRepository: (entity) => ({ find: async ({ where }) => {
    if (entity === RentRoomEntity) return rooms.filter((r) => !where.id || where.id._value.includes(r.id)).map((r) => ({ id: r.id, room_status: { code: r.code } }));
    if (entity === LeaseContractEntity) return contracts.filter((x) => inIds(where).includes(x.rent_room_id));
    if (entity === LeadEntity) return leads.filter((x) => inIds(where).includes(x.rent_room_id));
    return assert.fail(entity.name);
  } }) };
  const calls = [];
  const qb = {};
  for (const m of ['leftJoin', 'innerJoin', 'where', 'andWhere', 'select', 'addSelect', 'groupBy', 'orderBy', 'addOrderBy', 'offset', 'limit', 'setParameters'])
    qb[m] = (...args) => { calls.push([m, ...args]); return qb; };
  qb.clone = () => qb;
  qb.getCount = async () => { calls.push(['count']); return 0; };
  qb.getRawMany = async () => (statusFilterIds ?? [1, 2, 3, 4]).map((id) => ({ id }));
  const repo = { createQueryBuilder: () => qb, find: async ({ where }) => rooms.filter((r) => where.id._value.includes(r.id))
    .map((r) => ({ id: r.id, available_from_date: '2026-11-01', price_rows: [], prices: [], property: null, room_type: null })) };
  return { service: new AgentListingsService(repo, db), calls };
}

test('the room list filters by the status from the deals before counting and pagination', async () => {
  const { service: s, calls } = service();
  await s.listMine(7, { roomStatus: 'booked' });
  const count = calls.findIndex(([m]) => m === 'count');
  const filter = calls.findIndex(([m, sql, p]) => m === 'andWhere' && /room\.id IN/.test(sql) && JSON.stringify(p?.statusIds) === '[2]');
  assert.ok(filter >= 0 && filter < count, 'room 2 only, before the count');
  assert.ok(!calls.some(([m, sql]) => m === 'andWhere' && /roomStatus\.code = :roomStatus/.test(sql)), 'not the stored code');
  calls.length = 0;
  await s.listMine(7, { roomStatus: 'needs_edit' });
  assert.ok(calls.some(([m, sql]) => m === 'andWhere' && sql === '1 = 0'), 'nothing with that status: an empty page');
});

test('lead matching offers available and soon-vacant rooms, a soon-vacant one from the day after its lease', async () => {
  const { service: s } = service();
  const rooms = await s.matchCandidates(7, { maxPrice: 50000, boxes: [{ minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 }] });
  assert.deepEqual(rooms.map((r) => [r.id, r.availableFromDate]), [[1, '2026-11-01'], [4, '2099-01-16']],
    'not the booked room 2, not room 3 let outside the system');
});
