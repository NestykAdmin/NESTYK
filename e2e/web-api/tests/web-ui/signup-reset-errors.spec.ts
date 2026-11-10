import type { Locator, Page, Route } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { RegisterPage } from '../../src/web-ui/pages/register.page';
import { ResetPasswordPage } from '../../src/web-ui/pages/reset-password.page';
import { EN } from '../../src/web-ui/labels';
import { webUiEnv } from '../../src/web-ui/web-ui-env';
import { hasStoredSession, supabaseSessionKeys } from '../../src/web-ui/support/idle';

/**
 * ข้อความ error ของหน้าสมัครและหน้าลืมรหัสผ่าน (ตอบ QA 9 พ.ย. 2026: docs/qa-fixes/2026-11-09-login-error-cases-reply.md
 * หัวข้อ "หน้าสมัครและหน้าลืมรหัสผ่าน (QA ข้อ 3)" และ "ฝาก QA ตรวจ" ข้อ 5) ที่ UXUI/develop fe5d348
 * ทุกจุดเลือกข้อความด้วย authErrorText (lib/auth/auth-error.ts:55-60) ซึ่งใช้ signInErrorKind ตัวเดียวกับหน้า login
 *
 * ทุกข้อตอบปลอมด้วย page.route ไม่มีคำขอออกจากเบราว์เซอร์ไป Supabase หรือ API: ไม่สร้างบัญชี ไม่ส่งอีเมล ไม่ต้องใช้รหัสผ่านของบัญชี QA
 *   ตัวดักรวมของ /auth/v1/ ตัดทุกคำขอของ Supabase Auth ที่ตัวดักเฉพาะไม่ได้รับ แล้วตรวจท้ายข้อว่าไม่มีเลย (guard.ts:28 ไม่ครอบ Supabase ทุก path)
 * ค่าในคำตอบปลอม (code, status, msg) ใช้ชุดเดียวกับ CASES และ AUTH_TEXT_CASES ใน apps/consumer-app/lib/auth/auth-error.test.cjs ของ Jom
 *   ซึ่งใช้ error หน้าตาเดียวกับที่ Supabase สร้าง ยังไม่ได้เทียบกับคำตอบของ Supabase ของทีมโดยตรง
 *   ขั้นที่ต้องมี session (ใส่รหัส 6 หลัก, ตั้งรหัสใหม่) ใช้ session ปลอมที่ Supabase "ตอบ" ให้ token นี้ไม่เคยถึงระบบจริง
 * ทุกข้อตรวจ: ข้อความบนหน้าตรงตามตารางของ Jom / ไม่มีข้อความแบบอื่น / ไม่มีข้อความดิบของ Supabase หรือ API / ไม่มี session ของแอปค้าง
 * รันเป็นภาษาไทยด้วย npm run test:web-ui:th (labels.th.ts)
 * สิ่งที่ต้องเปิดก่อนรัน: เว็บที่ 8081 และ API ตามโหมดที่ใช้ (global-setup ตรวจ API ก่อนเริ่ม แม้ข้อในไฟล์นี้จะไม่เรียก API เลย)
 *
 * เคยเป็นบั๊ก (known-bug 4 ข้อ): lib/auth/reset-password.ts ห่อ error ของ Supabase ใหม่เป็น new Error(message) ชื่อ error กับ status หาย
 *   เคส 429 และเน็ตหลุดของหน้าลืมรหัสผ่านจึงขึ้นข้อความกลาง (ผลรัน 10 พ.ย. 2026 ที่ qa/e2e 1134c99: web-ui-signup-reset-errors-{en,th}-run1.txt)
 *   Jom แก้ที่ UXUI/develop 7d04c2e (ใช้ signInFailure(error) เก็บ name/status/code) รวมเข้า qa/e2e b6f23be
 *   ผลรันหลังแก้ (web-ui-signup-reset-errors-{en,th}-run3.txt): ทั้ง 4 ข้อ "Expected to fail, but passed" ทั้ง 2 ภาษา จึงเอาป้ายออกแล้ว
 */

/** ข้อความที่ Chromium ใส่ใน TypeError เมื่อ fetch ล้มเพราะเครือข่าย */
const RAW_FETCH_ERROR = 'Failed to fetch';

