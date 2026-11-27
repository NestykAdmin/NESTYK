// Task 4 (plans/2026-11-26-self-owner-contracts-api): the pure planner behind scripts/db-self-owner-contracts.cjs.
// No DB: the planner gets ids and today, and returns rows linked by array index.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { planSelfOwnerContracts, assertCreator, assertLocalDatabase, SEED_MARK, ROOMS_NEEDED } = require('../scripts/self-owner-contracts-plan.cjs');
const { validateLeaseAgreement } = require('../src/agent/contracts/lease-agreement.ts');
const { validateLeaseRenewal } = require('../src/agent/contracts/lease-renewal.ts');
const { validateBrokerAppointment } = require('../src/agent/contracts/broker-appointment.ts');
const { validateReservationLetter } = require('../src/agent/contracts/reservation-letter.ts');

/** data_schema of the active templates in supabase/seed/masters.sql (the script passes the DB's own). */
function masterSchemas() {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../../supabase/seed/masters.sql'), 'utf8');
  const byId = (id) => JSON.parse(new RegExp(`\\t\\(${id}, '[a-z_]+', \\d+, '[^']*', '[a-z_]+', '(\\{.*?\\})', `).exec(sql)[1]);
  return { lease: byId(11), renewal: byId(10), broker_appointment: byId(6), reservation: byId(7) };
}

const TODAY = '2026-11-26';
const rooms = [
  { id: 41, ownerUserId: 9, roomNumber: '2101', property: 'Aria Sathorn', monthlyRent: 25000, roomName: 'ห้องวิวสวน' },
  { id: 42, ownerUserId: 9, roomNumber: '805', property: 'Noble Ploenchit', monthlyRent: 18000 },
  { id: 43, ownerUserId: 9, roomNumber: '1204', property: 'Lumpini Place', monthlyRent: 12000 },
];
const base = { adminId: 5, ownerUserId: 9, tenantUserId: 7, rooms, today: TODAY };
const plan = (extra = {}) => planSelfOwnerContracts({ ...base, schemas: masterSchemas(), ...extra });
const formOf = (c) => c.data.leaseAgreement ?? c.data.leaseRenewal ?? c.data.brokerAppointment ?? c.data.reservationLetter;

test('six contracts with the demo kinds and statuses', () => {
  const { contracts } = plan();
  const demo = contracts.filter((c) => c.demo).sort((a, b) => a.demo - b.demo);
  assert.deepEqual(demo.map((c) => [c.demo, c.formKind, c.status, c.roomIndex]), [
    [1, 'lease', 'awaiting_signatures', 0],
    [2, 'renewal', 'awaiting_signatures', 1],
    [3, 'broker_appointment', 'awaiting_signatures', 2],
    [4, 'reservation', 'active', 0],
    [5, 'lease', 'active', 2],
    [6, 'lease', 'expired', 1],
  ]);
  // The extra rows: the active broker appointment of room A and the active lease the renewal renews.
  assert.deepEqual(contracts.filter((c) => !c.demo).map((c) => [c.formKind, c.status, c.roomIndex]),
    [['broker_appointment', 'active', 0], ['lease', 'active', 1]]);
  // Who signed: the lease waits for the owner (tenant signed), the renewal and the appointment for everyone.
  const signed = (c) => c.signatures.map((s) => s.party).sort();
  assert.deepEqual(signed(demo[0]), ['tenant']);
  assert.deepEqual(signed(demo[1]), []);
  assert.deepEqual(signed(demo[2]), []);
  assert.deepEqual(signed(demo[3]), ['agent', 'owner', 'tenant']);
  assert.deepEqual(signed(demo[4]), ['owner', 'tenant']);
  assert.equal(demo[0].signatures[0].signedByUserId, 7);
  // Dates relative to today: the awaiting lease starts soon, the active one is running, the expired one has ended.
  assert.ok(demo[0].start_date > TODAY && demo[0].start_date <= '2026-12-31');
  assert.ok(demo[4].start_date <= TODAY && demo[4].end_date > TODAY);
  assert.ok(demo[5].end_date < TODAY);
  assert.deepEqual(demo[5].end, { reasonCode: 'term_completed', effectiveEndDate: demo[5].end_date, recordedAt: `${demo[5].end_date.slice(0, 10)}T17:00:00.000Z` });
  for (const c of contracts) {
    assert.equal(c.data.seed, SEED_MARK);
    for (const s of c.signatures) assert.ok(s.signedAt < `${TODAY}T00:00:00.000Z`, 'signed before today');
  }
});

