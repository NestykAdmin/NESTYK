// Pure planner of scripts/db-self-owner-contracts.cjs (plans/2026-11-26-self-owner-contracts-api, Task 4): which QA
// rows to make for the self owner's contracts. No DB, no storage, no clock: everything comes in as arguments
// (`today` included), and the rows come out without ids, linked by array index. Tested in
// test/self-owner-contracts-seed.test.cjs.
//
// The forms in `data` go through the agent's own validators and snapshots (lease-agreement.ts, lease-renewal.ts,
// broker-appointment.ts, reservation-letter.ts) and `validateAgreementData` (agreement-data.ts) with the template's
// data_schema, the way saveDraft in agent-contracts.service.ts stores them, so POST /contracts/mine/:id/document can
// build its preview from them. Dates come from lease-term.ts.
const fs = require('node:fs');

// The .ts loader the API tests use (top of test/agent-contract-sign.test.cjs).
if (!require.extensions['.ts']) {
  const ts = require('typescript');
  require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
}
const { validateAgreementData } = require('../src/agent/contracts/agreement-data.ts');
const { emptyLeaseAgreement, validateLeaseAgreement, leaseAgreementSnapshot } = require('../src/agent/contracts/lease-agreement.ts');
const { emptyLeaseRenewal, validateLeaseRenewal, leaseRenewalSnapshot, firstLeaseFields, parseRenewalCommission } = require('../src/agent/contracts/lease-renewal.ts');
const { validateBrokerAppointment, brokerAppointmentSnapshot } = require('../src/agent/contracts/broker-appointment.ts');
const { emptyReservationLetter, validateReservationLetter } = require('../src/agent/contracts/reservation-letter.ts');
const { addCalendarMonths, leaseTermEnd, shiftIsoDate, isIsoDate } = require('../src/agent/contracts/lease-term.ts');
const { identityNumberProblem, isValidThaiId } = require('../src/common/identity-number.ts');

/** data.seed of every contract the script makes; `note` / `notes` of its property owner, leads and tenants. */
const SEED_MARK = 'self-owner-contracts';
/** Rooms A, B and C of the demo. */
const ROOMS_NEEDED = 3;
const TERM_MONTHS = 12;
const PERMISSIVE_SCHEMA = { type: 'object' };

/** The local Supabase DB (supabase/config.toml db port), the only target of the seed. */
const LOCAL_DB_HOSTS = ['127.0.0.1', 'localhost'];
const LOCAL_DB_PORT = '54422';

/**
 * Refuses any DATABASE_URL that pg would not connect to 127.0.0.1 / localhost on port 54422. Decided on what pg itself
 * uses: the same pg-connection-string parser pg resolves, whose query parameters (?host=, ?hostaddr=, ?port=) override
 * the URL's own host and port. A socket path, several hosts or an unparsable URL are refused too. Returns { host, port }.
 */
