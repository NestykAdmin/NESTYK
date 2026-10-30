import type { APIResponse } from '@playwright/test';
import type { TenantBill } from '../../src/api/types';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { env } from '../../src/config/env';
import { expectError, expectJson } from '../../src/support/http';

/**
 * บิลค่าเช่าและสลิป (กลุ่ม /bills) ชุดแรก: เคสที่ไม่ต้องมีบิลในฐานข้อมูล
 * ที่มา: apps/api/src/billing/ และ apps/api/src/common/database-id.pipe.ts ตรวจซ้ำที่ develop 9644dd9
 *   ส่วนเส้นทาง POST bills/received/:id/late-fee ตรวจซ้ำที่ develop bc77a8b (ถูกลบใน 1b16d32)
 *
 * สิ่งที่ต้องมีก่อน
 *   - API ที่รวม DEV/main ถึง f7d52ed แล้ว (มีตัวตรวจ id DatabaseIdPipe และเส้นทาง mine/:id/confirm, agent/:id/return)
 *   - ล็อกอินแบบนักพัฒนาได้ (ดู auth.spec.ts) แต่ละกลุ่มเรียกด้วยบัญชี QA ที่มีบทบาทของกลุ่มนั้น (ช่อง caller ของ idEndpoints)
 *     mine ใช้ qa-tenant (tenant-bills.controller.ts:26) received ใช้ qa-landlord (owner-bills.controller.ts:14) agent ใช้ qa-agent (agent-bills.controller.ts:11)
 *     (landlord คือชื่อใหม่ของ owner ตั้งแต่ develop 84087e2) ถ้ายังไม่ได้ตั้ง uuid ของ qa-tenant หรือ qa-landlord เทสของกลุ่มนั้นข้าม พร้อมเหตุผล
 *   - เทสของเส้นทางค่าปรับ (late-fee) ที่เพิ่มใน develop 9644dd9 ต้องใช้ API ตั้งแต่ 9644dd9 กับ API รุ่นก่อน ทุกข้อของเส้นทางนี้ได้ 404 "Cannot ..." ของ NestJS
 *   - เทส 'retired late fee of the landlord' ต้องใช้ API ตั้งแต่ 1b16d32 กับ API ตั้งแต่ 9644dd9 แต่ก่อน 1b16d32 (เส้นทางยังมี)
 *     จะได้ 401 แทน "Cannot POST ..." ซึ่งไม่ใช่บั๊ก
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   - ไม่เรียก GET mine, mine/next, received และ agent/tenants/:tenantId ด้วยบัญชีหรือ id ที่มีจริง เพราะ 4 เส้นทางนี้
 *     สร้างบิล เปิดสถานะการเข้าพัก (room_tenancies) และตั้งแต่ 9644dd9 เปลี่ยนหนังสือต่อสัญญาที่ถึงวันมีผลเป็น active
 *     เองก่อนตอบ (ดู bills.api.ts)
 *     ยกเว้นเทส 401 (ถูกปฏิเสธก่อนถึงฐานข้อมูล) และ agent/tenants/2147483647 (ตอบ 404 ก่อนขั้นสร้างบิล)
 *   - เส้นทาง POST ใช้เฉพาะ id ที่ไม่มีอยู่จริง หรือ id ที่ผิดรูปแบบ ระบบหาบิลไม่เจอหรือปฏิเสธก่อนบันทึก
 *     (mine, owned, forAgent ใน tenant-billing.service.ts ตอบ 404 ก่อนตรวจสถานะและก่อนบันทึก)
 *   - POST bills/agent/:id/late-fee ตรวจเนื้อคำขอก่อนหาบิล (createLateFee ใน tenant-billing.service.ts:664-667 ที่ develop 9644dd9)
 *     จึงส่งเนื้อคำขอที่ผ่าน (LATE_FEE_BODY)
 *   - POST bills/received/:id/late-fee (เจ้าของห้องออกใบค่าปรับ) ถูกลบตั้งแต่ develop 1b16d32 (owner-bills.controller.ts และ
 *     createLateFeeForLandlord ใน tenant-billing.service.ts) เทสไฟล์นี้ตรวจแค่ว่าเส้นทางนี้ไม่มีแล้ว (ดู 'retired late fee of the landlord')
 *
 * ยังไม่มีเทส (ต้องมีบิลในฐานข้อมูลก่อน): ขั้นตอนอัป ส่ง ยืนยัน และตีกลับสลิป, การออกใบค่าปรับ ส่งและตีกลับสลิปค่าปรับ, ชนิดและขนาดไฟล์,
 *   และบิลของผู้ใช้อื่นต้องได้ 404 (403 ของบทบาทที่ไม่ตรงอยู่ใน roles.spec.ts ซึ่งใช้บัญชี QA แยกบทบาท)
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

/** เนื้อคำขอที่ผ่านการตรวจของการออกใบค่าปรับ: ยอดมากกว่า 0 ไม่ส่ง dueDate = วันนี้ (lateFeeInput ใน apps/api/src/billing/late-fee-invoice.ts:54-62) */
const LATE_FEE_BODY = { amount: 1 };

