import type { APIResponse } from '@playwright/test';
import type { TenantBill } from '../../src/api/types';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';

/**
 * บิลค่าเช่าและสลิป (กลุ่ม /bills) ชุดแรก: เคสที่ไม่ต้องมีบิลในฐานข้อมูล
 * ที่มา: apps/api/src/billing/ และ apps/api/src/common/database-id.pipe.ts ที่ DEV/main f7d52ed
 *
 * สิ่งที่ต้องมีก่อน
 *   - API ที่รวม DEV/main ถึง f7d52ed แล้ว (มีตัวตรวจ id DatabaseIdPipe และเส้นทาง mine/:id/confirm, agent/:id/return)
 *   - ล็อกอินแบบนักพัฒนาได้ (ดู auth.spec.ts) บัญชีตัวอย่างมีบทบาท tenant, landlord และ agent ครบ จึงเรียกได้ทั้ง 3 กลุ่มด้วยบัญชีเดียว
 *     (landlord คือชื่อใหม่ของ owner ตั้งแต่ develop 84087e2 กลุ่ม received ต้องมี landlord: owner-bills.controller.ts:14)
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   - ไม่เรียก GET mine, mine/next, received และ agent/tenants/:tenantId ด้วยบัญชีหรือ id ที่มีจริง เพราะ 4 เส้นทางนี้
 *     สร้างบิลและเปิดสถานะการเข้าพัก (room_tenancies) เองก่อนตอบ (ดู bills.api.ts)
 *     ยกเว้นเทส 401 (ถูกปฏิเสธก่อนถึงฐานข้อมูล) และ agent/tenants/2147483647 (ตอบ 404 ก่อนขั้นสร้างบิล)
 *   - เส้นทาง POST ใช้เฉพาะ id ที่ไม่มีอยู่จริง หรือ id ที่ผิดรูปแบบ ระบบหาบิลไม่เจอหรือปฏิเสธก่อนบันทึก
 *     (mine, owned, forAgent ใน tenant-billing.service.ts ตอบ 404 ก่อนตรวจสถานะและก่อนบันทึก)
 *
 * ยังไม่มีเทส (ต้องมีบิลในฐานข้อมูลก่อน): ขั้นตอนอัป ส่ง ยืนยัน และตีกลับสลิป, ชนิดและขนาดไฟล์,
 *   บิลของผู้ใช้อื่นต้องได้ 404, และ 403 ของบทบาทที่ไม่ตรง (บัญชีตัวอย่างมีทุกบทบาท จึงยังไม่มีบัญชีให้ทดสอบ)
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id (ชนิด integer ของ PostgreSQL) เก็บได้ = 2^31 - 1 */
const INT32_MAX = 2_147_483_647;

/** id ที่ไม่มีบิลหรือผู้เช่ารายไหนใช้: ใช้ค่าที่มากที่สุดที่ฐานข้อมูลเก็บได้ */
const NO_SUCH_ID = INT32_MAX;

/** ข้อความที่ API ตอบ ที่มา: tenant-billing.service.ts และ database-id.pipe.ts */
const MESSAGE = {
  billNotFound: 'ไม่พบบิล',
  tenantNotFound: 'ไม่พบผู้เช่า',
  idOutOfRange: 'ID must be an integer between 1 and 2147483647',
  noToken: 'Missing Bearer token',
} as const;

/** เส้นทางกลุ่ม /bills ทั้งหมด 12 เส้นทาง (ใช้กับเทสที่ไม่ต้องล็อกอิน) */
const allEndpoints: { name: string; call: (session: ApiSession) => Promise<APIResponse> }[] = [
  { name: 'GET /bills/mine', call: (s) => s.bills.mine() },
  { name: 'GET /bills/mine/next', call: (s) => s.bills.mineNext() },
  { name: 'GET /bills/mine/:id/payment-slip', call: (s) => s.bills.minePaymentSlip(NO_SUCH_ID) },
  { name: 'POST /bills/mine/:id/payment-slip', call: (s) => s.bills.uploadMinePaymentSlipWithoutFile(NO_SUCH_ID) },
  { name: 'POST /bills/mine/:id/confirm', call: (s) => s.bills.confirmMine(NO_SUCH_ID) },
  { name: 'GET /bills/received', call: (s) => s.bills.received() },
  { name: 'GET /bills/received/:id/payment-slip', call: (s) => s.bills.receivedPaymentSlip(NO_SUCH_ID) },
  { name: 'GET /bills/agent', call: (s) => s.bills.agentPending() },
  { name: 'GET /bills/agent/tenants/:tenantId', call: (s) => s.bills.agentTenantBilling(NO_SUCH_ID) },
  { name: 'GET /bills/agent/:id/payment-slip', call: (s) => s.bills.agentPaymentSlip(NO_SUCH_ID) },
  { name: 'POST /bills/agent/:id/confirm', call: (s) => s.bills.agentConfirm(NO_SUCH_ID) },
  { name: 'POST /bills/agent/:id/return', call: (s) => s.bills.agentReturn(NO_SUCH_ID, { reason: 'e2e' }) },
];

