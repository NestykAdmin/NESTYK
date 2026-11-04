import { ACCOUNT_DELETE_BLOCKERS, type AccountDeletionPreview } from '../../src/api/types';
import { QA_ROLES, qaAgent2 } from '../../src/config/qa-accounts';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectCodedError, expectError, expectJson } from '../../src/support/http';

/**
 * เส้นทางลบบัญชีใต้ /auth: ดูสถานะการลบ (GET), ลบทันที (DELETE /auth/account) และนัดลบ 30 วัน (POST /auth/account/deletion)
 *
 * ที่มา (qa/e2e 01d0523 = รวม pre/dev/review 0f99388 เข้า develop): apps/api/src/auth/auth.controller.ts บรรทัด 96-115
 *   - ทั้ง 3 เส้นทางใช้ AuthGuard ไม่จำกัดบทบาท ไม่มี @Body (ไม่ตรวจเนื้อคำขอ)
 *   - DELETE /auth/account กับ POST /auth/account/deletion มี RecentAuthGuard ต่อจาก AuthGuard (บรรทัด 104, 111)
 *     RecentAuthGuard อ่านค่า amr จาก JWT ไม่แตะฐานข้อมูล (guards/recent-auth.guard.ts, recent-auth.ts) บัตรผ่านแบบนักพัฒนาไม่มี amr
 *     จึงได้ 401 { code: 'REAUTH_REQUIRED' } ก่อนถึง service ที่เขียนฐานข้อมูลเสมอ
 *   - GET /auth/account/deletion อ่านอย่างเดียว (deletionPreview: SELECT 3 คำสั่งกับ findOne, auth.service.ts บรรทัด 280-295)
 *
 * ไฟล์นี้อ่านอย่างเดียว ทุกคำขอถูกปฏิเสธก่อนเขียน หรือเป็น GET ที่ยืนยันจากโค้ดว่าไม่เขียน
 *   ไม่เรียก DELETE /auth/account/deletion (ยกเลิกนัด: UPDATE แถว users ทุกครั้ง บรรทัด 309-312)
 *   และ POST /auth/password-changed (ส่งอีเมลจริง) ตามข้อตกลงกับ Aof 4 พ.ย. 2026
 * API ต่อฐานข้อมูลของทีม งาน 00:10 ลบบัญชีที่ถึงกำหนด ต้องตั้ง DISABLE_SCHEDULED_JOBS=true เมื่อเปิด API ข้ามเที่ยงคืน (README)
 */

/** บัตรผ่านแบบนักพัฒนาของคนที่ไม่มีบัญชีในฐานข้อมูล (แบบเดียวกับ auth.spec.ts) uuid ถูกรูปแบบ AuthGuard จึงอ่านตารางแล้วไม่พบ */
const NEVER_REGISTERED = 'Bearer dev|11111111-1111-4111-8111-111111111111|e2e-nobody@example.invalid';

test.describe('account routes answer 401 before touching the database when there is no valid session', () => {
  test('GET preview, DELETE account and POST deletion answer 401 when no token is sent', async ({ anonymous }) => {
    // ขั้นที่ 1: ไม่ส่งหัวข้อ Authorization   ขั้นที่ 2: AuthGuard ตอบ 401 Missing Bearer token ก่อนอ่านฐานข้อมูล (auth.guard.ts บรรทัด 39-47)
    expect(await expectError(await anonymous.auth.deletionPreview(), 401)).toBe('Missing Bearer token');
    expect(await expectError(await anonymous.auth.deleteAccountNow(), 401)).toBe('Missing Bearer token');
    expect(await expectError(await anonymous.auth.scheduleDeletion(), 401)).toBe('Missing Bearer token');
  });

  test('GET preview answers 401 for a dev token of a user that was never registered', async ({ apiAs }) => {
    // ขั้นที่ 1: บัตรผ่านรูปแบบถูกแต่ไม่มีแถวใน users   ขั้นที่ 2: requireUser ใน controller ตอบ 401 (auth.controller.ts บรรทัด 158-162) ก่อนเรียก service
    const nobody = await apiAs(NEVER_REGISTERED);
    expect(await expectError(await nobody.auth.deletionPreview(), 401)).toBe('Call POST /auth/sync first');
  });

  test('DELETE account and POST deletion answer 401 REAUTH_REQUIRED for a dev token', async ({ apiAs }) => {
    // บัตรผ่านแบบนักพัฒนาไม่มี amr RecentAuthGuard จึงตอบ 401 REAUTH_REQUIRED ก่อนถึง requireUser และก่อน service (recent-auth.ts บรรทัด 34)
    //   ใช้บัตรผ่านของคนที่ไม่มีบัญชี จึงไม่แตะข้อมูลของบัญชีจริงแม้ guard จะเปลี่ยน
    const nobody = await apiAs(NEVER_REGISTERED);
    expect(await expectCodedError(await nobody.auth.deleteAccountNow(), 401, 'REAUTH_REQUIRED')).toBe('Confirm your identity again');
    expect(await expectCodedError(await nobody.auth.scheduleDeletion(), 401, 'REAUTH_REQUIRED')).toBe('Confirm your identity again');
  });
});

