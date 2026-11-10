import type { Page, Route } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { LoginPage } from '../../src/web-ui/pages/login.page';
import { EN } from '../../src/web-ui/labels';
import { emailOf, passwordOf, PASSWORD_VARIABLES, webUiEnv } from '../../src/web-ui/web-ui-env';
import { hasStoredSession, readAuthEvent, supabaseSessionKeys } from '../../src/web-ui/support/idle';

/**
 * ข้อความ error ของหน้า login (ตอบ QA 9 พ.ย. 2026: docs/qa-fixes/2026-11-09-login-error-cases-reply.md ตาราง "ข้อความที่หน้า login แสดงตอนนี้")
 * โค้ดที่เทส: apps/consumer-app/app/login.tsx:126-133 เลือกข้อความ 1 ใน 5 แบบตาม signInErrorKind (lib/auth/auth-error.ts:40) ที่ UXUI/develop fe5d348
 * เลขเคสตรงกับ CASES ใน apps/consumer-app/lib/auth/auth-error.test.cjs (เทสของ dev ที่เรียก signInErrorKind ตรง ๆ)
 *   เทสชุดนี้ตรวจต่อจากเทสของ dev ว่า error จริงที่ auth-js (2.116.0) กับ lib/api.ts สร้างจากคำตอบ HTTP ถูกแยกเป็นแบบที่ถูก และหน้าจอแสดงข้อความนั้น
 *
 * ทุกเคสตรวจ 3 อย่าง: ข้อความบนหน้าตรงตามตาราง / ไม่มีข้อความดิบของ Supabase หรือ API บนหน้า / ยังอยู่ที่ /login และไม่มี session ค้าง
 * รันเป็นภาษาไทยด้วย npm run test:web-ui:th (labels.th.ts) ข้อความดิบที่ตรวจเป็นภาษาอังกฤษทั้ง 2 ภาษา
 *
 * กลุ่ม Supabase: ตอบปลอมที่ POST /auth/v1/token?grant_type=password ด้วย page.route คำขอไม่ออกจากเบราว์เซอร์ อีเมลและรหัสผ่านเป็นค่าปลอม
 * กลุ่ม API: ล็อกอิน Supabase จริงด้วย qa-agent (ต้องตั้ง E2E_QA_AGENT_PASSWORD) แล้วตอบปลอมที่ POST /auth/sync
 *   ไม่มีคำขอถึง API แต่ Supabase Auth ของทีมได้ session ใหม่ 1 ครั้งต่อข้อ แล้วถูกปิดด้วย POST /auth/v1/logout?scope=local
 *   (AuthContext.tsx:268-275 sync ล้มแล้วเรียก signOut scope local ซึ่ง auth-js ส่งคำขอ logout จริง guard.ts:89 ปล่อยผ่านเพราะไม่ใช่ออกจากทุกอุปกรณ์)
 * สิ่งที่ต้องเปิดก่อนรัน: เว็บที่ 8081 และ API ตามโหมดที่ใช้ (global-setup ตรวจ API ก่อนเริ่ม แม้ข้อในไฟล์นี้จะไม่เรียก API เลย)
 */

/** ข้อความที่ Chromium ใส่ใน TypeError เมื่อ fetch ล้มเพราะเครือข่าย (กลายเป็นข้อความของ error ทั้งฝั่ง auth-js และ lib/api.ts:143) */
const RAW_FETCH_ERROR = 'Failed to fetch';

/** คำขอข้ามโดเมน (เว็บ 8081 ไป Supabase หรือ API 4000): ไม่มี header นี้ Chromium จะตัดคำตอบตามกติกา CORS แล้วหน้าจะได้ error เครือข่ายแทน */
const CORS = { 'access-control-allow-origin': '*' };

type Expected = 'invalidCredentials' | 'networkError' | 'emailNotConfirmed' | 'tooManyAttempts' | 'errorGeneric';

/** ข้อความของหน้าแต่ละแบบที่ต้องไม่ขึ้นพร้อมกัน (ป้องกันกรณีขึ้นข้อความรหัสผิดเพิ่มอีกบรรทัด แบบบั๊ก 9 พ.ย.) */
const ALL_TEXTS: Expected[] = ['invalidCredentials', 'networkError', 'emailNotConfirmed', 'tooManyAttempts', 'errorGeneric'];

