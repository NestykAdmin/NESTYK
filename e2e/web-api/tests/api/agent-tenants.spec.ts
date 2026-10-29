import type { AgentTenant, Lead, ListingSummary, Paginated, TenantLeadOption, TenantRoomOption } from '../../src/api/types';
import type { TenantRoomOptionsQuery } from '../../src/api/tenants.api';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';
import { MAX_PAGE_SIZE, isDescending } from '../../src/support/pagination';

/**
 * ผู้เช่าของนายหน้า: รายการ รายละเอียด ตัวเลือกลีดและห้องของฟอร์มสร้างผู้เช่า และการตรวจค่าตอนสร้างหรือแก้ผู้เช่า
 *
 * สิ่งที่ต้องมีก่อน
 *   - ล็อกอินแบบนักพัฒนาได้ (ดู auth.spec.ts)
 *   - qa-agent มีลีดที่สถานะไม่ใช่ lost และยังไม่เป็นผู้เช่าอย่างน้อย 1 ราย และห้องอย่างน้อย 2 ห้อง
 *     (ผู้เรียกของไฟล์นี้คือ fixture agent = qa-agent ดู src/config/qa-accounts.ts)
 *   - ถ้า qa-agent ยังไม่มีผู้เช่า เทสของรายการผู้เช่าตรวจได้แค่ว่าตอบเป็นรายการ (มีป้าย "ไม่ได้ตรวจ" ในรายงาน)
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   POST และ PATCH ส่งเฉพาะคำขอที่ระบบต้องปฏิเสธ และใช้ลีด ห้อง และผู้เช่าที่ไม่มีอยู่จริง (NO_SUCH_ID)
 *   create ใน apps/api/src/agent/tenants/agent-tenants.service.ts หาลีด แล้วหาห้อง ตรวจว่าห้องยังไม่ถูกจอง
 *   ตรวจว่ามีข้อเสนอที่ผู้ให้เช่ายืนยันแล้วของลีดกับห้องนั้น (400 OFFER_NOT_CONFIRMED) และตรวจเลขบัตร ก่อนบันทึก
 *   (การตรวจข้อเสนอและการตรวจเลขบัตรเพิ่มใน develop f845ac6 และอยู่หลังการหาลีดและห้อง เคส 404 ของไฟล์นี้จึงยังได้ 404 เหมือนเดิม)
 *   และ update หาผู้เช่าก่อนบันทึก ห้องหรือผู้เช่าที่ไม่มีจริงจึงหยุดการบันทึกไว้ แม้การตรวจค่าของ API จะหลุด
 *   (ยกเว้นข้อที่ส่งเนื้อเป็นรายการ ดูคอมเมนต์ของข้อนั้น)
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id (ชนิด integer ของ PostgreSQL) เก็บได้ = 2^31 - 1 */
const INT32_MAX = 2_147_483_647;

/** ข้อความของตัวตรวจ id (DatabaseIdPipe ใน apps/api/src/common/database-id.pipe.ts ตั้งแต่ DEV/main f7d52ed) เมื่อ id ไม่อยู่ในช่วง 1 ถึง 2147483647 */
const ID_OUT_OF_RANGE = 'ID must be an integer between 1 and 2147483647';

/** id ที่ไม่มีลีด ห้อง หรือผู้เช่ารายไหนใช้: ใช้ค่าที่มากที่สุดที่ฐานข้อมูลเก็บได้ */
const NO_SUCH_ID = INT32_MAX;

/** จำนวนตัวเลือกสูงสุดที่ API ส่งกลับในครั้งเดียว (take(30) ของ leadOptions และ roomOptions ใน agent-tenants.service.ts) */
const MAX_OPTIONS = 30;

