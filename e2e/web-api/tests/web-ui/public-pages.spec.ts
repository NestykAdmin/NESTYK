import type { Request } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { LoginPage } from '../../src/web-ui/pages/login.page';
import { GuestHome, LegalPage } from '../../src/web-ui/pages/public.page';
import { RegisterPage } from '../../src/web-ui/pages/register.page';
import { ResetPasswordPage } from '../../src/web-ui/pages/reset-password.page';
import { EN, LEGAL, LEGAL_SECTION_COUNT, LOCALES, UI_LOCALE } from '../../src/web-ui/labels';

/**
 * footer หน้ากฎหมาย การสลับภาษา และหน้าสมัคร (ผลเทสด้วยมือ 4 พ.ย. 2026 หัวข้อ "Footer, หน้ากฎหมาย และการสมัคร")
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web ไม่ต้องใช้รหัสผ่านของบัญชีไหน (ทุกข้อไม่ล็อกอิน)
 * ไม่สร้างบัญชี: ข้อสมัครหยุดที่การตรวจของหน้า และตัวกันตัดคำขอสมัคร (Supabase /auth/v1/signup, API /auth/dev/register) ไว้อีกชั้น
 */

test.describe('footers', () => {
  // testid: GuestPublicFooter.web.tsx:15, packages/ui/src/shells/PublicFooter.tsx:94, AuthLegalFooter.web.tsx:14
  // ผ่าน testID ของแต่ละหน้า (login.tsx:487, register.tsx:319, reset-password.tsx:169) และ LegalPage.web.tsx:103-118 (PublicFooter)
  test('/ shows its footer', async ({ page }) => {
    const home = new GuestHome(page);
    await home.goto();
    await expect(home.footer).toBeVisible();
  });

  test('/login shows its footer', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(login.footer).toBeVisible();
  });

  test('/register shows its footer', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await expect(register.footer).toBeVisible();
  });

  test('/reset-password shows its footer', async ({ page }) => {
    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await expect(reset.footer).toBeVisible();
  });

  for (const doc of ['privacy', 'terms'] as const) {
    test(`/${doc} shows its footer`, async ({ page }) => {
      const legal = new LegalPage(page, doc);
      await legal.goto();
      await expect(legal.footer).toBeVisible();
    });
  }

  test('the privacy link in the login footer opens a new tab', async ({ page }) => {
    // ขั้นที่ 1: เปิดหน้า login แล้วกดลิงก์ Privacy Policy ใน footer (AuthLegalFooter.web.tsx:18 target="_blank")
    const login = new LoginPage(page);
    await login.goto();
    const popup = page.waitForEvent('popup');
    await login.footerPrivacyLink.click();
    // ขั้นที่ 2: แท็บใหม่เปิดหน้า /privacy
    await expect(await popup).toHaveURL((url) => url.pathname === '/privacy');
  });

  test('the terms link in the guest footer opens a new tab', async ({ page }) => {
    // ขั้นที่ 1: เปิดหน้าแรกแล้วกดลิงก์ Terms of Use ใน footer
    // (PublicFooter.tsx:90-92, 137 legalInNewTab ค่าเริ่มต้น true และ GuestPublicFooter ไม่ส่งค่านี้)
    const home = new GuestHome(page);
    await home.goto();
    const popup = page.waitForEvent('popup');
    await home.footerTermsLink.click();
    // ขั้นที่ 2: แท็บใหม่เปิดหน้า /terms
    await expect(await popup).toHaveURL((url) => url.pathname === '/terms');
  });
});

