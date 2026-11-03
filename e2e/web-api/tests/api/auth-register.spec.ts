import type { APIResponse } from '@playwright/test';
import { qaAccounts } from '../../src/config/qa-accounts';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';

/**
 * POST /auth/dev/register (เพิ่มใน develop accb616): สมัครบัญชีทดสอบโดยไม่ต้องล็อกอิน
 *
 * ที่มา (develop accb616): auth.controller.ts:25-29, guards/dev-registration.guard.ts:3-39, registerForTesting ใน auth.service.ts:53-93
 *   - เปิดเฉพาะเมื่อ API ตั้ง NODE_ENV=development และ ALLOW_DEV_REGISTRATION=true และคำขอมาตรงจากเครื่องเดียวกัน
 *     (ที่อยู่ loopback, ไม่มีหัวข้อของ proxy, Origin เป็นเครื่องนี้, Sec-Fetch-Site ไม่ใช่ cross-site) ไม่อย่างนั้นตอบ 404 ข้อความเดียวกันหมด
 *   - เมื่อเปิด: ตรวจค่าก่อน (400 ข้อความเดียวกันทุกช่อง) แล้วจึงสร้างบัญชีใน Supabase Auth ผ่าน admin API
 *
 * ไฟล์นี้ไม่สร้างบัญชี: บัญชีที่สร้างจากเส้นทางนี้ยืนยันอีเมลแล้วและ API ไม่มีเส้นทางลบ
 *   (การสร้างบัญชีใน Supabase Auth ไม่อยู่ในข้อตกลงกับทีมเมื่อ 2 พ.ย. 2026 การสมัครสำเร็จจึงลองเฉพาะในห้องทดลองของ QA)
 *   - ข้อตัวกัน: ส่งเนื้อคำขอที่ผิดเสมอ (ไม่มีรหัสผ่าน) ถ้าตัวกันพัง API จะตอบ 400 แทน 404 จึงจับได้โดยไม่สร้างบัญชี
 *   - ข้อตรวจค่าและข้ออีเมลซ้ำ: ช่องที่ไม่ได้ทดสอบเป็นค่าที่ถูก และอีเมลเป็นของ qa-agent ถ้าการตรวจช่องนั้นหาย
 *     คำขอจะไปถึง Supabase แล้วได้ 409 แทน 400 จึงจับได้ แต่ **ไม่สร้างบัญชีก็ต่อเมื่อ qa-agent มีอยู่ใน Supabase Auth ของโปรเจกต์ที่
 *     SUPABASE_URL ของ API ชี้** โค้ดของ API ไม่ได้กันเรื่องนี้ และ global-setup ยืนยันแค่แถวในตาราง users ไม่ได้ถาม Supabase Auth
 *     ถ้าไม่มี คำขอจะสร้างบัญชี qa-agent ที่ยืนยันอีเมลแล้วด้วยรหัสผ่านที่เขียนไว้ในไฟล์นี้ ซึ่งลบผ่าน API ไม่ได้
 *     กลุ่มนี้จึงรันเฉพาะเมื่อผู้รันตั้ง E2E_ALLOW_REGISTER_PROBES=yes หลังดูเองใน Supabase > Authentication > Users ว่ามี qa-agent
 *   - ข้อยกเว้น: ข้ออีเมลไม่มี @ ใช้อีเมลใหม่ (จะใช้อีเมลของ qa-agent ไม่ได้ เพราะต้องผิดรูปแบบ) ถ้าการตรวจรูปแบบหาย คำขอจะไปถึง Supabase
 *     บิวตี้อนุมานว่า Supabase ปฏิเสธอีเมลที่ไม่มี @ (ยังไม่ได้ลองกับ Supabase จริง)
 * สิ่งที่ต้องมีก่อน: ไม่ต้องล็อกอิน ; ข้อที่ต้องให้เส้นทางเปิดจะข้ามถ้า API ปิด ; กลุ่มตรวจค่าต้องตั้ง E2E_ALLOW_REGISTER_PROBES=yes เพิ่ม
 */

/** คำตอบเมื่อเส้นทางปิด หรือตัวกันปฏิเสธคำขอ (dev-registration.guard.ts บรรทัด 36) */
const UNAVAILABLE = { code: 'TEST_REGISTRATION_UNAVAILABLE', message: 'Test registration is unavailable' };
/** คำตอบเมื่อค่าไม่ผ่าน (auth.service.ts บรรทัด 57-65 ข้อความเดียวกันทุกช่อง) */
const INVALID = { code: 'REGISTRATION_INVALID_INPUT', message: 'Invalid registration input' };
/** คำตอบเมื่ออีเมลมีบัญชีอยู่แล้ว (auth.service.ts บรรทัด 87-89) */
const EMAIL_EXISTS = { code: 'email_exists', message: 'Email already registered' };