interface ErrorCase {
  name: string;
  /** null = ตัดการเชื่อมต่อ (route.abort) */
  answer: { status: number; contentType: string; body: string } | null;
  expected: Expected;
  /** ข้อความดิบในคำตอบที่ต้องไม่ขึ้นบนหน้า (ใส่เฉพาะคำที่ไปอยู่ในข้อความของ error ได้จริง) */
  raw: string[];
  /** จดว่าแถบ "session หมดอายุ" ขึ้นไหม (เคส 13: Jom ฝาก QA ตรวจข้อ 3) */
  noteExpired?: boolean;
}

/** คำตอบ error ของ Supabase Auth: auth-js อ่าน code เมื่อมี header รุ่น API 2024-01-01 ขึ้นไป ไม่งั้นอ่าน error_code (ใส่ทั้ง 2 ให้ได้ผลเดียวกันทุกรุ่น) */
function supabaseError(status: number, code: string, msg: string): ErrorCase['answer'] {
  return { status, contentType: 'application/json', body: JSON.stringify({ code, error_code: code, msg }) };
}

/** คำตอบ error ของ API (รูปแบบของ NestJS: statusCode, message, error) lib/api.ts:117-123 ใช้แค่ message เป็นข้อความของ error */
function apiError(status: number, message: string, error: string): ErrorCase['answer'] {
  return { status, contentType: 'application/json', body: JSON.stringify({ statusCode: status, message, error }) };
}

const SUPABASE_CASES: ErrorCase[] = [
  { name: '3 wrong email or password', answer: supabaseError(400, 'invalid_credentials', 'Invalid login credentials'), expected: 'invalidCredentials', raw: ['Invalid login credentials'] },
  { name: '4 email not confirmed', answer: supabaseError(400, 'email_not_confirmed', 'Email not confirmed'), expected: 'emailNotConfirmed', raw: ['Email not confirmed'] },
  { name: '5 captcha failed', answer: supabaseError(400, 'captcha_failed', 'captcha protection: request disallowed (timeout-or-duplicate)'), expected: 'errorGeneric', raw: ['captcha protection'] },
  { name: '6 too many attempts', answer: supabaseError(429, 'over_request_rate_limit', 'Request rate limit reached'), expected: 'tooManyAttempts', raw: ['Request rate limit reached'] },
  { name: '7 banned', answer: supabaseError(400, 'user_banned', 'User is banned'), expected: 'errorGeneric', raw: ['User is banned'] },
  { name: '8 bad email format', answer: supabaseError(400, 'validation_failed', 'Unable to validate email address: invalid format'), expected: 'errorGeneric', raw: ['Unable to validate email address'] },
  { name: '9 Supabase unreachable', answer: null, expected: 'networkError', raw: [RAW_FETCH_ERROR] },
  // auth-js นับ 502, 503, 504 เป็น AuthRetryableFetchError โดยไม่อ่าน body จึงไม่มีข้อความดิบให้ตรวจ (ข้อความหลักยังตรวจอยู่)
  { name: '9 Supabase 503', answer: { status: 503, contentType: 'text/plain', body: 'Service Unavailable' }, expected: 'networkError', raw: [] },
];

const SYNC_CASES: ErrorCase[] = [
  { name: '11 API not answering', answer: null, expected: 'networkError', raw: [RAW_FETCH_ERROR, 'Network error'] },
  {
    // หน้า error ของ proxy (แบบที่ Railway แสดงเมื่อแอปไม่ตอบ) lib/api.ts:146-153 อ่านไม่ได้เป็น JSON จึงเก็บทั้งหน้าเป็นข้อความของ error
    name: '12 proxy 502 page',
    answer: { status: 502, contentType: 'text/html', body: '<!DOCTYPE html><html><head><title>Application failed to respond</title></head><body><h1>Application failed to respond</h1></body></html>' },
    expected: 'networkError',
    raw: ['Application failed to respond', 'DOCTYPE'],
  },
  // 401 ของ sync ไม่ขอ token ใหม่ และไม่เรียก onSessionExpired: finishSupabaseSession ส่ง token เอง (AuthContext.tsx:237)
  //   authHeader จึงคืน supabase: false (lib/api.ts:57-58) เงื่อนไขที่ :160 เป็นเท็จ ได้ ApiError(401) ที่ไม่มี code แล้วเป็นข้อความกลาง
  { name: '13 API refuses the token', answer: apiError(401, 'Invalid or expired token', 'Unauthorized'), expected: 'errorGeneric', raw: ['Invalid or expired token'], noteExpired: true },
  { name: '14 seed data missing', answer: apiError(400, 'master_roles.guest is missing — run npm run db:push and db:seed masters', 'Bad Request'), expected: 'errorGeneric', raw: ['master_roles', 'db:push'] },
  { name: '15 user missing after sync', answer: apiError(404, 'User not found after sync', 'Not Found'), expected: 'errorGeneric', raw: ['User not found'] },
];

