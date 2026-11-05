import type { Page } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { LoginPage } from '../../src/web-ui/pages/login.page';
import { IdleWarning } from '../../src/web-ui/pages/session.page';
import { EN } from '../../src/web-ui/labels';
import { ACTIVITY_WRITE_MS, hasStoredSession, IN_WARNING_WINDOW, PAST_LIMIT, setLastActivityAgo } from '../../src/web-ui/support/idle';

/**
 * การหมดเวลาและ session ข้ามแท็บของเว็บ (ผลเทสด้วยมือ 4 พ.ย. 2026 หัวข้อ "Session" และบั๊กข้อ 3, 5)
 * โค้ด: apps/consumer-app/components/web-session/IdleSignOutGate.web.tsx, lib/auth/AuthContext.tsx, lib/auth/cross-tab*.ts
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web และเรียก API ของ staging, ตั้ง E2E_QA_AGENT_PASSWORD
 * ทุกข้อล็อกอินเป็น qa-agent ใหม่ในเบราว์เซอร์ของเทสเอง (เรียก POST /auth/sync ที่ staging ซิงก์บัญชีที่มีอยู่แล้ว)
 * และออกจากระบบแบบ scope local เท่านั้น (ปุ่ม Sign Out และการหมดเวลา: AuthContext.tsx:344, 346) จึงไม่ตัด session ของคนอื่น
 * ห้ามกดปุ่มยืนยันในกล่อง "ออกจากทุกอุปกรณ์" (ตัวกันตัดคำขอนั้นไว้อีกชั้น)
 */

/** ล็อกอินเป็น qa-agent แล้วรอให้โครงหน้านายหน้าแสดง */
async function signInAsAgent(page: Page, loginAs: (role: 'agent', options?: { page?: Page }) => Promise<void>): Promise<void> {
  await loginAs('agent', { page });
  await expect(new AgentShell(page).createMenu).toBeVisible();
}

/** เปิดแท็บที่ 2 ในเบราว์เซอร์เดียวกัน (session ร่วมกันผ่าน localStorage) แล้วรอให้โครงหน้านายหน้าแสดง */
async function openSecondAgentTab(page: Page): Promise<Page> {
  const second = await page.context().newPage();
  await second.goto('/agent');
  await expect(new AgentShell(second).createMenu).toBeVisible();
  return second;
}

/**
 * การใช้งานที่ห่างจากการเขียนเวลาครั้งก่อนในแท็บนั้นน้อยกว่า 15 วินาทีไม่ถูกนับ (IdleSignOutGate.web.tsx:94)
 * การล็อกอินเขียนเวลาไว้ (:83) ข้อที่ต้องให้การขยับเมาส์หรือกดแป้นถูกนับ เหมือนผู้ใช้ที่ไม่ได้แตะเครื่องมานาน จึงต้องให้พ้นช่วงนี้ก่อน
 * ไม่มีสัญญาณจากหน้าเว็บให้รอ (ค่าเวลาเก็บใน ref ของ React) จึงรอตามเวลานี้โดยตรง (ข้อยกเว้นของกฎ ง.10 ที่มีเหตุผลจากโค้ด)
 */
async function waitPastActivityWindow(page: Page): Promise<void> {
  await page.waitForTimeout(ACTIVITY_WRITE_MS + 2_000);
}

