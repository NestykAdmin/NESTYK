import type { APIResponse } from '@playwright/test';
import { env } from '../../src/config/env';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';
import { isDescending } from '../../src/support/pagination';

/**
 * สัญญาฝั่งคู่สัญญา: สัญญาที่ส่งถึงผู้เช่าหรือเจ้าของห้อง (/contracts/mine)
 * และเส้นทางลิงก์ลงนามแบบไม่ต้องล็อกอิน (/public/contract-sign) ที่ทีมลบแล้ว ต้องเปิดไม่ได้
 *
 * สิ่งที่ต้องมีก่อน
 *   - ล็อกอินแบบนักพัฒนาได้ (ดู auth.spec.ts) เทสกลุ่ม /contracts/mine เรียกด้วย qa-tenant (ข้ามถ้ายังไม่ได้ตั้ง uuid)
 *     เส้นทางกลุ่มนี้รับ tenant กับ landlord (party-contracts.controller.ts:28 ที่ develop 84087e2 landlord คือชื่อใหม่ของ owner)
 *     qa-agent ไม่มี 2 บทบาทนี้ จึงใช้ไม่ได้ (403 ของ qa-agent ตรวจใน roles.spec.ts)
 *   - ถ้า qa-tenant ยังไม่มีสัญญา รายการสัญญาตรวจได้แค่ว่าตอบเป็นรายการ (มีป้าย "ไม่ได้ตรวจ" ในรายงาน)
 *   - API ตั้งแต่ develop b228ee3: เทส deposit-payment-slip และเทสลิงก์ลงนามที่ถูกลบ เขียนตามรุ่นนี้ กับ API รุ่นก่อน 2 กลุ่มนี้จะไม่ผ่าน
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   เส้นทาง POST ถูกเรียกกับสัญญาที่ไม่มีอยู่จริง ทุกเส้นทางหาสัญญาก่อนบันทึก
 *   (contractForParty, documentForParty, signAsParty และ uploadDepositPaymentSlip ใน apps/api/src/agent/contracts/agent-contracts.service.ts)
 *   เส้นทางลิงก์ลงนามที่ถูกลบไม่มีโค้ดรับคำขอแล้ว จึงไม่มีอะไรถูกบันทึก
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id (ชนิด integer ของ PostgreSQL) เก็บได้ = 2^31 - 1 */
const INT32_MAX = 2_147_483_647;

/** ข้อความของตัวตรวจ id (DatabaseIdPipe ใน apps/api/src/common/database-id.pipe.ts ตั้งแต่ DEV/main f7d52ed) เมื่อ id ไม่อยู่ในช่วง 1 ถึง 2147483647 */
const ID_OUT_OF_RANGE = 'ID must be an integer between 1 and 2147483647';

/** id ที่ไม่มีสัญญาไหนใช้: ใช้ค่าที่มากที่สุดที่ฐานข้อมูลเก็บได้ */
const NO_SUCH_ID = INT32_MAX;

/** ข้อความที่ API ตอบ ที่มา: contractForParty ใน agent-contracts.service.ts */
const MESSAGE = {
  contractNotFound: 'ไม่พบสัญญา',
  /** ข้อความเดิมของเส้นทางลิงก์ลงนามที่ถูกลบ (loadInvite) ถ้ากลับมาเห็นข้อความนี้ แปลว่าเส้นทางเดิมกลับมา */
  retiredLinkNotFound: 'ไม่พบลิงก์ลงนาม',
} as const;

/** ลิงก์ลงนามรูปแบบเดียวกับลิงก์จริงของระบบเดิม (ยาว 43 ตัว) ที่ไม่เคยถูกออก */
const NEVER_ISSUED_TOKEN = `e2e-never-issued-${'A'.repeat(26)}`;