/**
 * ตอบคำขอที่ดักไว้ตามเคส แล้วนับจำนวนครั้ง (ยืนยันว่าตัวดักจับคำขอได้จริง ไม่ใช่คำขอหลุดไปที่ระบบจริง)
 * beforeAnswer ทำงานก่อนตอบ เช่น นับ key session ของ Supabase ตอนที่ auth-js บันทึก session แล้ว
 */
async function answer(
  page: Page,
  match: (url: URL) => boolean,
  method: string,
  errorCase: ErrorCase,
  beforeAnswer?: () => Promise<void>,
): Promise<{ hits: number }> {
  const counter = { hits: 0 };
  await page.route(match, async (route: Route) => {
    if (route.request().method() !== method) return route.fallback();
    counter.hits += 1;
    if (beforeAnswer) await beforeAnswer();
    if (errorCase.answer === null) return route.abort('internetdisconnected');
    return route.fulfill({ ...errorCase.answer, headers: CORS });
  });
  return counter;
}

/** ตรวจหน้า login หลังล็อกอินไม่ผ่าน: ข้อความที่ถูก 1 ข้อความ ไม่มีข้อความแบบอื่น ไม่มีข้อความดิบ และยังอยู่ที่ /login โดยไม่มี session */
async function expectLoginError(page: Page, login: LoginPage, errorCase: ErrorCase): Promise<void> {
  await expect(login.alert.getByText(EN[errorCase.expected], { exact: true })).toBeVisible();
  for (const other of ALL_TEXTS.filter((key) => key !== errorCase.expected)) {
    await expect(login.textAnywhere(EN[other]), `ต้องไม่ขึ้นข้อความ ${other} ด้วย`).toHaveCount(0);
  }
  for (const raw of errorCase.raw) {
    await expect(login.body, `ข้อความดิบ "${raw}" ต้องไม่ขึ้นบนหน้า`).not.toContainText(raw);
  }
  await expect(page).toHaveURL((url) => url.pathname === '/login');
  expect(await hasStoredSession(page), 'ล็อกอินไม่ผ่านต้องไม่มี session ของแอปเก็บไว้').toBe(false);
  // session ของ Supabase เอง ต้องถูกล้างด้วย (AuthContext.tsx:273) กลุ่ม API ตรวจก่อนแล้วว่า key แบบนี้มีอยู่จริงตอน sync
  expect(await supabaseSessionKeys(page), 'ล็อกอินไม่ผ่านต้องไม่มี session ของ Supabase ค้าง').toEqual([]);
}

/** เปิดหน้า login แล้วใส่อีเมล (โหมดนักพัฒนาเติมบัญชีนักพัฒนาไว้ในช่องให้เอง login.tsx:79-84 จึงล้างก่อน) */
async function openLogin(page: Page, email: string): Promise<LoginPage> {
  const login = new LoginPage(page);
  await login.goto();
  await login.email.fill('');
  await login.email.fill(email);
  return login;
}

test.describe('Supabase refuses the sign-in', () => {
  for (const errorCase of SUPABASE_CASES) {
    test(`case ${errorCase.name} shows our own text`, async ({ page }) => {
      // ขั้นที่ 1: ดักคำขอล็อกอินของ Supabase ก่อนออกจากเบราว์เซอร์ (page.route ทำงานก่อน route ของตัวกันใน guard.ts)
      const token = await answer(
        page,
        (url) => url.pathname.endsWith('/auth/v1/token') && url.searchParams.get('grant_type') === 'password',
        'POST',
        errorCase,
      );
      // ขั้นที่ 2: ล็อกอินด้วยอีเมลและรหัสผ่านปลอม (คำตอบถูกปลอมไว้แล้ว ค่าทั้ง 2 ไม่ออกจากเบราว์เซอร์)
      const login = await openLogin(page, 'qa-web-ui-login-errors@nestyk.test');
      await login.password.fill('QaWebUi2026a');
      await login.submit.click();
      // ขั้นที่ 3: รอข้อความ ยืนยันว่าคำตอบมาจากตัวดักจริง 1 ครั้ง แล้วตรวจหน้า
      await expect(login.alert.first()).toBeVisible();
      expect(token.hits, 'คำขอล็อกอินต้องผ่านตัวดัก 1 ครั้ง').toBe(1);
      await expectLoginError(page, login, errorCase);
    });
  }
});

