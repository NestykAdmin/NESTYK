import type { Page, Request } from '@playwright/test';
import { test, expect, LOCALE_KEY } from '../../src/web-ui/web-ui.fixture';
import { ResetPasswordPage } from '../../src/web-ui/pages/reset-password.page';
import { EN, RAW_ERRORS, TH_EMAIL, TH_RESET_SEND } from '../../src/web-ui/labels';

/**
 * หน้าลืมรหัสผ่านและตั้งรหัสใหม่ (ผลเทสด้วยมือ 4 พ.ย. 2026 หัวข้อ "รีเซ็ตรหัสผ่าน" และบั๊กข้อ 4, 6, 7)
 * โค้ด: apps/consumer-app/app/reset-password.tsx และ lib/auth/reset-password.ts (qa/e2e efab8d0)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web ไม่ต้องใช้รหัสผ่านของบัญชีไหน (ทุกข้อไม่ล็อกอิน)
 * ไม่มีข้อไหนเปลี่ยนรหัสผ่านได้จริง:
 *   - ทุกข้อเปิดหน้าแบบไม่ล็อกอินในเบราว์เซอร์ใหม่ จึงไม่มี session ให้ updateUser เปลี่ยนรหัส
 *   - ลิงก์ที่ใช้เป็นค่าปลอม (token_hash และ code ไม่มีจริง) Supabase ปฏิเสธ
 * ไม่ส่งอีเมลรีเซ็ต: ข้อขั้นอีเมลใช้แค่อีเมลที่ไม่ผ่านรูปแบบ ซึ่งหน้าเว็บตรวจก่อนเรียก resetPasswordForEmail (reset-password.tsx:70-86)
 *   และตัวกันตัด POST /auth/v1/recover ไว้อีกชั้น (guard.ts) ข้อ "อีเมลที่ไม่มีบัญชีได้ข้อความกลาง ๆ" ไม่อยู่ในชุดนี้ เพราะต้องส่งคำขอนี้
 * รหัสผ่านในไฟล์นี้เป็นค่าทดสอบ ไม่ใช่รหัสของบัญชีไหน
 */

/** จดคำขอส่งอีเมลรีเซ็ตของ Supabase (POST /auth/v1/recover) ที่หน้าพยายามส่งระหว่างเทส */
function watchRecoverRequests(page: Page): Request[] {
  const seen: Request[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/auth/v1/recover')) seen.push(request);
  });
  return seen;
}

test.describe('email step', () => {
  for (const value of ['', 'abc@nestyk']) {
    test(`asks for a valid email when the email is ${value ? `"${value}"` : 'empty'}`, async ({ page }) => {
      // ขั้นที่ 1: เปิดหน้าลืมรหัสผ่าน ใส่อีเมลที่ไม่ผ่านรูปแบบ แล้วกดส่ง
      const recover = watchRecoverRequests(page);
      const reset = new ResetPasswordPage(page);
      await reset.goto();
      await reset.email().fill(value);
      await reset.sendButton().click();
      // ขั้นที่ 2: ขึ้นข้อความให้กรอกอีเมลให้ถูก และไม่มีคำขอไป Supabase
      await expect(reset.alert.filter({ hasText: EN.invalidEmail })).toBeVisible();
      expect(recover, 'หน้าไม่ควรเรียก Supabase เมื่ออีเมลไม่ผ่านรูปแบบ').toHaveLength(0);
    });
  }

  test('the email button does not say "Send code" in English', { tag: '@known-bug' }, async ({ page }) => {
    // ขั้นที่ 1: เปิดหน้าลืมรหัสผ่าน รอให้ช่องอีเมลแสดง
    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await expect(reset.email()).toBeVisible();
    // ขั้นที่ 2: ปุ่มต้องไม่เขียนว่าส่งรหัส เพราะระบบส่งเป็นลิงก์แล้ว
    test.fail(true, 'บั๊กข้อ 6: ปุ่มยังเป็น resetSend "Send code" (packages/i18n/src/locales/en.ts:345)');
    await expect(reset.sendButton(EN.resetSend)).toHaveCount(0);
  });

  test('the email button does not say "ส่งรหัส" in Thai', { tag: '@known-bug' }, async ({ page }) => {
    // ขั้นที่ 1: เปิดหน้าลืมรหัสผ่านเป็นภาษาไทย รอให้ช่องอีเมลแสดง
    await page.addInitScript((key) => window.localStorage.setItem(key, 'th'), LOCALE_KEY);
    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await expect(reset.email(TH_EMAIL)).toBeVisible();
    // ขั้นที่ 2: ปุ่มต้องไม่เขียนว่าส่งรหัส
    test.fail(true, 'บั๊กข้อ 6: ปุ่มยังเป็น resetSend "ส่งรหัส" (packages/i18n/src/locales/th.ts:345)');
    await expect(reset.sendButton(TH_RESET_SEND)).toHaveCount(0);
  });
});

