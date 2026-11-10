import type { Page, Request } from '@playwright/test';
import { test, expect, LOCALE_KEY } from '../../src/web-ui/web-ui.fixture';
import { ResetPasswordPage } from '../../src/web-ui/pages/reset-password.page';
import { EN, RAW_ERRORS, RETIRED_RESET_SEND, TH_EMAIL, TH_RESET_SEND, UI_LOCALE } from '../../src/web-ui/labels';

/**
 * หน้าลืมรหัสผ่านและตั้งรหัสใหม่ (ผลเทสด้วยมือ 4 พ.ย. 2026 หัวข้อ "รีเซ็ตรหัสผ่าน" และบั๊กข้อ 4, 6, 7)
 * โค้ด: apps/consumer-app/app/reset-password.tsx และ lib/auth/reset-password.ts (qa/e2e 648dd28: บั๊กข้อ 4, 6, 7 ของหน้านี้แก้แล้ว)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web ไม่ต้องใช้รหัสผ่านของบัญชีไหน (ทุกข้อไม่ล็อกอิน)
 * ไม่มีข้อไหนเปลี่ยนรหัสผ่านได้จริง:
 *   - ทุกข้อเปิดหน้าแบบไม่ล็อกอินในเบราว์เซอร์ใหม่ จึงไม่มี session ให้ updateUser เปลี่ยนรหัส
 *   - ลิงก์ที่ใช้เป็นค่าปลอม (token_hash และ code ไม่มีจริง) Supabase ปฏิเสธ
 *   - ตั้งแต่ 648dd28 token_hash ถูกตรวจตอนกดบันทึก ไม่ใช่ตอนเปิดหน้า (reset-password.tsx:37-38, 116-130)
 *     ข้อ "token ปลอมกดบันทึก" จึงเรียก Supabase verifyOtp ด้วย hash ปลอม 1 ครั้ง (Aof อนุมัติ 6 พ.ย. 2026)
 *     เทสตรวจเองว่ามีคำขอ POST /auth/v1/verify 1 คำขอที่ได้ 4xx และไม่มี PUT /auth/v1/user (หน้าหยุดก่อน updateUser: :119-126)
 *     อนุมาน: Supabase ไม่เขียนข้อมูลเมื่อหา token_hash ไม่เจอ (ไม่มีโค้ดของ Supabase ให้ตรวจ)
 * ไม่ส่งอีเมลรีเซ็ต: ข้อขั้นอีเมลใช้แค่อีเมลที่ไม่ผ่านรูปแบบ ซึ่งหน้าเว็บตรวจก่อนเรียก resetPasswordForEmail (reset-password.tsx:78-81)
 *   และตัวกันตัด POST /auth/v1/recover ไว้อีกชั้น (guard.ts) ข้อ "อีเมลที่ไม่มีบัญชีได้ข้อความกลาง ๆ" ไม่อยู่ในชุดนี้ เพราะต้องส่งคำขอนี้
 * รหัสผ่านในไฟล์นี้เป็นค่าทดสอบ ไม่ใช่รหัสของบัญชีไหน
 */

/** จดคำขอไป Supabase Auth ที่ path ลงท้ายด้วย suffix (และ method ถ้าระบุ) ที่หน้าส่งระหว่างเทส เริ่มจดก่อน goto */
function watchAuthRequests(page: Page, suffix: string, method?: string): Request[] {
  const seen: Request[] = [];
  page.on('request', (request) => {
    if (method && request.method() !== method) return;
    if (new URL(request.url()).pathname.endsWith(suffix)) seen.push(request);
  });
  return seen;
}

/** คำขอส่งอีเมลรีเซ็ต (POST /auth/v1/recover) */
function watchRecoverRequests(page: Page): Request[] {
  return watchAuthRequests(page, '/auth/v1/recover');
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

  // บั๊กข้อ 6 แก้แล้วที่ 648dd28 (เดิมเป็น known-bug): ปุ่มเขียนว่าส่งลิงก์ และไม่มีปุ่มที่เขียนว่าส่งรหัส
  test('the email button says "Send link" in English', async ({ page }) => {
    test.skip(UI_LOCALE !== 'en', 'ข้อนี้ตรวจภาษาอังกฤษ ข้อถัดไปตรวจภาษาไทยอยู่แล้ว');
    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await expect(reset.email()).toBeVisible();
    await expect(reset.sendButton(EN.resetSend)).toBeVisible();
    await expect(reset.sendButton(RETIRED_RESET_SEND.en)).toHaveCount(0);
  });

  test('the email button says "ส่งลิงก์" in Thai', async ({ page }) => {
    await page.addInitScript((key) => window.localStorage.setItem(key, 'th'), LOCALE_KEY);
    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await expect(reset.email(TH_EMAIL)).toBeVisible();
    await expect(reset.sendButton(TH_RESET_SEND)).toBeVisible();
    await expect(reset.sendButton(RETIRED_RESET_SEND.th)).toHaveCount(0);
  });
});