/** ข้อความที่ API ตอบ ที่มา: parseTenantProfile, validateTenant, create และ update ใน agent-tenants.service.ts */
const MESSAGE = {
  noBody: 'กรุณาระบุข้อมูลผู้เช่า',
  leadAndRoom: 'กรุณาเลือก Lead และห้องที่เช่า',
  nameAndPhone: 'กรุณาระบุชื่อและเบอร์โทรให้ครบ และตรวจสอบความยาวข้อมูล',
  email: 'รูปแบบอีเมลไม่ถูกต้อง',
  phone: 'กรุณาระบุเบอร์โทรที่ถูกต้อง',
  identityNumber: 'กรุณาระบุเลขบัตรประชาชนหรือพาสปอร์ตให้ถูกต้อง',
  leadNotFound: 'ไม่พบ Lead ที่คุณมีสิทธิ์จัดการ',
  tenantNotFound: 'ไม่พบผู้เช่า',
} as const;

/**
 * ข้อมูลผู้เช่าที่ผ่านการตรวจค่าทุกข้อ ส่งไปที่ลีดและห้องที่ไม่มีอยู่จริง เทสแต่ละข้อเปลี่ยนจากชุดนี้แค่ 1 จุด
 * กติกาของทุกข้อ: ห้ามส่ง rentRoomId ของห้องที่มีอยู่จริง และห้ามตัด rentRoomId ออก
 *   เหตุผล: ถ้าการตรวจค่าของ API หลุดจนระบบหาลีดเจอ ห้องที่ไม่มีจริงคือสิ่งที่หยุดการบันทึกไว้
 */
function validTenantBody(): Record<string, unknown> {
  return { leadId: NO_SUCH_ID, rentRoomId: NO_SUCH_ID, firstName: 'E2E', lastName: 'Tester', phone: '0812345678' };
}

/** ข้อมูลโปรไฟล์ผู้เช่าที่ถูกต้อง สำหรับ PATCH */
function validProfileBody(): Record<string, unknown> {
  return { firstName: 'E2E', lastName: 'Tester', phone: '0812345678' };
}

/** สำเนาของข้อมูลที่ตัดช่องที่ระบุออก */
function without(body: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  const copy = { ...body };
  for (const key of keys) delete copy[key];
  return copy;
}

/** ลีดทั้งหมดของนายหน้าจาก GET /agent/leads เดินอ่านทีละหน้าโดยเรียงตามเวลาที่สร้าง (ลำดับนี้ไม่ขยับระหว่างรัน) */
async function allLeads(agent: ApiSession): Promise<Lead[]> {
  const leads: Lead[] = [];
  for (let page = 1; ; page += 1) {
    const body = await expectJson<Paginated<Lead>>(
      await agent.leads.list({ page, limit: MAX_PAGE_SIZE, sort: 'created_asc' }),
      200,
    );
    leads.push(...body.items);
    if (body.items.length === 0 || leads.length >= body.total) return leads;
  }
}

/** ผู้เช่าทั้งหมดของนายหน้า */
async function allTenants(agent: ApiSession): Promise<AgentTenant[]> {
  const tenants = await expectJson<AgentTenant[]>(await agent.tenants.list(), 200);
  expect(Array.isArray(tenants), 'GET /agent/tenants ต้องตอบเป็นรายการ').toBe(true);
  return tenants;
}

/** ตัวเลือกห้องของฟอร์มสร้างผู้เช่า */
async function roomOptions(agent: ApiSession, query: TenantRoomOptionsQuery = {}): Promise<TenantRoomOption[]> {
  return expectJson<TenantRoomOption[]>(await agent.tenants.roomOptions(query), 200);
}