test('every contract has exactly one room and it is a self owner room', () => {
  const { contracts, tenancies } = plan();
  for (const row of [...contracts, ...tenancies]) {
    assert.equal(row.rent_room_id, null);
    assert.equal(row.self_owner_room_id, rooms[row.roomIndex].id);
  }
  // The labels the party endpoints show come from the room, through party_snapshot.
  const lease = contracts.find((c) => c.demo === 1);
  assert.equal(lease.party_snapshot.property, 'Aria Sathorn');
  assert.equal(lease.party_snapshot.room, '2101');
});

test("owner_user_id equals the room's owner and created_by is the admin", () => {
  const { contracts, tenancies, leads, tenants, propertyOwner } = plan();
  for (const c of contracts) {
    assert.equal(c.owner_user_id, rooms[c.roomIndex].ownerUserId);
    assert.equal(c.created_by_user_id, 5);
  }
  for (const row of [...tenancies, ...leads, ...tenants]) assert.equal(row.created_by_user_id, 5);
  // The landlord is the admin-made property owner row of the self owner.
  assert.equal(propertyOwner.created_by_user_id, 5);
  assert.equal(propertyOwner.user_id, 9);
  assert.equal(propertyOwner.note, SEED_MARK);
  for (const row of [...leads.map((l) => l.notes), ...tenants.map((t) => t.note)]) assert.equal(row, SEED_MARK);
  // A room of someone else is refused.
  assert.throws(() => plan({ rooms: [rooms[0], { ...rooms[1], ownerUserId: 99 }, rooms[2]] }), /ไม่ใช่ของ|not the self owner/);
  assert.throws(() => plan({ rooms: rooms.slice(0, 2) }), new RegExp(`${ROOMS_NEEDED}`));
});

test('delivered to both parties', () => {
  const { contracts, tenants } = plan();
  for (const c of contracts) {
    assert.ok(c.owner_delivered_at, `owner of contract ${c.key}`);
    // Like the agent path: the tenant gets every contract but a broker appointment, when they have a login.
    const tenantIsParty = c.formKind !== 'broker_appointment' && tenants[c.tenantIndex].user_id != null;
    assert.equal(!!c.tenant_delivered_at, tenantIsParty, `tenant of contract ${c.key}`);
  }
  // The self owner's QA tenant is the tenant of every open contract.
  for (const c of contracts.filter((row) => row.status !== 'expired'))
    assert.equal(tenants[c.tenantIndex].user_id, 7);
});

