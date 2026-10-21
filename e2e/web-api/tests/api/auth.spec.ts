import type { APIResponse } from '@playwright/test';
import type { AuthUser } from '../../src/api/types';
import { env } from '../../src/config/env';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';

/**
 * การล็อกอินและการกันคนที่ไม่มีสิทธิ์
 * สิ่งที่ต้องมีก่อน: API ตั้ง ALLOW_DEV_AUTH=true และฐานข้อมูลมีบัญชีตัวอย่างของทีม (seed-dev-user.sql)
 *   เทสของ POST /auth/dev/roles ต้องการ API ที่ตั้ง ALLOW_DEV_ROLE_GRANT=true ด้วย (ถ้าไม่ตั้ง API ตอบ 403 และข้อนั้นไม่ผ่าน)
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   POST /auth/dev/roles ถูกเรียกด้วยชื่อบทบาทที่ grantDevRole ปฏิเสธก่อนอ่านตารางบทบาทเท่านั้น จึงไม่บันทึกอะไร (ดูในเทส)
 */

/** เส้นทางที่ต้องล็อกอินก่อน (ตัวแทนของแต่ละกลุ่ม) */
const protectedEndpoints: { name: string; call: (session: ApiSession) => Promise<APIResponse> }[] = [
  { name: 'GET /agent/listings', call: (session) => session.listings.list() },
  { name: 'GET /agent/leads', call: (session) => session.leads.list() },
  { name: 'GET /agent/leads/visa-types', call: (session) => session.leads.visaTypes() },
  { name: 'GET /agent/tenants', call: (session) => session.tenants.list() },
  { name: 'GET /agent/contracts', call: (session) => session.contracts.list() },
  { name: 'GET /contracts/mine', call: (session) => session.partyContracts.mine() },
  { name: 'POST /auth/sync', call: (session) => session.auth.sync() },
];

/**
 * บัตรผ่านที่ API ต้องปฏิเสธ แต่ละแถวคือความผิดคนละแบบ
 * แถวสุดท้ายเป็นบัตรผ่านแบบนักพัฒนาที่รูปแบบถูก แต่เป็นของคนที่ไม่มีในฐานข้อมูล
 * จึงทดสอบกับเส้นทางแบบอ่านเท่านั้น (ถ้ายิงไปที่ POST /auth/sync ระบบจะสร้างผู้ใช้คนนี้ขึ้นมา)
 */
const rejectedCredentials: { name: string; authorization: string }[] = [
  { name: 'a scheme other than Bearer', authorization: 'Basic ZTJlOmUyZQ==' },
  { name: 'a token that is not a real session', authorization: 'Bearer e2e-not-a-real-token' },
  { name: 'a dev token with too few parts', authorization: 'Bearer dev|only-two-parts' },
  {
    name: 'a dev token of a user that was never registered',
    authorization: 'Bearer dev|11111111-1111-4111-8111-111111111111|e2e-nobody@example.invalid',
  },
];

test.describe('callers without a valid login', () => {
  for (const endpoint of protectedEndpoints) {
    test(`${endpoint.name} answers 401 when no token is sent`, { tag: '@smoke' }, async ({ anonymous }) => {
      // ขั้นที่ 1: เรียกเส้นทางโดยไม่ส่งหัวข้อ Authorization
      const response = await endpoint.call(anonymous);

      // ขั้นที่ 2: ต้องถูกปฏิเสธด้วย 401 (401 = ยังไม่ได้ยืนยันตัวตน)
      await expectError(response, 401);
    });
  }

  for (const credential of rejectedCredentials) {
    test(`GET /agent/leads answers 401 for ${credential.name}`, async ({ apiAs }) => {
      // ขั้นที่ 1: สร้างผู้เรียกที่ส่งบัตรผ่านแบบที่ใช้ไม่ได้
      const session = await apiAs(credential.authorization);

      // ขั้นที่ 2: เรียกเส้นทางแบบอ่าน แล้วต้องถูกปฏิเสธด้วย 401 โดยไม่มีข้อมูลหลุดออกมา
      const response = await session.leads.list();
      await expectError(response, 401);
      expect(await response.text()).not.toContain('"items"');
    });
  }
});