/**
 * เส้นทางที่รับ id ใน path และไม่สร้างบิล พร้อมข้อความ 404 เมื่อไม่พบ
 * (GET agent/tenants/:tenantId อยู่ในรายการนี้ได้ เพราะ API ตอบ 404 ก่อนถึงขั้นสร้างบิล: listForAgentTenant ใน tenant-billing.service.ts)
 */
const idEndpoints: { name: string; notFound: string; call: (s: ApiSession, id: number | string) => Promise<APIResponse> }[] = [
  { name: 'GET /bills/mine/:id/payment-slip', notFound: MESSAGE.billNotFound, call: (s, id) => s.bills.minePaymentSlip(id) },
  {
    name: 'POST /bills/mine/:id/payment-slip',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.uploadMinePaymentSlipWithoutFile(id),
  },
  { name: 'POST /bills/mine/:id/confirm', notFound: MESSAGE.billNotFound, call: (s, id) => s.bills.confirmMine(id) },
  {
    name: 'GET /bills/received/:id/payment-slip',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.receivedPaymentSlip(id),
  },
  {
    name: 'GET /bills/agent/tenants/:tenantId',
    notFound: MESSAGE.tenantNotFound,
    call: (s, id) => s.bills.agentTenantBilling(id),
  },
  { name: 'GET /bills/agent/:id/payment-slip', notFound: MESSAGE.billNotFound, call: (s, id) => s.bills.agentPaymentSlip(id) },
  { name: 'POST /bills/agent/:id/confirm', notFound: MESSAGE.billNotFound, call: (s, id) => s.bills.agentConfirm(id) },
  {
    name: 'POST /bills/agent/:id/return',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.agentReturn(id, { reason: 'e2e' }),
  },
];

/** id ที่เป็นจำนวนเต็มแต่อยู่นอกช่วง 1 ถึง 2147483647: DatabaseIdPipe ตอบ 400 พร้อมข้อความ idOutOfRange */
const OUT_OF_RANGE_IDS = ['0', '-1', String(INT32_MAX + 1)];

/**
 * id ที่ไม่ใช่จำนวนเต็ม: ParseIntPipe ของ NestJS ตอบ 400 ก่อน (ข้อความเป็นของ NestJS จึงไม่ตรวจข้อความ)
 * ทศนิยมใช้ 2147483647.5 ไม่ใช้ 1.5 เพราะถ้า pipe ของ NestJS รุ่นที่ใช้ตัดทศนิยมทิ้งแทนการปฏิเสธ
 * id จะกลายเป็นบิลที่ไม่มีจริง (ได้ 404 และเทสแดง) ไม่ใช่บิล id 1 ที่อาจมีอยู่และถูกยืนยันหรือตีกลับไปจริง
 */
const NOT_INTEGER_IDS = ['abc', `${NO_SUCH_ID}.5`];

test.describe('bills without a login', () => {
  for (const endpoint of allEndpoints) {
    test(`${endpoint.name} answers 401 when no token is sent`, async ({ anonymous }) => {
      // ขั้นที่ 1: เรียกเส้นทางโดยไม่ส่งหัวข้อ Authorization
      // ขั้นที่ 2: ต้องถูกปฏิเสธด้วย 401 จาก AuthGuard ก่อนถึงฐานข้อมูล (ตรวจข้อความด้วย เพราะ RolesGuard ก็ตอบ 401 ได้แต่ข้อความต่างกัน)
      expect(await expectError(await endpoint.call(anonymous), 401)).toBe(MESSAGE.noToken);
    });
  }
});

test.describe('bills of an id that does not exist', () => {
  for (const endpoint of idEndpoints) {
    test(`${endpoint.name} answers 404 for an id that does not exist`, async ({ agent }) => {
      // ขั้นที่ 1: ใช้ id ที่ไม่มีบิลหรือผู้เช่ารายไหนใช้
      // ขั้นที่ 2: ต้องได้ 404 พร้อมข้อความว่าไม่พบ
      //   (จากโค้ด: บิลของผู้ใช้อื่นก็ได้ข้อความเดียวกัน แต่เทสข้อนี้ไม่ได้ยืนยันกรณีนั้น เพราะยังไม่มีบิลของผู้ใช้อื่น)
      expect(await expectError(await endpoint.call(agent, NO_SUCH_ID), 404)).toBe(endpoint.notFound);
    });
  }
});