/** คำขอข้ามโดเมน (เว็บ 8081 ไป Supabase หรือ API 4000): ไม่มี header นี้ Chromium จะตัดคำตอบตามกติกา CORS */
const CORS = { 'access-control-allow-origin': '*' };

type Expected = 'networkError' | 'tooManyAttempts' | 'errorGeneric' | 'registrationFailed';
const ALL_TEXTS: Expected[] = ['networkError', 'tooManyAttempts', 'errorGeneric', 'registrationFailed'];

/** คำตอบปลอม null = ตัดการเชื่อมต่อ (route.abort) */
type FakeAnswer = { status: number; contentType: string; body: string } | null;

interface ErrorCase {
  name: string;
  answer: FakeAnswer;
  expected: Expected;
  /** ข้อความดิบในคำตอบที่ต้องไม่ขึ้นบนหน้า (ใส่เฉพาะคำที่ไปอยู่ในข้อความของ error ได้จริง) */
  raw: string[];
  /** ใส่เมื่อเป็นบั๊กที่รู้แล้ว: ข้อนี้ติดป้าย @known-bug และใต้ test.fail มีแค่การตรวจข้อความที่ถูก */
  knownBug?: string;
}

/** ป้ายของข้อ (known-bug ใช้ tag แบบเดียวกับ reset-password.spec.ts) */
function tagsOf(errorCase: ErrorCase): { tag?: string } {
  return errorCase.knownBug ? { tag: '@known-bug' } : {};
}

/** คำตอบ error ของ Supabase Auth (ใส่ทั้ง code และ error_code ให้ auth-js ทุกรุ่นอ่านได้ ข้อความอยู่ใน msg) */
function supabaseError(status: number, code: string, msg: string): FakeAnswer {
  return { status, contentType: 'application/json', body: JSON.stringify({ code, error_code: code, msg }) };
}

function json(body: unknown, status = 200): FakeAnswer {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

/** อีเมลปลอมของเทส (โดเมน .test ส่งอีเมลไม่ได้) */
const FAKE_EMAIL = 'qa-web-ui-signup-errors@nestyk.test';
const FAKE_USER_ID = '11111111-2222-4333-8444-555555555555';

/** ผู้ใช้ปลอมแบบที่ Supabase ตอบตอนสมัครที่ต้องยืนยันอีเมล (ไม่มี access_token: auth-js คืน session เป็น null) */
function fakeUser(): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: FAKE_USER_ID, aud: 'authenticated', role: 'authenticated', email: FAKE_EMAIL, phone: '',
    confirmation_sent_at: now, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
    identities: [{ identity_id: FAKE_USER_ID, id: FAKE_USER_ID, user_id: FAKE_USER_ID, provider: 'email', identity_data: { email: FAKE_EMAIL, sub: FAKE_USER_ID } }],
    created_at: now, updated_at: now,
  };
}