test.describe('recovery links', () => {
  test('a fake token_hash opens the form and drops the token from the URL', async ({ page }) => {
    // ลิงก์ที่มี token_hash: หน้าลบ query ทันที (reset-password.tsx:49-55) และเปิดฟอร์มตั้งรหัส ยังไม่ตรวจกับ Supabase (:37-38)
    const verify = watchAuthRequests(page, '/auth/v1/verify');
    const reset = new ResetPasswordPage(page);
    // ขั้นที่ 1: เปิดลิงก์ ฟอร์มตั้งรหัสขึ้น และยังอยู่หน้า /reset-password
    await reset.goto('?token_hash=qa-fake-token&type=recovery');
    await expect(reset.save).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL((url) => url.pathname === '/reset-password');
    // ขั้นที่ 2: ถ้าวันหนึ่งหน้ากลับไปตรวจ token ตอนเปิด (ซึ่งใช้ลิงก์จริงไปตั้งแต่เปิด) ข้อนี้ต้องแดง: ต้องไม่มี alert และคำขอ verify
    //   อยู่ก่อน test.fail โดยตั้งใจ ไม่อย่างนั้น test.fail จะกลับผลของ 2 บรรทัดนี้ด้วย (ข้อสังเกตของ test-reviewer 10 พ.ย. 2026)
    await expect(reset.alert).toHaveCount(0);
    expect(verify, 'หน้าไม่ควรตรวจ token กับ Supabase ตอนเปิด').toHaveLength(0);
    // ขั้นที่ 3: token ต้องไม่อยู่ใน URL
    // เคยเป็นบั๊ก (แจ้ง Jom 10 พ.ย. 2026: claude/nestyk-web-reset-token-url-for-dev-2026-11-10.md) expo-router เขียน URL ที่มี token กลับ
    //   Jom แก้ที่ UXUI/develop 056293c (ลบ params ผ่าน useNavigation().setParams หลัง effect รอบแรก) รวมเข้า pre/dev/review cfd6633
    //   ผลรัน 10 พ.ย. 2026 ที่ qa/e2e 34be4d6 ขึ้น "Expected to fail, but passed" (Claude outputs/results/web-ui-cfd6633-reset-cookie-run1.txt) จึงเอา test.fail กับป้ายออก
    await expect(page).toHaveURL((url) => url.search === '');
    // อ่าน URL ซ้ำอีกครั้งโดยไม่รอ: toHaveURL ผ่านทันทีที่เจอ URL สะอาด ถ้า URL สะอาดแค่ครู่เดียวแล้วถูกเขียนกลับ บรรทัดนี้จับได้
    expect(new URL(page.url()).search, 'URL ต้องยังไม่มี token หลังตรวจครั้งแรก').toBe('');
  });

  // บั๊กข้อ 4 แก้แล้วที่ 648dd28 (เดิมเป็น known-bug): ลิงก์ที่ไม่มี token กลับขั้นอีเมลพร้อมเหตุผล ไม่เปิดฟอร์มที่บันทึกไม่ได้
  //   ?type=recovery: brokenRecoveryLanding (lib/auth/reset-password.ts:37-44) ตั้งข้อความตั้งแต่เปิดหน้า (reset-password.tsx:31)
  //   ?code=: hasResetSession ตอบว่าไม่มี session แล้วกลับขั้นอีเมล (reset-password.tsx:59-70)
  for (const query of ['?type=recovery', '?code=qa-bad-code']) {
    test(`${query} without a reset session goes back to the email step with the reason`, async ({ page }) => {
      const reset = new ResetPasswordPage(page);
      await reset.goto(query);
      await expect(reset.linkBroken).toBeVisible({ timeout: 20_000 });
      await expect(reset.email()).toBeVisible();
      await expect(reset.save).toHaveCount(0);
    });
  }
});