test('renewal points at the lease of the same room', () => {
  // Contract numbers come from the DB (nextContractNo); the planner writes the ones it is given into the forms.
  const nos = plan().contracts.map((c, i) => `${c.formKind === 'renewal' ? 'RN' : 'LS'}2026${String(i + 1).padStart(5, '0')}`);
  const { contracts } = plan({ contractNos: nos });
  const renewal = contracts.find((c) => c.formKind === 'renewal');
  const previous = contracts[renewal.previousIndex];
  assert.equal(renewal.agreement_kind, 'renewal');
  assert.equal(renewal.rootIndex, renewal.previousIndex);
  assert.equal(previous.formKind, 'lease');
  assert.equal(previous.status, 'active');
  assert.equal(previous.roomIndex, renewal.roomIndex);
  assert.equal(previous.tenantIndex, renewal.tenantIndex);
  assert.equal(previous.tenancyIndex, renewal.tenancyIndex, 'the renewal continues the tenancy');
  // The agent rules: starts the day after the previous end, which is at most 30 days away.
  const nextDay = new Date(Date.parse(`${previous.end_date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  assert.equal(renewal.start_date, nextDay);
  assert.ok(previous.end_date >= TODAY && previous.end_date <= '2026-12-26');
  const form = renewal.data.leaseRenewal;
  assert.equal(form.documentNo, nos[contracts.indexOf(renewal)]);
  assert.equal(form.originalLeaseNo, nos[renewal.previousIndex]);
  assert.equal(form.firstLeaseNo, nos[renewal.previousIndex]);
  assert.equal(previous.data.leaseAgreement.documentNo, nos[renewal.previousIndex]);
  assert.equal(form.originalExpiryDate, previous.end_date);
  assert.equal(renewal.data.renewalCommission, '0.00');
  // New contracts are their own root.
  for (const c of contracts.filter((row) => row.agreement_kind === 'new')) {
    assert.equal(c.previousIndex, null);
    assert.equal(c.rootIndex, null);
  }
});

test('reservation room has an active broker appointment', () => {
  const { contracts } = plan();
  const reservation = contracts.find((c) => c.formKind === 'reservation');
  const appointment = contracts.find((c) => c.formKind === 'broker_appointment' && c.status === 'active');
  assert.equal(appointment.roomIndex, reservation.roomIndex);
  assert.equal(appointment.tenantIndex, reservation.tenantIndex);
  assert.equal(appointment.created_by_user_id, reservation.created_by_user_id);
  // hasBrokerAppointment: started under 1 year before today.
  assert.ok(appointment.start_date <= TODAY && appointment.start_date > '2025-11-26');
  assert.equal(appointment.end_date, null);
  assert.equal(reservation.end_date, null);
  assert.ok(reservation.move_in_date >= reservation.start_date);
  // The lease of room A starts on the booked move-in date.
  assert.equal(contracts.find((c) => c.demo === 1).start_date, reservation.move_in_date);
});

test('tenancies: one active per room at most', () => {
  const { contracts, tenancies } = plan();
  for (const [i] of rooms.entries())
    assert.ok(tenancies.filter((t) => t.roomIndex === i && t.status === 'active').length <= 1, `room ${i}`);
  for (const c of contracts) {
    const t = tenancies[c.tenancyIndex];
    assert.equal(t.roomIndex, c.roomIndex);
    assert.equal(t.tenantIndex, c.tenantIndex);
  }
  // An active lease has an active tenancy; the expired one moved out; the upcoming lease is a prospect.
  const byDemo = (n) => tenancies[contracts.find((c) => c.demo === n).tenancyIndex].status;
  assert.equal(byDemo(5), 'active');
  assert.equal(byDemo(6), 'moved_out');
  assert.equal(byDemo(1), 'prospect');
});

test('form data is what the agent save path stores, so the party preview can be built', () => {
  const { contracts } = plan();
  for (const c of contracts) {
    const form = formOf(c);
    assert.ok(form, `form of ${c.key}`);
    assert.ok(!Object.keys(form).some((key) => key.endsWith('SignaturePng')), 'snapshots drop signature images');
    const again = { lease: validateLeaseAgreement, renewal: validateLeaseRenewal, broker_appointment: validateBrokerAppointment, reservation: validateReservationLetter }[c.formKind](form);
    for (const key of Object.keys(form)) assert.deepEqual(again[key], form[key], `${c.key}.${key} survives the validator`);
  }
  const lease = contracts.find((c) => c.demo === 1);
  assert.equal(lease.data.leaseAgreement.landlordName, 'QA Self Owner');
  assert.equal(lease.data.leaseAgreement.termFrom, lease.start_date);
  assert.equal(lease.data.leaseAgreement.termTo, lease.end_date);
  assert.equal(lease.data.monthlyRent, 25000);
  assert.equal(lease.monthly_rent, '25000.00');
  assert.equal(lease.deposit, '50000.00');
  // A schema the data does not fit is refused (the script passes the template's own schema).
  assert.throws(() => plan({ schemas: { ...masterSchemas(), lease: { type: 'object', additionalProperties: false, properties: {} } } }), /ฟิลด์/);
});

test('script refuses an admin with the agent role', () => {
  assert.throws(() => assertCreator(['guest', 'admin', 'agent']), /agent/);
  assert.throws(() => assertCreator(['guest']), /admin/);
  assert.doesNotThrow(() => assertCreator(['guest', 'admin']));
});

test('script refuses a DATABASE_URL that pg would not connect to the local DB', () => {
  assert.deepEqual(assertLocalDatabase('postgresql://postgres:postgres@127.0.0.1:54422/postgres'), { host: '127.0.0.1', port: '54422' });
  assert.deepEqual(assertLocalDatabase('postgres://postgres:postgres@localhost:54422/postgres'), { host: 'localhost', port: '54422' });
  const refused = {
    // pg connects to the ?host= value, not to the URL's host.
    'postgres://postgres:x@127.0.0.1:54422/postgres?host=db.example.supabase.co': /not local/,
    'postgres://postgres:x@127.0.0.1:54422/postgres?host=%2Fvar%2Frun%2Fpostgresql': /not local/,
    'postgres://postgres:x@localhost:54422/postgres?hostaddr=10.0.0.5': /hostaddr/,
    'postgres://postgres:x@127.0.0.1:54422/postgres?port=5432': /port/,
    'postgres://postgres:x@127.0.0.1.evil.com:54422/postgres': /not local/,
    'postgres://postgres:x@localhost:5432/postgres': /port/,
    'postgres://postgres:x@localhost/postgres': /port/,
    'postgres://postgres:x@db.example.supabase.co:54422/postgres': /not local/,
    'postgres://postgres:x@%2Fvar%2Frun%2Fpostgresql:54422/postgres': /not local|parsed/,
    'postgres://postgres:x@127.0.0.1:54422,db.example.supabase.co:5432/postgres': /parsed|not local/,
    'socket:/var/run/postgresql?db=postgres': /postgres:\/\//,
    'not a url': /postgres:\/\//,
    'postgres://': /parsed|not local/,
  };
  for (const [url, message] of Object.entries(refused)) assert.throws(() => assertLocalDatabase(url), message, url);
  assert.throws(() => assertLocalDatabase(undefined), /postgres:\/\//);
});

// Bills plan (27 Nov 2026, Task 3): rent bills of the active leases, so the income page has paid, awaiting and
// overdue rows. Periods and amounts come from the API's own schedule (rentBillHistory).
test('bills: paid, awaiting review and overdue on the active leases', () => {
  const p = plan();
  assert.ok(Array.isArray(p.bills) && p.bills.length > 0, 'bills planned');
  const active = new Set(p.contracts.map((c, i) => (c.status === 'active' && ['lease', 'renewal'].includes(c.formKind) ? i : -1)).filter((i) => i >= 0));
  for (const b of p.bills) {
    assert.ok(active.has(b.contractIndex), `bill of contract ${b.contractIndex} is on an active lease`);
    assert.match(b.period, /^\d{4}-(0[1-9]|1[0-2])$/);
    assert.ok(b.issue_date <= TODAY, `${b.period} issued by today`);
    assert.ok(Number(b.amount) > 0);
  }
  const keys = p.bills.map((b) => `${b.contractIndex}:${b.period}`);
  assert.equal(new Set(keys).size, keys.length, 'one bill per lease and period');
  const paid = p.bills.filter((b) => b.status === 'paid');
  const awaiting = p.bills.filter((b) => b.status === 'pending' && b.slip);
  const overdue = p.bills.filter((b) => b.status === 'pending' && !b.slip && b.grace_until < TODAY);
  assert.ok(paid.length >= 1 && paid.every((b) => b.slip && b.slip_submitted_at && b.paid_at && b.slip_submitted_at <= b.paid_at));
  assert.ok(awaiting.length >= 1 && awaiting.every((b) => b.slip_submitted_at && !b.paid_at));
  assert.ok(overdue.length >= 1);
  for (const b of p.bills) if (b.slip_submitted_at) assert.ok(b.slip_submitted_at.slice(0, 10) <= TODAY, 'no slip from the future');
});
