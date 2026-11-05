import type { Page } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { LoginPage } from '../../src/web-ui/pages/login.page';
import { LegalPage, notFoundMessage } from '../../src/web-ui/pages/public.page';
import { EN } from '../../src/web-ui/labels';
import { webUiEnv } from '../../src/web-ui/web-ui-env';

/**
 * URL และการนำทางของเว็บ consumer-app (ผลเทสด้วยมือ 4 พ.ย. 2026 หัวข้อ "URL และการนำทาง" และบั๊กข้อ 9)
 * กติกาของ URL อยู่ใน apps/consumer-app/lib/app-routes.ts (qa/e2e efab8d0)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web และเรียก API ของ staging, ตั้ง E2E_QA_TENANT_PASSWORD กับ E2E_QA_AGENT_PASSWORD
 * ข้อที่ล็อกอินเรียก POST /auth/sync ที่ staging (ซิงก์บัญชี qa-* ที่มีอยู่แล้ว) นอกนั้นอ่านอย่างเดียว
 */

/** วันนี้ตามนาฬิกาของเบราว์เซอร์ (timezoneId Asia/Bangkok ใน playwright.web-ui.config.ts) รูปแบบ YYYY-MM-DD แบบเดียวกับหน้า calendar */
async function browserToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
}

test.describe('next= after signing in', () => {
  test('keeps the page in next=', async ({ page, loginAs }) => {
    await loginAs('tenant', { next: '/tenant/bills' });
    await expect(page).toHaveURL((url) => url.pathname === '/tenant/bills');
  });

  test('keeps the query of the page in next=', async ({ page, loginAs }) => {
    // ค่า date ถูกเก็บเฉพาะหน้า calendar (app-routes.ts:274-275)
    await loginAs('agent', { next: '/agent/calendar?date=2026-11-20' });
    await expect(page).toHaveURL((url) => url.pathname === '/agent/calendar' && url.searchParams.get('date') === '2026-11-20');
  });

  // safeNextPath (app-routes.ts:69-78) ทิ้งค่าที่ไม่ขึ้นต้นด้วย / ขึ้นต้น // มี \ หรือมี : ในส่วน path แล้วพาไปหน้าแรกของบทบาท
  const unsafe = ['//evil.example', 'https://evil.example', '/\\evil.example', '/javascript:alert(1)'];
  for (const next of unsafe) {
    test(`drops the unsafe next=${next}`, async ({ page, loginAs }) => {
      await loginAs('agent', { next });
      await expect(page).toHaveURL((url) => url.origin === webUiEnv.webUrl && url.pathname === '/agent');
    });
  }

  test('drops a path under /search that the app does not know', async ({ page, loginAs }) => {
    // /search//evil.example ผ่าน safeNextPath (ไม่ขึ้นต้น //) แต่ไม่ตรงหน้าใดของผู้เยี่ยมชม routeToState จึงใช้หน้าแรก "/" (app-routes.ts:294 ?? pages[0])
    await loginAs('agent', { next: '/search//evil.example' });
    await expect(page).toHaveURL((url) => url.origin === webUiEnv.webUrl && url.pathname === '/');
  });
});

