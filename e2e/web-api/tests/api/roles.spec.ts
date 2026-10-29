import type { APIResponse } from '@playwright/test';
import type { AuthUser, OwnerUserOption } from '../../src/api/types';
import { qaAccounts, type QaRole } from '../../src/config/qa-accounts';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';

/**
 * สิทธิ์ตามบทบาท: บัญชีที่ไม่มีบทบาทที่เส้นทางกำหนดต้องได้ 403 และบัญชีที่มีบทบาทนั้นต้องผ่าน
 * ที่มา: @Roles ของแต่ละ controller และ RolesGuard (apps/api/src/auth/guards/roles.guard.ts) ตรวจซ้ำที่ develop 9644dd9
 *   (เลขบรรทัดในไฟล์นี้เป็นของ 9644dd9 ส่วน "เพิ่มใน develop ..." บอกรุ่นที่เส้นทางนั้นเข้ามา)
 *   ทุก controller ที่ต้องล็อกอินกำหนดบทบาทระดับ class เทสจึงเรียกเส้นทางตัวแทนของแต่ละ controller
 *   party-contracts.controller.ts มี @Roles('landlord') ระดับ method: GET mine/deal-offers กับ POST mine/deal-offers/:id/confirm
 *   (ตั้งแต่ develop f845ac6) และ GET mine/reminders (ตั้งแต่ develop 8a62e39) รวม 3 เส้นทาง (บรรทัด 102-103, 108-109, 120-121)
 *   RolesGuard อ่านบทบาทด้วย reflector.getAllAndOverride([handler, class]) ค่าระดับ method จึงใช้แทนระดับ class (ไม่รวมกัน)
 *   เส้นทางระดับ method จึงตรวจแยกในกลุ่ม "landlord contract routes" ถ้าทีมเพิ่ม @Roles ระดับ method ให้เส้นทางอื่นอีก
 *   เทสชุดนี้จับไม่ได้ (ค้นได้ด้วย grep -rn -A1 "@Roles" apps/api/src: ระดับ class คือ @Roles ที่บรรทัดถัดไปเป็น export class
 *   ที่เหลือเป็นระดับ method ไม่ว่าจะอยู่ก่อนหรือหลัง @Get, @Post, @Put, @Patch หรือ @Delete)
 *   RolesGuard รับเมื่อผู้เรียกมีบทบาทอย่างน้อย 1 บทบาทในรายการ และตอบ 403 "Required role: <รายการ คั่นด้วย ' | '>"
 *   ไม่มีเส้นทางไหนรับบทบาท guest หรือ admin (ถ้าทีมเพิ่ม admin ให้เส้นทางไหน เทส 403 ของ admin ที่เส้นทางนั้นจะแดง และต้องแก้ตาม)
 *
 * สิ่งที่ต้องมีก่อน
 *   - API ตั้ง ALLOW_DEV_AUTH=true
 *   - บัญชี QA แยกบทบาท (qa-<role>@nestyk.test) มีในฐานข้อมูลที่ API ใช้ และตั้ง uuid ไว้ในตัวแปรแวดล้อม E2E_QA_<ROLE>_UUID
 *     (ดู src/config/qa-accounts.ts) global-setup ตรวจแล้วว่าทุกบัญชีที่ตั้ง uuid มีอยู่จริงและบทบาทตรงกับ migration
 *     บัญชีที่ไม่ได้ตั้ง uuid: เทสที่ใช้บัญชีนั้นข้าม พร้อมเหตุผล
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   - เรียกเส้นทาง GET (กับ POST 1 เส้นทางในข้อถัดไป) ด้วยบทบาทที่ต้องถูกปฏิเสธ ยกเว้นเส้นทางที่ไม่บันทึกอะไรเมื่อผ่าน (กลุ่ม "accepted")
 *   - POST 1 เส้นทาง: POST /contracts/mine/deal-offers/:id/confirm เรียกด้วยบทบาทที่ต้องได้ 403 ส่งเนื้อคำขอว่างกับ NO_SUCH_ID
 *     ถ้า guard พังจนคำขอไปถึง service จะได้ 400 ก่อนแตะฐานข้อมูล (ที่มาเขียนไว้ที่ party-contracts.api.ts landlordConfirmDealOfferEmptyBody)
 *   - GET /bills/mine, /bills/mine/next และ /bills/received สร้างบิลเองก่อนตอบเมื่อผู้เรียกผ่าน (tenant-billing.service.ts insertBills)
 *     และตั้งแต่ 9644dd9 เปลี่ยนหนังสือต่อสัญญาที่ถึงวันมีผลเป็น active ด้วย (บรรทัด 250-259)
 *     จึงเรียกด้วยบทบาทที่ต้องได้ 403 เท่านั้น RolesGuard ปฏิเสธก่อนถึง service (ลำดับของ NestJS: guard ก่อน pipe และ handler)
 *     ถ้า guard พังจนคำขอผ่านไปถึง service: insertBills คืน 0 โดยไม่บันทึกเมื่อไม่มีสัญญาที่ activeLeases เลือก (tenant-billing.service.ts:240)
 *     คือสัญญาเช่า active หรือหนังสือต่อสัญญาที่ออกเอกสารแล้วและรอลงนามหรือรอนายหน้าตรวจ ของผู้เรียก (บรรทัด 235)
 *     (อนุมาน: บัญชีที่เรียกไม่มีบทบาท tenant หรือ landlord ของเส้นทางนั้น จึงไม่น่าเป็นคู่สัญญาเช่า แต่ตรวจสภาพฐานข้อมูลของทีมจากชุดเทสไม่ได้)
 *   - GET /agent/places/* เรียกบริการของ Google เมื่อผู้เรียกมีบทบาท agent จึงไม่เรียกด้วย qa-agent
 *     และส่งคำค้นยาว 1 ตัวอักษร ซึ่ง service คืนรายการว่างโดยไม่เรียก Google แม้ guard จะพัง (agent-places.service.ts:273-275)
 *   - POST /auth/sync ถูกเรียกด้วยบัญชี QA ที่ global-setup ยืนยันแล้วว่ามีอยู่ (sync ของบัญชีที่มีอยู่ไม่บันทึกอะไร)
 *
 * ยังไม่ครอบคลุม: เส้นทาง agent กลุ่มห้อง (/agent/rooms/*), ลิงก์แชร์ห้อง (/agent/listings/:id/share-links), การนัดดูห้อง
 *   และการจับคู่ห้องให้ลีด (ยังไม่มีตัวเรียกใน src/api/)
 *   และเส้นทาง POST/PUT/PATCH/DELETE (ถ้าบทบาทถูก คำขอจะบันทึกข้อมูลจริง) ยกเว้น POST mine/deal-offers/:id/confirm
 *   ซึ่งตั้ง @Roles('landlord') ระดับ method แยกเป็นของตัวเอง (party-contracts.controller.ts:109) GET mine/deal-offers จึงเป็นตัวแทนไม่ได้
 *   เทสในกลุ่ม "landlord contract routes" จับได้ถ้า @Roles บรรทัด 109 หายไป (qa-tenant จะได้ 400 แทน 403)
 *
 * เส้นทาง GET ที่เพิ่มใน develop f845ac6 และ 8a62e39 ไม่มี id ไว้หยุดการทำงาน 4 เส้นทาง (agent/dashboard, agent/reminders,
 *   contracts/mine/deal-offers, contracts/mine/reminders) ถ้า guard พังจนคำขอไปถึง service ก็ไม่บันทึกอะไร
 *   เพราะ service ของทั้ง 8 เส้นทางที่เพิ่มอ่านอย่างเดียว (ที่มาเขียนไว้ที่ตัวเรียกใน agent-work.api.ts, leads.api.ts, contracts.api.ts,
 *   party-contracts.api.ts ตรวจซ้ำที่ 9644dd9 ถ้าทีมแก้ service เหล่านี้ ต้องตรวจซ้ำอีก)
 *
 * เส้นทาง GET ที่เพิ่มใน develop 9644dd9 (9 เส้นทาง) เรียกด้วย NO_SUCH_ID ทุกเส้นทางหาสัญญาหรือบิลก่อน และอ่านอย่างเดียว
 *   ถ้า guard พังจนคำขอไปถึง service จะได้ 404 โดยไม่บันทึกอะไร (ที่มาเขียนไว้ที่ตัวเรียกใน contracts.api.ts, party-contracts.api.ts
 *   และ bills.api.ts ตรวจที่ 9644dd9) และต้องใช้ API ตั้งแต่ 9644dd9
 *
 * เส้นทางที่เพิ่มใน develop f845ac6 และ 8a62e39 ต้องใช้ API ตั้งแต่ 8a62e39 กับ API รุ่นก่อน เส้นทางที่ยังไม่มีจะได้ 404
 *   "Cannot GET ..." หรือ "Cannot POST ..." ของ NestJS แทน 403 ซึ่งไม่ใช่บั๊ก
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id (ชนิด integer ของ PostgreSQL) เก็บได้ = 2^31 - 1 ใช้เป็น id ที่ไม่มีอยู่จริง */
const NO_SUCH_ID = 2_147_483_647;

