/// <reference lib="dom" />  // โค้ดใน evaluate และ addInitScript ทำงานในเบราว์เซอร์ (tsconfig ของชุดนี้ใช้ lib ES2022 อย่างเดียว)
import type { Locator, Page } from '@playwright/test';
import { test, expect, LOCALE_KEY } from '../../src/web-ui/web-ui.fixture';
import { LEGAL, UI_LOCALE } from '../../src/web-ui/labels';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { LegalPage } from '../../src/web-ui/pages/public.page';
import { RegisterPage } from '../../src/web-ui/pages/register.page';
import {
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_VERSION,
  COOKIE_TABLE_ROWS,
  CookieNotice,
  PREFERENCE_STORAGE_KEYS,
  PRIVACY_VERSION,
  TERMS_VERSION,
  readStorage,
  readStoredConsent,
} from '../../src/web-ui/pages/cookie-notice.page';

/**
 * แถบขอความยินยอมคุกกี้ของเว็บ consumer-app (PDPA: pre/dev/review cba5045 ข้อความส่ง QA ของ Mos 9 พ.ย. 2026)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web จาก pre/dev/review ที่รวม cba5045 แล้ว ทุกข้อไม่ล็อกอิน ยกเว้นกลุ่ม 'agent workspace theme' ท้ายไฟล์
 *   กลุ่มนั้นต้องใช้ API (staging หรือ API บนเครื่องตาม README "ใช้ API บนเครื่อง" รวม EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT=false) และ E2E_QA_AGENT_PASSWORD
 *   ถ้าไม่ได้ตั้งรหัส ข้อนั้นข้ามเอง (loginAs) การล็อกอินเรียก POST /auth/sync ของ qa-agent ที่มีอยู่แล้ว และสร้าง session ใหม่ใน Supabase ไม่บันทึกอย่างอื่น
 * ไม่สร้างบัญชี: ข้อสมัครดักคำขอ Supabase /auth/v1/signup ด้วย page.route แล้วตอบปลอม คำขอไม่ออกจากเบราว์เซอร์
 *
 * ค่าที่คาดมาจากโค้ด (ดูที่มาใน src/web-ui/pages/cookie-notice.page.ts)
 *   ที่เก็บ: localStorage 'nestyk.web.cookieConsent' ค่า JSON {version, at, preferences, maps} (cookieConsent.ts:18, :57-63)
 *   ก่อนเลือก ทุกหมวดปิด (opt-in: cookieConsentAllows :103-106)
 *
 * fixture ใส่ค่าความยินยอมไว้ให้ทุกเทส (web-ui.fixture.ts cookieConsent) ไฟล์นี้ปิดค่านั้นเพื่อเทสตอนเข้าเว็บครั้งแรก
 * ยกเว้น 2 กลุ่มที่ตั้งค่าเอง: "fixture" (ค่าเริ่มของ fixture) และ "agent workspace theme" (ใช้เฉพาะที่จำเป็น)
 *
 * ยังไม่ครอบคลุม (รอคำตอบจาก Mos 10 พ.ย. 2026):
 *   - ปุ่ม "แสดงแผนที่" (MapConsentGate.tsx:39) บันทึก maps:true แทนผู้ใช้ และลบค่าที่จำไว้ถ้ายังไม่เคยเลือก (คำถามข้อ 1)
 *   - กด Esc แล้วแถบไม่ปิด (คำถามข้อ 3)
 *   - หน้าแชร์ห้อง /s/<token> ของ apps/web ไม่มีแถบ (คำถามข้อ 2)
 */
test.use({ cookieConsent: null });

/** เปิดหน้า /privacy แล้วรอให้หน้าแสดง (หน้าสาธารณะที่โหลดเร็วและไม่ต้องล็อกอิน) */
async function openPrivacy(page: Page): Promise<{ legal: LegalPage; notice: CookieNotice }> {
  const legal = new LegalPage(page, 'privacy');
  await legal.goto();
  await expect(legal.root).toBeVisible();
  return { legal, notice: new CookieNotice(page) };
}