/** เนื้อคำขอของการตีกลับสลิปค่าปรับ ไม่ต้องผ่านการตรวจ เพราะ returnLateFeeSlip หาบิลก่อนตรวจ 2 ช่องนี้ (tenant-billing.service.ts:727-737) */
const LATE_FEE_RETURN_BODY = { reason: 'e2e', submittedAt: '2026-01-01T00:00:00.000Z' };

/** เส้นทางกลุ่ม /bills ทั้งหมด 18 เส้นทาง (ใช้กับเทสที่ไม่ต้องล็อกอิน) รวมค่าปรับ 6 เส้นทาง (develop 9644dd9 เพิ่ม 7 เส้นทาง 1b16d32 ลบ 1) */
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
  { name: 'GET /bills/mine/:id/late-fee/:kind', call: (s) => s.bills.mineLateFeeDocument(NO_SUCH_ID, 'invoice') },
  { name: 'POST /bills/mine/:id/late-fee/payment-slip', call: (s) => s.bills.uploadMineLateFeeSlipWithoutFile(NO_SUCH_ID) },
  { name: 'GET /bills/received/:id/late-fee/:kind', call: (s) => s.bills.receivedLateFeeDocument(NO_SUCH_ID, 'invoice') },
  { name: 'GET /bills/agent/:id/late-fee/:kind', call: (s) => s.bills.agentLateFeeDocument(NO_SUCH_ID, 'invoice') },
  { name: 'POST /bills/agent/:id/late-fee', call: (s) => s.bills.agentCreateLateFee(NO_SUCH_ID, LATE_FEE_BODY) },
  { name: 'POST /bills/agent/:id/late-fee/return', call: (s) => s.bills.agentReturnLateFeeSlip(NO_SUCH_ID, LATE_FEE_RETURN_BODY) },
];

/** บัญชี QA ที่มีบทบาทของกลุ่มเส้นทาง ใช้เรียกผ่าน fixture qa (qa('agent') คือบัญชีเดียวกับ fixture agent) */
type BillCaller = 'tenant' | 'landlord' | 'agent';

/**
 * เส้นทางที่รับ id ใน path และไม่สร้างบิล พร้อมบัญชีที่ใช้เรียก และข้อความ 404 เมื่อไม่พบ
 * (GET agent/tenants/:tenantId อยู่ในรายการนี้ได้ เพราะ API ตอบ 404 ก่อนถึงขั้นสร้างบิล: listForAgentTenant ใน tenant-billing.service.ts)
 */