test.describe('GET /contracts/mine', () => {
  test('returns the contracts delivered to the signed-in user as a list', { tag: '@smoke' }, async ({ qa }) => {
    // ขั้นที่ 1: ล็อกอินด้วย qa-tenant แล้วเรียกรายการสัญญาของผู้ใช้
    const tenant = await qa('tenant');
    const contracts = await expectJson<{ id: number }[]>(await tenant.partyContracts.mine(), 200);
    expect(Array.isArray(contracts)).toBe(true);

    // ขั้นที่ 2: ถ้ามีสัญญา id ต้องไม่ซ้ำ และเรียงจากฉบับล่าสุด (id มากไปน้อย)
    //   ถ้ายังไม่มีสัญญา ขั้นนี้ไม่ได้ตรวจอะไร จึงบันทึกไว้ในรายงาน
    if (contracts.length === 0) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: 'ยังไม่มีสัญญาที่ส่งถึงผู้ใช้นี้ จึงตรวจได้แค่ว่าตอบเป็นรายการ' });
    }
    const ids = contracts.map((contract) => contract.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(isDescending(ids)).toBe(true);
  });
});

test.describe('party routes with a contract that does not exist', () => {
  /**
   * เส้นทางที่ต้องหาสัญญาของผู้เรียกก่อนทำอย่างอื่น (POST ส่งแบบไม่มีเนื้อหรือไม่แนบไฟล์)
   * เทสส่งสัญญาที่ไม่มีอยู่จริง การกันสัญญาที่มีอยู่แต่ผู้เรียกไม่ใช่คู่สัญญายังไม่ได้ตรวจ เพราะต้องมีสัญญาก่อน (ดู README หัวข้อยังไม่ครอบคลุม)
   */
  const lookups: { name: string; call: (party: ApiSession, id: number) => Promise<APIResponse> }[] = [
    { name: 'GET /contracts/mine/:id/attachments', call: (party, id) => party.partyContracts.attachments(id) },
    { name: 'GET /contracts/mine/:id/attachments/:documentId/url', call: (party, id) => party.partyContracts.attachmentUrl(id, 1) },
    { name: 'GET /contracts/mine/:id/financial-documents/invoice', call: (party, id) => party.partyContracts.financialDocument(id, 'invoice') },
    { name: 'POST /contracts/mine/:id/document', call: (party, id) => party.partyContracts.document(id) },
    { name: 'POST /contracts/mine/:id/sign', call: (party, id) => party.partyContracts.sign(id, {}) },
    { name: 'POST /contracts/mine/:id/payment-slip without a file', call: (party, id) => party.partyContracts.uploadPaymentSlip(id) },
    { name: 'POST /contracts/mine/:id/attachments without a file', call: (party, id) => party.partyContracts.uploadAttachment(id) },
    // เส้นทางใหม่ใน develop b228ee3: หาสัญญาก่อนตรวจว่าเป็นผู้เช่าและก่อนอ่านไฟล์ (uploadDepositPaymentSlip ใน agent-contracts.service.ts)
    {
      name: 'POST /contracts/mine/:id/deposit-payment-slip without a file',
      call: (party, id) => party.partyContracts.uploadDepositPaymentSlip(id),
    },
  ];
  for (const lookup of lookups) {
    test(`${lookup.name} answers 404 for a contract that does not exist`, async ({ qa }) => {
      // ขั้นที่ 1: ล็อกอินด้วย qa-tenant แล้วใช้ id ที่ไม่มีสัญญาไหนใช้
      // ขั้นที่ 2: ต้องได้ 404 พร้อมข้อความว่าไม่พบสัญญา (ไม่มีอะไรถูกบันทึก)
      const tenant = await qa('tenant');
      expect(await expectError(await lookup.call(tenant, NO_SUCH_ID), 404)).toBe(MESSAGE.contractNotFound);
    });
  }

  test('answers 400 for an id that is not a whole number', async ({ qa }) => {
    // ขั้นที่ 1: ล็อกอินด้วย qa-tenant แล้วส่ง id ที่เป็นตัวอักษร   ขั้นที่ 2: ต้องได้ 400
    const tenant = await qa('tenant');
    await expectError(await tenant.partyContracts.attachments('abc'), 400);
  });

  test('answers 400 for an id above the 32-bit integer range', async ({ qa }) => {
    // เดิมเป็นบั๊กที่รู้แล้ว (API ตอบ 500) ทีมแก้แล้วที่ DEV/main f7d52ed: ตัวตรวจ id (DatabaseIdPipe) ปฏิเสธก่อนถึงฐานข้อมูล
    // ขั้นที่ 1: ล็อกอินด้วย qa-tenant แล้วส่ง id ที่มากกว่าค่าสูงสุดของ integer อยู่ 1   ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความของตัวตรวจ id
    const tenant = await qa('tenant');
    expect(await expectError(await tenant.partyContracts.attachments(INT32_MAX + 1), 400)).toBe(ID_OUT_OF_RANGE);
  });
});