/**
 * เปิดหน้าตั้งค่าจากลิงก์ใน footer ของหน้า /privacy แล้วตรวจว่าแอปอ่านค่าที่บันทึกไว้ได้จริง
 * ใช้แทนการตรวจว่า "ไม่มีแถบ" อย่างเดียว ซึ่งอาจผ่านก่อน effect ของแถบทำงาน (CookieNotice.web.tsx:47)
 * ปุ่ม × ขึ้นเฉพาะเมื่อ readCookieConsent() ไม่เป็น null (:43, :100) ซึ่งเกิดเมื่อรุ่นตรงกันเท่านั้น (cookieConsent.ts:50)
 * และช่องติ๊กเริ่มจากค่าที่บันทึกไว้ (:39, :42)
 */
async function expectStoredChoiceInSettings(page: Page, expected: { preferences: boolean; maps: boolean }): Promise<void> {
  const notice = new CookieNotice(page);
  await page.getByTestId('public.footer').getByTestId('public.footer.cookies').click();
  await expect(notice.root).toHaveAttribute('data-view', 'settings');
  await expect(notice.close).toBeVisible();
  for (const id of ['preferences', 'maps'] as const) {
    if (expected[id]) await expect(notice.category(id)).toBeChecked();
    else await expect(notice.category(id)).not.toBeChecked();
  }
}

/** เวลาใน at ต้องเป็นเวลาที่กดจริง (cookieConsentRecord ใช้ now.toISOString() :62) */
function expectRecentIso(value: string, startedAt: number): void {
  const at = Date.parse(value);
  expect(Number.isNaN(at), `at ต้องเป็นเวลาแบบ ISO ได้ ${value}`).toBe(false);
  expect(at).toBeGreaterThanOrEqual(startedAt - 1_000);
  expect(at).toBeLessThanOrEqual(Date.now() + 1_000);
}