test.describe('idle sign out', () => {
  test('shows "Are you still there?" within the last two minutes before the limit', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอิน แล้วตั้งเวลาใช้งานล่าสุดให้เหลือ 1 นาทีก่อนหมดเวลา
    await signInAsAgent(page, loginAs);
    await setLastActivityAgo(page, IN_WARNING_WINDOW);
    // ขั้นที่ 2: กล่องเตือนขึ้นพร้อมนับถอยหลังรูป m:ss (idle-rules.ts:33-37)
    const warning = new IdleWarning(page);
    await expect(warning.dialog).toBeVisible();
    await expect(warning.title).toBeVisible();
    await expect(warning.dialog).toContainText(/\b[01]:\d{2}\b/);
  });

  test(
    'the Sign out button in the warning signs out when reached with the mouse',
    { tag: '@known-bug' },
    async ({ page, loginAs }) => {
      // ขั้นที่ 1: ล็อกอิน รอให้พ้นช่วง 15 วินาที แล้วตั้งเวลาให้กล่องเตือนขึ้น
      await signInAsAgent(page, loginAs);
      await waitPastActivityWindow(page);
      await setLastActivityAgo(page, IN_WARNING_WINDOW);
      const warning = new IdleWarning(page);
      await expect(warning.signOut).toBeVisible();
      // ขั้นที่ 2: เลื่อนเมาส์เข้าหาปุ่มทีละน้อยเหมือนตอนเทสด้วยมือ แล้วกด Sign out ต้องออกจากระบบ
      test.fail(true, 'บั๊กข้อ 3: pointermove ปิดกล่องเตือนก่อนเมาส์ถึงปุ่ม (IdleSignOutGate.web.tsx:14, 76, 92-95)');
      await page.mouse.move(5, 5);
      await page.mouse.move(400, 300, { steps: 5 });
      await warning.signOut.click({ timeout: 5_000 });
      await expect(new LoginPage(page).expiredNotice).toBeVisible();
    },
  );

  test(
    'the Sign out button in the warning signs out when reached with the keyboard',
    { tag: '@known-bug' },
    async ({ page, loginAs }) => {
      // ขั้นที่ 1: ล็อกอิน รอให้พ้นช่วง 15 วินาที แล้วตั้งเวลาให้กล่องเตือนขึ้น โฟกัสเริ่มที่ "Stay signed in" (autoFocus :132)
      await signInAsAgent(page, loginAs);
      await waitPastActivityWindow(page);
      await setLastActivityAgo(page, IN_WARNING_WINDOW);
      const warning = new IdleWarning(page);
      await expect(warning.stay).toBeFocused();
      // ขั้นที่ 2: Shift+Tab ไปที่ปุ่ม Sign out (อยู่ก่อนหน้า) แล้วกด Enter ต้องออกจากระบบ
      test.fail(true, 'บั๊กข้อ 3: keydown ปิดกล่องเตือนตั้งแต่แป้นแรก (IdleSignOutGate.web.tsx:14, 76, 92-95)');
      await page.keyboard.press('Shift+Tab');
      await expect(warning.signOut).toBeFocused({ timeout: 3_000 });
      await page.keyboard.press('Enter');
      await expect(new LoginPage(page).expiredNotice).toBeVisible();
    },
  );

  test('reloading after the limit signs out and asks to sign in again', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอิน แล้วตั้งเวลาย้อนไปเกินเวลาหมด โดยไม่สั่งให้ตัวตรวจทำงาน (ให้หมดเวลาตอนหน้าเริ่มหลังโหลดใหม่ :91)
    await signInAsAgent(page, loginAs);
    await setLastActivityAgo(page, PAST_LIMIT, { notify: false });
    // ขั้นที่ 2: โหลดหน้าใหม่ ต้องออกจากระบบ ไป /login?next=/agent และขึ้นข้อความหมดเวลา
    // ผลเทสด้วยมือยืนยัน URL ส่วนข้อความหมดเวลาในแท็บเดียวเป็นค่าที่คาดจากโค้ด (signOutIdle → endSession 'expired': AuthContext.tsx:338, 346)
    await page.reload();
    await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('next') === '/agent');
    await expect(new LoginPage(page).expiredNotice).toBeVisible();
    expect(await hasStoredSession(page)).toBe(false);
  });
});