/** ข้อความ 403 ของ RolesGuard (roles.guard.ts: `Required role: ${required.join(' | ')}`) */
const REQUIRED = {
  agent: 'Required role: agent',
  tenant: 'Required role: tenant',
  landlord: 'Required role: landlord',
  party: 'Required role: tenant | landlord',
};

interface GatedEndpoint {
  name: string;
  call: (session: ApiSession) => Promise<APIResponse>;
}

interface GatedGroup {
  /** ชื่อกลุ่มในชื่อเทส */
  title: string;
  /** ข้อความ 403 ที่คาด */
  message: string;
  /** บัญชี QA ที่ไม่มีบทบาทที่กลุ่มนี้กำหนด จึงต้องได้ 403 */
  denied: QaRole[];
  endpoints: GatedEndpoint[];
}

const groups: GatedGroup[] = [
  {
    // @Roles('agent'): agent-leads, agent-listings, agent-tenants, agent-contracts, agreement-attachments, agent-places, agent-bills controller
    //   และ agent-dashboard, deal-offers (ตั้งแต่ develop f845ac6), contract-reminders controller (ตั้งแต่ develop 8a62e39)
    title: 'agent routes',
    message: REQUIRED.agent,
    denied: ['guest', 'tenant', 'landlord', 'admin'],
    endpoints: [
      { name: 'GET /agent/leads/visa-types', call: (s) => s.leads.visaTypes() },
      { name: 'GET /agent/leads', call: (s) => s.leads.list() },
      { name: 'GET /agent/listings', call: (s) => s.listings.list() },
      { name: 'GET /agent/tenants', call: (s) => s.tenants.list() },
      { name: 'GET /agent/contracts', call: (s) => s.contracts.list() },
      // คำค้นที่ไม่มีบัญชีไหนใช้ ถ้าการกันสิทธิ์หลุด คำตอบก็ไม่มีข้อมูลส่วนตัวของเจ้าของห้อง
      { name: 'GET /agent/contracts/owner-users', call: (s) => s.contracts.ownerUsers('e2e-no-such-owner-zz') },
      { name: 'GET /agent/contracts/:id/attachments', call: (s) => s.contracts.attachments(NO_SUCH_ID) },
      // ตั้งแต่ develop 84087e2 รับเฉพาะ agent (เดิม agent, owner): agent-places.controller.ts:10-11
      { name: 'GET /agent/places/autocomplete', call: (s) => s.places.autocomplete('e') },
      { name: 'GET /bills/agent', call: (s) => s.bills.agentPending() },
      // agent-dashboard.controller.ts:8-10 (เพิ่มใน develop f845ac6)
      { name: 'GET /agent/dashboard', call: (s) => s.agentWork.dashboard() },
      // contract-reminders.controller.ts:9-11 (เพิ่มใน develop 8a62e39)
      { name: 'GET /agent/reminders', call: (s) => s.agentWork.reminders() },
      // deal-offers.controller.ts:10-12 เส้นทางบรรทัด 16 (เพิ่มใน develop f845ac6)
      { name: 'GET /agent/leads/:leadId/deal-offers', call: (s) => s.leads.dealOffers(NO_SUCH_ID) },
      // agent-contracts.controller.ts:52-54 เส้นทางบรรทัด 184 (เพิ่มใน develop f845ac6) และ 424 (เพิ่มใน develop 8a62e39)
      { name: 'GET /agent/contracts/:id/handover', call: (s) => s.contracts.handover(NO_SUCH_ID) },
      { name: 'GET /agent/contracts/:id/cancellation-preview', call: (s) => s.contracts.cancellationPreview(NO_SUCH_ID) },
      // agent-contracts.controller.ts:52-54 เส้นทางบรรทัด 135, 218, 251 และ agent-bills.controller.ts:9-11 เส้นทางบรรทัด 53 (เพิ่มใน develop 9644dd9)
      { name: 'GET /agent/contracts/:id/early-end/:kind', call: (s) => s.contracts.earlyEndFile(NO_SUCH_ID, 'invoice') },
      { name: 'GET /agent/contracts/:id/handover/move-out', call: (s) => s.contracts.moveOutHandover(NO_SUCH_ID) },
      { name: 'GET /agent/contracts/:id/deposit-settlement', call: (s) => s.contracts.depositSettlement(NO_SUCH_ID) },
      { name: 'GET /bills/agent/:id/late-fee/:kind', call: (s) => s.bills.agentLateFeeDocument(NO_SUCH_ID, 'invoice') },
    ],
  },
  {
    // @Roles('tenant'): tenant-bills.controller.ts:24-26
    title: 'tenant bill routes',
    message: REQUIRED.tenant,
    denied: ['guest', 'landlord', 'agent', 'admin'],
    endpoints: [
      { name: 'GET /bills/mine', call: (s) => s.bills.mine() },
      { name: 'GET /bills/mine/next', call: (s) => s.bills.mineNext() },
      { name: 'GET /bills/mine/:id/payment-slip', call: (s) => s.bills.minePaymentSlip(NO_SUCH_ID) },
      // tenant-bills.controller.ts บรรทัด 71 (เพิ่มใน develop 9644dd9)
      { name: 'GET /bills/mine/:id/late-fee/:kind', call: (s) => s.bills.mineLateFeeDocument(NO_SUCH_ID, 'invoice') },
    ],
  },
  {
    // @Roles('landlord'): owner-bills.controller.ts:12-14
    title: 'landlord bill routes',
    message: REQUIRED.landlord,
    denied: ['guest', 'tenant', 'agent', 'admin'],
    endpoints: [
      { name: 'GET /bills/received', call: (s) => s.bills.received() },
      { name: 'GET /bills/received/:id/payment-slip', call: (s) => s.bills.receivedPaymentSlip(NO_SUCH_ID) },
      // owner-bills.controller.ts บรรทัด 43 (เพิ่มใน develop 9644dd9)
      { name: 'GET /bills/received/:id/late-fee/:kind', call: (s) => s.bills.receivedLateFeeDocument(NO_SUCH_ID, 'invoice') },
    ],
  },
  {
    // @Roles('tenant', 'landlord') ระดับ class: party-contracts.controller.ts:32-34
    title: 'contract party routes',
    message: REQUIRED.party,
    denied: ['guest', 'agent', 'admin'],
    endpoints: [
      { name: 'GET /contracts/mine', call: (s) => s.partyContracts.mine() },
      { name: 'GET /contracts/mine/:id/attachments', call: (s) => s.partyContracts.attachments(NO_SUCH_ID) },
      // เพิ่มใน develop f845ac6
      { name: 'GET /contracts/mine/:id/handover', call: (s) => s.partyContracts.handover(NO_SUCH_ID) },
      // party-contracts.controller.ts บรรทัด 59, 69, 233 ไม่มี @Roles ระดับ method (เพิ่มใน develop 9644dd9)
      { name: 'GET /contracts/mine/:id/deposit-settlement', call: (s) => s.partyContracts.depositSettlement(NO_SUCH_ID) },
      { name: 'GET /contracts/mine/:id/handover/move-out', call: (s) => s.partyContracts.moveOutHandover(NO_SUCH_ID) },
      { name: 'GET /contracts/mine/:id/early-end/:kind', call: (s) => s.partyContracts.earlyEndFile(NO_SUCH_ID, 'invoice') },
    ],
  },
  {
    // @Roles('landlord') ระดับ method ใน controller ที่ระดับ class รับ tenant และ landlord: party-contracts.controller.ts:102-103, 108-109, 120-121
    //   qa-tenant คือข้อสำคัญ: ถ้า guard รวมบทบาทระดับ class เข้ามา qa-tenant จะผ่านทั้งที่ไม่ควรผ่าน
    title: 'landlord contract routes (method-level @Roles)',
    message: REQUIRED.landlord,
    denied: ['guest', 'tenant', 'agent', 'admin'],
    endpoints: [
      { name: 'GET /contracts/mine/deal-offers', call: (s) => s.partyContracts.landlordDealOffers() },
      { name: 'GET /contracts/mine/reminders', call: (s) => s.partyContracts.landlordReminders() },
      // POST ข้อเดียวของไฟล์นี้: เนื้อคำขอว่างกับ NO_SUCH_ID ทำให้ service ตอบ 400 ก่อนแตะฐานข้อมูลถ้า guard พัง (ดู party-contracts.api.ts)
      { name: 'POST /contracts/mine/deal-offers/:id/confirm', call: (s) => s.partyContracts.landlordConfirmDealOfferEmptyBody(NO_SUCH_ID) },
    ],
  },
];