test.describe('GET /agent/tenants', () => {
  test("returns the agent's tenants as a list", { tag: '@smoke' }, async ({ agent }) => {
    // ขั้นที่ 1: เรียกรายการผู้เช่า
    const tenants = await allTenants(agent);

    // ขั้นที่ 2: ถ้ามีผู้เช่า ทุกรายต้องมีช่องหลักครบ id ไม่ซ้ำ และเรียงจากรายที่สร้างล่าสุด (id มากไปน้อย)
    //   ถ้ายังไม่มีผู้เช่า ขั้นนี้ไม่ได้ตรวจอะไร จึงบันทึกไว้ในรายงาน คนอ่านผลจะได้ไม่เข้าใจว่าตรวจแล้ว
    if (tenants.length === 0) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: 'ยังไม่มีผู้เช่า จึงตรวจได้แค่ว่าตอบเป็นรายการ' });
    }
    for (const tenant of tenants) {
      const label = `ผู้เช่า id ${tenant.id}`;
      expect(Number.isInteger(tenant.id) && tenant.id > 0, label).toBe(true);
      expect(tenant.name.trim().length, label).toBeGreaterThan(0);
      expect(tenant.phone.trim().length, label).toBeGreaterThan(0);
      expect(Array.isArray(tenant.contracts), label).toBe(true);
    }
    const ids = tenants.map((tenant) => tenant.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(isDescending(ids)).toBe(true);
  });
});

test.describe('GET /agent/tenants/:id', () => {
  test('answers 404 for an id that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ใช้ id ที่ไม่มีผู้เช่ารายไหนใช้   ขั้นที่ 2: ต้องได้ 404 พร้อมข้อความว่าไม่พบผู้เช่า
    expect(await expectError(await agent.tenants.getById(NO_SUCH_ID), 404)).toBe(MESSAGE.tenantNotFound);
  });

  test('answers 400 for an id that is not a whole number', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง id ที่เป็นตัวอักษร และ id ที่เป็นทศนิยม   ขั้นที่ 2: ต้องได้ 400 ทั้งคู่
    await expectError(await agent.tenants.getById('abc'), 400);
    await expectError(await agent.tenants.getById('1.5'), 400);
  });

  test('answers 400 for an id above the 32-bit integer range', async ({ agent }) => {
    // เดิมเป็นบั๊กที่รู้แล้ว (API ตอบ 500) ทีมแก้แล้วที่ DEV/main f7d52ed: ตัวตรวจ id (DatabaseIdPipe) ปฏิเสธก่อนถึงฐานข้อมูล
    // ขั้นที่ 1: ส่ง id ที่มากกว่าค่าสูงสุดของ integer อยู่ 1   ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความของตัวตรวจ id
    expect(await expectError(await agent.tenants.getById(INT32_MAX + 1), 400)).toBe(ID_OUT_OF_RANGE);
  });
});

