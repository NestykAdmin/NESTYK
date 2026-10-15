import type { APIResponse } from '@playwright/test';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';
import { isDescending } from '../../src/support/pagination';

/**
 * สัญญาฝั่งคู่สัญญา: สัญญาที่ส่งถึงผู้เช่าหรือเจ้าของห้อง (/contracts/mine) และลิงก์ลงนามที่เปิดได้โดยไม่ต้องล็อกอิน (/public/contract-sign)
 *
 * สิ่งที่ต้องมีก่อน
 *   - ล็อกอินแบบนักพัฒนาได้ (ดู auth.spec.ts) เทสใช้ผู้เรียก agent ซึ่งเป็นบัญชีตัวอย่างเดียวกัน
 *     บัญชีนี้มีบทบาท tenant และ owner ด้วย (seed-dev-user.sql) จึงเรียกเส้นทางกลุ่ม /contracts/mine ได้
 *   - ข้อมูลตัวอย่างยังไม่มีสัญญา รายการสัญญาจึงตรวจได้แค่ว่าตอบเป็นรายการ
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   เส้นทาง POST ถูกเรียกกับสัญญาที่ไม่มีอยู่จริง และลิงก์ลงนามที่ไม่เคยถูกออก ทุกเส้นทางหาสัญญาหรือลิงก์ก่อนบันทึก
 *   (contractForParty, documentForParty, signAsParty และ loadInvite ใน apps/api/src/agent/contracts/agent-contracts.service.ts)
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id (ชนิด integer ของ PostgreSQL) เก็บได้ = 2^31 - 1 */
const INT32_MAX = 2_147_483_647;

/** ข้อความของตัวตรวจ id (DatabaseIdPipe ใน apps/api/src/common/database-id.pipe.ts ตั้งแต่ DEV/main f7d52ed) เมื่อ id ไม่อยู่ในช่วง 1 ถึง 2147483647 */
const ID_OUT_OF_RANGE = 'ID must be an integer between 1 and 2147483647';

/** id ที่ไม่มีสัญญาไหนใช้: ใช้ค่าที่มากที่สุดที่ฐานข้อมูลเก็บได้ */
const NO_SUCH_ID = INT32_MAX;

/** ข้อความที่ API ตอบ ที่มา: contractForParty และ loadInvite ใน agent-contracts.service.ts */
const MESSAGE = {
  contractNotFound: 'ไม่พบสัญญา',
  linkNotFound: 'ไม่พบลิงก์ลงนาม',
} as const;

/**
 * ลิงก์ลงนามที่รูปแบบถูกแต่ไม่เคยถูกออก
 * รูปแบบที่ระบบรับ: ตัวอักษรอังกฤษ ตัวเลข _ และ - ยาว 20 ถึง 128 ตัว (isPlausibleShareLinkToken ใน apps/api/src/common/share-link-token.ts)
 * ลิงก์จริงยาว 43 ตัว เทสจึงใช้ความยาวเท่ากัน
 */
const NEVER_ISSUED_TOKEN = `e2e-never-issued-${'A'.repeat(26)}`;