/** เหตุผลที่ข้อซึ่งต้องให้เส้นทางเปิดข้าม */
const CLOSED =
  'POST /auth/dev/register ตอบ 404 (API ต้องตั้ง NODE_ENV=development และ ALLOW_DEV_REGISTRATION=true และ E2E_API_BASE_URL ต้องเป็น localhost, 127.0.0.1 หรือ [::1])';

/** เนื้อคำขอที่ผิดเสมอ (ไม่มีรหัสผ่าน ชื่อ นามสกุล) ใช้กับข้อตัวกัน */
const ALWAYS_INVALID = { email: 'e2e-never-created@nestyk.test' };

/** เนื้อคำขอที่ถูกทุกช่อง ด้วยอีเมลของ qa-agent ที่มีบัญชีอยู่แล้ว (ถ้าส่งไปถึง Supabase จะได้ 409 ไม่สร้างบัญชี) */
const validWithExistingEmail = () => ({ email: qaAccounts.agent.email, password: 'e2e-password-1', firstName: 'E2E', lastName: 'QA' });

/** อ่านเนื้อคำตอบ (คำตอบของเส้นทางนี้ไม่มีข้อมูลส่วนตัว) */
async function bodyOf(response: APIResponse): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * เส้นทางเปิดอยู่หรือไม่: ส่ง {} โดยไม่มีหัวข้อเพิ่ม เปิด = 400 INVALID, ปิด = 404 UNAVAILABLE (ทั้ง 2 แบบไม่สร้างบัญชี)
 * คำตอบแบบอื่นแปลว่าเส้นทางเปลี่ยน เทสจึงไม่ผ่านที่นี่
 */
async function registrationOpen(anonymous: ApiSession): Promise<boolean> {
  const response = await anonymous.auth.devRegister({});
  const body = await bodyOf(response);
  if (response.status() === 404) {
    expect(body, 'เส้นทางปิด: ต้องได้ 404 TEST_REGISTRATION_UNAVAILABLE').toEqual(UNAVAILABLE);
    return false;
  }
  expect(response.status(), 'POST /auth/dev/register ด้วย {} ต้องได้ 404 (ปิด) หรือ 400 (เปิด)').toBe(400);
  expect(body).toEqual(INVALID);
  return true;
}