test.describe('GET /agent/tenants/leads', () => {
  test('lists every lead that can still become a tenant, newest first', async ({ agent }) => {
    // ขั้นที่ 1: หาคำตอบที่ควรได้จากรายการลีด (GET /agent/leads)
    //   ลีดที่สร้างเป็นผู้เช่าได้ = ลีดของนายหน้าที่สถานะไม่ใช่ lost และยังไม่เป็นผู้เช่า (tenantId เป็น null) เรียง id จากมากไปน้อย ไม่เกิน 30 ราย
    //   (leadOptions ใน agent-tenants.service.ts กรองด้วย lead.tenant_id IS NULL ซึ่งเป็นค่าเดียวกับ tenantId ของรายการลีด)
    const leads = await allLeads(agent);
    const eligible = leads.filter((lead) => lead.status !== 'lost' && lead.tenantId === null).sort((a, b) => b.id - a.id);
    expect(eligible.length, 'qa-agent ต้องมีลีดที่สถานะไม่ใช่ lost และยังไม่เป็นผู้เช่าอย่างน้อย 1 ราย').toBeGreaterThan(0);
    const expected = eligible.slice(0, MAX_OPTIONS);

    // บันทึกลงรายงานว่าเงื่อนไขไหนข้อมูลชุดนี้ตรวจไม่ได้ คนอ่านผลจะได้ไม่เข้าใจว่าตรวจครบ
    if (!leads.some((lead) => lead.status === 'lost')) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: 'ไม่มีลีดสถานะ lost การตัดลีด lost ออกจึงไม่ถูกตรวจ' });
    }
    if (!leads.some((lead) => lead.tenantId !== null)) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: 'ไม่มีลีดที่เป็นผู้เช่าแล้ว การตัดลีดที่เป็นผู้เช่าแล้วออกจึงไม่ถูกตรวจ' });
    }
    if (eligible.length <= MAX_OPTIONS) {
      test.info().annotations.push({
        type: 'ไม่ได้ตรวจ',
        description: `ลีดที่เลือกได้มี ${eligible.length} ราย ไม่เกินเพดาน ${MAX_OPTIONS} ราย เพดานจึงไม่ถูกตรวจ`,
      });
    }

    // ขั้นที่ 2: ขอตัวเลือกลีดของฟอร์มสร้างผู้เช่า
    const options = await expectJson<TenantLeadOption[]>(await agent.tenants.leadOptions(), 200);

    // ขั้นที่ 3: ต้องเป็นลีดชุดเดียวกันในลำดับเดียวกัน และชื่อกับเบอร์โทรตรงกับรายการลีด
    expect(options.map((option) => ({ id: option.id, name: option.name, phone: option.phone }))).toEqual(
      expected.map((lead) => ({ id: lead.id, name: lead.name, phone: lead.phone })),
    );
  });

  test('search narrows the options by name, and an unknown name finds nothing', async ({ agent }) => {
    // ขั้นที่ 1: หยิบลีดรายแรกของตัวเลือก แล้วค้นด้วยชื่อของลีดรายนั้น
    const options = await expectJson<TenantLeadOption[]>(await agent.tenants.leadOptions(), 200);
    expect(options.length, 'qa-agent ต้องมีตัวเลือกลีดอย่างน้อย 1 ราย').toBeGreaterThan(0);
    const target = options[0]!;
    const found = await expectJson<TenantLeadOption[]>(await agent.tenants.leadOptions(target.name), 200);

    // ขั้นที่ 2: ต้องเจอลีดรายนั้น และทุกรายที่ได้ต้องมีคำค้นอยู่ในชื่อ ชื่อจริง นามสกุล หรือเบอร์โทร (ไม่สนตัวพิมพ์เล็กใหญ่)
    expect(found.map((option) => option.id)).toContain(target.id);
    const needle = target.name.toLowerCase();
    for (const option of found) {
      const fields = [option.name, option.firstName, option.lastName, option.phone].map((value) => (value ?? '').toLowerCase());
      expect(fields.some((value) => value.includes(needle)), `ลีด id ${option.id} ไม่มีคำค้นในชื่อหรือเบอร์โทร`).toBe(true);
    }

    // ขั้นที่ 3: ค้นด้วยคำที่ไม่มีลีดรายไหนใช้ ต้องได้รายการว่าง
    expect(await expectJson<TenantLeadOption[]>(await agent.tenants.leadOptions('e2e-no-such-lead-zz'), 200)).toEqual([]);
  });
});