for (const group of groups) {
  test.describe(`${group.title} reject accounts without the role`, () => {
    for (const role of group.denied) {
      for (const endpoint of group.endpoints) {
        test(`${endpoint.name} answers 403 for qa-${role}`, async ({ qa }) => {
          // ขั้นที่ 1: ล็อกอินด้วยบัญชี QA ที่ไม่มีบทบาทของกลุ่มนี้ (ข้ามถ้ายังไม่ได้ตั้ง uuid)
          const session = await qa(role);

          // ขั้นที่ 2: ต้องได้ 403 พร้อมข้อความที่บอกบทบาทที่ต้องมี
          //   ตรวจข้อความด้วย เพราะ 401 "Call POST /auth/sync first" ก็มาจาก guard เดียวกันแต่แปลว่าบัญชีไม่มีในฐานข้อมูล
          expect(await expectError(await endpoint.call(session), 403)).toBe(group.message);
        });
      }
    }
  });
}

test.describe('the role check runs before the id check', () => {
  // NestJS ทำงานตามลำดับ guard → pipe → handler บทบาทผิดจึงต้องได้ 403 แม้ id ผิดรูปแบบ
  //   (ถ้าได้ 400 แปลว่าการกันสิทธิ์ทำงานหลังการตรวจ id และคนที่ไม่มีสิทธิ์ได้คำตอบจากส่วนที่ควรถูกกันไว้)
  //   ตัวคุม: id 'abc' ที่ GET /bills/mine/:id/payment-slip ได้ 400 กับบัญชีที่มีบทบาท tenant (bills.spec.ts ตรวจด้วย qa-tenant)

  test('GET /bills/mine/abc/payment-slip answers 403 for qa-agent', async ({ qa }) => {
    // ขั้นที่ 1: ล็อกอินด้วย qa-agent (ไม่มีบทบาท tenant)   ขั้นที่ 2: ส่ง id ที่ไม่ใช่ตัวเลข ต้องได้ 403 ไม่ใช่ 400
    const session = await qa('agent');
    expect(await expectError(await session.bills.minePaymentSlip('abc'), 403)).toBe(REQUIRED.tenant);
  });

  test('GET /agent/contracts/abc/attachments answers 403 for qa-tenant', async ({ qa }) => {
    // ยังไม่มีตัวคุมว่า id 'abc' ที่เส้นทางนี้ได้ 400 กับบทบาท agent (agent-contracts.spec.ts ตรวจ 400 ที่ GET /agent/contracts/:id)
    //   ถ้าเส้นทางนี้ไม่ตรวจ id เลย ข้อนี้ยังผ่าน แต่ยังยืนยันได้ว่าบทบาทผิดได้ 403
    // ขั้นที่ 1: ล็อกอินด้วย qa-tenant (ไม่มีบทบาท agent)   ขั้นที่ 2: ส่ง id ที่ไม่ใช่ตัวเลข ต้องได้ 403 ไม่ใช่ 400
    const session = await qa('tenant');
    expect(await expectError(await session.contracts.attachments('abc'), 403)).toBe(REQUIRED.agent);
  });
});