test.describe('DELETE account and POST deletion need a recent authentication, which a dev token never has', () => {
  // ตรวจว่าบัญชีจริง (qa-agent2) ที่มีสิทธิ์ครบก็ยังถูกปฏิเสธที่ RecentAuthGuard ก่อนเขียน จึงปลอดภัยกับฐานข้อมูลของทีม
  test.skip(qaAgent2.uuid === null, `ยังไม่ได้ตั้ง ${qaAgent2.uuidVariable} (uuid ของ ${qaAgent2.email})`);

  test('DELETE /auth/account answers 401 REAUTH_REQUIRED for a real account with a dev token', async ({ agent2 }) => {
    expect(await expectCodedError(await agent2.auth.deleteAccountNow(), 401, 'REAUTH_REQUIRED')).toBe('Confirm your identity again');
  });

  test('POST /auth/account/deletion answers 401 REAUTH_REQUIRED for a real account with a dev token', async ({ agent2 }) => {
    // ถ้า guard ถูกข้าม คำขอนี้จะนัดลบบัญชี qa-agent2 จริง (scheduleAccountDeletion เขียน users.deletion_* แล้วส่งอีเมล)
    //   RecentAuthGuard หยุดก่อน ถ้าได้อย่างอื่นนอกจาก 401 REAUTH_REQUIRED ให้แจ้งทีมทันที (ดูข้อ known-bug ท้ายไฟล์)
    expect(await expectCodedError(await agent2.auth.scheduleDeletion(), 401, 'REAUTH_REQUIRED')).toBe('Confirm your identity again');
  });
});

test.describe('GET /auth/account/deletion returns the deletion status without writing', () => {
  /** ตรวจรูปแบบคำตอบของ 1 บัญชี โดยไม่เทียบค่าจริง เพราะค่าขึ้นกับข้อมูลสดของทีม */
  async function expectPreviewShape(session: ApiSession, who: string, annotateScheduled = true): Promise<AccountDeletionPreview> {
    const body = await expectJson<AccountDeletionPreview>(await session.auth.deletionPreview(), 200);
    expect(typeof body.blocked, `${who}: blocked ต้องเป็น boolean`).toBe('boolean');
    expect(Array.isArray(body.reasons), `${who}: reasons ต้องเป็นรายการ`).toBe(true);
    // reasons ต้องอยู่ใน 5 รหัสที่โค้ดกำหนด (account-deletion.ts บรรทัด 2) และไม่ซ้ำ
    expect(body.reasons.every((r) => (ACCOUNT_DELETE_BLOCKERS as readonly string[]).includes(r)), `${who}: reasons ต้องเป็นรหัสที่รู้จัก`).toBe(true);
    expect(new Set(body.reasons).size, `${who}: reasons ต้องไม่ซ้ำ`).toBe(body.reasons.length);
    // blocked ต้องสอดคล้องกับว่ามีเหตุกันหรือไม่ (deletionPreview บรรทัด 290)
    expect(body.blocked, `${who}: blocked ต้องเท่ากับ (reasons ไม่ว่าง)`).toBe(body.reasons.length > 0);
    expect(typeof body.deleteNowAvailable, `${who}: deleteNowAvailable ต้องเป็น boolean`).toBe('boolean');
    if (body.scheduledFor !== null) {
      expect(Number.isNaN(Date.parse(body.scheduledFor)), `${who}: scheduledFor ต้องเป็นเวลา ISO`).toBe(false);
      // บัญชีนี้ถูกนัดลบไว้ ถ้าถึงกำหนดแล้วงาน 00:10 จะลบบัญชีนี้ ให้บันทึกเตือน (เฉพาะการอ่านครั้งแรก จะได้ไม่ซ้ำ)
      if (annotateScheduled) {
        test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: `${who} มีนัดลบบัญชี (scheduledFor ไม่ว่าง) ตรวจกับทีมว่าตั้งใจหรือไม่` });
      }
    }
    return body;
  }

  /**
   * เรียกซ้ำแล้วตรวจว่ารูปแบบยังถูก และ deleteNowAvailable (มาจาก ALLOW_IMMEDIATE_ACCOUNT_DELETION ของ API ไม่ใช่ข้อมูลของบัญชี) ไม่เปลี่ยน
   * ไม่ใช้ toEqual ทั้งก้อน เพราะ reasons/scheduledFor ขึ้นกับข้อมูลสดของทีม (qa-tenant/qa-landlord ทีมใช้ในแอปด้วย) อาจเปลี่ยนระหว่างการอ่าน 2 ครั้ง
   *   การอ่าน 2 ครั้งนี้ตรวจความเสถียรของช่องที่นิ่งเท่านั้น ไม่ได้พิสูจน์ว่า GET ไม่เขียน (ยืนยันจากโค้ด deletionPreview บรรทัด 280-295 ว่าไม่มี update/insert)
   */
  async function expectPreviewStable(session: ApiSession, who: string): Promise<void> {
    const first = await expectPreviewShape(session, who);
    const second = await expectPreviewShape(session, `${who} (อ่านซ้ำ)`, false);
    expect(second.deleteNowAvailable, `${who}: deleteNowAvailable ต้องไม่เปลี่ยนระหว่างการอ่าน`).toBe(first.deleteNowAvailable);
  }

  for (const role of QA_ROLES) {
    test(`preview for qa-${role} has the right shape and writes nothing`, async ({ qa }) => {
      await expectPreviewStable(await qa(role), `qa-${role}`);
    });
  }

  test('preview for qa-agent2 has the right shape and writes nothing', async ({ agent2 }) => {
    test.skip(qaAgent2.uuid === null, `ยังไม่ได้ตั้ง ${qaAgent2.uuidVariable}`);
    await expectPreviewStable(agent2, 'qa-agent2');
  });
});