test.describe('GET /agent/tenants/rooms', () => {
  test("lists up to 30 of the agent's rooms, newest first", async ({ agent }) => {
    // ขั้นที่ 1: ขอตัวเลือกห้องโดยไม่ส่งตัวกรอง
    const rooms = await roomOptions(agent);
    expect(rooms.length, 'qa-agent ต้องมีห้องอย่างน้อย 1 ห้อง').toBeGreaterThan(0);
    expect(rooms.length).toBeLessThanOrEqual(MAX_OPTIONS);

    // ขั้นที่ 2: ไม่ได้ส่ง roomId และ leadId จึงไม่มีห้องที่ถูกดันขึ้นก่อน รายการต้องเรียงตาม id จากมากไปน้อย และไม่มีห้องซ้ำ
    const ids = rooms.map((room) => room.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(isDescending(ids)).toBe(true);

    // ขั้นที่ 3: ตรวจทีละห้อง (ไม่ได้บอกว่าเป็นลีดรายไหน จึงไม่มีห้องที่ถูกนัดดู viewed ต้องเป็น false ทุกห้อง)
    for (const room of rooms) {
      const label = `ห้อง id ${room.id}`;
      expect(Number.isInteger(room.id) && room.id > 0, label).toBe(true);
      expect(room.property.trim().length, label).toBeGreaterThan(0);
      expect(room.room === null || typeof room.room === 'string', label).toBe(true);
      expect(room.viewed, label).toBe(false);
      expect(room.bookedBy === null || typeof room.bookedBy === 'string', label).toBe(true);
    }

    // ขั้นที่ 4: เพดาน 30 ห้อง
    //   GET /agent/listings นับเฉพาะห้องที่ is_scout_room เป็นจริง จึงนับได้ไม่เกินจำนวนห้องทั้งหมดของนายหน้า
    //   ถ้านับได้เกิน 30 ห้อง รายการนี้ต้องมี 30 ห้องพอดี ถ้าไม่เกิน ข้อมูลชุดนี้ตรวจเพดานไม่ได้ จึงบันทึกไว้ในรายงาน
    //   ขั้นนี้พึ่ง GET /agent/listings ด้วย ถ้าเส้นทางนั้นพัง ข้อนี้จะแดงตาม
    const { total: listedRooms } = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit: 1 }), 200);
    if (listedRooms > MAX_OPTIONS) {
      expect(rooms).toHaveLength(MAX_OPTIONS);
    } else {
      test.info().annotations.push({
        type: 'ไม่ได้ตรวจ',
        description: `ห้องที่นับจาก GET /agent/listings มี ${listedRooms} ห้อง ไม่เกินเพดาน ${MAX_OPTIONS} ห้อง เพดานจึงไม่ถูกตรวจ`,
      });
    }
  });

  test('a roomId puts that room first', async ({ agent }) => {
    // ขั้นที่ 1: หยิบห้องที่อยู่ท้ายสุดของรายการปกติ
    const ids = (await roomOptions(agent)).map((room) => room.id);
    expect(ids.length, 'qa-agent ต้องมีห้องอย่างน้อย 2 ห้อง จึงจะเห็นว่าห้องที่เลือกถูกดันขึ้นก่อน').toBeGreaterThanOrEqual(2);
    const picked = ids.at(-1)!;

    // ขั้นที่ 2: ส่ง roomId ของห้องนั้น   ขั้นที่ 3: ห้องนั้นต้องขึ้นก่อน และห้องที่เหลือเรียงเหมือนรายการปกติ
    const pinned = (await roomOptions(agent, { roomId: picked })).map((room) => room.id);
    expect(pinned).toEqual([picked, ...ids.filter((id) => id !== picked)].slice(0, MAX_OPTIONS));
  });

  test('ignores a roomId that is not a positive whole number or does not exist', async ({ agent }) => {
    // ขั้นที่ 1: เก็บรายการปกติไว้เทียบ
    const expected = (await roomOptions(agent)).map((room) => room.id);

    // ขั้นที่ 2: ส่ง roomId ที่ใช้ไม่ได้ทีละแบบ ทุกแบบต้องตอบ 200 และได้รายการเหมือนตอนไม่ส่ง roomId
    //   (ห้องของนายหน้าคนอื่นยังไม่ได้ตรวจ เพราะต้องมีนายหน้าคนที่ 2 ดู README หัวข้อยังไม่ครอบคลุม)
    for (const roomId of ['abc', '0', '-1', '1.5', String(NO_SUCH_ID)]) {
      const ids = (await roomOptions(agent, { roomId })).map((room) => room.id);
      expect(ids, `roomId=${roomId}`).toEqual(expected);
    }
  });

  test('search finds a room by its room number, and an unknown one finds nothing', async ({ agent }) => {
    // ขั้นที่ 1: หยิบห้องที่ใหม่ที่สุดที่มีเลขห้อง
    const target = (await roomOptions(agent)).find((room) => room.room);
    test.skip(!target, 'ไม่มีห้องที่มีเลขห้อง จึงทดสอบการค้นหาไม่ได้');

    // ขั้นที่ 2: ค้นด้วยเลขห้องนั้น ต้องเจอห้องนั้น
    const found = await roomOptions(agent, { q: target!.room! });
    expect(found.map((room) => room.id)).toContain(target!.id);

    // ขั้นที่ 3: ค้นด้วยคำที่ไม่มีห้องไหนใช้ ต้องได้รายการว่าง
    expect(await roomOptions(agent, { q: 'e2e-no-such-room-zz' })).toEqual([]);
  });

  test('ignores a leadId above the 32-bit integer range', async ({ agent }) => {
    // เดิมเป็นบั๊กที่รู้แล้ว (API ตอบ 500) ทีมแก้แล้วที่ DEV/main f7d52ed: positiveId ใน agent-tenants.controller.ts
    //   คืน undefined เมื่อค่าเกิน 2147483647 API จึงไม่สนค่านี้ แบบเดียวกับค่าที่ไม่ใช่จำนวนเต็มบวก
    //   id ที่เกินช่วงมีอยู่จริงไม่ได้ เทสนี้จึงยืนยันได้แค่ว่าตอบ 200 และรายการไม่เปลี่ยน
    // ขั้นที่ 1: เก็บรายการปกติไว้เทียบ ต้องมีห้องอย่างน้อย 1 ห้อง ไม่อย่างนั้นการเทียบรายการว่างกับรายการว่างไม่ได้ตรวจอะไร
    const expected = (await roomOptions(agent)).map((room) => room.id);
    expect(expected.length, 'qa-agent ต้องมีห้องอย่างน้อย 1 ห้อง').toBeGreaterThan(0);

    // ขั้นที่ 2: ส่ง leadId ที่มากกว่าค่าสูงสุดของ integer อยู่ 1   ขั้นที่ 3: ต้องตอบ 200 และได้รายการเหมือนตอนไม่ส่ง leadId
    const ids = (await roomOptions(agent, { leadId: INT32_MAX + 1 })).map((room) => room.id);
    expect(ids).toEqual(expected);
  });

  test('ignores a roomId above the 32-bit integer range', async ({ agent }) => {
    // เดิมเป็นบั๊กที่รู้แล้ว (API ตอบ 500) ทีมแก้แล้วที่ DEV/main f7d52ed: positiveId ใน agent-tenants.controller.ts
    //   คืน undefined เมื่อค่าเกิน 2147483647 API จึงไม่สนค่านี้ แบบเดียวกับค่าที่ไม่ใช่จำนวนเต็มบวก
    //   id ที่เกินช่วงมีอยู่จริงไม่ได้ เทสนี้จึงยืนยันได้แค่ว่าตอบ 200 และรายการไม่เปลี่ยน
    // ขั้นที่ 1: เก็บรายการปกติไว้เทียบ ต้องมีห้องอย่างน้อย 1 ห้อง ไม่อย่างนั้นการเทียบรายการว่างกับรายการว่างไม่ได้ตรวจอะไร
    const expected = (await roomOptions(agent)).map((room) => room.id);
    expect(expected.length, 'qa-agent ต้องมีห้องอย่างน้อย 1 ห้อง').toBeGreaterThan(0);

    // ขั้นที่ 2: ส่ง roomId ที่มากกว่าค่าสูงสุดของ integer อยู่ 1   ขั้นที่ 3: ต้องตอบ 200 และได้รายการเหมือนตอนไม่ส่ง roomId
    const ids = (await roomOptions(agent, { roomId: INT32_MAX + 1 })).map((room) => room.id);
    expect(ids).toEqual(expected);
  });
});