test.describe('retired public sign links (no login)', () => {
  /**
   * ทีมลบการลงนามผ่านลิงก์แบบไม่ต้องล็อกอินแล้ว (controller ของ /public/contract-sign ไม่อยู่ใน agent.module.ts ตั้งแต่ develop b228ee3)
   * ตอนนี้คู่สัญญาลงนามในแอปหลังล็อกอิน (POST /contracts/mine/:id/sign) หรือนายหน้าลงนามแทนบนเครื่องของนายหน้า (POST /agent/contracts/:id/sign)
   *
   * วิธีตรวจ: เส้นทางที่ไม่มีอยู่ NestJS ตอบ 404 พร้อมข้อความของตัวเอง "Cannot <วิธีเรียก> <ที่อยู่>"
   *   ตรวจแค่รหัส 404 ไม่พอ เพราะเส้นทางเดิมก็ตอบ 404 ("ไม่พบลิงก์ลงนาม") เมื่อลิงก์ไม่เคยถูกออก
   *   ถ้าเส้นทางเดิมกลับมา ข้อความจะเปลี่ยนจาก "Cannot ..." และเทสนี้จะไม่ผ่าน เพื่อให้ถามทีมว่าตั้งใจเปิดกลับหรือไม่
   */
  const routes: { method: 'GET' | 'POST'; call: (anonymous: ApiSession) => Promise<APIResponse> }[] = [
    { method: 'GET', call: (anonymous) => anonymous.retiredContractSign.preview(NEVER_ISSUED_TOKEN) },
    { method: 'POST', call: (anonymous) => anonymous.retiredContractSign.sign(NEVER_ISSUED_TOKEN, {}) },
  ];
  for (const route of routes) {
    test(`${route.method} /public/contract-sign/:token no longer exists`, async ({ anonymous }) => {
      // ขั้นที่ 1: เรียกเส้นทางเดิมโดยไม่ล็อกอิน ด้วยลิงก์รูปแบบถูกที่ไม่เคยถูกออก
      const response = await route.call(anonymous);
      const message = await expectError(response, 404);

      // ขั้นที่ 2: คำตอบต้องมาจากที่อยู่เดิม ไม่ใช่ที่อยู่อื่นที่ถูกส่งต่อ (redirect) ไป
      //   ที่อยู่ที่คาดสร้างจาก E2E_API_BASE_URL เอง เพราะ response.url() เป็นที่อยู่ปลายทางหลัง Playwright ตามการส่งต่อแล้ว
      const expectedPath = new URL(`public/contract-sign/${NEVER_ISSUED_TOKEN}`, `${env.apiBaseUrl}/`).pathname;
      expect(new URL(response.url()).pathname).toBe(expectedPath);

      // ขั้นที่ 3: ข้อความต้องเป็นของ NestJS ว่าไม่มีเส้นทางนี้ ไม่ใช่ข้อความเดิมของระบบลิงก์ลงนาม
      //   NestJS ใส่ path ที่ได้รับ (รวม /api/v1 ที่ main.ts ตั้งเป็นคำนำหน้า) ไว้ในข้อความ "Cannot <วิธีเรียก> <path>"
      expect(message).not.toBe(MESSAGE.retiredLinkNotFound);
      expect(message).toBe(`Cannot ${route.method} ${expectedPath}`);
    });
  }
});