const idEndpoints: {
  name: string;
  caller: BillCaller;
  notFound: string;
  call: (s: ApiSession, id: number | string) => Promise<APIResponse>;
}[] = [
  {
    name: 'GET /bills/mine/:id/payment-slip',
    caller: 'tenant',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.minePaymentSlip(id),
  },
  {
    name: 'POST /bills/mine/:id/payment-slip',
    caller: 'tenant',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.uploadMinePaymentSlipWithoutFile(id),
  },
  { name: 'POST /bills/mine/:id/confirm', caller: 'tenant', notFound: MESSAGE.billNotFound, call: (s, id) => s.bills.confirmMine(id) },
  {
    name: 'GET /bills/received/:id/payment-slip',
    caller: 'landlord',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.receivedPaymentSlip(id),
  },
  {
    name: 'GET /bills/agent/tenants/:tenantId',
    caller: 'agent',
    notFound: MESSAGE.tenantNotFound,
    call: (s, id) => s.bills.agentTenantBilling(id),
  },
  {
    name: 'GET /bills/agent/:id/payment-slip',
    caller: 'agent',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.agentPaymentSlip(id),
  },
  { name: 'POST /bills/agent/:id/confirm', caller: 'agent', notFound: MESSAGE.billNotFound, call: (s, id) => s.bills.agentConfirm(id) },
  {
    name: 'POST /bills/agent/:id/return',
    caller: 'agent',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.agentReturn(id, { reason: 'e2e' }),
  },
  // ค่าปรับของบิล (develop 9644dd9) ทุกเส้นทางหาบิลก่อน
  {
    name: 'GET /bills/mine/:id/late-fee/:kind',
    caller: 'tenant',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.mineLateFeeDocument(id, 'invoice'),
  },
  {
    name: 'POST /bills/mine/:id/late-fee/payment-slip',
    caller: 'tenant',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.uploadMineLateFeeSlipWithoutFile(id),
  },
  {
    name: 'GET /bills/received/:id/late-fee/:kind',
    caller: 'landlord',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.receivedLateFeeDocument(id, 'invoice'),
  },
  {
    name: 'GET /bills/agent/:id/late-fee/:kind',
    caller: 'agent',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.agentLateFeeDocument(id, 'invoice'),
  },
  {
    // ตรวจเนื้อคำขอก่อนหาบิล จึงต้องส่งเนื้อคำขอที่ผ่าน ไม่อย่างนั้นได้ 400 แทน 404
    name: 'POST /bills/agent/:id/late-fee',
    caller: 'agent',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.agentCreateLateFee(id, LATE_FEE_BODY),
  },
  {
    name: 'POST /bills/agent/:id/late-fee/return',
    caller: 'agent',
    notFound: MESSAGE.billNotFound,
    call: (s, id) => s.bills.agentReturnLateFeeSlip(id, LATE_FEE_RETURN_BODY),
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
    test(`${endpoint.name} answers 404 for an id that does not exist`, async ({ qa }) => {
      // ขั้นที่ 1: ล็อกอินด้วยบัญชีที่มีบทบาทของเส้นทางนี้ (ข้ามถ้ายังไม่ได้ตั้ง uuid) แล้วใช้ id ที่ไม่มีบิลหรือผู้เช่ารายไหนใช้
      const session = await qa(endpoint.caller);
      // ขั้นที่ 2: ต้องได้ 404 พร้อมข้อความว่าไม่พบ
      //   (จากโค้ด: บิลของผู้ใช้อื่นก็ได้ข้อความเดียวกัน ยกเว้นเส้นทางค่าปรับของนายหน้าที่อาจได้ 403 "เฉพาะนายหน้าเจ้าของดีล"
      //   เมื่อผู้เช่าเป็นของนายหน้าแต่สัญญาเป็นของนายหน้าอื่น: ownedDealBill ใน tenant-billing.service.ts:653-658
      //   เทสข้อนี้ไม่ได้ยืนยันกรณีเหล่านั้น เพราะยังไม่มีบิลของผู้ใช้อื่น)
      expect(await expectError(await endpoint.call(session, NO_SUCH_ID), 404)).toBe(endpoint.notFound);
    });
  }
});