test.describe('POST /auth/account/deletion requires a recent authentication in the token payload', () => {
  /**
   * RecentAuthGuard อ่าน amr จากส่วนกลางของ JWT (คั่นด้วย '.') AuthGuard รับบัตรผ่านแบบนักพัฒนาที่มีส่วนเกิน 3 ส่วน
   *   (ตรวจแค่ parts.length < 3 ที่ auth.guard.ts) จึงประกอบบัตรผ่านที่มีจุด 2 ตัวและใส่ amr เองได้
   * ข้อนี้ตรวจขั้นต่ำที่ต้องจริงเสมอ: บัตรผ่านของคนที่ไม่มีบัญชีต้องถูกปฏิเสธด้วย 401 และต้องไม่มี scheduledFor ในคำตอบ (ไม่นัดลบ)
   *   ไม่ว่า RecentAuthGuard จะหยุด (401 REAUTH_REQUIRED) หรือถูกข้ามแล้วไปหยุดที่ requireUser (401 Call POST /auth/sync first)
   *   ก็ยังไม่มีการเขียน เพราะผู้ใช้ไม่มีในตาราง ใช้บัตรผ่านของคนที่ไม่มีบัญชีเท่านั้น ห้ามใช้กับบัญชีจริง
   * บันทึกว่าไปหยุดที่ด่านไหนไว้ใน annotation ถ้าไม่ใช่ REAUTH_REQUIRED แปลว่า amr ที่ประกอบเองผ่าน RecentAuthGuard
   *   (ด่านยืนยันตัวตนซ้ำถูกข้าม) ซึ่งต้องแจ้งทีม ดู nestyk-qa-setup-and-plan ข้อ 15
   * อีเมลในบัตรผ่านต้องไม่มีจุด: jwtPayload แยกทั้ง token ด้วย '.' แล้วต้องได้พอดี 3 ส่วน (recent-auth.ts บรรทัด 25-26) ถึงจะอ่าน amr ที่ประกอบไว้
   *   ถ้าอีเมลมีจุด (เช่น .invalid หรือ .test) ทั้ง token จะมีจุดเกิน 3 ส่วน amr ไม่ถูกอ่าน ได้ REAUTH_REQUIRED เสมอ และเคสนี้จะตรวจการข้าม guard ไม่ได้
   */
  test('a dev token carrying its own amr is still refused for a user that has no account', async ({ apiAs }) => {
    // ขั้นที่ 1: ประกอบบัตรผ่านของคนที่ไม่มีบัญชี ให้มี amr ที่ยืนยันตัวตนไว้เมื่อครู่ (method ไม่ใช่ token_refresh) อีเมลไม่มีจุด (ดูคอมเมนต์ด้านบน)
    const amr = Buffer.from(JSON.stringify({ amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] })).toString('base64url');
    const session = await apiAs(`Bearer dev|11111111-1111-4111-8111-111111111111|e2e-nobody@exampleinvalid|e2e.${amr}.e2e`);

    // ขั้นที่ 2: ต้องถูกปฏิเสธด้วย 401 (ด่านใดด่านหนึ่ง) และคำตอบต้องไม่มี scheduledFor
    const response = await session.auth.scheduleDeletion();
    const text = await response.text();
    expect(response.status(), 'คำขอของคนที่ไม่มีบัญชีต้องถูกปฏิเสธ (401)').toBe(401);
    expect(text, 'คำตอบ 401 ต้องไม่มี scheduledFor (ไม่ได้นัดลบ)').not.toContain('scheduledFor');

    // ขั้นที่ 3: บันทึกด่านที่หยุด เพื่อดูว่า amr ที่ประกอบเองผ่าน RecentAuthGuard หรือไม่
    const passedRecentAuth = !text.includes('REAUTH_REQUIRED');
    test.info().annotations.push({
      type: passedRecentAuth ? 'พบช่องโหว่' : 'ปกติ',
      description: passedRecentAuth
        ? 'บัตรผ่านนักพัฒนาที่ประกอบ amr เองผ่าน RecentAuthGuard (หยุดที่ requireUser) ด่านยืนยันตัวตนซ้ำถูกข้าม แจ้งทีม'
        : 'RecentAuthGuard ปฏิเสธ amr ที่ประกอบเอง (401 REAUTH_REQUIRED) ตามที่ควร',
    });
  });
});