test.describe('legal pages', () => {
  for (const doc of ['privacy', 'terms'] as const) {
    test(`/${doc} has ${LEGAL_SECTION_COUNT[doc]} sections and the draft banner`, async ({ page }) => {
      // ขั้นที่ 1: เปิดหน้าเอกสาร
      const legal = new LegalPage(page, doc);
      await legal.goto();
      await expect(legal.root).toBeVisible();
      // ขั้นที่ 2: มีแถบ Draft และจำนวนหัวข้อตรงกับ packages/i18n/src/locales/legal/<ภาษาที่รัน>.ts
      await expect(legal.draftBanner).toContainText(LEGAL[UI_LOCALE].draftBadge);
      await expect(legal.sectionHeadings).toHaveCount(LEGAL_SECTION_COUNT[doc]);
    });
  }

  test('switching the language changes the text and the footer', async ({ page }) => {
    // ขั้นที่ 1: เปิดหน้านโยบายความเป็นส่วนตัว
    const legal = new LegalPage(page, 'privacy');
    await legal.goto();
    await expect(legal.root).toBeVisible();
    // ขั้นที่ 2: เลือกทีละภาษา แล้วตรวจหัวเรื่อง แถบ Draft ลิงก์ใน footer และหัวข้อทุกส่วน
    for (const locale of LOCALES) {
      await test.step(locale, async () => {
        await legal.language.selectOption(locale);
        const copy = LEGAL[locale];
        await expect(legal.title).toHaveText(copy.privacyTitle);
        await expect(legal.draftBanner).toContainText(copy.draftBadge);
        await expect(legal.footerPrivacyLink).toHaveText(copy.footerPrivacy);
        // ไม่มีหัวข้อที่ว่าง: คีย์ที่หายทำให้ข้อความว่าง ไม่ได้ขึ้นชื่อคีย์ (t เป็น object ไม่ใช่ฟังก์ชัน: code-scout)
        const headings = await legal.sectionHeadings.allInnerTexts();
        expect(headings).toHaveLength(LEGAL_SECTION_COUNT.privacy);
        for (const heading of headings) expect(heading).toMatch(/^\d+\.\s+\S/);
      });
    }
  });
});

test.describe('register', () => {
  test('without ticking the terms it asks to accept them and sends nothing', async ({ page }) => {
    const signUps: Request[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/auth/v1/signup') || path.includes('/auth/dev/register')) signUps.push(request);
    });
    // ขั้นที่ 1: กรอกทุกช่องด้วยข้อมูลทดสอบ แต่ไม่ติ๊กยอมรับเงื่อนไข
    // ลำดับการตรวจของหน้า (register.tsx:78-105): ช่องว่างก่อน แล้วจึงการยอมรับเงื่อนไข จึงต้องกรอกครบทุกช่อง
    const register = new RegisterPage(page);
    await register.goto();
    await register.firstName.fill('QA');
    await register.lastName.fill('WebUi');
    await register.phone.fill('0812345678');
    await register.email.fill('qa-web-ui-consent@nestyk.test');
    await register.password.fill('QaWebUi2026a');
    await register.confirmPassword.fill('QaWebUi2026a');
    await expect(register.consent).toHaveAttribute('aria-checked', 'false');
    // ขั้นที่ 2: กดสร้างบัญชี ขึ้นข้อความให้ยอมรับเงื่อนไข และหน้าไม่ส่งคำขอสมัคร
    await register.submit.click();
    await expect(register.alert.filter({ hasText: EN.acceptTermsRequired })).toBeVisible();
    expect(signUps, 'หน้าไม่ควรส่งคำขอสมัคร').toHaveLength(0);
  });

  test('the Terms link in the consent text opens the terms without ticking the box', async ({ page }) => {
    // ขั้นที่ 1: เปิดหน้าสมัคร ช่องติ๊กยังไม่ถูกติ๊ก
    const register = new RegisterPage(page);
    await register.goto();
    await expect(register.consent).toHaveAttribute('aria-checked', 'false');
    // ขั้นที่ 2: กดลิงก์ Terms ในข้อความยินยอม เปิดแท็บใหม่ และช่องติ๊กไม่ถูกติ๊กตาม
    // (ConsentLabel.web.tsx:23-33 target="_blank" และหยุดเหตุการณ์ไม่ให้ถึงช่องติ๊ก)
    const popup = page.waitForEvent('popup');
    await register.consentTermsLink.click();
    await expect(await popup).toHaveURL((url) => url.pathname === '/terms');
    await expect(register.consent).toHaveAttribute('aria-checked', 'false');
  });
});