test.describe('retired late fee of the landlord', () => {
  /**
   * develop 1b16d32 ลบเส้นทางที่เจ้าของห้องออกใบค่าปรับเอง (owner-bills.controller.ts เหลือแค่ GET received, received/:id/payment-slip
   * และ received/:id/late-fee/:kind) ตอนนี้นายหน้าเป็นคนออกใบค่าปรับ (POST /bills/agent/:id/late-fee)
   *
   * วิธีตรวจเหมือน 'retired public sign links' ใน party-contracts.spec.ts: เส้นทางที่ไม่มีอยู่ NestJS ตอบ 404 "Cannot <วิธีเรียก> <path>"
   *   เรียกโดยไม่ล็อกอิน: เทสไม่ข้ามแม้ยังไม่ได้ตั้ง uuid ของ qa-landlord และถ้าเส้นทางกลับมา AuthGuard ระดับ class ของ
   *   owner-bills.controller.ts ตอบ 401 "Missing Bearer token" ก่อนถึง handler จึงไม่มีอะไรถูกบันทึก แต่ข้อความไม่ใช่ "Cannot ..."
   *   เทสนี้จะไม่ผ่าน เพื่อให้ถามทีมว่าตั้งใจเปิดกลับหรือไม่
   */
  test('POST /bills/received/:id/late-fee no longer exists', async ({ anonymous }) => {
    // ขั้นที่ 1: เรียกเส้นทางเดิมโดยไม่ล็อกอิน ด้วยบิลที่ไม่มีจริงและเนื้อคำขอที่ผ่านการตรวจเดิม
    const response = await anonymous.bills.retiredReceivedCreateLateFee(NO_SUCH_ID, LATE_FEE_BODY);
    const message = await expectError(response, 404);

    // ขั้นที่ 2: คำตอบต้องมาจากที่อยู่เดิม ไม่ใช่ที่อยู่อื่นที่ถูกส่งต่อไป (ที่อยู่ที่คาดสร้างจาก E2E_API_BASE_URL)
    const expectedPath = new URL(`bills/received/${NO_SUCH_ID}/late-fee`, `${env.apiBaseUrl}/`).pathname;
    expect(new URL(response.url()).pathname).toBe(expectedPath);

    // ขั้นที่ 3: ข้อความต้องเป็นของ NestJS ว่าไม่มีเส้นทางนี้ ("Cannot POST /api/v1/bills/received/2147483647/late-fee")
    expect(message).toBe(`Cannot POST ${expectedPath}`);
  });
});

test.describe('bills with an id that is not valid', () => {
  for (const endpoint of idEndpoints) {
    test(`${endpoint.name} answers 400 for ids outside 1 to 2147483647`, async ({ qa }) => {
      // ขั้นที่ 1: ล็อกอินด้วยบัญชีที่มีบทบาทของเส้นทางนี้ แล้วส่ง id 0, -1 และค่าที่เกินช่วงของ integer อยู่ 1
      //   (ต้องเป็นบัญชีที่มีบทบาท ไม่อย่างนั้น RolesGuard ตอบ 403 ก่อนถึงตัวตรวจ id)
      const session = await qa(endpoint.caller);
      // ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความของ DatabaseIdPipe ทุกค่า (ปฏิเสธก่อนถึงฐานข้อมูล จึงไม่ได้ 404 หรือ 500)
      for (const id of OUT_OF_RANGE_IDS) {
        expect(await expectError(await endpoint.call(session, id), 400), `id ${id}`).toBe(MESSAGE.idOutOfRange);
      }
    });

    test(`${endpoint.name} answers 400 for ids that are not whole numbers`, async ({ qa }) => {
      // ขั้นที่ 1: ล็อกอินด้วยบัญชีที่มีบทบาทของเส้นทางนี้ แล้วส่ง id ที่เป็นตัวอักษร และ id ที่เป็นทศนิยม   ขั้นที่ 2: ต้องได้ 400 ทุกค่า
      const session = await qa(endpoint.caller);
      for (const id of NOT_INTEGER_IDS) {
        await expectError(await endpoint.call(session, id), 400);
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
    //   รายการนี้มีบิลได้เมื่อผู้เช่าอัปสลิปและกดยืนยันส่งแล้วเท่านั้น
    //   (supabase/seed/demo.sql ที่ develop 9644dd9 ไม่มีแถวในตาราง tenant_bills ฐานข้อมูลที่สร้างจาก seed นี้จึงข้ามข้อนี้)
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