test.describe('cookie bar on first visit', () => {
  test('shows at the bottom left with three choices and no close button', async ({ page }) => {
    // ขั้นที่ 1: เปิดเว็บครั้งแรก (ไม่มีค่าใน localStorage) แถบขึ้นเอง (CookieNotice.web.tsx:47)
    const { notice } = await openPrivacy(page);
    await expect(notice.root).toBeVisible();
    await expect(notice.root).toHaveAttribute('data-view', 'choice');
    await expect(notice.acceptAll).toBeVisible();
    await expect(notice.necessaryOnly).toBeVisible();
    await expect(notice.settings).toBeVisible();
    // มุมมอง choice ไม่มีปุ่ม × เลย (ปุ่มอยู่ในมุมมอง settings: :97-111) จึงปิดแถบได้ด้วยการเลือกเท่านั้น
    // กรณี "ยังไม่เคยเลือก" ในมุมมอง settings ตรวจในข้อ "Settings" ด้านล่าง
    await expect(notice.close).toHaveCount(0);
    expect(await readStoredConsent(page), 'ยังไม่เลือก ต้องยังไม่มีค่า').toBeNull();

    // ขั้นที่ 2: ตำแหน่งมุมซ้ายล่าง ห่างขอบ 16px กว้างไม่เกิน 440px (cookie-notice.css:2-9)
    const box = await notice.root.boundingBox();
    const viewport = page.viewportSize();
    expect(box, 'หาตำแหน่งของแถบไม่ได้').not.toBeNull();
    expect(viewport).not.toBeNull();
    if (!box || !viewport) return;
    expect(Math.abs(box.x - 16), `ระยะจากขอบซ้าย ${box.x}`).toBeLessThanOrEqual(1);
    expect(Math.abs(viewport.height - (box.y + box.height) - 16), `ระยะจากขอบล่าง ${viewport.height - (box.y + box.height)}`).toBeLessThanOrEqual(1);
    expect(box.width).toBeLessThanOrEqual(440);
  });

  test('"Accept all" stores both categories and the bar stays closed after reload', async ({ page }) => {
    const { notice } = await openPrivacy(page);
    const startedAt = Date.now();
    // ขั้นที่ 1: กดยอมรับทั้งหมด แถบปิด (choose(ALL) :16, :70-73)
    await notice.acceptAll.click();
    await expect(notice.root).toBeHidden();
    // ขั้นที่ 2: ค่าที่บันทึกตรงกับรุ่นปัจจุบัน และเปิดทั้ง 2 หมวด
    const stored = await readStoredConsent(page);
    expect(stored).toEqual({ version: COOKIE_CONSENT_VERSION, at: expect.any(String), preferences: true, maps: true });
    expectRecentIso(stored?.at ?? '', startedAt);
    // ขั้นที่ 3: โหลดหน้าใหม่ แถบไม่ขึ้นอีก เพราะมีค่าของรุ่นนี้แล้ว (:47)
    await page.reload();
    await expect(new LegalPage(page, 'privacy').root).toBeVisible();
    await expect(notice.root).toHaveCount(0);
    // ขั้นที่ 4: ยืนยันว่าหลังโหลดใหม่แอปอ่านค่าที่บันทึกได้จริง ไม่ใช่แค่แถบยังไม่ทันขึ้น
    await expectStoredChoiceInSettings(page, { preferences: true, maps: true });
  });

  test('"Necessary only" stores neither category and removes the remembered settings', async ({ page }) => {
    const { notice } = await openPrivacy(page);
    // ขั้นที่ 1: ใส่ค่าที่แอปจำไว้ครบ 4 ตัว เหมือนผู้ใช้ที่เคยใช้เว็บก่อนมีแถบ (ภาษาใส่ไว้แล้วโดย fixture)
    await page.evaluate(() => {
      window.localStorage.setItem('nestyk.web.theme', 'dark');
      window.localStorage.setItem('nestyk.web.lastRole', 'agent');
      window.localStorage.setItem('nestyk.agentRooms.view', 'grid');
    });
    expect(Object.values(await readStorage(page, PREFERENCE_STORAGE_KEYS))).not.toContain(null);
    // ขั้นที่ 2: กดใช้เฉพาะที่จำเป็น ค่าเป็นปิดทั้งคู่ (choose(NONE) :15)
    await notice.necessaryOnly.click();
    await expect(notice.root).toBeHidden();
    expect(await readStoredConsent(page)).toEqual({ version: COOKIE_CONSENT_VERSION, at: expect.any(String), preferences: false, maps: false });
    // ขั้นที่ 3: ค่าที่จำไว้ทั้ง 4 ตัวถูกลบ (saveCookieConsent :129-137)
    // ตรวจก่อนโหลดหน้าใหม่: fixture ใส่ภาษากลับทุกครั้งที่โหลดหน้า ถ้าไม่มีค่า จึงตรวจหลังโหลดไม่ได้
    expect(await readStorage(page, PREFERENCE_STORAGE_KEYS)).toEqual(Object.fromEntries(PREFERENCE_STORAGE_KEYS.map((key) => [key, null])));
  });

  test('"Settings" shows necessary locked on, and saving with nothing ticked equals "Necessary only"', async ({ page }) => {
    const { notice } = await openPrivacy(page);
    // ขั้นที่ 1: กดตั้งค่า เปลี่ยนเป็นมุมมอง settings และยังไม่บันทึกอะไร (:155-163)
    await notice.settings.click();
    await expect(notice.root).toHaveAttribute('data-view', 'settings');
    expect(await readStoredConsent(page)).toBeNull();
    // ขั้นที่ 2: หมวดจำเป็นติ๊กไว้และกดไม่ได้ หมวดอื่นเริ่มจากปิด (:114-127) ยังไม่เคยเลือก จึงไม่มีปุ่ม ×
    await expect(notice.category('necessary')).toBeChecked();
    await expect(notice.category('necessary')).toBeDisabled();
    await expect(notice.category('preferences')).not.toBeChecked();
    await expect(notice.category('maps')).not.toBeChecked();
    await expect(notice.close).toHaveCount(0);
    // ขั้นที่ 3: บันทึกโดยไม่ติ๊ก ได้ค่าเดียวกับใช้เฉพาะที่จำเป็น (choose(draft) :169)
    await notice.save.click();
    await expect(notice.root).toBeHidden();
    expect(await readStoredConsent(page)).toEqual({ version: COOKIE_CONSENT_VERSION, at: expect.any(String), preferences: false, maps: false });
  });

  test('"Settings" with only "Remember my settings" ticked stores just that category', async ({ page }) => {
    const { notice } = await openPrivacy(page);
    // ขั้นที่ 1: เปิดหน้าตั้งค่า แล้วติ๊กเฉพาะหมวด "จำค่าที่คุณตั้ง"
    await notice.settings.click();
    await notice.category('preferences').check();
    // ขั้นที่ 2: บันทึก ค่าที่ได้เปิดเฉพาะหมวดนี้ (choose(draft) :169)
    await notice.save.click();
    await expect(notice.root).toBeHidden();
    expect(await readStoredConsent(page)).toEqual({ version: COOKIE_CONSENT_VERSION, at: expect.any(String), preferences: true, maps: false });
  });
});