/** session ปลอมแบบที่ Supabase ตอบเมื่อยืนยันรหัสหรือลิงก์ผ่าน token ไม่ได้ลงลายมือชื่อจริง และไม่เคยออกจากเบราว์เซอร์ */
function fakeSession(): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: FAKE_USER_ID, email: FAKE_EMAIL, aud: 'authenticated', role: 'authenticated', exp: now + 3600, iat: now })}.qa-fake-signature`;
  return {
    access_token: accessToken, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'qa-fake-refresh-token',
    user: { ...fakeUser(), email_confirmed_at: new Date().toISOString() },
  };
}

/** ดักคำขอของ Supabase Auth ที่ path นี้ด้วย method นี้ แล้วตอบปลอม นับจำนวนครั้ง (ยืนยันว่าคำขอไม่หลุดไปที่ระบบจริง) */
async function answerSupabase(
  page: Page,
  path: string,
  method: string,
  answer: FakeAnswer,
  beforeAnswer?: () => Promise<void>,
): Promise<{ hits: number }> {
  return answerRequest(page, (url) => url.pathname.endsWith(`/auth/v1/${path}`), method, answer, beforeAnswer);
}

async function answerRequest(
  page: Page,
  match: (url: URL) => boolean,
  method: string,
  answer: FakeAnswer,
  beforeAnswer?: () => Promise<void>,
): Promise<{ hits: number }> {
  const counter = { hits: 0 };
  await page.route(match, async (route: Route) => {
    if (route.request().method() !== method) return route.fallback();
    counter.hits += 1;
    if (beforeAnswer) await beforeAnswer();
    if (answer === null) return route.abort('internetdisconnected');
    return route.fulfill({ ...answer, headers: CORS });
  });
  return counter;
}

/**
 * ตัวดักรวมของ Supabase Auth: ลงทะเบียนก่อนตัวดักเฉพาะทุกตัว (route ที่ลงทะเบียนทีหลังได้คำขอก่อน) คำขอที่หลุดมาถึงตัวนี้ถูกตัดและจดไว้
 * ใช้ปิดทางที่ตัวดักเฉพาะจับ path ไม่ตรง แล้วคำขอที่มีอีเมลหรือ token ปลอมออกไปถึง Supabase ของทีม
 */
async function blockOtherSupabaseAuth(page: Page): Promise<string[]> {
  const leaked: string[] = [];
  await page.route(
    (url) => url.pathname.includes('/auth/v1/'),
    async (route: Route) => {
      const url = new URL(route.request().url());
      leaked.push(`${route.request().method()} ${url.pathname}`);
      await route.abort('blockedbyclient');
    },
  );
  return leaked;
}

/** ส่วนของหน้าที่ใช้ตรวจ (RegisterPage และ ResetPasswordPage มีครบ) */
interface FormPage {
  alert: Locator;
  body: Locator;
  textAnywhere(text: string): Locator;
}

/**
 * ตรวจข้อความ error ของฟอร์ม: ไม่มีข้อความดิบ ไม่มี session ของแอป แล้วจึงตรวจข้อความที่ถูก 1 ข้อความและไม่มีข้อความแบบอื่น
 * เรียกหลังเห็น alert แล้ว ข้อ known-bug ตรวจ 2 อย่างแรกก่อน test.fail ใต้ test.fail จึงเหลือแค่การตรวจข้อความที่ถูก
 * เมื่อทีมแก้แล้ว ข้อนั้นจะขึ้น "Expected to fail, but passed" ให้เอา knownBug ออก
 */
async function expectFormError(page: Page, form: FormPage, errorCase: ErrorCase): Promise<void> {
  for (const raw of errorCase.raw) {
    await expect(form.body, `ข้อความดิบ "${raw}" ต้องไม่ขึ้นบนหน้า`).not.toContainText(raw);
  }
  // ตัวกันเท่านั้น: แอปบันทึก session ของตัวเองเมื่อ sync สำเร็จเท่านั้น (AuthContext.tsx:451-454) ข้อในไฟล์นี้จึงแทบไม่มีทางเป็น true
  expect(await hasStoredSession(page), 'ไม่สำเร็จต้องไม่มี session ของแอปเก็บไว้').toBe(false);
  if (errorCase.knownBug) {
    test.info().annotations.push({ type: 'alert-shown', description: (await form.alert.allInnerTexts()).join(' | ') });
    test.fail(true, errorCase.knownBug);
  }
  await expect(form.alert.getByText(EN[errorCase.expected], { exact: true })).toBeVisible();
  for (const other of ALL_TEXTS.filter((key) => key !== errorCase.expected)) {
    await expect(form.textAnywhere(EN[other]), `ต้องไม่ขึ้นข้อความ ${other} ด้วย`).toHaveCount(0);
  }
}

/** เปิดหน้าสมัคร กรอกครบ แล้วกดสร้างบัญชี (คำขอสมัครต้องถูกดักไว้ก่อนเรียก) */
async function submitRegistration(page: Page): Promise<RegisterPage> {
  const register = new RegisterPage(page);
  await register.goto();
  await register.fillValidForm(FAKE_EMAIL);
  await expect(register.consent).toHaveAttribute('aria-checked', 'true');
  await register.submit.click();
  return register;
}

/** auth-error.test.cjs:34, :81 (captcha_failed 400) และ :83 (over_email_send_rate_limit 429) */
const SIGNUP_CAPTCHA = supabaseError(400, 'captcha_failed', 'captcha protection: request disallowed (timeout-or-duplicate)');
const EMAIL_RATE_LIMIT = supabaseError(429, 'over_email_send_rate_limit', 'email rate limit exceeded');

test.describe('sign-up', () => {
  const SUBMIT_CASES: ErrorCase[] = [
    { name: 'captcha fails', answer: SIGNUP_CAPTCHA, expected: 'registrationFailed', raw: ['captcha protection'] },
    { name: 'too many sign-ups', answer: EMAIL_RATE_LIMIT, expected: 'tooManyAttempts', raw: ['email rate limit exceeded'] },
    { name: 'Supabase is unreachable', answer: null, expected: 'networkError', raw: [RAW_FETCH_ERROR] },
  ];
  for (const errorCase of SUBMIT_CASES) {
    test(`Create account: ${errorCase.name} shows our own text`, async ({ page }) => {
      // ขั้นที่ 1: ดักคำขอสมัครของ Supabase (register.tsx:112 → AuthContext.tsx signUp) แล้วตอบปลอม
      const leaked = await blockOtherSupabaseAuth(page);
      const signup = await answerSupabase(page, 'signup', 'POST', errorCase.answer);
      // ขั้นที่ 2: กรอกฟอร์มด้วยค่าปลอมแล้วกดสร้างบัญชี
      const register = await submitRegistration(page);
      // ขั้นที่ 3: ยืนยันว่าคำตอบมาจากตัวดัก 1 ครั้ง แล้วตรวจหน้า (catch ที่ register.tsx:123-133)
      await expect(register.alert.first()).toBeVisible();
      expect(signup.hits, 'คำขอสมัครต้องผ่านตัวดัก 1 ครั้ง').toBe(1);
      await expectFormError(page, register, errorCase);
      await expect(register.codeInput, 'ไม่สำเร็จต้องยังอยู่ที่ฟอร์ม ไม่ไปขั้นใส่รหัส').toHaveCount(0);
      expect(leaked, 'ต้องไม่มีคำขออื่นของ Supabase Auth').toEqual([]);
    });
  }

  test('6-digit code: the profile sync failing after the code shows the generic text', async ({ page }) => {
    // ขั้นที่ 1: ตอบปลอมทุกคำขอของขั้นนี้
    const leaked = await blockOtherSupabaseAuth(page);
    //   สมัคร: ผู้ใช้ที่ต้องยืนยันอีเมล (ไม่มี session) หน้าจึงไปขั้นใส่รหัส (register.tsx:114-119)
    //   ยืนยันรหัส: session ปลอม / POST /auth/sync: 400 ข้อความ master_roles (เคส 14 ของหน้า login)
    //   ออกจากระบบ: sync ล้มแล้ว AuthContext เรียก signOut scope local ซึ่งส่ง logout ไป Supabase ตอบ 204 ไว้ไม่ให้ token ปลอมออกไป
    const signup = await answerSupabase(page, 'signup', 'POST', json(fakeUser()));
    const verify = await answerSupabase(page, 'verify', 'POST', json(fakeSession()));
    const logout = await answerSupabase(page, 'logout', 'POST', { status: 204, contentType: 'text/plain', body: '' });
    let keysDuringSync: string[] = [];
    const sync = await answerRequest(
      page,
      (url) => url.origin === webUiEnv.apiOrigin && url.pathname.endsWith('/auth/sync'),
      'POST',
      json({ statusCode: 400, message: 'master_roles.guest is missing — run npm run db:push and db:seed masters', error: 'Bad Request' }, 400),
      async () => {
        keysDuringSync = await supabaseSessionKeys(page);
      },
    );
    // ขั้นที่ 2: สมัคร แล้วใส่รหัส 6 หลัก (ค่าใดก็ได้ 6 ตัว คำตอบของการยืนยันถูกปลอมไว้แล้ว)
    const register = await submitRegistration(page);
    await expect(register.codeInput).toBeVisible();
    await register.codeInput.fill('123456');
    await register.verifyButton.click();
    // ขั้นที่ 3: ทุกคำขอผ่านตัวดัก 1 ครั้ง แล้วตรวจหน้า (catch ที่ register.tsx:152-153 ใช้ข้อความกลาง)
    await expect(register.alert.first()).toBeVisible();
    expect([signup.hits, verify.hits, sync.hits], 'สมัคร / ยืนยันรหัส / sync ต้องผ่านตัวดักอย่างละ 1 ครั้ง').toEqual([1, 1, 1]);
    expect(keysDuringSync, 'ตอน sync ต้องมี session ของ Supabase 1 key (ตัวคุมของการตรวจว่า key นี้ถูกล้าง)').toHaveLength(1);
    await expectFormError(page, register, { name: 'sync', answer: null, expected: 'errorGeneric', raw: ['master_roles', 'db:push'] });
    expect(logout.hits, 'sync ล้มแล้วต้องออกจาก Supabase (AuthContext.tsx verifySignupCode)').toBe(1);
    expect(await supabaseSessionKeys(page), 'ต้องไม่มี session ของ Supabase ค้าง').toEqual([]);
    expect(leaked, 'ต้องไม่มีคำขออื่นของ Supabase Auth').toEqual([]);
  });

  const RESEND_CASES: ErrorCase[] = [
    { name: 'captcha fails', answer: SIGNUP_CAPTCHA, expected: 'registrationFailed', raw: ['captcha protection'] },
    { name: 'too many codes', answer: EMAIL_RATE_LIMIT, expected: 'tooManyAttempts', raw: ['email rate limit exceeded'] },
  ];
  for (const errorCase of RESEND_CASES) {
    test(`Send a new code: ${errorCase.name} shows our own text`, async ({ page }) => {
      // ขั้นที่ 1: ใช้นาฬิกาที่เร่งได้ (เวลายังเดินตามปกติจนกว่าจะเร่ง) เพราะปุ่มส่งรหัสใหม่ต้องรอนับถอยหลัง 60 วินาที (register.tsx:76-79, :118)
      await page.clock.install();
      const leaked = await blockOtherSupabaseAuth(page);
      const signup = await answerSupabase(page, 'signup', 'POST', json(fakeUser()));
      const resend = await answerSupabase(page, 'resend', 'POST', errorCase.answer);
      // ขั้นที่ 2: สมัครจนถึงขั้นใส่รหัส เร่งนาฬิกาให้นับถอยหลังจบ แล้วกดส่งรหัสใหม่
      const register = await submitRegistration(page);
      await expect(register.codeInput).toBeVisible();
      //   ตัวนับเป็น setTimeout 1 วินาทีที่ตั้งใหม่ทุกครั้งที่ค่าเปลี่ยน fastForward ครั้งเดียวจึงลดได้แค่ 1 วินาที
      //   เดินทีละ 1 วินาที แล้วเว้นให้ React วาดหน้าใหม่ก่อนตรวจ จนปุ่มเปลี่ยนเป็น "ส่งรหัสใหม่" (60 รอบ)
      await expect
        .poll(
          async () => {
            await page.clock.fastForward(1_000);
            return register.resendButton.count();
          },
          { message: 'นับถอยหลัง 60 วินาทีต้องจบ แล้วปุ่มเปลี่ยนเป็นส่งรหัสใหม่', intervals: [50], timeout: 30_000 },
        )
        .toBe(1);
      await expect(register.resendButton).toBeEnabled();
      await register.resendButton.click();
      // ขั้นที่ 3: ยืนยันว่าคำตอบมาจากตัวดัก แล้วตรวจหน้า (catch ที่ register.tsx:174-176)
      await expect(register.alert.first()).toBeVisible();
      expect([signup.hits, resend.hits], 'สมัคร / ส่งรหัสใหม่ ต้องผ่านตัวดักอย่างละ 1 ครั้ง').toEqual([1, 1]);
      await expectFormError(page, register, errorCase);
      expect(leaked, 'ต้องไม่มีคำขออื่นของ Supabase Auth').toEqual([]);
    });
  }
});

test.describe('password reset', () => {
  const REQUEST_CASES: ErrorCase[] = [
    { name: 'captcha fails', answer: SIGNUP_CAPTCHA, expected: 'errorGeneric', raw: ['captcha protection'] },
    { name: 'too many requests', answer: EMAIL_RATE_LIMIT, expected: 'tooManyAttempts', raw: ['email rate limit exceeded'] },
    { name: 'Supabase is unreachable', answer: null, expected: 'networkError', raw: [RAW_FETCH_ERROR] },
  ];
  for (const errorCase of REQUEST_CASES) {
    test(`Send link: ${errorCase.name} shows our own text`, tagsOf(errorCase), async ({ page }) => {
      // ขั้นที่ 1: ดักคำขอส่งลิงก์ของ Supabase (resetPasswordForEmail → POST /auth/v1/recover) ไม่มีอีเมลถูกส่ง
      const leaked = await blockOtherSupabaseAuth(page);
      const recover = await answerSupabase(page, 'recover', 'POST', errorCase.answer);
      // ขั้นที่ 2: ใส่อีเมลปลอมแล้วกดส่งลิงก์
      const reset = new ResetPasswordPage(page);
      await reset.goto();
      await reset.email().fill(FAKE_EMAIL);
      await reset.sendButton().click();
      // ขั้นที่ 3: ยืนยันว่าคำตอบมาจากตัวดัก 1 ครั้ง แล้วตรวจหน้า (catch ที่ reset-password.tsx:95-97)
      await expect(reset.alert.first()).toBeVisible();
      expect(recover.hits, 'คำขอส่งลิงก์ต้องผ่านตัวดัก 1 ครั้ง').toBe(1);
      expect(leaked, 'ต้องไม่มีคำขออื่นของ Supabase Auth').toEqual([]);
      await expectFormError(page, reset, errorCase);
    });
  }

  // auth-error.test.cjs:35 (over_request_rate_limit 429) และ :84 (same_password 422)
  const SAVE_CASES: ErrorCase[] = [
    { name: 'too many attempts', answer: supabaseError(429, 'over_request_rate_limit', 'Request rate limit reached'), expected: 'tooManyAttempts', raw: ['Request rate limit reached'] },
    { name: 'Supabase is unreachable', answer: null, expected: 'networkError', raw: [RAW_FETCH_ERROR] },
    { name: 'the new password is the old one', answer: supabaseError(422, 'same_password', 'New password should be different from the old password.'), expected: 'errorGeneric', raw: ['New password should be different'] },
  ];
  for (const errorCase of SAVE_CASES) {
    test(`Set a new password: ${errorCase.name} shows our own text`, tagsOf(errorCase), async ({ page }) => {
      // ขั้นที่ 1: ลิงก์รีเซ็ตปลอม ตรวจลิงก์ (POST /auth/v1/verify) ตอบ session ปลอม แล้วการบันทึกรหัส (PUT /auth/v1/user) ตอบตามเคส
      //   reset-password.tsx:116-129 ตรวจลิงก์ตอนกดบันทึก ไม่ใช่ตอนเปิดหน้า
      const leaked = await blockOtherSupabaseAuth(page);
      const verify = await answerSupabase(page, 'verify', 'POST', json(fakeSession()));
      const user = await answerSupabase(page, 'user', 'PUT', errorCase.answer);
      // ขั้นที่ 2: เปิดลิงก์แบบในอีเมล ใส่รหัสใหม่ที่ผ่านกฎ แล้วกดบันทึก
      const reset = new ResetPasswordPage(page);
      await reset.goto('?token_hash=qa-fake-token-hash&type=recovery');
      await reset.password.fill('QaWebUi2026b');
      await reset.confirmPassword.fill('QaWebUi2026b');
      await reset.save.click();
      // ขั้นที่ 3: ยืนยันว่าคำขอผ่านตัวดักอย่างละ 1 ครั้ง แล้วตรวจหน้า (catch ที่ reset-password.tsx:133-137)
      //   ไม่ตรวจ session ของ Supabase: แอปตั้งใจเก็บ session ของลิงก์ไว้ให้กดบันทึกซ้ำได้ (reset-password.tsx:129)
      await expect(reset.alert.first()).toBeVisible();
      expect([verify.hits, user.hits], 'ตรวจลิงก์ / บันทึกรหัส ต้องผ่านตัวดักอย่างละ 1 ครั้ง').toEqual([1, 1]);
      expect(leaked, 'ต้องไม่มีคำขออื่นของ Supabase Auth').toEqual([]);
      await expectFormError(page, reset, errorCase);
    });
  }
});
