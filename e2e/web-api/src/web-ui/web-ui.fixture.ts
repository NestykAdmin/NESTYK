/// <reference lib="dom" />  // โค้ดใน addInitScript ทำงานในเบราว์เซอร์ (tsconfig ของชุดนี้ใช้ lib ES2022 อย่างเดียว)
import { test as base, expect, type Page } from '@playwright/test';
import { NEVER_ALLOWED, RequestGuard, type BlockedRequest } from './guard';
import { UI_LOCALE } from './labels';
import { LoginPage } from './pages/login.page';
import { emailOf, passwordOf, PASSWORD_VARIABLES, type WebUiRole } from './web-ui-env';

/** คีย์ภาษาที่แอปจำไว้ (apps/consumer-app/lib/locale-storage.ts:4) */
export const LOCALE_KEY = '@nestyk/preferred_locale';

/** เวลาที่ตัวช่วยล็อกอินรอให้เว็บพาออกจากหน้า login */
const LOGIN_WAIT_MS = 30_000;

interface WebUiFixtures {
  /**
   * ตัวกันคำขอ (src/web-ui/guard.ts) ติดตั้งกับ context ของทุกเทสโดยอัตโนมัติ ก่อนเปิดหน้าใด ๆ
   * หลังเทสจบ ถ้ามีคำขอที่ห้ามเกิดเลย (ดู NEVER_ALLOWED) เทสข้อนั้นไม่ผ่าน และถูกตรวจซ้ำตอนปิด worker
   * เทสขอใช้ guard ได้เพื่ออ่านจำนวนคำขอที่ถูกตัด เช่น guard.roleGrants('agent')
   */
  guard: RequestGuard;
  /**
   * ล็อกอินผ่านหน้า /login ด้วยบัญชี QA ของบทบาทที่ระบุ แล้วรอจนเว็บพาออกจากหน้า login
   * ถ้าไม่ได้ตั้งรหัสผ่านของบัญชีนั้น เทสข้อนั้นข้ามพร้อมเหตุผล
   * next: ค่า next ของหน้า login (ไม่ต้อง encode เอง)  page: แท็บที่จะล็อกอิน (ค่าเริ่มต้นคือ page ของเทส)
   */
  loginAs: (role: WebUiRole, options?: { next?: string; page?: Page }) => Promise<void>;
}

interface WebUiWorkerFixtures {
  /**
   * คำขอต้องห้ามของทุกเทสใน worker นี้ ตรวจตอนปิด worker
   * เหตุผล: ข้อ known-bug ใช้ test.fail ซึ่งกลับผลของความล้มทุกแบบที่เกิดหลังบรรทัดนั้น รวมถึงการตรวจหลังจบเทสใน fixture guard
   * ถ้ามีคำขอต้องห้ามในข้อ known-bug ข้อนั้นจะยังเขียว การตรวจตอนปิด worker ไม่ถูกกลับผล จึงยังแดงให้เห็น
   */
  forbiddenLog: { title: string; blocked: BlockedRequest[] }[];
}

