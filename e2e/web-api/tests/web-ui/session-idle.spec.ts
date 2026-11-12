import type { Page } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { LoginPage } from '../../src/web-ui/pages/login.page';
import { IdleWarning } from '../../src/web-ui/pages/session.page';
import { EN } from '../../src/web-ui/labels';
import { webUiEnv } from '../../src/web-ui/web-ui-env';
import { ACTIVITY_WRITE_MS, hasStoredSession, IN_WARNING_WINDOW, PAST_LIMIT, readAuthEvent, setLastActivityAgo } from '../../src/web-ui/support/idle';

/**
 * การหมดเวลาและ session ข้ามแท็บของเว็บ (ผลเทสด้วยมือ 4 พ.ย. 2026 หัวข้อ "Session" และบั๊กข้อ 3, 5 [WEB-005, WEB-007])
 * โค้ด: apps/consumer-app/components/web-session/IdleSignOutGate.web.tsx, lib/auth/AuthContext.tsx, lib/auth/cross-tab*.ts
 * ที่ qa/e2e 648dd28 (merge pre/dev/review 9821d87) บั๊กข้อ 3 และ 5 [WEB-005, WEB-007] ทีมแก้แล้ว
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
 * การใช้งานที่ห่างจากการเขียนเวลาครั้งก่อนในแท็บนั้นน้อยกว่า 15 วินาทีไม่ถูกนับ (IdleSignOutGate.web.tsx:100)
 * การล็อกอินเขียนเวลาไว้ (:85) ข้อที่ต้องให้การขยับเมาส์หรือกดแป้นถูกนับ เหมือนผู้ใช้ที่ไม่ได้แตะเครื่องมานาน จึงต้องให้พ้นช่วงนี้ก่อน
 * ข้อกล่องเตือน (บั๊กข้อ 3 [WEB-005]) ยังต้องรอ: ถ้าไม่รอ เมาส์และแป้นไม่ถูกนับเพราะช่วง 15 วินาทีอยู่แล้ว เทสจะผ่านโดยไม่ได้ตรวจการแก้ที่ :98
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

  test('the Sign out button in the warning signs out when reached with the mouse', async ({ page, loginAs }) => {
    // บั๊กข้อ 3 [WEB-005] แก้แล้ว: ระหว่างกล่องเตือนแสดง การขยับเมาส์และกดแป้นไม่นับเป็นการใช้งาน (IdleSignOutGate.web.tsx:95-98)
    // ปิดกล่องได้ด้วยปุ่ม "Stay signed in", "Sign out" หรือเมื่อหมดเวลาเท่านั้น
    // ขั้นที่ 1: ล็อกอิน รอให้พ้นช่วง 15 วินาที แล้วตั้งเวลาให้กล่องเตือนขึ้น
    await signInAsAgent(page, loginAs);
    await waitPastActivityWindow(page);
    await setLastActivityAgo(page, IN_WARNING_WINDOW);
    const warning = new IdleWarning(page);
    await expect(warning.signOut).toBeVisible();
    // ขั้นที่ 2: เลื่อนเมาส์เข้าหาปุ่มทีละน้อยเหมือนตอนเทสด้วยมือ กล่องต้องยังอยู่
    await page.mouse.move(5, 5);
    await page.mouse.move(400, 300, { steps: 5 });
    await expect(warning.dialog).toBeVisible();
    // ขั้นที่ 3: กด Sign out ต้องออกจากระบบแบบหมดเวลา: ไป /login?next=/agent พร้อมข้อความหมดเวลา และไม่เหลือ session
    // (expire → signOutIdle → endSession 'local','expired': IdleSignOutGate.web.tsx:51-58, AuthContext.tsx:332-363; index.tsx:659-662)
    await warning.signOut.click({ timeout: 5_000 });
    await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('next') === '/agent');
    await expect(new LoginPage(page).expiredNotice).toBeVisible();
    expect(await hasStoredSession(page)).toBe(false);
  });

  test('the Sign out button in the warning signs out when reached with the keyboard', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอิน รอให้พ้นช่วง 15 วินาที แล้วตั้งเวลาให้กล่องเตือนขึ้น โฟกัสเริ่มที่ "Stay signed in" (autoFocus :138)
    await signInAsAgent(page, loginAs);
    await waitPastActivityWindow(page);
    await setLastActivityAgo(page, IN_WARNING_WINDOW);
    const warning = new IdleWarning(page);
    await expect(warning.stay).toBeFocused();
    // ขั้นที่ 2: Shift+Tab ไปที่ปุ่ม Sign out (อยู่ก่อนหน้าใน DOM :135) กล่องต้องยังอยู่ (บั๊กข้อ 3 [WEB-005] แก้แล้ว: :98)
    await page.keyboard.press('Shift+Tab');
    await expect(warning.signOut).toBeFocused({ timeout: 3_000 });
    await expect(warning.dialog).toBeVisible();
    // ขั้นที่ 3: กด Enter ต้องออกจากระบบแบบหมดเวลา เหมือนข้อที่ใช้เมาส์
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('next') === '/agent');
    await expect(new LoginPage(page).expiredNotice).toBeVisible();
    expect(await hasStoredSession(page)).toBe(false);
  });

  test('reloading after the limit signs out and asks to sign in again', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอิน แล้วตั้งเวลาย้อนไปเกินเวลาหมด โดยไม่สั่งให้ตัวตรวจทำงาน (ให้หมดเวลาตอนหน้าเริ่มหลังโหลดใหม่ :91)
    await signInAsAgent(page, loginAs);
    await setLastActivityAgo(page, PAST_LIMIT, { notify: false });
    // ขั้นที่ 2: โหลดหน้าใหม่ ต้องออกจากระบบ ไป /login?next=/agent และขึ้นข้อความหมดเวลา
    // ผลเทสด้วยมือยืนยัน URL ส่วนข้อความหมดเวลาในแท็บเดียวเป็นค่าที่คาดจากโค้ด (signOutIdle → endSession 'expired': AuthContext.tsx:332-363)
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
    // แท็บที่ 2 อาจออกจากระบบเพราะ storage event ของเวลา (IdleSignOutGate.web.tsx:106-108)
    // หรือเพราะแท็บที่ 1 แจ้งว่าหมดเวลา (markAuthEvent AuthContext.tsx:350) เทสนี้ไม่แยก 2 ทางนี้
    await setLastActivityAgo(page, PAST_LIMIT);
    await expect(second).toHaveURL((url) => url.pathname === '/login', { timeout: 30_000 });
    await expect(page).toHaveURL((url) => url.pathname === '/login', { timeout: 30_000 });
  });

  test('signing in in one tab signs the other tab in', async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดหน้า login ค้างไว้ในแท็บที่ 2
    const second = await page.context().newPage();
    await new LoginPage(second).goto();
    await expect(new LoginPage(second).submit).toBeVisible();
    // ขั้นที่ 2: ล็อกอินในแท็บที่ 1 แท็บที่ 2 รับ session จาก storage event (AuthContext.tsx:151-180)
    // แล้วหน้า login พาไปหน้าแรกของบทบาท (login.tsx:99-104)
    await loginAs('agent', { page });
    await expect(second).toHaveURL((url) => url.pathname === '/agent', { timeout: 30_000 });
  });

  // ออกจากระบบเมื่อเปิดไว้ 2 แท็บ: ทีมตอบ 6 พ.ย. 2026 ว่าทุกแท็บไปหน้า login รวมแท็บที่กด Sign Out
  //   (claude/nestyk-web-review-648dd28-for-dev-2026-11-06.md เรื่องที่ 1) ผลรันก่อนตอบ: แท็บที่กดไป "/" แท็บอื่นไป /login?next=%2Fagent
  //   พร้อมข้อความหมดเวลา เว็บค่าเริ่มต้นยังพาแท็บที่กดไป "/" (afterSignOutHref: lib/route-access.ts) ส่วนเว็บที่ตั้ง
//   EXPO_PUBLIC_WEB_SIGN_OUT_TO=login ไป /login ตั้งแต่ 7a9bf48 (ข้อแท็บที่กดเป็น known-bug เฉพาะเมื่อไม่ได้ตั้ง E2E_WEB_SIGN_OUT_TO=login)
  // ทั้ง 3 ข้อออกจากระบบด้วยปุ่ม Sign Out ในเมนูบัญชี (scope local: AuthContext.tsx:344) ไม่ตัด session ของคนอื่น
  // ข้อแรกกับข้อที่ 3 ผูกกัน (อนุมานจากโค้ด): ตอนนี้แท็บอื่นไปหน้า login ได้เพราะถูกนับเป็นหมดเวลา ซึ่งคือบั๊กของข้อที่ 3
  //   เมื่อออกจากระบบตามปกติ เว็บค่าเริ่มต้นยังพาแท็บอื่นไป "/" (cross-tab-rules.ts:6-8, AuthContext.tsx:158-160) ถ้าทีมแก้ข้อที่ 3 แต่ไม่แก้ทางนี้ ข้อแรกจะแดง
//   (เว็บที่ตั้ง login พาแท็บอื่นไป /login ทาง landElsewhere ใน app/index.tsx ที่ 7a9bf48 อยู่แล้ว)

  test('signing out in one tab sends the other tab to the login page', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินในแท็บที่ 1 แล้วเปิดแท็บที่ 2
    await signInAsAgent(page, loginAs);
    const second = await openSecondAgentTab(page);
    // ขั้นที่ 2: ออกจากระบบในแท็บที่ 1 แท็บที่ 2 ต้องไปหน้า login (ตรวจแค่ pathname ส่วน next= ไม่ได้ตกลงกับทีม)
    await new AgentShell(page).signOut();
    await expect(second).toHaveURL((url) => url.pathname === '/login', { timeout: 30_000 });
  });

  // ข้อนี้เป็น known-bug เฉพาะเมื่อไม่ได้ตั้ง E2E_WEB_SIGN_OUT_TO=login (เว็บที่ใช้ค่าเริ่มต้นไป "/")
  //   ทีมแก้ที่ pre/dev/review 7a9bf48: เมื่อเว็บตั้ง EXPO_PUBLIC_WEB_SIGN_OUT_TO=login แท็บที่กดไปถึง /login จริง
  //   ผลรัน 9 พ.ย. 2026 (เว็บตั้ง login) ข้อนี้ขึ้น "Expected to fail, but passed" จึงเปลี่ยนเป็นเทสปกติเมื่อตั้งค่านี้
  const signOutKnownBug = webUiEnv.signOutTo !== 'login';
  test('signing out sends the tab that signed out to the login page', { tag: signOutKnownBug ? '@known-bug' : [] }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินในแท็บที่ 1 แล้วเปิดแท็บที่ 2
    await signInAsAgent(page, loginAs);
    await openSecondAgentTab(page);
    // ขั้นที่ 2: ออกจากระบบในแท็บที่ 1 รอให้ถึงหน้าใดหน้าหนึ่งที่รู้จัก ("/" ของเว็บค่าเริ่มต้น หรือ /login ของเว็บที่ตั้ง login)
    // ถ้าไปหน้าอื่น ข้อนี้แดงที่ขั้นนี้ ไม่ถูกนับเป็นบั๊กที่รู้แล้ว (ข้อสังเกตของ test-reviewer)
    await new AgentShell(page).signOut();
    await expect(page).toHaveURL((url) => url.pathname === '/' || url.pathname === '/login', { timeout: 30_000 });
    // ขั้นที่ 3: แท็บที่กดต้องอยู่ที่หน้า login
    test.fail(signOutKnownBug, 'WEB-002: ไม่ได้ตั้ง E2E_WEB_SIGN_OUT_TO=login: เว็บค่าเริ่มต้นพาแท็บที่กด Sign Out ไป "/" ทีมตอบ 6 พ.ย. ว่าต้องไปหน้า login');
    await expect(page, 'ถ้าค้างที่ "/" ให้ตรวจว่าเว็บตั้ง EXPO_PUBLIC_WEB_SIGN_OUT_TO=login ตรงกับ E2E_WEB_SIGN_OUT_TO').toHaveURL(
      (url) => url.pathname === '/login',
      { timeout: 10_000 },
    );
  });

  test('the other tab does not say the session expired after a sign out', { tag: '@known-bug' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินในแท็บที่ 1 แล้วเปิดแท็บที่ 2
    await signInAsAgent(page, loginAs);
    const second = await openSecondAgentTab(page);
    // ขั้นที่ 2: ออกจากระบบในแท็บที่ 1 แล้วรอให้แท็บที่ 2 แสดงหน้า login ครบ
    // ข้อความหมดเวลาขึ้นพร้อมฟอร์ม (อนุมานจากโค้ด): session กับสถานะหมดเวลาถูกตั้งในฟังก์ชันเดียวกัน (AuthContext.tsx:141-142, 162-164)
    // และหน้า login วาดข้อความ (login.tsx:91, 349-358) ในต้นไม้เดียวกับปุ่ม
    await new AgentShell(page).signOut();
    await expect(second).toHaveURL((url) => url.pathname === '/login', { timeout: 30_000 });
    const login = new LoginPage(second);
    await expect(login.submit).toBeVisible();
    // หลักฐานให้ทีมแยกสาเหตุ (ไม่เปลี่ยนผลของเทส): เหตุผลที่แท็บล่าสุดเขียนไว้ ผลรัน 6 พ.ย. 2 รอบได้ 'expired' ทั้ง 2 รอบ
    // ค่านี้เป็นของแท็บที่เขียนล่าสุด จึงใช้ชี้ทางได้เท่านั้น (เช่น AuthContext.tsx:134 เมื่อได้ 401 หรือ :350 ผ่าน endSession 'expired')
    test.info().annotations.push({ type: 'nestyk.web.authEvent', description: await readAuthEvent(second) });
    // ขั้นที่ 3: ผู้ใช้กด Sign Out เอง แท็บที่ 2 ต้องไม่บอกว่า session หมดเวลา
    test.fail(true, 'WEB-003: แท็บอื่นขึ้น "Your session has expired" หลังผู้ใช้กด Sign Out เอง (แท็บที่ 2 ถูกนับเป็นหมดเวลา)');
    await expect(login.expiredNotice).toHaveCount(0);
  });

  test('a tab reloaded after the other tab timed out still shows the expired notice', async ({ page, loginAs }) => {
    // บั๊กข้อ 5 [WEB-007] แก้แล้ว: แท็บที่ล้าง session เพราะหมดเวลาเขียนเวลาไว้ที่ nestyk.web.expiredAt (cross-tab.web.ts:8)
    // แท็บที่โหลดใหม่โดยไม่มี session อ่านค่านี้ครั้งเดียวแล้วลบ (takeExpiryNotice :30-38, AuthContext.tsx:219) จึงขึ้นข้อความ 1 ครั้ง
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
    await page.reload();
    await expect(page).toHaveURL((url) => url.pathname === '/login');
    await expect(new LoginPage(page).expiredNotice).toBeVisible();
  });
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