test.describe('"Remember my settings" decides whether the language is kept', () => {
  // ภาษาที่สลับไป: ต่างจากภาษาที่ชุดเทสเปิดหน้า เพื่อให้เห็นว่าการสลับเกิดจริง
  const other = UI_LOCALE === 'th' ? 'en' : 'th';

  for (const allowed of [false, true]) {
    test(`with it ${allowed ? 'on' : 'off'} the chosen language is ${allowed ? '' : 'not '}saved`, async ({ page }) => {
      const { legal, notice } = await openPrivacy(page);
      // ขั้นที่ 1: เลือกในแถบ (ใช้เฉพาะที่จำเป็นลบภาษาที่ fixture ใส่ไว้ด้วย :129-137)
      await (allowed ? notice.acceptAll : notice.necessaryOnly).click();
      await expect(notice.root).toBeHidden();
      // ขั้นที่ 2: สลับภาษาของหน้า (LegalPage.web.tsx:50 setLocale) แล้วรอให้ข้อความเปลี่ยนจริง
      await legal.language.selectOption(other);
      await expect(legal.title).toHaveText(LEGAL[other].privacyTitle);
      // ขั้นที่ 3: แอปบันทึกภาษาเฉพาะเมื่อหมวดนี้เปิด (savePreferredLocale: lib/locale-storage.ts:19-20)
      if (allowed) {
        await expect.poll(async () => (await readStorage(page, [LOCALE_KEY]))[LOCALE_KEY]).toBe(other);
      } else {
        expect((await readStorage(page, [LOCALE_KEY]))[LOCALE_KEY], 'หมวดนี้ปิด ต้องไม่บันทึกภาษา').toBeNull();
      }
    });
  }
});

test.describe('"Cookie settings" links reopen the settings on the same page', () => {
  const links: { path: string; link: (page: Page) => Locator }[] = [
    // GuestPublicFooter.web.tsx ครอบ PublicFooter.tsx:141-146 (ลิงก์มี target=_blank แต่แถบเรียก preventDefault: CookieNotice.web.tsx:49-55)
    { path: '/', link: (page) => page.getByTestId('guest.footer').getByTestId('public.footer.cookies') },
    // AuthLegalFooter.web.tsx:25-28 ผ่าน testID ของแต่ละหน้า (login.tsx:508, register.tsx:334, reset-password.tsx:191)
    { path: '/login', link: (page) => page.getByTestId('login.footer.cookies') },
    { path: '/register', link: (page) => page.getByTestId('register.footer.cookies') },
    { path: '/reset-password', link: (page) => page.getByTestId('resetPassword.footer.cookies') },
    // หน้ากฎหมาย: footer (LegalPage.web.tsx ใช้ PublicFooter) และปุ่มในหัวข้อคุกกี้ (:164-166)
    { path: '/privacy', link: (page) => page.getByTestId('public.footer').getByTestId('public.footer.cookies') },
    { path: '/privacy#cookies', link: (page) => page.getByTestId('legal.cookies.settings') },
  ];

  for (const { path, link } of links) {
    test(`${path}: the link opens the settings without leaving the page`, async ({ page, context }) => {
      // ขั้นที่ 1: เปิดหน้าแล้วเลือกในแถบให้แถบปิดก่อน
      await page.goto(path, { timeout: 60_000 });
      const notice = new CookieNotice(page);
      await notice.necessaryOnly.click();
      await expect(notice.root).toBeHidden();
      // ฟังแท็บใหม่ตั้งแต่ก่อนกด แล้วตรวจท้ายเทส (เผื่อเวลาให้แท็บที่อาจเปิดช้า) ลิงก์ของ / และ /privacy มี target=_blank
      const opened: Page[] = [];
      context.on('page', (tab) => opened.push(tab));
      const urlBefore = page.url();
      // ขั้นที่ 2: กดลิงก์ตั้งค่าคุกกี้ แถบเปิดในมุมมอง settings และมีปุ่ม × เพราะเคยเลือกแล้ว (openSettings :41-46)
      await link(page).click();
      await expect(notice.root).toBeVisible();
      await expect(notice.root).toHaveAttribute('data-view', 'settings');
      await expect(notice.close).toBeVisible();
      // ขั้นที่ 3: ปุ่ม × ปิดโดยไม่บันทึก ติ๊กหมวดหนึ่งไว้ก่อนกด ถ้า × บันทึก draft ค่าจะเปลี่ยน (setOpen(false) :104)
      const storedBefore = await readStoredConsent(page);
      await notice.category('preferences').check();
      await notice.close.click();
      await expect(notice.root).toBeHidden();
      expect(await readStoredConsent(page), 'ปุ่ม × ต้องไม่บันทึกค่า').toEqual(storedBefore);
      // ขั้นที่ 4: ไม่เปิดแท็บใหม่ และ URL ไม่เปลี่ยน (ไม่มี #cookie-settings ต่อท้าย เพราะแถบเรียก preventDefault :52)
      expect(opened, 'ลิงก์ต้องไม่เปิดแท็บใหม่').toHaveLength(0);
      expect(page.url()).toBe(urlBefore);
    });
  }
});