test.describe('paths', () => {
  for (const path of ['/foo', '/agentx/leads']) {
    test(`${path} shows the not-found page`, async ({ page }) => {
      // segment แรกที่ไม่รู้จัก: WebAppHost คืน null และ CatchAllRoute แสดง <Unmatched /> ของ expo-router (CatchAllRoute.web.tsx:7)
      await page.goto(path);
      await expect(notFoundMessage(page)).toBeVisible();
    });
  }

  test('drops tracking query parameters', async ({ page }) => {
    // เก็บเฉพาะ date ของ calendar และ history ของบิลผู้เช่า (app-routes.ts:274-275, 297-298) ที่เหลือหายเมื่อ replace (web-routes.web.ts:109)
    await page.goto('/search/?utm_source=x');
    await expect(page).toHaveURL((url) => url.pathname === '/search' && url.search === '');
  });

  test('replaces an impossible calendar date with today', async ({ page, loginAs }) => {
    // isValidDateKey (app-routes.ts:204-209) ทิ้ง 2026-02-30 หน้า calendar เริ่มที่วันนี้ (index.tsx:189-194)
    await loginAs('agent');
    await page.goto('/agent/calendar?date=2026-02-30');
    const today = await browserToday(page);
    await expect(page).toHaveURL((url) => url.pathname === '/agent/calendar' && url.searchParams.get('date') === today);
  });

  test('/AGENT/Nope/1 is read without case and sends a signed-out visitor to log in', async ({ page }) => {
    // parseAppPath ทำ path เป็นตัวเล็ก (app-routes.ts:38) path ใต้บทบาทที่ไม่รู้จักเปิดหน้าแรกของบทบาท แล้วพาไปล็อกอิน (index.tsx:640-643)
    await page.goto('/AGENT/Nope/1');
    await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('next') === '/agent');
  });

  test('/Login opens the login page', { tag: '@known-bug' }, async ({ page }) => {
    // ขั้นที่ 1: เปิด /Login แล้วรอให้หน้าแสดงอย่างใดอย่างหนึ่ง: หน้าไม่พบ (ตอนนี้) หรือหน้า login (เมื่อแก้แล้ว)
    await page.goto('/Login');
    const login = new LoginPage(page);
    await expect(notFoundMessage(page).or(login.submit).first()).toBeVisible();
    // ขั้นที่ 2: ต้องเป็นหน้า login
    test.fail(true, 'บั๊กข้อ 9: /Login ขึ้นหน้า Unmatched Route ของ expo-router (ไฟล์ route /login ตรงตัวพิมพ์) แต่ /AGENT/... ใช้ได้');
    await expect(login.submit).toBeVisible({ timeout: 3_000 });
  });

  test('/Privacy opens the privacy policy', { tag: '@known-bug' }, async ({ page }) => {
    // ขั้นที่ 1: เปิด /Privacy แล้วรอให้หน้าแสดงอย่างใดอย่างหนึ่ง
    await page.goto('/Privacy');
    const legal = new LegalPage(page, 'privacy');
    await expect(notFoundMessage(page).or(legal.root).first()).toBeVisible();
    // ขั้นที่ 2: ต้องเป็นหน้านโยบายความเป็นส่วนตัว
    test.fail(true, 'บั๊กข้อ 9: /Privacy ขึ้นหน้า Unmatched Route ของ expo-router');
    await expect(legal.root).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('history', () => {
  test('Back and Forward walk through Dashboard, Leads and Calendar', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินเป็น agent แล้วกดเมนูข้าง Leads กับ Calendar
    await loginAs('agent');
    const shell = new AgentShell(page);
    await expect(page).toHaveURL((url) => url.pathname === '/agent');
    await shell.navItem(EN.navLeads).click();
    await expect(page).toHaveURL((url) => url.pathname === '/agent/leads');
    await shell.navItem(EN.navCalendar).click();
    await expect(page).toHaveURL((url) => url.pathname === '/agent/calendar');

    // ขั้นที่ 2: Back 2 ครั้ง แล้ว Forward 2 ครั้ง
    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === '/agent/leads');
    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === '/agent');
    await page.goForward();
    await expect(page).toHaveURL((url) => url.pathname === '/agent/leads');
    await page.goForward();
    await expect(page).toHaveURL((url) => url.pathname === '/agent/calendar');
  });

  test('Back after signing out does not show the signed-in page', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินแล้วออกจากระบบ หลังออกไปหน้าแรกของผู้เยี่ยมชม (AFTER_SIGN_OUT_PATH index.tsx:171)
    await loginAs('agent');
    const shell = new AgentShell(page);
    await expect(shell.createMenu).toBeVisible();
    await shell.signOut();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    // ขั้นที่ 2: กด Back ต้องไปหน้า login (index.tsx:640-643 พาหน้าที่ต้องล็อกอินไป /login?next=) ไม่เห็นหน้าเดิม
    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === '/login');
    await expect(shell.createMenu).toHaveCount(0);
  });

  test('menu items marked Coming soon do nothing', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินเป็น agent เมนูข้างมีอย่างน้อย Commission กับ Team ที่ยังไม่เปิดใช้ (AgentWorkspace.web.tsx:663, 668)
    await loginAs('agent');
    const shell = new AgentShell(page);
    await expect(shell.createMenu).toBeVisible();
    const items = await shell.comingSoonItems.all();
    expect(items.length).toBeGreaterThanOrEqual(2);
    // ขั้นที่ 2: ทุกรายการกดไม่ได้ และกดแล้วหน้าไม่เปลี่ยน
    // แอปเปลี่ยน URL ใน effect หลังวาดหน้า (lib/web-routes.web.ts:114-132) จึงเฝ้า URL ไว้ช่วงหนึ่งหลังคลิก ไม่ตรวจทันที
    const before = new URL(page.url()).pathname;
    for (const item of items) {
      await expect(item).toBeDisabled();
      await item.click({ force: true });
    }
    const navigated = await page.waitForURL((url) => url.pathname !== before, { timeout: 3_000 }).then(
      () => true,
      () => false,
    );
    expect(navigated, `หน้าเปลี่ยนไป ${new URL(page.url()).pathname}`).toBe(false);
  });
});
