// Viewing requests from the guest web (project-docs/nestyk-guest-viewing-request-plan-20261123.md, Mos approved
// step 1 on 23 Nov 2026): a signed-in account asks to view a public room; NESTYK admin coordinates; the room's
// agent either handles it ("นัดเอง", then sees the guest's contact) or hands it back to admin.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
};
const { BadRequestException, ConflictException, NotFoundException, Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const R = require('../src/viewing-requests/viewing-request-rules.ts');
const { ViewingRequestsService } = require('../src/viewing-requests/viewing-requests.service.ts');
const { MeViewingRequestsController } = require('../src/viewing-requests/me-viewing-requests.controller.ts');
const { AdminViewingRequestsController } = require('../src/viewing-requests/admin-viewing-requests.controller.ts');
const { AgentViewingRequestsController } = require('../src/viewing-requests/agent-viewing-requests.controller.ts');
const { AuthService } = require('../src/auth/auth.service.ts');

// 23 Nov 2026 10:00 in Bangkok (03:00 UTC).
const NOW = Date.UTC(2026, 10, 23, 3, 0, 0);
const HOUR = 3600e3;
const iso = (ms) => new Date(NOW + ms).toISOString();

const code = (e) => e && typeof e.getResponse === 'function' ? e.getResponse().code : undefined;
const conflict = (want) => (e) => e instanceof ConflictException && code(e) === want;

test('Bangkok calendar day: the date a guest sees, not the UTC date', () => {
  assert.equal(R.bangkokDate(Date.UTC(2026, 10, 22, 17, 30)), '2026-11-23'); // 00:30 in Bangkok
  assert.equal(R.bangkokDate(Date.UTC(2026, 10, 22, 16, 30)), '2026-11-22');
  assert.equal(R.addDays('2026-11-23', 60), '2027-01-22');
});

test('new request: room id, one day and time (Bangkok, every 30 min, 08:00–20:00) from tomorrow up to 60 days ahead, a phone; message optional', () => {
  const ok = R.validateCreate({ roomId: '31', preferredAt: '2026-11-24T14:30:00+07:00', phone: ' 081 234 5678 ', message: '  ' }, NOW);
  assert.deepEqual(ok, { roomId: 31, preferredAt: new Date('2026-11-24T07:30:00.000Z'), phone: '081 234 5678', message: null });
  // The same rule whatever offset the client writes: 01:00 UTC is 08:00 in Bangkok, the first time of the day.
  const first = R.validateCreate({ roomId: '31', preferredAt: '2026-11-24T01:00:00.000Z', phone: '+66 81-234-5678' }, NOW);
  assert.equal(first.preferredAt.toISOString(), '2026-11-24T01:00:00.000Z');
  assert.equal(first.phone, '+66812345678');
  // The last time of the day, on the 60th day.
  assert.equal(R.validateCreate({ roomId: '31', preferredAt: '2027-01-22T20:00:00+07:00', phone: '0812345678' }, NOW).preferredAt.toISOString(), '2027-01-22T13:00:00.000Z');
  const base = { roomId: '31', preferredAt: '2026-11-24T10:00:00+07:00', phone: '0812345678' };
  for (const bad of [
    null, [], {},
    { ...base, roomId: '0' }, { ...base, roomId: 31 },
    { ...base, preferredAt: undefined }, { ...base, preferredAt: '' }, { ...base, preferredAt: 'soon' }, { ...base, preferredAt: 5 },
    { ...base, preferredAt: '2026-11-24' }, // a day without a time
    { ...base, preferredAt: '2026-11-23T18:00:00+07:00' }, // today: not allowed (Mos 23 Nov 2026)
    { ...base, preferredAt: '2026-11-22T10:00:00+07:00' }, // past
    { ...base, preferredAt: '2027-01-23T10:00:00+07:00' }, // 61 days ahead
    { ...base, preferredAt: '2026-11-24T14:15:00+07:00' }, { ...base, preferredAt: '2026-11-24T14:30:10+07:00' },
    { ...base, preferredAt: '2026-11-24T14:30:00.500+07:00' }, // not on the half hour
    { ...base, preferredAt: '2026-11-24T07:30:00+07:00' }, { ...base, preferredAt: '2026-11-24T20:30:00+07:00' },
    { ...base, preferredAt: '2026-11-24T00:00:00+07:00' }, // outside 08:00–20:00
    { ...base, preferredAt: '2026-11-31T10:00:00+07:00' }, { ...base, preferredAt: '2027-02-30T10:00:00+07:00' }, // no such day
    { roomId: '31', preferredDates: ['2026-11-24'], preferredSlot: 'morning', phone: '0812345678' }, // the old shape
    { ...base, phone: '' }, { ...base, phone: '   ' }, { ...base, phone: 'x'.repeat(51) }, { ...base, phone: '+12' },
    { ...base, message: 'x'.repeat(501) }, { ...base, message: 5 },
  ]) assert.throws(() => R.validateCreate(bad, NOW), BadRequestException, JSON.stringify(bad));
});

test('around Bangkok midnight the day rule follows the Bangkok date, whatever offset the client writes', () => {
  const at = (now, preferredAt) => R.validateCreate({ roomId: '31', preferredAt, phone: '0812345678' }, now);
  const justAfterMidnight = Date.UTC(2026, 10, 23, 17, 30); // 24 Nov 00:30 in Bangkok (still 23 Nov in UTC)
  assert.throws(() => at(justAfterMidnight, '2026-11-24T10:00:00+07:00'), BadRequestException, 'that is today now');
  assert.ok(at(justAfterMidnight, '2026-11-25T08:00:00+07:00'));
  const lateEvening = Date.UTC(2026, 10, 23, 16, 30); // 23 Nov 23:30 in Bangkok
  assert.ok(at(lateEvening, '2026-11-24T08:00:00+07:00'));
  assert.equal(at(NOW, '2026-11-23T20:00:00-05:00').preferredAt.toISOString(), '2026-11-24T01:00:00.000Z', '08:00 on the 24th in Bangkok');
});

test('schedule time: a date-time no more than 60 s in the past and at most 366 days ahead (same as agent viewings)', () => {
  assert.equal(R.validateSchedule({ scheduledAt: iso(2 * HOUR) }, NOW).toISOString(), iso(2 * HOUR));
  assert.ok(R.validateSchedule({ scheduledAt: iso(-30e3) }, NOW));
  for (const bad of [{}, { scheduledAt: 'soon' }, { scheduledAt: iso(-2 * HOUR) }, { scheduledAt: iso(367 * 24 * HOUR) }]) {
    assert.throws(() => R.validateSchedule(bad, NOW), BadRequestException, JSON.stringify(bad));
  }
  assert.equal(R.validateReason({ reason: '  rented  ' }), 'rented');
  for (const bad of [{}, { reason: ' ' }, { reason: 'x'.repeat(501) }]) assert.throws(() => R.validateReason(bad), BadRequestException);
  assert.equal(R.validateNote({ note: ' called the agent ' }), 'called the agent');
  assert.throws(() => R.validateNote({ note: '' }), BadRequestException);
});

const agentRoom = { id: 31, agentUserId: 7, isScout: true, title: 'Ideo Q Ari', number: '1208' };
const row = (over = {}) => ({ id: 1, rent_room_id: 31, requester_user_id: 50, agent_user_id: null, status: 'new', handled_by: null, scheduled_at: null, ...over });
const admin = { role: 'admin', userId: 1 };
const agent = { role: 'agent', userId: 7 };
const otherAgent = { role: 'agent', userId: 8 };
const guest = { role: 'guest', userId: 50 };
const at = new Date(NOW + 5 * HOUR);

test('the coordination path in the plan, step by step', () => {
  assert.deepEqual(R.decide(row(), agentRoom, { type: 'forward' }, admin), { status: 'awaiting_agent', agent_user_id: 7, handled_by: null });
  assert.deepEqual(R.decide(row({ status: 'awaiting_agent', agent_user_id: 7 }), agentRoom, { type: 'handle' }, agent), { status: 'agent_handling', handled_by: 'agent' });
  assert.deepEqual(R.decide(row({ status: 'awaiting_agent', agent_user_id: 7 }), agentRoom, { type: 'handToAdmin' }, agent), { status: 'admin_handling', handled_by: 'admin' });
  assert.deepEqual(R.decide(row(), agentRoom, { type: 'take' }, admin), { status: 'admin_handling', handled_by: 'admin' });
  assert.deepEqual(R.decide(row({ status: 'awaiting_agent', agent_user_id: 7 }), agentRoom, { type: 'take' }, admin), { status: 'admin_handling', handled_by: 'admin' });
  // Whoever handles it books, moves and finishes the viewing.
  const byAgent = row({ status: 'agent_handling', agent_user_id: 7, handled_by: 'agent' });
  assert.deepEqual(R.decide(byAgent, agentRoom, { type: 'schedule', at }, agent), { status: 'scheduled', scheduled_at: at });
  const bookedByAgent = { ...byAgent, status: 'scheduled', scheduled_at: at };
  assert.deepEqual(R.decide(bookedByAgent, agentRoom, { type: 'schedule', at }, agent), { status: 'scheduled', scheduled_at: at });
  assert.deepEqual(R.decide(bookedByAgent, agentRoom, { type: 'viewed' }, agent), { status: 'viewed' });
  const byAdmin = row({ status: 'admin_handling', handled_by: 'admin' });
  assert.deepEqual(R.decide(byAdmin, agentRoom, { type: 'schedule', at }, admin), { status: 'scheduled', scheduled_at: at });
  assert.deepEqual(R.decide({ ...byAdmin, status: 'scheduled', scheduled_at: at }, agentRoom, { type: 'viewed' }, admin), { status: 'viewed' });
  // Cancel (guest or admin) and close (admin, with a reason) from any open state.
  for (const status of R.OPEN_STATUSES) {
    assert.deepEqual(R.decide(row({ status }), agentRoom, { type: 'cancel' }, guest), { status: 'cancelled', cancelled_by: 'guest' }, status);
    assert.deepEqual(R.decide(row({ status }), agentRoom, { type: 'cancel' }, admin), { status: 'cancelled', cancelled_by: 'admin' }, status);
    assert.deepEqual(R.decide(row({ status }), agentRoom, { type: 'close', reason: 'rented' }, admin), { status: 'closed', close_reason: 'rented' }, status);
  }
});

test('moves the plan does not allow are refused (409 WRONG_STATUS, or 404 when it is not yours)', () => {
  const wrong = conflict('WRONG_STATUS');
  // Only new requests are forwarded; a room without an agent cannot be forwarded.
  assert.throws(() => R.decide(row({ status: 'admin_handling', handled_by: 'admin' }), agentRoom, { type: 'forward' }, admin), wrong);
  assert.throws(() => R.decide(row(), { ...agentRoom, agentUserId: null }, { type: 'forward' }, admin), conflict('NO_AGENT'));
  assert.throws(() => R.decide(row(), { ...agentRoom, isScout: false, agentUserId: null }, { type: 'forward' }, admin), conflict('NO_AGENT'));
  assert.throws(() => R.decide(row({ status: 'scheduled', handled_by: 'admin', scheduled_at: at }), agentRoom, { type: 'take' }, admin), wrong);
  // The agent answers only requests sent to them, and only once.
  assert.throws(() => R.decide(row({ status: 'awaiting_agent', agent_user_id: 7 }), agentRoom, { type: 'handle' }, otherAgent), NotFoundException);
  assert.throws(() => R.decide(row({ status: 'agent_handling', agent_user_id: 7, handled_by: 'agent' }), agentRoom, { type: 'handle' }, agent), wrong);
  assert.throws(() => R.decide(row({ status: 'new' }), agentRoom, { type: 'handToAdmin' }, agent), NotFoundException);
  // An agent who handed it to admin can no longer book or finish it; admin cannot book one the agent handles.
  const handed = row({ status: 'admin_handling', agent_user_id: 7, handled_by: 'admin' });
  assert.throws(() => R.decide(handed, agentRoom, { type: 'schedule', at }, agent), wrong);
  assert.throws(() => R.decide({ ...handed, status: 'scheduled', scheduled_at: at }, agentRoom, { type: 'viewed' }, agent), wrong);
  assert.throws(() => R.decide(row({ status: 'agent_handling', agent_user_id: 7, handled_by: 'agent' }), agentRoom, { type: 'schedule', at }, admin), wrong);
  assert.throws(() => R.decide(row({ status: 'awaiting_agent', agent_user_id: 7 }), agentRoom, { type: 'schedule', at }, admin), wrong);
  // Viewed only after a booking; closed requests stay closed.
  assert.throws(() => R.decide(row({ status: 'agent_handling', agent_user_id: 7, handled_by: 'agent' }), agentRoom, { type: 'viewed' }, agent), wrong);
  for (const status of ['viewed', 'cancelled', 'closed']) {
    for (const [action, actor] of [[{ type: 'cancel' }, guest], [{ type: 'cancel' }, admin], [{ type: 'close', reason: 'x' }, admin], [{ type: 'take' }, admin]]) {
      assert.throws(() => R.decide(row({ status, handled_by: 'admin', scheduled_at: at }), agentRoom, action, actor), wrong, `${status} ${action.type}`);
    }
  }
  // A guest cancels only their own request.
  assert.throws(() => R.decide(row(), agentRoom, { type: 'cancel' }, { role: 'guest', userId: 51 }), NotFoundException);
});

test('who sees what: the agent gets the contact and message only after "นัดเอง"; the guest never sees the agent', () => {
  const record = {
    ...row({ status: 'awaiting_agent', agent_user_id: 7 }),
    contact_name: 'Mint Guest', contact_phone: '0812345678', contact_email: 'mint@example.test',
    preferred_at: new Date('2026-11-24T11:00:00.000Z'), message: 'Line: mint', close_reason: null, cancelled_by: null,
    owner_notified_at: null, created_at: new Date(NOW), updated_at: new Date(NOW),
    room: agentRoom, agent: { id: 7, name: 'Agent Seven', email: 'seven@example.test' },
  };
  const before = R.toAgentView(record);
  assert.equal(before.contact, null);
  assert.equal(before.message, null);
  assert.equal(before.preferredAt, '2026-11-24T11:00:00.000Z');
  const after = R.toAgentView({ ...record, status: 'agent_handling', handled_by: 'agent' });
  assert.deepEqual(after.contact, { name: 'Mint Guest', phone: '0812345678', email: 'mint@example.test' });
  assert.equal(after.message, 'Line: mint');
  // Handed back to admin: still hidden, also once admin books it.
  assert.equal(R.toAgentView({ ...record, status: 'admin_handling', handled_by: 'admin' }).contact, null);
  assert.equal(R.toAgentView({ ...record, status: 'scheduled', handled_by: 'admin', scheduled_at: at }).contact, null);

  const adminView = R.toAdminView(record);
  assert.deepEqual(adminView.contact, { name: 'Mint Guest', phone: '0812345678', email: 'mint@example.test' });
  assert.deepEqual(adminView.agent, { id: 7, name: 'Agent Seven', email: 'seven@example.test' });
  assert.equal(adminView.isAgentRoom, true);

  const guestView = R.toGuestView(record, { id: '31' });
  assert.equal(JSON.stringify(guestView).includes('Agent Seven'), false);
  assert.equal(JSON.stringify(guestView).includes('seven@'), false);
  assert.equal('agent' in guestView, false);
  assert.equal(guestView.cancellable, true);
  assert.equal(R.toGuestView({ ...record, status: 'viewed' }, null).cancellable, false);
});

/** In-memory store with the same contract as ViewingRequestsStore (TypeORM). */
function fakeStore({ rooms = [agentRoom, { id: 32, agentUserId: 50, isScout: true, title: 'Mine', number: null }] } = {}) {
  const rows = [];
  const log = [];
  let seq = 0;
  const agents = { 7: { id: 7, name: 'Agent Seven', email: 'seven@example.test' } };
  const full = (r) => ({ ...r, room: rooms.find((x) => x.id === r.rent_room_id) ?? null, agent: r.agent_user_id ? agents[r.agent_user_id] ?? null : null });
  return {
    rows, log,
    async roomInfo(id) { return rooms.find((r) => r.id === id) ?? null; },
    async countOpen(userId) { return rows.filter((r) => r.requester_user_id === userId && R.OPEN_STATUSES.includes(r.status)).length; },
    async findOpenId(userId, roomId) { return rows.find((r) => r.requester_user_id === userId && r.rent_room_id === roomId && R.OPEN_STATUSES.includes(r.status))?.id ?? null; },
    async create(values, actorUserId) {
      const r = { id: ++seq, agent_user_id: null, status: 'new', handled_by: null, scheduled_at: null, close_reason: null, cancelled_by: null, owner_notified_at: null, created_at: new Date(NOW + seq), updated_at: new Date(NOW + seq), ...values };
      rows.push(r);
      log.push({ request_id: r.id, actor_user_id: actorUserId, from_status: null, to_status: 'new', note: null });
      return r.id;
    },
    async get(id) { const r = rows.find((x) => x.id === id); return r ? full(r) : null; },
    async list(filter) {
      return rows.filter((r) => (filter.requesterUserId == null || r.requester_user_id === filter.requesterUserId)
        && (filter.agentUserId == null || r.agent_user_id === filter.agentUserId)
        && (!filter.statuses || filter.statuses.includes(r.status))).sort((a, b) => b.created_at - a.created_at).map(full);
    },
    async events(id) { return log.filter((e) => e.request_id === id).map((e, i) => ({ id: i + 1, actorName: null, fromStatus: e.from_status, toStatus: e.to_status, note: e.note, createdAt: new Date(NOW).toISOString() })); },
    async mutate(id, change) {
      const r = rows.find((x) => x.id === id);
      if (!r) throw new NotFoundException('Viewing request not found');
      const { patch, event } = change(full(r), rooms.find((x) => x.id === r.rent_room_id) ?? null);
      Object.assign(r, patch);
      log.push({ request_id: id, actor_user_id: event.actorUserId, from_status: event.from, to_status: event.to, note: event.note });
    },
  };
}

function fakeRooms(publicIds = [31, 32]) {
  return {
    async publicIdsAmong(ids) { return ids.filter((id) => publicIds.includes(id)); },
    async cardsFor(ids) { return ids.filter((id) => publicIds.includes(id)).map((id) => ({ id: String(id) })); },
  };
}

const me = { id: 50, first_name: 'Mint', last_name: 'Guest', email: 'mint@example.test' };
const body = (over = {}) => ({ roomId: '31', preferredAt: '2026-11-24T18:00:00+07:00', phone: '0812345678', ...over });

test('sending a request: public rooms only, not your own room, one open request per room, at most 10 open', async () => {
  const store = fakeStore();
  const service = new ViewingRequestsService(store, fakeRooms([31, 32]), () => NOW);
  const created = await service.create(me, body({ message: 'Line: mint' }));
  assert.equal(created.status, 'new');
  assert.equal(store.rows[0].preferred_at.toISOString(), '2026-11-24T11:00:00.000Z');
  assert.equal(store.rows[0].contact_name, 'Mint Guest');
  assert.equal(store.rows[0].contact_email, 'mint@example.test');
  assert.deepEqual(store.log[0], { request_id: 1, actor_user_id: 50, from_status: null, to_status: 'new', note: null });

  await assert.rejects(service.create(me, body()), (e) => conflict('REQUEST_EXISTS')(e) && e.getResponse().requestId === 1);
  await assert.rejects(service.create(me, body({ roomId: '99' })), NotFoundException);
  await assert.rejects(service.create(me, body({ roomId: '32' })), conflict('OWN_ROOM'));
  // A name-less account falls back to its email for the contact name.
  await service.create({ ...me, id: 60, first_name: '', last_name: '' }, body());
  assert.equal(store.rows[1].contact_name, 'mint@example.test');

  const busy = fakeStore();
  for (let i = 0; i < 10; i += 1) busy.rows.push({ id: 100 + i, requester_user_id: 50, rent_room_id: 500 + i, status: 'new' });
  const full = new ViewingRequestsService(busy, fakeRooms([31]), () => NOW);
  await assert.rejects(full.create(me, body()), conflict('REQUEST_LIMIT'));
  busy.rows[0].status = 'cancelled';
  await full.create(me, body());
});

test('a guest lists and cancels only their own requests; admin and agent see the right ones', async () => {
  const store = fakeStore();
  const service = new ViewingRequestsService(store, fakeRooms([31]), () => NOW);
  const { id } = await service.create(me, body());
  assert.deepEqual((await service.listMine(50)).map((r) => [r.id, r.room?.id ?? null, r.status]), [[id, '31', 'new']]);
  assert.deepEqual(await service.listMine(51), []);
  await assert.rejects(service.cancelMine(51, id), NotFoundException);

  // Admin forwards; the agent sees it without the contact, then takes it on.
  await service.adminAct(1, id, 'forward', {});
  assert.equal((await service.agentList(8)).length, 0);
  assert.equal((await service.agentList(7))[0].contact, null);
  await assert.rejects(service.agentAct(8, id, 'handle', {}), NotFoundException);
  await service.agentAct(7, id, 'handle', {});
  assert.equal((await service.agentList(7))[0].contact.phone, '0812345678');
  await service.agentAct(7, id, 'schedule', { scheduledAt: iso(5 * HOUR) });
  assert.equal((await service.listMine(50))[0].scheduledAt, iso(5 * HOUR));

  const detail = await service.adminGet(id);
  assert.deepEqual(detail.events.map((e) => e.toStatus), ['new', 'awaiting_agent', 'agent_handling', 'scheduled']);
  await service.adminAct(1, id, 'notes', { note: 'Guest confirmed by phone' });
  assert.equal((await service.adminGet(id)).events.at(-1).note, 'Guest confirmed by phone');
  assert.equal((await service.adminGet(id)).status, 'scheduled', 'a note does not change the status');

  await service.cancelMine(50, id);
  assert.equal(store.rows[0].cancelled_by, 'guest');
  await assert.rejects(service.cancelMine(50, id), conflict('WRONG_STATUS'));

  assert.deepEqual((await service.adminList('cancelled')).map((r) => r.id), [id]);
  assert.deepEqual((await service.adminList('open')).map((r) => r.id), []);
  await assert.rejects(service.adminList('everything'), BadRequestException);
  await assert.rejects(service.adminAct(1, id, 'dance', {}), NotFoundException);
});

test('HTTP: me/ needs a sign-in, admin/ needs admin, agent/ needs agent; personal answers are not cached', async (t) => {
  process.env.ALLOW_DEV_AUTH = 'true';
  const store = fakeStore();
  const service = new ViewingRequestsService(store, fakeRooms([31]), () => Date.now());
  const roles = { 1: ['admin'], 7: ['agent'], 50: ['guest'] };
  class TestModule {}
  Module({
    controllers: [MeViewingRequestsController, AdminViewingRequestsController, AgentViewingRequestsController],
    providers: [
      { provide: ViewingRequestsService, useValue: service },
      { provide: AuthService, useValue: {
        findBySupabaseUserId: async (id) => (roles[Number(id)] ? { id: Number(id) } : null),
        loadUserWithRoles: async (id) => ({ id, first_name: 'Mint', last_name: 'Guest', email: 'mint@example.test', roleNames: roles[id] }),
      } },
    ],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  t.after(() => app.close());
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1/`;
  const call = (path, { method = 'GET', user, json } = {}) => fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer dev|${user}|u${user}@example.invalid` } : {}) },
    body: json == null ? undefined : JSON.stringify(json),
  });
  const tomorrow = R.addDays(R.bangkokDate(Date.now()), 1);

  assert.equal((await call('me/viewing-requests')).status, 401);
  assert.equal((await call('me/viewing-requests', { user: 99 })).status, 401, 'a valid token without an account row');
  const created = await call('me/viewing-requests', { method: 'POST', user: 50, json: { roomId: '31', preferredAt: `${tomorrow}T10:00:00+07:00`, phone: '0812345678' } });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const mine = await call('me/viewing-requests', { user: 50 });
  assert.equal(mine.headers.get('cache-control'), 'private, no-store');
  assert.equal((await mine.json()).length, 1);

  assert.equal((await call('admin/viewing-requests', { user: 50 })).status, 403);
  assert.equal((await call('admin/viewing-requests', { user: 7 })).status, 403);
  const queue = await call('admin/viewing-requests?status=open', { user: 1 });
  assert.equal(queue.status, 200);
  assert.equal(queue.headers.get('cache-control'), 'private, no-store');
  assert.equal((await call(`admin/viewing-requests/${id}/forward`, { method: 'POST', user: 1 })).status, 201);

  assert.equal((await call('agent/viewing-requests', { user: 50 })).status, 403);
  assert.equal((await call(`agent/viewing-requests/${id}/handle`, { method: 'POST', user: 1 })).status, 403);
  assert.equal((await call(`agent/viewing-requests/${id}/handle`, { method: 'POST', user: 7 })).status, 201);
  assert.equal((await call(`agent/viewing-requests/${id}/handle`, { method: 'POST', user: 7 })).status, 409);
  assert.equal((await call('admin/viewing-requests/abc', { user: 1 })).status, 400);
  assert.equal((await call(`me/viewing-requests/${id}/cancel`, { method: 'POST', user: 50 })).status, 201);
});

test('the module is registered and every entity is known to the schema check', () => {
  const appModule = fs.readFileSync(require.resolve('../src/app.module.ts'), 'utf8');
  assert.match(appModule, /ViewingRequestsModule/);
  const entities = fs.readFileSync(require.resolve('../src/entities/index.ts'), 'utf8');
  assert.match(entities, /ViewingRequestEntity,/);
  assert.match(entities, /ViewingRequestEventEntity,/);
});