test.describe('the cookie part of /privacy', () => {
  test('lists every item the web keeps and both outside services', async ({ page }) => {
    // ขั้นที่ 1: เปิด /privacy#cookies หน้าเลื่อนไปที่หัวข้อคุกกี้ (LegalPage.web.tsx:32-38)
    await page.goto('/privacy#cookies', { timeout: 60_000 });
    const section = page.getByTestId('legal.cookies');
    await expect(section).toBeVisible();
    // ขั้นที่ 2: จำนวนแถวตรงกับรายการในโค้ด (lib/cookie-notice.ts:28-39, :43-46)
    const storage = page.getByTestId('legal.cookies.storage');
    await expect(storage.locator('tbody tr')).toHaveCount(COOKIE_TABLE_ROWS.storage);
    const services = page.getByTestId('legal.cookies.services');
    await expect(services.locator('tbody tr')).toHaveCount(COOKIE_TABLE_ROWS.services);
    // ชื่อบริการเป็นชื่อแบรนด์ ไม่ผ่านการแปล (lib/cookie-notice.ts:44-45)
    for (const name of ['hCaptcha', 'Google Maps']) await expect(services, name).toContainText(name);
    // ขั้นที่ 3: key ที่แถบเขียนและลบจริง (cookieConsent.ts) ต้องอยู่ในตาราง ผู้ใช้จึงเห็นสิ่งที่เว็บเก็บครบ
    for (const key of [COOKIE_CONSENT_KEY, ...PREFERENCE_STORAGE_KEYS]) {
      await expect(storage, key).toContainText(key);
    }
  });
});

test.describe('a stored choice that is not valid asks again', () => {
  const cases: { name: string; value: string }[] = [
    { name: 'not JSON', value: '{oops' },
    { name: 'an older version', value: JSON.stringify({ version: '2026-01-01', at: '2026-01-01T00:00:00.000Z', preferences: true, maps: true }) },
    { name: 'no time', value: JSON.stringify({ version: COOKIE_CONSENT_VERSION, preferences: true, maps: true }) },
  ];

  for (const { name, value } of cases) {
    test(`${name}: the bar shows again`, async ({ page }) => {
      // ขั้นที่ 1: ใส่ค่าที่ใช้ไม่ได้ก่อนเปิดหน้า (parseCookieConsent คืน null: cookieConsent.ts:43-55)
      await page.addInitScript(({ key, raw }) => window.localStorage.setItem(key, raw), { key: COOKIE_CONSENT_KEY, raw: value });
      // ขั้นที่ 2: แถบขึ้นเหมือนยังไม่เคยเลือก
      const { notice } = await openPrivacy(page);
      await expect(notice.root).toBeVisible();
      await expect(notice.root).toHaveAttribute('data-view', 'choice');
    });
  }
});

test.describe('two tabs', () => {
  test('a choice in one tab closes the bar in the other', async ({ page, context }) => {
    // ขั้นที่ 1: เปิด 2 แท็บในเบราว์เซอร์เดียวกัน แถบขึ้นทั้งคู่
    const first = await openPrivacy(page);
    const second = await openPrivacy(await context.newPage());
    await expect(first.notice.root).toBeVisible();
    await expect(second.notice.root).toBeVisible();
    // ขั้นที่ 2: เลือกในแท็บแรก แท็บที่ 2 ได้ storage event แล้วปิดแถบ (onCookieConsentChange: CookieNotice.web.tsx:58-60)
    await first.notice.acceptAll.click();
    await expect(second.notice.root).toBeHidden();
  });
});