export const test = base.extend<WebUiFixtures, WebUiWorkerFixtures>({
  forbiddenLog: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const log: { title: string; blocked: BlockedRequest[] }[] = [];
      await use(log);
      expect(log, 'มีคำขอต้องห้ามในเทส UI (ถูกตัดก่อนออกจากเบราว์เซอร์แล้ว) ดูชื่อเทสและปลายทางในรายการนี้').toEqual([]);
    },
    { scope: 'worker' },
  ],

  guard: [
    async ({ context, forbiddenLog }, use, testInfo) => {
      const guard = new RequestGuard();
      await guard.install(context);
      // เปิดเว็บเป็นภาษาของ UI_LOCALE (labels.ts ค่าเริ่มต้น en) ถ้ายังไม่ได้เลือกภาษาในแท็บนี้ (ถ้าเทสเลือกภาษาเอง การโหลดหน้าใหม่ไม่ทับค่าที่เลือก)
      await context.addInitScript(({ key, locale }) => {
        try {
          if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, locale);
        } catch {
          // storage ถูกปิด: แอปใช้ภาษาของเบราว์เซอร์ (ค่าตั้ง locale en-US ใน playwright.web-ui.config.ts)
        }
      }, { key: LOCALE_KEY, locale: UI_LOCALE });
      await use(guard);
      const forbidden = guard.blocked.filter((entry) => NEVER_ALLOWED.includes(entry.kind));
      if (forbidden.length > 0) forbiddenLog.push({ title: testInfo.titlePath.join(' › '), blocked: forbidden });
      expect(
        forbidden,
        'มีคำขอที่ห้ามเกิดในเทส UI (ถูกตัดก่อนออกจากเบราว์เซอร์แล้ว) ถ้าเป็น foreign-api แปลว่าเว็บชี้ไป API อื่นที่ไม่ใช่ E2E_WEB_API_ORIGIN ให้หยุดรันและตรวจ EXPO_PUBLIC_API_URL',
      ).toEqual([]);
    },
    { auto: true },
  ],

  loginAs: async ({ page: defaultPage, guard }, use) => {
    void guard; // ให้ตัวกันติดตั้งก่อนล็อกอินเสมอ
    await use(async (role, options = {}) => {
      const password = passwordOf(role);
      test.skip(password === null, `ไม่ได้ตั้ง ${PASSWORD_VARIABLES[role]} จึงล็อกอินเป็น qa-${role} ไม่ได้`);
      const page = options.page ?? defaultPage;
      const login = new LoginPage(page);

      // ขั้นที่ 1: เปิดหน้า login แล้วใส่อีเมล
      // โหมดนักพัฒนาเติมบัญชีนักพัฒนาไว้ในช่องให้เอง (apps/consumer-app/app/login.tsx:78-83) จึงล้างก่อนพิมพ์
      await login.goto(options.next);
      await login.email.fill('');
      await login.email.fill(emailOf(role));

      // ขั้นที่ 2: ใส่รหัสผ่านโดยไม่ให้ค่าอยู่ในรายงาน (support/inputs.ts)
      // ต่อเวลาของข้อนี้ก่อน ให้การรอในขั้นที่ 3 หมดเวลาก่อนเวลาของทั้งข้อเสมอ เพื่อให้ catch ได้ล้างช่องรหัสผ่าน
      // ถ้าเวลาของทั้งข้อหมดก่อน Playwright จะเก็บ error-context.md ขณะช่องยังมีรหัสผ่าน
      // timeout 0 (เช่น --debug หรือ --timeout=0) คือไม่จำกัดเวลา ไม่ต้องต่อ (ถ้าต่อจะกลายเป็นจำกัดเวลา: ข้อสังเกตของ test-reviewer รอบ 2)
      if (test.info().timeout > 0) test.setTimeout(test.info().timeout + LOGIN_WAIT_MS + 30_000);
      await login.setPasswordHidden(password as string);

      // ขั้นที่ 3: กดเข้าสู่ระบบ แล้วรอให้เว็บพาออกจาก /login (login.tsx:99-104)
      // ใช้ waitForURL ไม่ใช้ expect: ถ้า expect ไม่ผ่าน Playwright เก็บภาพโครงหน้าจอ (error-context.md) ทันที ซึ่งมีค่าในช่องรหัสผ่าน
      // ส่วนความผิดพลาดแบบอื่นเก็บตอนจบเทส หลังบรรทัดล้างช่องด้านล่าง (ลองในห้องทดลอง 4 พ.ย. 2026)
      try {
        await login.submit.click({ timeout: 10_000 });
        await page.waitForURL((url) => url.pathname !== '/login', { timeout: LOGIN_WAIT_MS });
      } catch (error) {
        await login.setPasswordHidden('').catch(() => undefined);
        const alert = await login.alert.allInnerTexts().catch(() => []);
        throw new Error(
          `ล็อกอินเป็น qa-${role} ไม่สำเร็จภายใน ${LOGIN_WAIT_MS / 1000} วินาที ข้อความบนหน้า: ${JSON.stringify(alert)}\n` +
            'ถ้าขึ้นว่าให้ยืนยันว่าไม่ใช่บอท แปลว่า build ตั้ง EXPO_PUBLIC_HCAPTCHA_SITE_KEY ไว้ ชุดเทสนี้ใช้ไม่ได้กับ build นั้น',
          { cause: error },
        );
      }
    });
  },
});

export { expect };