test.describe('accounts with the role are accepted', () => {
  // ตัวคุมของเทส 403: ยืนยันว่าบัญชี QA ใช้งานได้จริง และ 403 ข้างบนมาจากบทบาท ไม่ใช่บัญชีเสีย
  //   เรียกเฉพาะเส้นทางที่ไม่บันทึกอะไรเมื่อผ่าน (listForUser ใน agent-contracts.service.ts อ่านอย่างเดียว)

  test('GET /agent/leads/visa-types answers 200 for qa-agent', async ({ qa }) => {
    // ขั้นที่ 1: ล็อกอินด้วย qa-agent   ขั้นที่ 2: ต้องได้รายการประเภทวีซ่า (ตารางตั้งต้น master_visa_types มีอย่างน้อย 1 แถว)
    const session = await qa('agent');
    const visaTypes = await expectJson<unknown[]>(await session.leads.visaTypes(), 200);
    expect(visaTypes.length).toBeGreaterThan(0);
  });

  for (const role of ['tenant', 'landlord'] as const) {
    test(`GET /contracts/mine answers 200 for qa-${role}`, async ({ qa }) => {
      // ขั้นที่ 1: ล็อกอินด้วยบัญชีคู่สัญญา   ขั้นที่ 2: ต้องได้รายการ (บัญชี QA ยังไม่มีสัญญา จึงไม่ตรวจจำนวน)
      const session = await qa(role);
      const contracts = await expectJson<unknown>(await session.partyContracts.mine(), 200);
      expect(Array.isArray(contracts)).toBe(true);
    });
  }
});