test.describe('bills with an id that is not valid', () => {
  for (const endpoint of idEndpoints) {
    test(`${endpoint.name} answers 400 for ids outside 1 to 2147483647`, async ({ agent }) => {
      // ขั้นที่ 1: ส่ง id 0, -1 และค่าที่เกินช่วงของ integer อยู่ 1
      // ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความของ DatabaseIdPipe ทุกค่า (ปฏิเสธก่อนถึงฐานข้อมูล จึงไม่ได้ 404 หรือ 500)
      for (const id of OUT_OF_RANGE_IDS) {
        expect(await expectError(await endpoint.call(agent, id), 400), `id ${id}`).toBe(MESSAGE.idOutOfRange);
      }
    });

    test(`${endpoint.name} answers 400 for ids that are not whole numbers`, async ({ agent }) => {
      // ขั้นที่ 1: ส่ง id ที่เป็นตัวอักษร และ id ที่เป็นทศนิยม   ขั้นที่ 2: ต้องได้ 400 ทุกค่า
      for (const id of NOT_INTEGER_IDS) {
        await expectError(await endpoint.call(agent, id), 400);
      }
    });
  }
});

test.describe('GET /bills/agent', () => {
  test('answers 200 with a list', async ({ agent }) => {
    // ขั้นที่ 1: เรียกรายการสลิปที่รอนายหน้าตรวจ (เส้นทางนี้อ่านอย่างเดียว ไม่สร้างบิล: listForAgent ใน tenant-billing.service.ts)
    // ขั้นที่ 2: ต้องตอบ 200 เป็นรายการ ไม่ตรวจจำนวน
    const bills = await expectJson<TenantBill[]>(await agent.bills.agentPending(), 200);
    expect(Array.isArray(bills)).toBe(true);
  });

  test('lists only slips that tenants have sent and that are still waiting, oldest due date first', async ({ agent }) => {
    // ขั้นที่ 1: เรียกรายการสลิปที่รอนายหน้าตรวจ
    const bills = await expectJson<TenantBill[]>(await agent.bills.agentPending(), 200);

    // ถ้ายังไม่มีบิลในรายการ ข้ามเทสข้อนี้ (รายงานจะแสดงว่าข้าม ไม่ใช่ผ่าน)
    //   รายการนี้มีบิลได้เมื่อผู้เช่าอัปสลิปและกดยืนยันส่งแล้วเท่านั้น ข้อมูลตัวอย่างตอนนี้ไม่มีบิล
    //   (supabase/seed/demo.sql ที่ DEV/main f7d52ed ไม่มีแถวในตาราง tenant_bills)
    test.skip(bills.length === 0, 'ยังไม่มีบิลที่ผู้เช่าส่งสลิปให้นายหน้าบัญชีนี้ จึงตรวจกฎกรองและลำดับไม่ได้');

    // ขั้นที่ 2: ทุกรายการต้องยังไม่จ่าย มีสลิป และผู้เช่ากดยืนยันส่งแล้ว
    //   (API กรอง status = pending, payment_slip_path ไม่ว่าง และ slip_submitted_at ไม่ว่าง
    //   แล้วคำนวณ overdue ตอนอ่าน บิลที่รอตรวจจึงเป็นได้แค่ pending หรือ overdue)
    for (const bill of bills) {
      const label = `บิล id ${bill.id}`;
      expect(['pending', 'overdue'], label).toContain(bill.status);
      expect(bill.hasPaymentSlip, label).toBe(true);
      expect(bill.slipSubmitted, label).toBe(true);
    }

    // ขั้นที่ 3: id ไม่ซ้ำ และเรียงตามวันครบกำหนดจากเก่าไปใหม่ ถ้าวันเดียวกันเรียงตาม id น้อยไปมาก
    const ids = bills.map((bill) => bill.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < bills.length; i += 1) {
      const [before, after] = [bills[i - 1], bills[i]];
      const inOrder = before.dueDate < after.dueDate || (before.dueDate === after.dueDate && before.id < after.id);
      expect(inOrder, `บิล id ${before.id} ต้องมาก่อน id ${after.id}`).toBe(true);
    }
  });
});