test.describe('POST /auth/sync', () => {
  test('returns the profile and roles of the seeded dev account', { tag: '@smoke' }, async ({ agent }) => {
    // ขั้นที่ 1: ล็อกอินแบบนักพัฒนาด้วยบัญชีตัวอย่าง
    const user = await expectJson<AuthUser>(await agent.auth.sync(), 201);

    // ขั้นที่ 2: ต้องได้บัญชีเดียวกับที่ตั้งไว้ใน src/config/env.ts และมีบทบาทนายหน้า
    expect(user.email).toBe(env.devUser.email);
    expect(user.roles).toContain('agent');
    expect(Number.isInteger(user.id) && user.id > 0).toBe(true);

    // ขั้นที่ 3: บัญชีนี้มีอยู่แล้ว ระบบจึงต้องไม่สร้างผู้ใช้ใหม่ (provisioned = false)
    expect(user.provisioned).toBe(false);
  });

  test('gives the same user every time it is called', async ({ agent }) => {
    // ขั้นที่ 1: เรียก 2 ครั้งติดกัน
    const first = await expectJson<AuthUser>(await agent.auth.sync(), 201);
    const second = await expectJson<AuthUser>(await agent.auth.sync(), 201);

    // ขั้นที่ 2: ต้องเป็นผู้ใช้คนเดิม และไม่มีครั้งไหนสร้างผู้ใช้ใหม่
    expect(second.id).toBe(first.id);
    expect(second.roles).toEqual(first.roles);
    expect([first.provisioned, second.provisioned]).toEqual([false, false]);
  });
});

/**
 * รายการบทบาทที่ขอได้ จากข้อความ 400 ของ grantDevRole
 * (auth.service.ts:169-171: `Role must be one of: ${DEV_GRANTABLE.join(', ')}`) ถ้าข้อความไม่ใช่รูปแบบนี้ ได้รายการว่าง
 */
function grantableRoles(message: string): string[] {
  return /^Role must be one of: (.+)$/.exec(message)?.[1]?.split(', ') ?? [];
}

test.describe('POST /auth/dev/roles', () => {
  // ตั้งแต่ develop 84087e2 บทบาท owner เปลี่ยนชื่อเป็น landlord (supabase/migrations/20261016100000_rename_owner_role_to_landlord.sql)
  //   และชื่อ owner ไม่อยู่ในรายการที่ขอได้แล้ว (DEV_GRANTABLE ใน apps/api/src/auth/auth.service.ts:27)
  //   grantDevRole (auth.service.ts:166-172) ตรวจว่าเปิดให้ขอบทบาทไหม แล้วตรวจชื่อ ก่อนอ่านตาราง master_roles และ user_roles
  //   ชื่อที่ไม่อยู่ในรายการจึงไม่ถูกบันทึก (ส่วน AuthGuard อ่านตาราง users ก่อนทุกคำขออยู่แล้ว)

  test('rejects the retired role name owner', async ({ agent }) => {
    // ขั้นที่ 1: ยืนยันว่าบัญชีตัวอย่างใช้ชื่อบทบาทชุดใหม่แล้ว (มี landlord ไม่มี owner)
    //   ถ้าไม่ตรง เทสหยุดตรงนี้ เพราะฐานข้อมูลยังไม่ได้ขึ้น migration rename_owner_role_to_landlord
    const before = await expectJson<AuthUser>(await agent.auth.sync(), 201);
    expect(before.roles, 'บัญชีตัวอย่างต้องมีบทบาท landlord (ฐานข้อมูลต้องขึ้น migration rename_owner_role_to_landlord แล้ว)').toContain('landlord');
    expect(before.roles, 'ต้องไม่มีบทบาทชื่อ owner เหลืออยู่').not.toContain('owner');

    // ขั้นที่ 2: ถามรายการบทบาทที่ API ที่เปิดอยู่ยอมให้ขอ ด้วยชื่อที่ไม่มีอยู่จริง
    //   ชื่อนี้ไม่อยู่ในรายการที่ขอได้ และการบันทึกต้องหาแถวชื่อนี้ใน master_roles ให้เจอก่อน (auth.service.ts:173-178)
    //   ซึ่งไม่มี (seed ของทีมไม่มีชื่อนี้) คำขอนี้จึงได้ 400 โดยไม่บันทึกอะไร
    //   ถ้ารายการไม่มี landlord หรือยังมี owner แปลว่า API น่าจะเป็นโค้ดก่อน 84087e2 ซึ่งบันทึกบทบาท owner ให้บัญชีได้
    //   ถ้าตาราง master_roles ยังมีแถว owner เทสจึงหยุดตรงนี้ก่อนส่งชื่อ owner
    const probeMessage = await expectError(await agent.auth.grantDevRole('e2e-not-a-role'), 400);
    const probe = grantableRoles(probeMessage);
    expect(probe, `ต้องได้รายการบทบาทที่ขอได้ซึ่งมี landlord ถ้าไม่มี ให้ดูว่า API เป็นโค้ดก่อน 84087e2 หรือไม่ (ข้อความของ API: ${probeMessage})`).toContain('landlord');
    expect(probe, `API ที่เปิดอยู่ยังรับชื่อ owner (โค้ดก่อน 84087e2) จึงไม่ส่งคำขอ owner (ข้อความของ API: ${probeMessage})`).not.toContain('owner');

    // ขั้นที่ 3: ขอบทบาท owner แล้วต้องถูกปฏิเสธด้วย 400 ที่จุดเดียวกับขั้นที่ 2 (ชื่อไม่อยู่ในรายการที่ขอได้)
    //   ถ้าข้อนี้ได้ 201 แปลว่า API อาจบันทึกบทบาท owner ให้บัญชีแล้ว ให้แจ้งทีมพร้อมผลรัน ห้ามเรียก DELETE /auth/dev/roles เอง
    const message = await expectError(await agent.auth.grantDevRole('owner'), 400);
    expect(grantableRoles(message), `ข้อความของ API: ${message}`).toEqual(probe);

    // ขั้นที่ 4: บทบาทของบัญชีต้องเท่าเดิม (เรียงก่อนเทียบ เพราะ API ไม่ได้เรียงบทบาท)
    const after = await expectJson<AuthUser>(await agent.auth.sync(), 201);
    expect([...after.roles].sort()).toEqual([...before.roles].sort());
  });
});