test.describe('fixture', () => {
  test.use({ cookieConsent: { preferences: true, maps: false } });

  test("the fixture's stored choice still hides the bar", async ({ page }) => {
    // ถ้าข้อนี้ไม่ผ่าน แถบจะขึ้นในทุกเทสของทุกชุด ให้ดู COOKIE_CONSENT_VERSION ใน cookie-notice.page.ts เทียบกับ cookieConsent.ts:15
    // ขั้นที่ 1: เปิดหน้า ไม่มีแถบ
    const { notice } = await openPrivacy(page);
    await expect(notice.root).toHaveCount(0);
    // ขั้นที่ 2: แอปอ่านค่าที่ fixture ใส่ไว้ได้จริง (ปุ่ม × ขึ้นเฉพาะเมื่อรุ่นตรง) และช่องติ๊กตรงกับค่าเริ่มต้นของ fixture
    await expectStoredChoiceInSettings(page, { preferences: true, maps: false });
  });

  test('sign-up sends the terms and privacy versions with the account details', async ({ page }) => {
    // ขั้นที่ 1: ดักคำขอสมัครของ Supabase ก่อนออกจากเบราว์เซอร์ แล้วตอบปลอมว่าปิดรับสมัคร ไม่มีบัญชีถูกสร้าง
    // page.route ทำงานก่อน route ของตัวกันที่ติดกับ context (guard.ts ตัดคำขอสมัครอีกชั้นถ้าหลุด)
    const bodies: unknown[] = [];
    await page.route(
      (url) => url.pathname.endsWith('/auth/v1/signup'),
      async (route) => {
        bodies.push(route.request().postDataJSON());
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          // คำขอข้ามโดเมนไป Supabase: ไม่มี header นี้ Chromium จะตัดคำตอบตามกติกา CORS แล้วหน้าจะได้ error เครือข่ายแทน
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ code: 422, error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' }),
        });
      },
    );
    // ขั้นที่ 2: กรอกครบทุกช่องและติ๊กยอมรับเงื่อนไข แล้วกดสร้างบัญชี (register.tsx:84-112)
    const register = new RegisterPage(page);
    await register.goto();
    await register.firstName.fill('QA');
    await register.lastName.fill('WebUi');
    await register.phone.fill('0812345678');
    await register.email.fill('qa-web-ui-consent@nestyk.test');
    await register.password.fill('QaWebUi2026a');
    await register.confirmPassword.fill('QaWebUi2026a');
    // กดใกล้ขอบซ้ายของแถว (12px) ซึ่งเป็นไอคอนช่องติ๊ก ไม่กดกลางแถว เพราะลิงก์ Terms ท้ายประโยคหยุดเหตุการณ์ไม่ให้ติ๊ก (ConsentLabel.web.tsx:33-37)
    // แถวเรียงไอคอนก่อนข้อความ (register.tsx:239-245) ค่า 12 ไม่ได้มาจากขนาดไอคอน ถ้ากดพลาด บรรทัด aria-checked ถัดไปจะไม่ผ่านให้เห็น
    const consentBox = await register.consent.boundingBox();
    await register.consent.click({ position: { x: 12, y: (consentBox?.height ?? 44) / 2 } });
    await expect(register.consent).toHaveAttribute('aria-checked', 'true');
    const startedAt = Date.now();
    await register.submit.click();
    // ขั้นที่ 3: คำขอมีค่า 3 ตัวใน data (AuthContext.tsx signUp ใส่ signupLegalMetadata(): lib/cookie-notice.ts:58-64)
    // Supabase เก็บ data นี้ใน raw_user_meta_data ของผู้ใช้
    await expect.poll(() => bodies.length, 'หน้าควรส่งคำขอสมัคร 1 ครั้ง').toBe(1);
    const data = (bodies[0] as { data?: Record<string, unknown> }).data ?? {};
    expect(data).toMatchObject({ terms_version: TERMS_VERSION, privacy_version_shown: PRIVACY_VERSION, terms_accepted_at: expect.any(String) });
    expectRecentIso(String(data.terms_accepted_at), startedAt);
  });
});