test.describe('POST /agent/tenants (requests that must be refused, nothing is created)', () => {
  /** ข้อมูลที่ผิดกติกาทีละ 1 จุด และข้อความที่ API ต้องตอบ (เรียงตามลำดับที่ API ตรวจ) */
  const refused: { name: string; body: unknown; message: string }[] = [
    // เนื้อที่เป็นรายการไม่มี rentRoomId ข้อนี้จึงพึ่งการตรวจของ API หลายจุด (เนื้อต้องเป็นวัตถุ และ leadId ต้องเป็นตัวเลข)
    //   ถ้าจุดเหล่านี้หลุดพร้อมกันจึงจะมีโอกาสบันทึก ซึ่งตัวเทสกันไม่ได้
    { name: 'the body is not an object', body: [], message: MESSAGE.noBody },
    { name: 'leadId is missing', body: without(validTenantBody(), 'leadId'), message: MESSAGE.leadAndRoom },
    // ส่งเลขเป็นข้อความ: API รับเฉพาะตัวเลขของ JSON (ใช้เลขของลีดที่ไม่มีจริง เผื่อการตรวจข้อนี้หลุด)
    { name: 'leadId is text', body: { ...validTenantBody(), leadId: String(NO_SUCH_ID) }, message: MESSAGE.leadAndRoom },
    { name: 'leadId is 0', body: { ...validTenantBody(), leadId: 0 }, message: MESSAGE.leadAndRoom },
    { name: 'rentRoomId is a decimal', body: { ...validTenantBody(), rentRoomId: 1.5 }, message: MESSAGE.leadAndRoom },
    {
      name: 'rentRoomId is above the 32-bit integer range',
      body: { ...validTenantBody(), rentRoomId: INT32_MAX + 1 },
      message: MESSAGE.leadAndRoom,
    },
    {
      name: 'firstName is longer than 255 characters',
      body: { ...validTenantBody(), firstName: 'a'.repeat(256) },
      message: MESSAGE.nameAndPhone,
    },
    { name: 'phone is missing', body: without(validTenantBody(), 'phone'), message: MESSAGE.nameAndPhone },
    { name: 'phone is a number', body: { ...validTenantBody(), phone: 812345678 }, message: MESSAGE.nameAndPhone },
    { name: 'note is longer than 500 characters', body: { ...validTenantBody(), note: 'a'.repeat(501) }, message: MESSAGE.nameAndPhone },
    { name: 'the email has no @', body: { ...validTenantBody(), email: 'not-an-email' }, message: MESSAGE.email },
    { name: 'the phone has letters', body: { ...validTenantBody(), phone: 'abc-defg' }, message: MESSAGE.phone },
    { name: 'the phone has 6 digits', body: { ...validTenantBody(), phone: '081234' }, message: MESSAGE.phone },
    { name: 'the phone has 16 digits', body: { ...validTenantBody(), phone: '0812345678901234' }, message: MESSAGE.phone },
    {
      name: 'the identity number is shorter than 5 characters',
      body: { ...validTenantBody(), identityNumber: 'A123' },
      message: MESSAGE.identityNumber,
    },
    { name: 'there is neither firstName nor name', body: without(validTenantBody(), 'firstName', 'lastName'), message: MESSAGE.nameAndPhone },
  ];
  for (const request of refused) {
    test(`answers 400 when ${request.name}`, async ({ agent }) => {
      // ขั้นที่ 1: ส่งข้อมูลที่ผิดกติกา 1 จุด
      //   ถ้าการตรวจค่าข้อนี้หลุด ระบบจะตอบรหัสอื่นที่ไม่ใช่ 400 เทสจึงแดง และห้องที่ไม่มีจริงหยุดการบันทึกไว้
      const response = await agent.tenants.create(request.body);

      // ขั้นที่ 2: ต้องถูกปฏิเสธด้วย 400 และข้อความบอกสาเหตุตรงตัว
      expect(await expectError(response, 400)).toBe(request.message);
    });
  }

  test('a valid body for a lead that does not exist answers 404', async ({ agent }) => {
    // ขั้นที่ 1: ส่งข้อมูลที่ถูกต้องครบ ไปที่ลีดและห้องที่ไม่มีอยู่จริง
    const response = await agent.tenants.create(validTenantBody());

    // ขั้นที่ 2: ข้อมูลผ่านการตรวจค่า ระบบจึงไปหาลีด แล้วต้องตอบ 404 เพราะไม่พบลีด (ไม่มีอะไรถูกสร้าง)
    expect(await expectError(response, 404)).toBe(MESSAGE.leadNotFound);
  });

  /** ค่าที่อยู่บนขอบของกติกาพอดี ต้องผ่านการตรวจค่า (คู่กับค่าที่เกินขอบในรายการ refused ข้างบน) */
  const accepted: { name: string; body: Record<string, unknown> }[] = [
    { name: 'a phone with 7 digits', body: { ...validTenantBody(), phone: '0812345' } },
    { name: 'a phone with 15 digits', body: { ...validTenantBody(), phone: '081234567890123' } },
    { name: 'a firstName of 255 characters', body: { ...validTenantBody(), firstName: 'a'.repeat(255) } },
    { name: 'an identity number of 5 characters', body: { ...validTenantBody(), identityNumber: 'A1234' } },
    // API รับชื่อเต็มในช่อง name แทน firstName กับ lastName ได้ด้วย (แยกคำแรกเป็นชื่อจริง ที่เหลือเป็นนามสกุล)
    { name: 'a full name in name instead of firstName and lastName', body: { ...without(validTenantBody(), 'firstName', 'lastName'), name: 'E2E Tester' } },
  ];
  for (const request of accepted) {
    test(`accepts ${request.name} (then answers 404 because the lead does not exist)`, async ({ agent }) => {
      // ขั้นที่ 1: ส่งค่าที่อยู่บนขอบของกติกา ไปที่ลีดและห้องที่ไม่มีอยู่จริง
      const response = await agent.tenants.create(request.body);

      // ขั้นที่ 2: ต้องผ่านการตรวจค่า จึงได้ 404 เพราะไม่พบลีด ไม่ใช่ 400
      expect(await expectError(response, 404)).toBe(MESSAGE.leadNotFound);
    });
  }
});