test.describe('dev token with a user id that is not a uuid', () => {
  // บั๊กที่รู้แล้ว (พบ 20 ต.ค. 2026 ที่ develop a09e6d2 Aof ต้องแจ้งทีม): API ตอบ 500 แทน 401
  //   ที่มา: AuthGuard ส่งส่วนที่ 2 ของ dev token ไปค้นคอลัมน์ users.supabase_user_id (ชนิด uuid) โดยไม่ตรวจรูปแบบ
  //   (auth.guard.ts resolveIdentity และ auth.service.ts findBySupabaseUserId) PostgreSQL จึงโยน error
  //   invalid input syntax for type uuid (log ของ API: routine string_to_uuid) และ NestJS ตอบ 500
  //   ผลกระทบ: เฉพาะ API ที่ตั้ง ALLOW_DEV_AUTH=true บัตรผ่านจริงของ Supabase มี uuid ที่ถูกรูปแบบเสมอ
  //   เทสเขียนตามพฤติกรรมที่ถูกต้อง (บัตรผ่านที่ใช้ไม่ได้ต้องได้ 401) เมื่อทีมแก้แล้ว test.fail จะแจ้งให้เอาป้ายออก
  //   คำขอนี้ไม่บันทึกอะไร: error เกิดตอนค้นผู้ใช้ ก่อนถึงเส้นทาง

  test('GET /agent/leads gives no data when the user id is not a uuid', async ({ apiAs }) => {
    // เทสคู่กับข้อ known-bug ด้านล่าง: test.fail นับความล้มทุกแบบว่าเป็นบั๊กที่รู้แล้ว ถ้า API เปลี่ยนไปตอบ 200 พร้อมข้อมูล
    //   ข้อนั้นจะยังผ่าน ข้อนี้จึงตรวจขั้นต่ำที่ต้องจริงเสมอ: คำขอถูกปฏิเสธ (ไม่ใช่ 2xx) และไม่มีข้อมูลหลุดออกมา
    // ขั้นที่ 1: สร้างผู้เรียกที่ส่ง dev token รูปแบบครบ 3 ส่วน แต่ส่วน uuid ไม่ใช่ uuid
    const session = await apiAs('Bearer dev|e2e-not-a-uuid|e2e-nobody@example.invalid');

    // ขั้นที่ 2: ต้องไม่ได้ 2xx และเนื้อคำตอบต้องไม่มีรายการลีด
    const response = await session.leads.list();
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(await response.text()).not.toContain('"items"');
  });

  test('GET /agent/leads answers 401 when the user id is not a uuid', { tag: '@known-bug' }, async ({ apiAs }) => {
    test.fail(true, 'API ตอบ 500 เพราะไม่ตรวจรูปแบบ uuid ใน dev token ก่อนค้นฐานข้อมูล');

    // ขั้นที่ 1: สร้างผู้เรียกที่ส่ง dev token รูปแบบครบ 3 ส่วน แต่ส่วน uuid ไม่ใช่ uuid
    const session = await apiAs('Bearer dev|e2e-not-a-uuid|e2e-nobody@example.invalid');

    // ขั้นที่ 2: ต้องถูกปฏิเสธด้วย 401 โดยไม่มีข้อมูลหลุดออกมา
    const response = await session.leads.list();
    await expectError(response, 401);
    expect(await response.text()).not.toContain('"items"');
  });
});