test.describe('GET /agent/contracts/owner-users searches landlord accounts only', () => {
  // ที่มา: searchOwnerUsers ใน agent-contracts.service.ts กรอง r.name = 'landlord' และค้นด้วย ILIKE ที่อีเมล ชื่อ เบอร์โทร และเลขบัตร
  // ข้อควรระวัง: คำตอบมีข้อมูลส่วนตัว เทสจึงเทียบแค่ id (ถ้าไม่ผ่าน Playwright พิมพ์เฉพาะ id ออกมา)
  //   ผู้ค้นคือ qa-agent (fixture agent) เส้นทางนี้ไม่ได้ใช้ข้อมูลของผู้ค้น (controller ไม่ส่ง user.id ให้ service)

  /** id ของบัญชี QA จาก POST /auth/sync (global-setup ยืนยันแล้วว่าบัญชีมีอยู่ จึงไม่สร้างผู้ใช้ใหม่) */
  async function qaUserId(session: ApiSession, role: QaRole): Promise<number> {
    const user = await expectJson<AuthUser>(await session.auth.sync(), 201);
    expect(user.provisioned, `sync ของ qa-${role} สร้างผู้ใช้ใหม่ (ไม่ควรเกิด เพราะ global-setup ยืนยันแล้วว่าบัญชีมีอยู่) ให้แจ้งทีมพร้อมเวลาที่รัน`).toBe(false);
    return user.id;
  }

  test('finds qa-landlord by its email', async ({ agent, qa }) => {
    // ขั้นที่ 1: หา id ของ qa-landlord
    const landlordId = await qaUserId(await qa('landlord'), 'landlord');

    // ขั้นที่ 2: ค้นด้วยอีเมลของบัญชีนี้   ขั้นที่ 3: ต้องเจอบัญชีนี้ (อีเมลไม่ซ้ำ: users_email_key)
    const owners = await expectJson<OwnerUserOption[]>(await agent.contracts.ownerUsers(qaAccounts.landlord.email), 200);
    expect(owners.map((owner) => owner.id)).toContain(landlordId);
  });

  for (const role of ['guest', 'tenant', 'agent', 'admin'] as const) {
    test(`does not return qa-${role}, which has no landlord role`, async ({ agent, qa }) => {
      // ขั้นที่ 1: ตัวคุม: ค้น qa-landlord ด้วยอีเมลแล้วต้องเจอ (ข้ามถ้าไม่ได้ตั้ง uuid ของ qa-landlord)
      //   ถ้าไม่มีขั้นนี้ การค้นที่พังจนคืนรายการว่างเสมอจะทำให้ขั้นที่ 3 ผ่านโดยไม่ได้ตรวจอะไร
      const landlordId = await qaUserId(await qa('landlord'), 'landlord');
      const landlords = await expectJson<OwnerUserOption[]>(await agent.contracts.ownerUsers(qaAccounts.landlord.email), 200);
      expect(landlords.map((owner) => owner.id), 'ตัวคุม: ต้องค้นเจอ qa-landlord').toContain(landlordId);

      // ขั้นที่ 2: หา id ของบัญชีที่ไม่มีบทบาท landlord (บัญชีมีอยู่จริง ถ้าตัวกรองบทบาทหาย การค้นด้วยอีเมลจะเจอบัญชีนี้)
      const userId = await qaUserId(await qa(role), role);

      // ขั้นที่ 3: ค้นด้วยอีเมลของบัญชีนี้ แล้วคำตอบต้องไม่มีบัญชีนี้
      const owners = await expectJson<OwnerUserOption[]>(await agent.contracts.ownerUsers(qaAccounts[role].email), 200);
      expect(owners.map((owner) => owner.id)).not.toContain(userId);
    });
  }
});