test.describe('Supabase accepts the password but POST /auth/sync fails', () => {
  for (const errorCase of SYNC_CASES) {
    test(`case ${errorCase.name} shows our own text`, async ({ page }, testInfo) => {
      const password = passwordOf('agent');
      test.skip(password === null, `ไม่ได้ตั้ง ${PASSWORD_VARIABLES.agent} จึงล็อกอินเป็น qa-agent ไม่ได้`);
      // ขั้นที่ 1: ดัก POST /auth/sync ของ API ที่เว็บเรียก (webUiEnv.apiOrigin) คำขอไม่ถึง API
      //   ตอนคำขอ sync มาถึง auth-js บันทึก session ของ Supabase ไว้แล้ว จึงนับ key ไว้เป็นตัวคุมของการตรวจ "ไม่มี session ค้าง" ในขั้นที่ 3
      let keysDuringSync: string[] = [];
      const sync = await answer(
        page,
        (url) => url.origin === webUiEnv.apiOrigin && url.pathname.endsWith('/auth/sync'),
        'POST',
        errorCase,
        async () => {
          keysDuringSync = await supabaseSessionKeys(page);
        },
      );
      // ขั้นที่ 2: ล็อกอิน Supabase จริงด้วย qa-agent ใส่รหัสผ่านโดยไม่ให้ค่าอยู่ในรายงาน
      // ต่อเวลาของข้อก่อน แบบเดียวกับ loginAs (web-ui.fixture.ts:112-115): ให้ waitFor หมดเวลาก่อนเวลาของทั้งข้อเสมอ finally จึงได้ล้างช่องรหัสผ่าน
      // รอข้อความด้วย waitFor แล้วล้างช่องรหัสผ่านก่อนใช้ expect: ถ้า expect ไม่ผ่านขณะช่องยังมีรหัสผ่าน
      // Playwright จะเก็บโครงหน้าจอ (error-context.md) ที่มีค่าในช่องนั้น
      if (testInfo.timeout > 0) test.setTimeout(testInfo.timeout + 30_000 + 30_000);
      const login = await openLogin(page, emailOf('agent'));
      await login.setPasswordHidden(password as string);
      try {
        await login.submit.click({ timeout: 10_000 });
        await login.alert.first().waitFor({ state: 'visible', timeout: 30_000 });
      } finally {
        await login.setPasswordHidden('').catch(() => undefined);
      }
      // ขั้นที่ 3: ยืนยันว่า sync ผ่านตัวดัก 1 ครั้ง (ถ้าไม่ถึง แปลว่า Supabase จริงไม่ให้ล็อกอิน ข้อความที่ตรวจต่อจะไม่ใช่เรื่องของเคสนี้)
      expect(sync.hits, 'คำขอ POST /auth/sync ต้องผ่านตัวดัก 1 ครั้ง').toBe(1);
      expect(keysDuringSync, 'ตอน sync ต้องมี session ของ Supabase 1 key (ตัวคุมของการตรวจว่า key นี้ถูกล้าง)').toHaveLength(1);
      if (errorCase.noteExpired) {
        // จดไว้เท่านั้น ไม่ทำให้เทสแดง: login.tsx:92 ให้ข้อความ error ทับแถบหมดอายุเสมอ ค่า "ไม่ขึ้น" ตอนนี้จึงยังไม่บอกว่าแอปตั้งค่าหมดอายุหรือเปล่า
        //   authEvent บอกเพิ่มว่าแอปบันทึกว่า session หมดอายุไหม (AuthContext.tsx:136 markAuthEvent('expired'))
        testInfo.annotations.push({ type: 'expired-notice', description: (await login.expiredNotice.count()) > 0 ? 'ขึ้น' : 'ไม่ขึ้น' });
        testInfo.annotations.push({ type: 'auth-event', description: await readAuthEvent(page) });
      }
      await expectLoginError(page, login, errorCase);
    });
  }
});