function assertLocalDatabase(url) {
  const shown = (value) => JSON.stringify(String(value ?? ''));
  if (typeof url !== 'string' || !/^postgres(ql)?:\/\//i.test(url.trim()))
    throw new Error('DATABASE_URL must be a postgres:// or postgresql:// URL');
  let outer;
  try {
    outer = new URL(url.trim());
  } catch {
    throw new Error('DATABASE_URL cannot be parsed');
  }
  const { parse } = require(require.resolve('pg-connection-string', { paths: [require('node:path').dirname(require.resolve('pg'))] }));
  let config;
  try {
    config = parse(url.trim());
  } catch {
    throw new Error('DATABASE_URL cannot be parsed');
  }
  const host = String(config.host ?? '');
  const hosts = [outer.hostname, host, ...outer.searchParams.getAll('host')];
  if (!host || hosts.some((h) => !LOCAL_DB_HOSTS.includes(h)))
    throw new Error(`DATABASE_URL host ${shown(host || outer.hostname)} is not local (allowed: ${LOCAL_DB_HOSTS.join(', ')}; no socket path, no other ?host=)`);
  const hostaddrs = [...new Set([config.hostaddr, ...outer.searchParams.getAll('hostaddr')].filter((v) => v != null && v !== ''))];
  if (hostaddrs.some((a) => a !== '127.0.0.1'))
    throw new Error(`DATABASE_URL hostaddr ${shown(hostaddrs.join(','))} is not 127.0.0.1`);
  const port = String(config.port ?? '');
  if (port !== LOCAL_DB_PORT || outer.searchParams.getAll('port').some((p) => p !== LOCAL_DB_PORT))
    throw new Error(`DATABASE_URL port ${shown(port || '(default 5432)')} is not the local Supabase DB port ${LOCAL_DB_PORT}`);
  return { host, port };
}

/** The seed's creator stands in for the agent, but must not be one: agent endpoints would then reach the contracts. */
function assertCreator(roles) {
  const list = Array.isArray(roles) ? roles : [];
  if (list.includes('agent')) throw new Error('the creator has the agent role; use an admin account without it (qa-admin)');
  if (!list.includes('admin')) throw new Error('the creator needs the admin role (qa-admin: guest + admin)');
}

const money = (n) => Number(n).toFixed(2);
const text = (n) => String(Number(n));
const fit = (value, max) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const firstOfMonth = (iso) => `${iso.slice(0, 7)}-01`;
/** Delivery and signing moments: a fixed hour (Bangkok morning) of a day, so the plan is the same for the same today. */
const at = (day, hourUtc) => `${day}T${String(hourUtc).padStart(2, '0')}:00:00.000Z`;
/** A valid Thai ID card number from 12 digits (the 13th is the check digit, identity-number.ts). */
function thaiId(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (13 - i);
  const id = `${first12}${(11 - (sum % 11)) % 10}`;
  if (!isValidThaiId(id)) throw new Error(`bad generated Thai ID ${id}`);
  return id;
}
function person(input, fallback) {
  const p = { ...fallback, ...Object.fromEntries(Object.entries(input ?? {}).filter(([, v]) => v != null && v !== '')) };
  const name = [p.firstName, p.lastName].filter((part) => String(part ?? '').trim()).join(' ').trim();
  return { ...p, name: name || fallback.name || 'QA' };
}

/**
 * @param {{ adminId: number; ownerUserId: number; tenantUserId: number;
 *   rooms: Array<{ id: number; ownerUserId: number; roomNumber: string | null; property: string | null; monthlyRent: number;
 *     roomName?: string; address?: string; floor?: string; area?: string; advanceMonths?: number; depositMonths?: number }>;
 *   today: string;
 *   people?: { admin?: object; owner?: object; tenant?: object };
 *   schemas?: Partial<Record<'lease' | 'renewal' | 'broker_appointment' | 'reservation', object>>;
 *   contractNos?: string[] }} input
 */
function planSelfOwnerContracts(input) {
  const { adminId, ownerUserId, tenantUserId, today } = input;
  for (const [key, id] of Object.entries({ adminId, ownerUserId, tenantUserId }))
    if (!Number.isSafeInteger(id) || id < 1) throw new Error(`${key} must be a user id`);
  if (!isIsoDate(today)) throw new Error('today must be YYYY-MM-DD');
  const rooms = Array.isArray(input.rooms) ? input.rooms : [];
  if (rooms.length < ROOMS_NEEDED)
    throw new Error(`the self owner has ${rooms.length} room(s); ${ROOMS_NEEDED} are needed (rooms A, B, C)`);
  const used = rooms.slice(0, ROOMS_NEEDED).map((room, i) => {
    if (room.ownerUserId !== ownerUserId)
      throw new Error(`room ${room.id} is not the self owner's (owner_user_id ${room.ownerUserId}, expected ${ownerUserId})`);
    const rent = Number(room.monthlyRent);
    if (!Number.isFinite(rent) || rent <= 0) throw new Error(`room ${room.id} has no monthly rent`);
    const project = fit(room.property || room.roomName || `QA room ${'ABC'[i]}`, 80);
    return {
      ...room,
      rent,
      project,
      number: fit(room.roomNumber ?? '', 24),
      address: fit(room.address ?? '', 160),
      advanceMonths: Number.isInteger(room.advanceMonths) ? room.advanceMonths : 1,
      depositMonths: Number.isInteger(room.depositMonths) ? room.depositMonths : 2,
    };
  });
  const schemas = input.schemas ?? {};
  const nos = input.contractNos ?? [];
  const admin = person(input.people?.admin, { firstName: 'QA', lastName: 'Admin', phone: '0990000006', name: 'QA Admin' });
  const owner = person(input.people?.owner, { firstName: 'QA', lastName: 'Self Owner', phone: '0990000004', email: '', name: 'QA Self Owner' });
  const qaTenant = person(input.people?.tenant, { firstName: 'QA', lastName: 'Tenant', phone: '0990000002', email: '', nationality: 'Thai', name: 'QA Tenant' });
  if (!qaTenant.identityNumber || identityNumberProblem(qaTenant.identityNumber, qaTenant.nationality))
    qaTenant.identityNumber = thaiId('110170020345');
  const formerTenant = person(null, {
    firstName: 'มานพ', lastName: 'ดีงาม', phone: '0870002206', email: '', nationality: 'Thai', identityNumber: thaiId('310060011223'), name: 'มานพ ดีงาม',
  });

  const propertyOwner = {
    name: owner.name,
    phone: owner.phone,
    email: owner.email || null,
    note: SEED_MARK,
    created_by_user_id: adminId,
    user_id: ownerUserId,
  };
  const leads = [];
  const tenants = [];
  const tenancies = [];
  const contracts = [];
  /** One lead and its tenant per deal, as the agent makes them (tenants.lead_id is unique). */
  function deal(who, userId) {
    leads.push({
      name: who.name, first_name: who.firstName, last_name: who.lastName, phone: who.phone, email: who.email || null,
      nationality: who.nationality || null, status: 'booked', notes: SEED_MARK, created_by_user_id: adminId, tenantIndex: tenants.length,
    });
    tenants.push({
      leadIndex: leads.length - 1, name: who.name, first_name: who.firstName, last_name: who.lastName, phone: who.phone,
      email: who.email || null, identity_number: who.identityNumber, nationality: who.nationality || null, user_id: userId,
      note: SEED_MARK, created_by_user_id: adminId, who,
    });
    return tenants.length - 1;
  }
  function tenancy(roomIndex, tenantIndex, status, moveIn = null, moveOut = null) {
    tenancies.push({
      roomIndex, self_owner_room_id: used[roomIndex].id, rent_room_id: null, tenantIndex, status,
      move_in_date: moveIn, move_out_date: moveOut, created_by_user_id: adminId,
    });
    return tenancies.length - 1;
  }

  const agentContact = [admin.name, admin.phone, 'NESTYK'].filter(Boolean).join(' · ');
  const propertyLine = (room, max) => fit([room.project, room.number ? `ห้อง ${room.number}` : '', room.address].filter(Boolean).join(' · '), max);
  const snapshot = (room, t, ownerName = owner.name, ownerPhone = owner.phone) => ({
    tenantName: t.name,
    tenantPhone: t.phone,
    tenantEmail: t.email || null,
    tenantIdNumber: t.identity_number,
    tenantNationality: t.nationality,
    ownerName,
    ownerPhone: ownerPhone || null,
    // rent_rooms.owner_identity_number in the agent path; a self owner room has no such column.
    ownerIdNumber: null,
    agentName: admin.name,
    agentPhone: admin.phone || null,
    room: room.number || null,
    property: room.project,
    propertyAddress: room.address || null,
  });
  const landlord = {
    landlordName: owner.name, landlordFirstName: owner.firstName ?? '', landlordLastName: owner.lastName ?? '',
    landlordPhone: owner.phone ?? '', landlordId: owner.identityNumber ?? '',
  };
  const tenantFields = (t) => ({
    tenantName: t.name, tenantFirstName: t.first_name ?? '', tenantLastName: t.last_name ?? '', tenantPhone: t.phone ?? '',
    tenantEmail: t.email ?? '', tenantId: t.identity_number ?? '', tenantNationality: t.nationality ?? '',
  });

  function leaseForm(i, room, t, start, end, issueDate) {
    const form = validateLeaseAgreement({
      ...emptyLeaseAgreement(),
      documentNo: nos[i] ?? '',
      issueDate,
      ...landlord,
      landlordEmail: owner.email ?? '',
      landlordAddress: room.address,
      ...tenantFields(t),
      project: room.project,
      houseNo: room.number,
      propertyAddress: room.address,
      floor: fit(room.floor ?? '', 20),
      area: fit(room.area ?? '', 20),
      termMonths: String(TERM_MONTHS),
      termFrom: start,
      termTo: end,
      monthlyRent: text(room.rent),
      rentDueDay: '5',
      advanceMonths: String(room.advanceMonths),
      advanceAmount: text(room.rent * room.advanceMonths),
      depositMonths: String(room.depositMonths),
      depositAmount: text(room.rent * room.depositMonths),
      accountName: owner.name,
      agentContact: fit(agentContact, 200),
      landlordSignName: owner.name,
      tenantSignName: t.name,
      witnessSignName: admin.name,
    });
    return leaseAgreementSnapshot(form);
  }

  /** The base of `data`: the template's own fields through validateAgreementData, then the form (saveDraft order). */
  function baseData(kind, terms) {
    return validateAgreementData(schemas[kind] ?? PERMISSIVE_SCHEMA, undefined, terms, kind);
  }

  function lease(spec) {
    const i = contracts.length;
    const room = used[spec.roomIndex];
    const t = tenants[spec.tenantIndex];
    const end = leaseTermEnd(spec.start, TERM_MONTHS);
    const deposit = room.rent * room.depositMonths;
    const data = baseData('lease', { leadId: 1, startDate: spec.start, endDate: end, monthlyRent: room.rent, deposit });
    data.leaseAgreement = leaseForm(i, room, t, spec.start, end, spec.issueDate);
    contracts.push(row(i, spec, 'lease', {
      start_date: spec.start, end_date: end, monthly_rent: money(room.rent), deposit: money(deposit), data, snap: snapshot(room, t),
    }));
    return i;
  }

  function row(i, spec, formKind, fields) {
    const t = tenants[spec.tenantIndex];
    const { snap, ...rest } = fields;
    const data = { ...rest.data, seed: SEED_MARK };
    return {
      key: spec.key,
      demo: spec.demo ?? null,
      formKind,
      roomIndex: spec.roomIndex,
      leadIndex: t.leadIndex,
      tenantIndex: spec.tenantIndex,
      tenancyIndex: spec.tenancyIndex,
      previousIndex: spec.previousIndex ?? null,
      // null = the contract is its own root (saveDraft sets root_agreement_id to the new id).
      rootIndex: spec.previousIndex ?? null,
      agreement_kind: spec.previousIndex == null ? 'new' : 'renewal',
      created_by_user_id: adminId,
      owner_user_id: used[spec.roomIndex].ownerUserId,
      self_owner_room_id: used[spec.roomIndex].id,
      rent_room_id: null,
      status: spec.status,
      start_date: null,
      end_date: null,
      move_in_date: null,
      monthly_rent: null,
      deposit: null,
      reservation_fee: null,
      notes: null,
      ...rest,
      data,
      party_snapshot: snap,
      // saveDraft: the owner gets every contract; the tenant every one but a broker appointment, if they have a login.
      owner_delivered_at: at(spec.issueDate, 3),
      tenant_delivered_at: formKind !== 'broker_appointment' && t.user_id != null ? at(spec.issueDate, 3) : null,
      signatures: (spec.signed ?? []).map(([party, day]) => ({
        party,
        channel: 'app',
        signedAt: at(day, 5),
        signedByUserId: party === 'owner' ? ownerUserId : party === 'tenant' ? t.user_id : adminId,
      })),
      end: spec.status === 'expired'
        ? { reasonCode: 'term_completed', effectiveEndDate: fields.end_date, recordedAt: `${fields.end_date}T17:00:00.000Z` }
        : null,
    };
  }

  function broker(spec) {
    const i = contracts.length;
    const room = used[spec.roomIndex];
    const t = tenants[spec.tenantIndex];
    const data = baseData('broker_appointment', { leadId: 1, startDate: spec.start });
    data.brokerAppointment = brokerAppointmentSnapshot(validateBrokerAppointment({
      documentNo: nos[i] ?? '',
      issueDate: spec.start,
      ...landlord,
      landlordNationality: '',
      landlordAddress: fit(room.address, 120),
      brokerCompany: 'NESTYK',
      brokerContact: admin.name,
      brokerNationality: 'ไทย',
      brokerId: '',
      brokerPhone: admin.phone ?? '',
      brokerAddress: '',
      propertyLine: propertyLine(room, 160),
      monthlyRent: text(room.rent),
      leaseMonths: String(TERM_MONTHS),
      commissionFee: '',
      commissionMonths: '1',
      landlordSignName: owner.name,
      brokerSignName: admin.name,
      landlordSignaturePng: '',
      brokerSignaturePng: '',
    }));
    contracts.push(row(i, spec, 'broker_appointment', { start_date: spec.start, data, snap: snapshot(room, t) }));
    return i;
  }

  function reservation(spec) {
    const i = contracts.length;
    const room = used[spec.roomIndex];
    const t = tenants[spec.tenantIndex];
    const termTo = leaseTermEnd(spec.moveIn, TERM_MONTHS);
    const fee = room.rent;
    const letter = validateReservationLetter({
      ...emptyReservationLetter(),
      documentNo: nos[i] ?? '',
      issueDate: spec.start,
      ...tenantFields(t),
      ...landlord,
      landlordEmail: owner.email ?? '',
      landlordNationality: owner.nationality ?? '',
      agentName: admin.name,
      agentPhone: admin.phone ?? '',
      project: room.project,
      address: room.address,
      unitNo: room.number,
      floor: fit(room.floor ?? '', 16),
      area: fit(room.area ?? '', 16),
      termMonths: String(TERM_MONTHS),
      termFrom: spec.moveIn,
      termTo,
      monthlyRent: text(room.rent),
      advanceMonths: String(room.advanceMonths),
      advanceAmount: text(room.rent * room.advanceMonths),
      depositMonths: String(room.depositMonths),
      depositAmount: text(room.rent * room.depositMonths),
      reservationPayment: text(fee),
      balanceDue: text(room.rent * (room.advanceMonths + room.depositMonths) - fee),
      payee: owner.name,
      paymentMethod: 'transfer',
      tenantSignName: t.name,
      landlordSignName: owner.name,
      agentSignName: admin.name,
    });
    const data = baseData('reservation', { leadId: 1, startDate: spec.start, moveInDate: spec.moveIn, reservationFee: fee });
    data.reservationLetter = letter;
    contracts.push(row(i, spec, 'reservation', {
      start_date: spec.start, move_in_date: spec.moveIn, reservation_fee: money(fee),
      // saveDraft: a reservation's rent and deposit are the letter's.
      monthly_rent: money(room.rent), deposit: money(room.rent * room.depositMonths),
      data, snap: snapshot(room, t, letter.landlordName, letter.landlordPhone),
    }));
    return i;
  }

  function renewal(spec) {
    const i = contracts.length;
    const previous = contracts[spec.previousIndex];
    const room = used[spec.roomIndex];
    const t = tenants[spec.tenantIndex];
    const start = shiftIsoDate(previous.end_date, 1);
    const end = leaseTermEnd(start, TERM_MONTHS);
    const prev = { contract_no: nos[spec.previousIndex] || `QA-${spec.previousIndex + 1}`, start_date: previous.start_date, end_date: previous.end_date, data: previous.data };
    // The renewal's first lease is the previous lease here (the chain starts there), as saveDraft fills it.
    const first = firstLeaseFields(prev);
    const form = validateLeaseRenewal({
      ...emptyLeaseRenewal(),
      documentNo: nos[i] ?? '',
      issueDate: spec.issueDate,
      landlordName: owner.name,
      tenantName: t.name,
      propertyLine: propertyLine(room, 240),
      ...first,
      originalLeaseNo: first.firstLeaseNo,
      originalLeaseDate: first.firstLeaseDate,
      originalExpiryDate: previous.end_date,
      renewMonths: String(TERM_MONTHS),
      startDate: start,
      endDate: end,
      monthlyRent: text(room.rent),
      dueDay: '5',
      depositCarried: text(Number(previous.deposit)),
      landlordSignName: owner.name,
      tenantSignName: t.name,
    });
    const deposit = Number(previous.deposit);
    const data = baseData('renewal', { leadId: 1, startDate: start, endDate: end, monthlyRent: room.rent, deposit });
    data.leaseRenewal = leaseRenewalSnapshot(form);
    data.renewalCommission = parseRenewalCommission('0');
    contracts.push(row(i, spec, 'renewal', {
      start_date: start, end_date: end, monthly_rent: money(room.rent), deposit: money(deposit), data, snap: snapshot(room, t),
    }));
    return i;
  }

  const T = today;
  const day = (n) => shiftIsoDate(T, n);

  // Room A (the demo's r5): appointed broker, a booking, and the lease that starts on the booked move-in date and
  // waits for the owner (the tenant has signed).
  const A = 0;
  const tA = deal(qaTenant, tenantUserId);
  const yA = tenancy(A, tA, 'prospect');
  const moveIn = addCalendarMonths(firstOfMonth(T), 1);
  broker({ key: 'broker-a', roomIndex: A, tenantIndex: tA, tenancyIndex: yA, status: 'active', start: day(-35), issueDate: day(-35),
    signed: [['owner', day(-35)], ['agent', day(-35)]] });
  reservation({ key: 'reservation-a', demo: 4, roomIndex: A, tenantIndex: tA, tenancyIndex: yA, status: 'active', start: day(-4),
    issueDate: day(-4), moveIn, signed: [['tenant', day(-3)], ['owner', day(-3)], ['agent', day(-3)]] });
  lease({ key: 'lease-a', demo: 1, roomIndex: A, tenantIndex: tA, tenancyIndex: yA, status: 'awaiting_signatures', start: moveIn,
    issueDate: day(-2), signed: [['tenant', day(-1)]] });

  // Room B (r2 and r6): the lease before ended, the current lease ends within 30 days (the renewal window), and its
  // renewal waits for both.
  const B = 1;
  const currentStart = addCalendarMonths(day(21), -TERM_MONTHS);
  const formerStart = addCalendarMonths(currentStart, -TERM_MONTHS);
  const tX = deal(formerTenant, null);
  const yX = tenancy(B, tX, 'moved_out', formerStart, leaseTermEnd(formerStart, TERM_MONTHS));
  lease({ key: 'lease-b-expired', demo: 6, roomIndex: B, tenantIndex: tX, tenancyIndex: yX, status: 'expired', start: formerStart,
    issueDate: shiftIsoDate(formerStart, -5), signed: [['owner', shiftIsoDate(formerStart, -3)], ['tenant', shiftIsoDate(formerStart, -3)]] });
  const tB = deal(qaTenant, tenantUserId);
  const yB = tenancy(B, tB, 'active', currentStart);
  const currentB = lease({ key: 'lease-b', roomIndex: B, tenantIndex: tB, tenancyIndex: yB, status: 'active', start: currentStart,
    issueDate: shiftIsoDate(currentStart, -5), signed: [['owner', shiftIsoDate(currentStart, -3)], ['tenant', shiftIsoDate(currentStart, -3)]] });
  renewal({ key: 'renewal-b', demo: 2, roomIndex: B, tenantIndex: tB, tenancyIndex: yB, previousIndex: currentB,
    status: 'awaiting_signatures', issueDate: day(-1) });

  // Room C (r1): an ongoing lease, and a broker appointment waiting for the owner (and the agent).
  const C = 2;
  const cStart = addCalendarMonths(firstOfMonth(T), -3);
  const tC = deal(qaTenant, tenantUserId);
  const yC = tenancy(C, tC, 'active', cStart);
  lease({ key: 'lease-c', demo: 5, roomIndex: C, tenantIndex: tC, tenancyIndex: yC, status: 'active', start: cStart,
    issueDate: shiftIsoDate(cStart, -5), signed: [['owner', shiftIsoDate(cStart, -3)], ['tenant', shiftIsoDate(cStart, -3)]] });
  broker({ key: 'broker-c', demo: 3, roomIndex: C, tenantIndex: tC, tenancyIndex: yC, status: 'awaiting_signatures', start: day(-1),
    issueDate: day(-1) });

  return {
    propertyOwner,
    leads,
    tenants: tenants.map(({ who, ...t }) => t),
    tenancies,
    contracts,
  };
}

module.exports = { planSelfOwnerContracts, assertCreator, assertLocalDatabase, SEED_MARK, ROOMS_NEEDED, TERM_MONTHS };
