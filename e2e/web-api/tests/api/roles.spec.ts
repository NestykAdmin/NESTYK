import type { APIResponse } from '@playwright/test';
import type { AuthUser, OwnerUserOption } from '../../src/api/types';
import { qaAccounts, type QaRole } from '../../src/config/qa-accounts';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';

/**
 * สิทธิ์ตามบทบาท: บัญชีที่ไม่มีบทบาทที่เส้นทางกำหนดต้องได้ 403 และบัญชีที่มีบทบาทนั้นต้องผ่าน
 * ที่มา: @Roles ระดับ class ของแต่ละ controller และ RolesGuard (apps/api/src/auth/guards/roles.guard.ts) ที่ develop a09e6d2
 *   ทุก controller ที่ต้องล็อกอินกำหนดบทบาทระดับ class ไม่มีระดับ method ทุกเส้นทางใน controller เดียวกันจึงใช้บทบาทชุดเดียวกัน
 *   เทสจึงเรียกเส้นทางตัวแทนของแต่ละ controller ถ้าทีมเพิ่ม @Roles ระดับ method ให้เส้นทางที่ไม่ใช่ตัวแทน เทสชุดนี้จับไม่ได้
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
 *   - เรียกเฉพาะเส้นทาง GET และเรียกด้วยบทบาทที่ต้องถูกปฏิเสธ ยกเว้นเส้นทางที่ไม่บันทึกอะไรเมื่อผ่าน (กลุ่ม "accepted")
 *   - GET /bills/mine, /bills/mine/next และ /bills/received สร้างบิลเองก่อนตอบเมื่อผู้เรียกผ่าน (tenant-billing.service.ts insertBills)
 *     จึงเรียกด้วยบทบาทที่ต้องได้ 403 เท่านั้น RolesGuard ปฏิเสธก่อนถึง service (ลำดับของ NestJS: guard ก่อน pipe และ handler)
 *     ถ้า guard พังจนคำขอผ่านไปถึง service: insertBills คืน 0 โดยไม่บันทึกเมื่อผู้เรียกไม่มีสัญญาเช่า active (tenant-billing.service.ts:136)
 *     (อนุมาน: บัญชีที่เรียกไม่มีบทบาท tenant หรือ landlord ของเส้นทางนั้น จึงไม่น่าเป็นคู่สัญญาเช่า แต่ตรวจสภาพฐานข้อมูลของทีมจากชุดเทสไม่ได้)
 *   - GET /agent/places/* เรียกบริการของ Google เมื่อผู้เรียกมีบทบาท agent จึงไม่เรียกด้วย qa-agent
 *     และส่งคำค้นยาว 1 ตัวอักษร ซึ่ง service คืนรายการว่างโดยไม่เรียก Google แม้ guard จะพัง (agent-places.service.ts:273-275)
 *   - POST /auth/sync ถูกเรียกด้วยบัญชี QA ที่ global-setup ยืนยันแล้วว่ามีอยู่ (sync ของบัญชีที่มีอยู่ไม่บันทึกอะไร)
 *
 * ยังไม่ครอบคลุม: เส้นทาง agent กลุ่มห้อง (/agent/rooms/*), ลิงก์แชร์ห้อง (/agent/listings/:id/share-links), การนัดดูห้อง
 *   และการจับคู่ห้องให้ลีด (ยังไม่มีตัวเรียกใน src/api/)
 *   และเส้นทาง POST/PATCH ทุกเส้นทาง (ถ้าบทบาทถูก คำขอจะบันทึกข้อมูลจริง)
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
    ],
  },
  {
    // @Roles('tenant', 'landlord'): party-contracts.controller.ts:26-28
    title: 'contract party routes',
    message: REQUIRED.party,
    denied: ['guest', 'agent', 'admin'],
    endpoints: [
      { name: 'GET /contracts/mine', call: (s) => s.partyContracts.mine() },
      { name: 'GET /contracts/mine/:id/attachments', call: (s) => s.partyContracts.attachments(NO_SUCH_ID) },
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
