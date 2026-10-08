import type { APIResponse } from '@playwright/test';
import type { AuthUser } from '../../src/api/types';
import { env } from '../../src/config/env';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';

/**
 * การล็อกอินและการกันคนที่ไม่มีสิทธิ์
 * สิ่งที่ต้องมีก่อน: API ตั้ง ALLOW_DEV_AUTH=true และฐานข้อมูลมีบัญชีตัวอย่างของทีม (seed-dev-user.sql)
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 */

/** เส้นทางที่ต้องล็อกอินก่อน (ตัวแทนของแต่ละกลุ่ม) */
const protectedEndpoints: { name: string; call: (session: ApiSession) => Promise<APIResponse> }[] = [
  { name: 'GET /agent/listings', call: (session) => session.listings.list() },
  { name: 'GET /agent/leads', call: (session) => session.leads.list() },
  { name: 'GET /agent/leads/visa-types', call: (session) => session.leads.visaTypes() },
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