test.describe('new password form', () => {
  // เข้าฟอร์มด้วย token_hash ปลอม (ฟอร์มเปิดโดยยังไม่ตรวจลิงก์) 2 ข้อแรกหยุดที่การตรวจในหน้า ก่อนเรียก Supabase (reset-password.tsx:105-112)
  const FAKE_LINK = '?token_hash=qa-fake-token&type=recovery';

  test('a short password shows the password rules', async ({ page }) => {
    // ขั้นที่ 1: เปิดฟอร์ม ใส่รหัสสั้นทั้ง 2 ช่อง แล้วกดบันทึก
    const verify = watchAuthRequests(page, '/auth/v1/verify');
    const reset = new ResetPasswordPage(page);
    await reset.goto(FAKE_LINK);
    await reset.password.fill('Ab1');
    await reset.confirmPassword.fill('Ab1');
    await reset.save.click();
    // ขั้นที่ 2: ขึ้นกฎรหัสผ่านใน role=alert (passwordIsStrong: lib/auth/password-rules.ts:2-3) และไม่มีคำขอไป Supabase
    await expect(reset.alert.filter({ hasText: EN.passwordRules })).toBeVisible();
    expect(verify, 'รหัสไม่ผ่านกฎ หน้าต้องหยุดก่อนตรวจลิงก์ (reset-password.tsx:105-108)').toHaveLength(0);
  });

  test('two different passwords show the mismatch message', async ({ page }) => {
    // ขั้นที่ 1: เปิดฟอร์ม ใส่รหัสที่ถูกกฎแต่ไม่ตรงกัน แล้วกดบันทึก
    const verify = watchAuthRequests(page, '/auth/v1/verify');
    const reset = new ResetPasswordPage(page);
    await reset.goto(FAKE_LINK);
    await reset.password.fill('QaWebUi2026a');
    await reset.confirmPassword.fill('QaWebUi2026b');
    await reset.save.click();
    // ขั้นที่ 2: ขึ้นข้อความว่ารหัสไม่ตรงกัน และไม่มีคำขอไป Supabase
    await expect(reset.alert.filter({ hasText: EN.passwordMismatch })).toBeVisible();
    expect(verify, 'รหัสไม่ตรงกัน หน้าต้องหยุดก่อนตรวจลิงก์ (reset-password.tsx:109-112)').toHaveLength(0);
  });

  // บั๊กข้อ 7 ของหน้านี้แก้แล้วที่ 648dd28 ข้อนี้ตรวจเฉพาะทางของ verifyOtp (reset-password.tsx:119-125)
  //   ทางที่บันทึกเมื่อไม่มี session (RECOVERY_SESSION_MISSING :133-135) ไม่มีข้อไหนเดินถึงแล้ว (อยู่ในรายการ "ยังไม่ได้เทส" ของ README)
  test('saving with a fake link says the link expired and stops before updating the password', async ({ page }) => {
    // ขั้นที่ 1: เริ่มจดคำขอก่อนเปิดหน้า เปิดฟอร์มด้วย token ปลอม ใส่รหัสที่ถูกกฎและตรงกัน
    const verify = watchAuthRequests(page, '/auth/v1/verify');
    const updateUser = watchAuthRequests(page, '/auth/v1/user', 'PUT');
    const reset = new ResetPasswordPage(page);
    await reset.goto(FAKE_LINK);
    await reset.password.fill('QaWebUi2026a');
    await reset.confirmPassword.fill('QaWebUi2026a');
    expect(verify, 'ก่อนกดบันทึกต้องยังไม่ตรวจลิงก์').toHaveLength(0);
    // ขั้นที่ 2: กดบันทึก หน้าเรียก verifyOtp ด้วย hash ปลอม
    const verifyResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/auth/v1/verify'), { timeout: 20_000 });
    await reset.save.click();
    const response = await verifyResponse;
    // ขั้นที่ 3: Supabase ต้องปฏิเสธด้วย 4xx (ไม่ใช่เครือข่ายล้ม) ขึ้นข้อความ resetLinkInvalid ทั้งข้อความ ฟอร์มยังอยู่
    expect(response.status(), 'Supabase ต้องปฏิเสธ token ปลอม').toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
    await expect(reset.alert).toHaveText(EN.resetLinkInvalid, { timeout: 20_000 });
    await expect(reset.save).toBeVisible();
    await expect(reset.text(RAW_ERRORS.authSessionMissing)).toHaveCount(0);
    // ขั้นที่ 4: ตรวจลิงก์ครั้งเดียว และไม่มีคำขอเปลี่ยนรหัสผ่าน (หน้าหยุดก่อน updateUser)
    expect(verify, 'ต้องตรวจลิงก์กับ Supabase 1 ครั้งตามที่ Aof อนุมัติ').toHaveLength(1);
    expect(updateUser, 'ต้องไม่มี PUT /auth/v1/user').toHaveLength(0);
  });
});