test.describe('agent workspace theme', () => {
  // เริ่มเหมือนผู้ใช้ที่เลือก "ใช้เฉพาะที่จำเป็น" แล้ว (การกดปุ่มในแถบตรวจในกลุ่มด้านบน) เพื่อให้ข้อนี้ตรวจเฉพาะเรื่องธีม
  // colorScheme light: ให้ธีมของเครื่องเป็นสว่างแน่นอน ขั้นที่ 3 จึงแยกได้ว่าแถบใช้ธีมของแอป (dark ที่เลือก) ไม่ใช่ธีมของเครื่อง
  test.use({ cookieConsent: { preferences: false, maps: false }, colorScheme: 'light' });

  test('with "Remember my settings" off the dark theme is not kept after reload, and the bar follows the dark theme', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินเป็น qa-agent ผ่านตัวกัน (guard.ts) แล้วรอโครงหน้านายหน้า
    await loginAs('agent');
    const shell = new AgentShell(page);
    await expect(shell.createMenu).toBeVisible();
    await expect(shell.root).toHaveAttribute('data-theme', 'light');
    const keysBefore = await page.evaluate(() => Object.keys(window.localStorage).sort());

    // ขั้นที่ 2: เลือกธีมมืด หน้าเป็นมืดทันที แต่ไม่บันทึก เพราะหมวดนี้ปิด (chooseTheme: AgentWorkspace.web.tsx:223-232)
    //   ธีมไปถึงหน้าจอผ่าน effect ที่เรียก setThemeMode (:201-213) แล้วรากใช้ data-theme={theme.mode} (:477)
    await shell.themeButton.click();
    await shell.themeOption('dark').click();
    await expect(shell.root).toHaveAttribute('data-theme', 'dark');
    // THEME_PREF_KEY = 'nestyk.web.theme' (AgentWorkspace.web.tsx:81) และต้องไม่มี key ใหม่ที่อื่น (เผื่อธีมถูกเก็บด้วยชื่ออื่นโดยไม่ดูความยินยอม)
    expect((await readStorage(page, ['nestyk.web.theme']))['nestyk.web.theme'], 'หมวด "จำค่าที่คุณตั้ง" ปิด ต้องไม่บันทึกธีม').toBeNull();
    expect(await page.evaluate(() => Object.keys(window.localStorage).sort()), 'เลือกธีมแล้วต้องไม่มี key ใหม่ใน localStorage').toEqual(keysBefore);

    // ขั้นที่ 3: เปิดหน้าตั้งค่าคุกกี้จาก footer ของหน้านายหน้า (AgentWorkspaceFooter.web.tsx:56-61)
    // แถบใช้ธีมของแอป ไม่ใช่ธีมของเครื่อง (useMobileTheme().isDark: CookieNotice.web.tsx:27, :85) จึงต้องเป็น dark ตามที่เพิ่งเลือก
    const notice = new CookieNotice(page);
    await page.getByTestId('shell.footer').getByTestId('shell.footer.cookies').click();
    await expect(notice.root).toHaveAttribute('data-view', 'settings');
    await expect(notice.root).toHaveAttribute('data-theme', 'dark');
    await notice.close.click();
    await expect(notice.root).toBeHidden();

    // ขั้นที่ 4: โหลดหน้าใหม่ ธีมกลับเป็นสว่าง เพราะไม่มีค่าที่บันทึก (readThemePref คืน light: AgentWorkspace.web.tsx:82-89)
    await page.reload();
    await expect(shell.createMenu).toBeVisible();
    expect((await readStorage(page, ['nestyk.web.theme']))['nestyk.web.theme'], 'หลังโหลดใหม่ต้องยังไม่มีค่าธีม').toBeNull();
    // ตรวจจาก themePref โดยตรง: รายการในเมนูธีมเป็น menuitemradio ที่มี aria-checked (WebMenu.tsx:112-113, AgentWorkspace.web.tsx:567)
    // ไม่ตรวจแค่ data-theme ของราก เพราะก่อน effect :201-205 ทำงาน รากเป็น light ได้ทั้งที่ themePref เป็น dark (ข้อสังเกตของ test-reviewer)
    await shell.themeButton.click();
    await expect(shell.themeOption('light')).toHaveAttribute('aria-checked', 'true');
    await expect(shell.themeOption('dark')).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    await expect(shell.root).toHaveAttribute('data-theme', 'light');
  });
});