test.describe('PATCH /agent/tenants/:id (requests that must be refused, nothing is changed)', () => {
  test('checks the body before looking up the tenant', async ({ agent }) => {
    // ขั้นที่ 1: ส่งข้อมูลที่ไม่มีเบอร์โทร ไปที่ผู้เช่าที่ไม่มีอยู่จริง
    const response = await agent.tenants.update(NO_SUCH_ID, without(validProfileBody(), 'phone'));

    // ขั้นที่ 2: API ตรวจข้อมูลก่อนหาผู้เช่า จึงต้องได้ 400 (ไม่ใช่ 404)
    expect(await expectError(response, 400)).toBe(MESSAGE.nameAndPhone);
  });

  test('answers 404 for a valid body when the tenant does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ส่งข้อมูลที่ถูกต้อง ไปที่ผู้เช่าที่ไม่มีอยู่จริง   ขั้นที่ 2: ต้องได้ 404 เพราะไม่พบผู้เช่า (ไม่มีอะไรถูกแก้)
    expect(await expectError(await agent.tenants.update(NO_SUCH_ID, validProfileBody()), 404)).toBe(MESSAGE.tenantNotFound);
  });

  test('answers 400 for an id that is not a whole number', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง id ที่เป็นตัวอักษร   ขั้นที่ 2: ต้องได้ 400 ก่อนถึงขั้นหาผู้เช่า
    await expectError(await agent.tenants.update('abc', validProfileBody()), 400);
  });
});