test.describe('two tabs', () => {
  test('timing out in one tab signs the other tab out too', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินในแท็บที่ 1 แล้วเปิดแท็บที่ 2
    await signInAsAgent(page, loginAs);
    const second = await openSecondAgentTab(page);
    // ขั้นที่ 2: ตั้งเวลาย้อนเกินเวลาหมดในแท็บที่ 1 ทั้ง 2 แท็บต้องไปหน้า login
    // แท็บที่ 2 อาจออกจากระบบเพราะ storage event ของเวลา (IdleSignOutGate.web.tsx:100-102)
    // หรือเพราะแท็บที่ 1 แจ้งว่าหมดเวลา (markAuthEvent AuthContext.tsx:334) เทสนี้ไม่แยก 2 ทางนี้
    await setLastActivityAgo(page, PAST_LIMIT);
    await expect(second).toHaveURL((url) => url.pathname === '/login', { timeout: 30_000 });
    await expect(page).toHaveURL((url) => url.pathname === '/login', { timeout: 30_000 });
  });

  test('signing in in one tab signs the other tab in', async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดหน้า login ค้างไว้ในแท็บที่ 2
    const second = await page.context().newPage();
    await new LoginPage(second).goto();
    await expect(new LoginPage(second).submit).toBeVisible();
    // ขั้นที่ 2: ล็อกอินในแท็บที่ 1 แท็บที่ 2 รับ session จาก storage event (AuthContext.tsx:141-170)
    // แล้วหน้า login พาไปหน้าแรกของบทบาท (login.tsx:99-104)
    await loginAs('agent', { page });
    await expect(second).toHaveURL((url) => url.pathname === '/agent', { timeout: 30_000 });
  });

  test('signing out in one tab sends both tabs to the guest home', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินในแท็บที่ 1 แล้วเปิดแท็บที่ 2
    await signInAsAgent(page, loginAs);
    const second = await openSecondAgentTab(page);
    // ขั้นที่ 2: ออกจากระบบในแท็บที่ 1 ทั้ง 2 แท็บต้องไปหน้าแรกของผู้เยี่ยมชม "/"
    // (ลบ session ด้วยเหตุผล signedOut → แท็บอื่นไปหน้าผู้เยี่ยมชม: lib/auth/cross-tab-rules.ts)
    await new AgentShell(page).signOut();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect(second).toHaveURL((url) => url.pathname === '/', { timeout: 30_000 });
  });

  test(
    'a tab reloaded after the other tab timed out still shows the expired notice',
    { tag: '@known-bug' },
    async ({ page, loginAs }) => {
      // ขั้นตอนตามผลเทสข้อ 5: ตั้งเวลาในแท็บที่ 1 แล้วโหลดแท็บที่ 1 ใหม่
      // ขั้นที่ 1: ล็อกอินในแท็บที่ 1 แล้วเปิดแท็บที่ 2
      await signInAsAgent(page, loginAs);
      await openSecondAgentTab(page);
      // ขั้นที่ 2: ตั้งเวลาในแท็บที่ 1 โดยไม่สั่งให้ตัวตรวจของแท็บที่ 1 ทำงาน แท็บที่ 2 ได้ storage event แล้วออกจากระบบ
      // รอจน session ถูกล้าง (ลำดับที่น่าจะเกิดตอนเทสด้วยมือ) เพื่อไม่ให้ผลขึ้นกับจังหวะเวลา
      await setLastActivityAgo(page, PAST_LIMIT, { notify: false });
      // อ่านค่าได้ไม่สำเร็จระหว่างที่แท็บกำลังเปลี่ยนหน้า (ตาม event ของแท็บที่ 2) ให้นับว่ายังไม่ล้าง แล้วอ่านใหม่
      await expect.poll(() => hasStoredSession(page).catch(() => true), { timeout: 30_000 }).toBe(false);
      // ขั้นที่ 3: โหลดแท็บที่ 1 ใหม่ ต้องยังบอกผู้ใช้ว่าหมดเวลา
      // สาเหตุที่ code-scout อนุมาน (ยังไม่ได้พิสูจน์): ข้อความหมดเวลาเป็นแค่ state ใน AuthContext.tsx:108
      //   แท็บที่โหลดหลัง session ถูกล้างแล้วได้ผล restoreSession แบบ none จึงไม่ตั้งข้อความ (session-expiry.ts:59-61)
      await page.reload();
      await expect(page).toHaveURL((url) => url.pathname === '/login');
      test.fail(true, 'บั๊กข้อ 5: แท็บที่โหลดใหม่หลังหมดเวลาไม่บอกผู้ใช้ว่าหมดเวลา');
      await expect(new LoginPage(page).expiredNotice).toBeVisible();
    },
  );
});

test.describe('sign out of all devices', () => {
  test('the confirm dialog focuses Close when opened and Esc closes it', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอิน แล้วเปิดกล่อง "ออกจากทุกอุปกรณ์" จากเมนูบัญชี
    await signInAsAgent(page, loginAs);
    const shell = new AgentShell(page);
    await shell.openAccountMenu();
    await shell.signOutAllButton.click();
    const dialog = shell.signOutAllDialog;
    await expect(dialog).toBeVisible();
    await expect(shell.signOutAllTitle).toHaveText(EN.signOutAllTitle);
    // ขั้นที่ 2: โฟกัสแรกอยู่ที่ปุ่ม Close ไม่มี autoFocus ใน WebDialog.tsx จึงเป็นค่าเริ่มต้นของ <dialog>.showModal()
    // คือปุ่มแรกที่โฟกัสได้ = ปุ่ม Close (:51-56)
    await expect(shell.signOutAllClose).toBeFocused();
    // ขั้นที่ 3: กด Esc กล่องปิด และยังล็อกอินอยู่ (ไม่ได้กดยืนยัน)
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await hasStoredSession(page)).toBe(true);
  });
});