test.describe('GET /contracts/mine', () => {
  test('returns the contracts delivered to the signed-in user as a list', { tag: '@smoke' }, async ({ agent }) => {
    // ขั้นที่ 1: เรียกรายการสัญญาของผู้ใช้
    const contracts = await expectJson<{ id: number }[]>(await agent.partyContracts.mine(), 200);
    expect(Array.isArray(contracts)).toBe(true);

    // ขั้นที่ 2: ถ้ามีสัญญา id ต้องไม่ซ้ำ และเรียงจากฉบับล่าสุด (id มากไปน้อย)
    //   ข้อมูลตัวอย่างตอนนี้ไม่มีสัญญา ขั้นนี้จึงยังไม่ได้ตรวจอะไร และบันทึกไว้ในรายงาน
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
  const lookups: { name: string; call: (agent: ApiSession, id: number) => Promise<APIResponse> }[] = [
    { name: 'GET /contracts/mine/:id/attachments', call: (agent, id) => agent.partyContracts.attachments(id) },
    { name: 'GET /contracts/mine/:id/attachments/:documentId/url', call: (agent, id) => agent.partyContracts.attachmentUrl(id, 1) },
    { name: 'GET /contracts/mine/:id/financial-documents/invoice', call: (agent, id) => agent.partyContracts.financialDocument(id, 'invoice') },
    { name: 'POST /contracts/mine/:id/document', call: (agent, id) => agent.partyContracts.document(id) },
    { name: 'POST /contracts/mine/:id/sign', call: (agent, id) => agent.partyContracts.sign(id, {}) },
    { name: 'POST /contracts/mine/:id/payment-slip without a file', call: (agent, id) => agent.partyContracts.uploadPaymentSlip(id) },
    { name: 'POST /contracts/mine/:id/attachments without a file', call: (agent, id) => agent.partyContracts.uploadAttachment(id) },
  ];
  for (const lookup of lookups) {
    test(`${lookup.name} answers 404 for a contract that does not exist`, async ({ agent }) => {
      // ขั้นที่ 1: ใช้ id ที่ไม่มีสัญญาไหนใช้   ขั้นที่ 2: ต้องได้ 404 พร้อมข้อความว่าไม่พบสัญญา (ไม่มีอะไรถูกบันทึก)
      expect(await expectError(await lookup.call(agent, NO_SUCH_ID), 404)).toBe(MESSAGE.contractNotFound);
    });
  }

  test('answers 400 for an id that is not a whole number', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง id ที่เป็นตัวอักษร   ขั้นที่ 2: ต้องได้ 400
    await expectError(await agent.partyContracts.attachments('abc'), 400);
  });

  test('answers 400 for an id above the 32-bit integer range', async ({ agent }) => {
    // เดิมเป็นบั๊กที่รู้แล้ว (API ตอบ 500) ทีมแก้แล้วที่ DEV/main f7d52ed: ตัวตรวจ id (DatabaseIdPipe) ปฏิเสธก่อนถึงฐานข้อมูล
    // ขั้นที่ 1: ส่ง id ที่มากกว่าค่าสูงสุดของ integer อยู่ 1   ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความของตัวตรวจ id
    expect(await expectError(await agent.partyContracts.attachments(INT32_MAX + 1), 400)).toBe(ID_OUT_OF_RANGE);
  });
});

test.describe('public sign links (no login)', () => {
  test('GET answers 404 without asking for a login, for a token that cannot be a sign link', async ({ anonymous }) => {
    // ขั้นที่ 1: เปิดลิงก์โดยไม่ล็อกอิน ด้วย token ที่ผิดรูปแบบ 3 แบบ: สั้นกว่า 20 ตัว ยาวกว่า 128 ตัว และมีจุด
    for (const token of ['too-short', 'A'.repeat(129), 'has.dots.are.not.allowed.here']) {
      // ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบลิงก์ (ไม่ใช่ 401 เพราะเส้นทางนี้เปิดได้โดยไม่ต้องล็อกอิน)
      const message = await expectError(await anonymous.publicContractSign.preview(token), 404);
      expect(message, `token ยาว ${token.length} ตัว`).toBe(MESSAGE.linkNotFound);
    }
  });

  test('GET answers 404 for a well-formed token that was never issued', async ({ anonymous }) => {
    // ขั้นที่ 1: เปิดลิงก์ที่รูปแบบถูกแต่ไม่เคยถูกออก   ขั้นที่ 2: ระบบหาลิงก์ในฐานข้อมูลไม่เจอ ต้องได้ 404
    expect(await expectError(await anonymous.publicContractSign.preview(NEVER_ISSUED_TOKEN), 404)).toBe(MESSAGE.linkNotFound);
  });

  test('POST answers 404 for a token that was never issued, before reading the signature', async ({ anonymous }) => {
    // ขั้นที่ 1: ลงนามผ่านลิงก์ที่ไม่เคยถูกออก โดยไม่ส่งลายเซ็น
    const response = await anonymous.publicContractSign.sign(NEVER_ISSUED_TOKEN, {});

    // ขั้นที่ 2: ระบบหาลิงก์ก่อนอ่านลายเซ็น จึงต้องได้ 404 (ไม่ใช่ 400 เรื่องลายเซ็น และไม่มีอะไรถูกบันทึก)
    expect(await expectError(response, 404)).toBe(MESSAGE.linkNotFound);
  });
});