test.describe('POST /auth/dev/register guard', () => {
  // ตัวกันตรวจหัวข้อเหล่านี้ก่อนตรวจค่า (dev-registration.guard.ts บรรทัด 29-35) ถ้าเส้นทางเปิด 404 นี้มาจากตัวกันเท่านั้น
  //   ถ้าเส้นทางปิดด้วยค่าตั้ง ทุกคำขอได้ 404 อยู่แล้ว ข้อเหล่านี้จึงข้าม และข้อ "closed route" ด้านล่างตรวจแทน
  const rejectedHeaders: [string, Record<string, string>][] = [
    ['Forwarded', { Forwarded: 'for=203.0.113.1' }],
    ['X-Forwarded-For', { 'X-Forwarded-For': '203.0.113.1' }],
    ['X-Forwarded-Host', { 'X-Forwarded-Host': 'example.com' }],
    ['X-Forwarded-Proto', { 'X-Forwarded-Proto': 'https' }],
    ['an Origin of another site', { Origin: 'https://example.com' }],
    ['Sec-Fetch-Site: cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
  ];

  test('answers 404 TEST_REGISTRATION_UNAVAILABLE for every request while the route is closed', async ({ anonymous }) => {
    // ข้อนี้รันเฉพาะเมื่อเส้นทางปิด (ค่าที่ API ใช้ตอนไม่ได้ตั้ง NODE_ENV=development หรือ ALLOW_DEV_REGISTRATION=true)
    test.skip(await registrationOpen(anonymous), 'เส้นทางเปิดอยู่ ข้อตัวกันด้านล่างตรวจแทน');
    // ขั้นที่ 1-2: เนื้อคำขอที่ผิดก็ต้องได้ 404 เดียวกัน (ปิดจริง ไม่ใช่แค่ตรวจค่าแล้วปฏิเสธ)
    const response = await anonymous.auth.devRegister(ALWAYS_INVALID);
    expect(response.status()).toBe(404);
    expect(await bodyOf(response)).toEqual(UNAVAILABLE);
  });

  for (const [label, headers] of rejectedHeaders) {
    test(`answers 404 when the request has ${label}`, async ({ anonymous }) => {
      // ขั้นที่ 1: ข้อนี้ตรวจตัวกันได้เฉพาะเมื่อเส้นทางเปิด (ถ้าปิด ทุกคำขอได้ 404 อยู่แล้ว จึงพิสูจน์อะไรไม่ได้)
      test.skip(!(await registrationOpen(anonymous)), CLOSED);

      // ขั้นที่ 2: ส่งเนื้อคำขอที่ผิดเสมอพร้อมหัวข้อนี้   ขั้นที่ 3: ต้องได้ 404 (ถ้าตัวกันหาย จะได้ 400 จากการตรวจค่า)
      const response = await anonymous.auth.devRegister(ALWAYS_INVALID, headers);
      expect(response.status()).toBe(404);
      expect(await bodyOf(response)).toEqual(UNAVAILABLE);
    });
  }
});

test.describe('POST /auth/dev/register input checks', () => {
  // ทุกข้อในกลุ่มนี้ต้องให้เส้นทางเปิด และผู้รันต้องตั้ง E2E_ALLOW_REGISTER_PROBES=yes (ดูเหตุผลที่หัวไฟล์) ไม่อย่างนั้นข้าม
  test.skip(
    process.env.E2E_ALLOW_REGISTER_PROBES !== 'yes',
    'ตั้ง E2E_ALLOW_REGISTER_PROBES=yes หลังยืนยันใน Supabase > Authentication > Users ของโปรเจกต์ที่ API ใช้ว่ามี qa-agent (ไม่อย่างนั้นคำขออาจสร้างบัญชีที่ลบไม่ได้)',
  );
  const NOT_OPEN = CLOSED;

  const invalidBodies: [string, unknown][] = [
    ['the body is an array', [validWithExistingEmail()]],
    ['the email has no @', { ...validWithExistingEmail(), email: 'e2e-not-an-email' }],
    ['the password has 7 characters', { ...validWithExistingEmail(), password: 'e2e-pw7' }],
    ['the password has 1025 characters', { ...validWithExistingEmail(), password: 'p'.repeat(1025) }],
    ['the first name is only spaces', { ...validWithExistingEmail(), firstName: '   ' }],
    ['the last name is missing', { email: qaAccounts.agent.email, password: 'e2e-password-1', firstName: 'E2E' }],
    ['the first name has 256 characters', { ...validWithExistingEmail(), firstName: 'E'.repeat(256) }],
    ['the last name has 256 characters', { ...validWithExistingEmail(), lastName: 'Q'.repeat(256) }],
  ];

  for (const [label, body] of invalidBodies) {
    test(`answers 400 when ${label}`, async ({ anonymous }) => {
      test.skip(!(await registrationOpen(anonymous)), NOT_OPEN);
      // ขั้นที่ 1: ส่งเนื้อคำขอที่ผิดช่องเดียว   ขั้นที่ 2: ต้องได้ 400 ข้อความเดียวกับทุกช่อง (ถ้าการตรวจช่องนี้หาย จะได้ 409 จาก Supabase)
      const response = await anonymous.auth.devRegister(body);
      expect(response.status()).toBe(400);
      expect(await bodyOf(response)).toEqual(INVALID);
    });
  }

  test('accepts names at the longest allowed length, so the 256 checks are at the limit', async ({ anonymous }) => {
    test.skip(!(await registrationOpen(anonymous)), NOT_OPEN);
    // ตัวคุมของข้อชื่อยาวข้างบน: ชื่อและนามสกุล 255 ตัวต้องผ่านการตรวจค่า แล้วไปได้ 409 เพราะอีเมลมีบัญชีอยู่แล้ว
    //   ถ้าเพดานจริงต่ำกว่านี้ ข้อนี้จะได้ 400 และข้อ 256 ข้างบนก็ไม่ได้พิสูจน์ว่าเพดานอยู่ที่ 255
    //   รหัสผ่าน 1024 ตัวไม่ใส่ในตัวคุม เพราะ Supabase Auth อาจมีเพดานรหัสผ่านต่ำกว่านั้น (อนุมาน) แล้วตอบ REGISTRATION_FAILED แทน 409
    const response = await anonymous.auth.devRegister({ ...validWithExistingEmail(), firstName: 'E'.repeat(255), lastName: 'Q'.repeat(255) });
    expect(response.status()).toBe(409);
    expect(await bodyOf(response)).toEqual(EMAIL_EXISTS);
  });

  test('answers 409 for an email that already has an account, in any letter case', async ({ anonymous }) => {
    test.skip(!(await registrationOpen(anonymous)), NOT_OPEN);
    // ขั้นที่ 1: สมัครด้วยอีเมลของ qa-agent ตัวพิมพ์ใหญ่และมีช่องว่าง (API ตัดช่องว่างและทำเป็นตัวพิมพ์เล็กก่อนส่ง auth.service.ts บรรทัด 79)
    // ขั้นที่ 2: ต้องได้ 409 และ API ไม่แก้บัญชีเดิม (Supabase ไม่สร้างบัญชีซ้ำ ; การไม่แก้บัญชีเดิมตรวจไม่ได้จากเทสนี้)
    const response = await anonymous.auth.devRegister({ ...validWithExistingEmail(), email: `  ${qaAccounts.agent.email.toUpperCase()} ` });
    expect(response.status()).toBe(409);
    expect(await bodyOf(response)).toEqual(EMAIL_EXISTS);
  });
});