test.describe('recovery links', () => {
  test('a fake token_hash shows the expired-link message and leaves the URL', async ({ page }) => {
    // ลิงก์ที่มี token_hash กับ type=recovery: หน้าลบ query ทั้งหมดทันที (reset-password.tsx:50-52) แล้วตรวจกับ Supabase
    // token ปลอมถูกปฏิเสธ → ข้อความ resetLinkInvalid และกลับขั้นอีเมล (:61-64)
    const reset = new ResetPasswordPage(page);
    await reset.goto('?token_hash=qa-fake-token&type=recovery');
    await expect(reset.linkInvalid).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL((url) => url.pathname === '/reset-password' && !url.searchParams.has('token_hash'));
  });

  for (const query of ['?type=recovery', '?code=qa-bad-code']) {
    test(`${query} without a reset session shows the link is not usable`, { tag: '@known-bug' }, async ({ page }) => {
      // ขั้นที่ 1: เปิดลิงก์ที่ไม่มี token แล้วรอให้หน้าแสดงอย่างใดอย่างหนึ่ง: ฟอร์มตั้งรหัส (ตอนนี้) หรือข้อความว่าลิงก์ใช้ไม่ได้ (เมื่อแก้แล้ว)
      const reset = new ResetPasswordPage(page);
      await reset.goto(query);
      await expect(reset.save.or(reset.linkInvalid).first()).toBeVisible({ timeout: 20_000 });
      // ขั้นที่ 2: ผลที่ควรเป็น (ผลเทสข้อ 4): ขึ้นข้อความว่าลิงก์ใช้ไม่ได้ แบบเดียวกับ token ปลอม และไม่มีฟอร์มตั้งรหัส
      test.fail(true, 'บั๊กข้อ 4: isRecoveryLanding (lib/auth/reset-password.ts:27-31) พาไปฟอร์มตั้งรหัสโดยไม่ตรวจ session');
      await expect(reset.linkInvalid).toBeVisible({ timeout: 3_000 });
      await expect(reset.save).toHaveCount(0);
    });
  }
});

test.describe('new password form', () => {
  // ทุกข้อในกลุ่มนี้เข้าฟอร์มด้วย ?type=recovery ซึ่งได้ฟอร์มเพราะบั๊กข้อ 4 ยังอยู่
  // เมื่อทีมแก้ข้อ 4 แล้ว ข้อในกลุ่มนี้จะเปิดฟอร์มไม่ได้ ต้องเปลี่ยนไปใช้ลิงก์รีเซ็ตจริง (รอบัญชีเทสที่ใช้อีเมลจริงจาก dev)
  test('a short password shows the password rules', async ({ page }) => {
    // ขั้นที่ 1: เปิดฟอร์ม ใส่รหัสสั้นทั้ง 2 ช่อง แล้วกดบันทึก
    const reset = new ResetPasswordPage(page);
    await reset.goto('?type=recovery');
    await reset.password.fill('Ab1');
    await reset.confirmPassword.fill('Ab1');
    await reset.save.click();
    // ขั้นที่ 2: ขึ้นกฎรหัสผ่านใน role=alert (passwordIsStrong: lib/auth/password-rules.ts:2-3)
    await expect(reset.alert.filter({ hasText: EN.passwordRules })).toBeVisible();
  });

  test('two different passwords show the mismatch message', async ({ page }) => {
    // ขั้นที่ 1: เปิดฟอร์ม ใส่รหัสที่ถูกกฎแต่ไม่ตรงกัน แล้วกดบันทึก
    const reset = new ResetPasswordPage(page);
    await reset.goto('?type=recovery');
    await reset.password.fill('QaWebUi2026a');
    await reset.confirmPassword.fill('QaWebUi2026b');
    await reset.save.click();
    // ขั้นที่ 2: ขึ้นข้อความว่ารหัสไม่ตรงกัน
    await expect(reset.alert.filter({ hasText: EN.passwordMismatch })).toBeVisible();
  });

  test('saving without a reset session does not show the raw Supabase error', { tag: '@known-bug' }, async ({ page }) => {
    // ขั้นที่ 1: เปิดฟอร์ม ใส่รหัสที่ถูกกฎและตรงกัน แล้วกดบันทึก
    // ไม่มี session จึงเปลี่ยนรหัสของบัญชีไหนไม่ได้ (updateUser ต้องมี session: reset-password.ts:51-55)
    const reset = new ResetPasswordPage(page);
    await reset.goto('?type=recovery');
    await reset.password.fill('QaWebUi2026a');
    await reset.confirmPassword.fill('QaWebUi2026a');
    await reset.save.click();
    // ขั้นที่ 2: รอให้หน้าตอบกลับ: ข้อความผิดพลาดใน role=alert (ตอนนี้) หรือข้อความว่าลิงก์ใช้ไม่ได้ (เมื่อแก้แล้ว)
    await expect(reset.alert.or(reset.linkInvalid).first()).toBeVisible({ timeout: 20_000 });
    // ขั้นที่ 3: ต้องไม่ใช่ข้อความดิบจาก Supabase
    test.fail(true, 'บั๊กข้อ 7 (และข้อ 4): ขึ้น "Auth session missing!" ซึ่งเป็นข้อความดิบจาก Supabase');
    await expect(reset.text(RAW_ERRORS.authSessionMissing)).toHaveCount(0);
  });
});
