import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';

/**
 * โครงหน้าเดสก์ท็อปของนายหน้า (ผลเทสด้วยมือ 4 พ.ย. 2026 หัวข้อ "Workspace ของนายหน้า" และบั๊กข้อ 10)
 * โค้ด: apps/consumer-app/components/agent-web/AgentWorkspace.web.tsx และ ui/WebMenu.tsx (qa/e2e efab8d0)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web และเรียก API ของ staging, ตั้ง E2E_QA_AGENT_PASSWORD
 * ทุกข้อล็อกอินเป็น qa-agent (เรียก POST /auth/sync ที่ staging ซิงก์บัญชีที่มีอยู่แล้ว) และไม่บันทึกอะไร
 * (ธีมเก็บใน localStorage ของเบราว์เซอร์เทสเท่านั้น)
 */

test.beforeEach(async ({ page, loginAs }) => {
  await loginAs('agent');
  await expect(new AgentShell(page).createMenu).toBeVisible();
});

test('the dark theme stays after reloading', async ({ page }) => {
  // ขั้นที่ 1: เลือกธีมมืด ค่าเก็บใน nestyk.web.theme (AgentWorkspace.web.tsx:79, 233) และราก aw-shell มี data-theme (:483)
  const shell = new AgentShell(page);
  await shell.themeButton.click();
  await shell.themeOption('dark').click();
  await expect(shell.root).toHaveAttribute('data-theme', 'dark');
  // ขั้นที่ 2: โหลดหน้าใหม่ ธีมยังเป็นมืด
  await page.reload();
  await expect(shell.root).toHaveAttribute('data-theme', 'dark');
});

test('a 700px wide window switches to the phone layout', async ({ page }) => {
  // ขั้นที่ 1: ย่อหน้าต่างเหลือ 700px ไม่มีโครงหน้าเดสก์ท็อป (WEB_SHELL_MIN_WIDTH = 768: app/index.tsx:176)
  const shell = new AgentShell(page);
  await page.setViewportSize({ width: 700, height: 800 });
  await expect(shell.root).toHaveCount(0);
  // ขั้นที่ 2: ขยายกลับ โครงหน้าเดสก์ท็อปกลับมา
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(shell.root).toBeVisible();
});

test.describe('Create menu', () => {
  test('Esc closes the menu', async ({ page }) => {
    // ขั้นที่ 1: เปิดเมนู Create
    const shell = new AgentShell(page);
    await shell.createButton.click();
    await expect(shell.createList).toBeVisible();
    // ขั้นที่ 2: กด Esc เมนูปิด (WebMenu.tsx:41-42)
    await page.keyboard.press('Escape');
    await expect(shell.createList).toBeHidden();
  });

  test('Esc gives the focus back to the Create button', { tag: '@known-bug' }, async ({ page }) => {
    // ขั้นที่ 1: เปิดเมนู Create แล้วกด Esc
    const shell = new AgentShell(page);
    await shell.createButton.click();
    await expect(shell.createList).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(shell.createList).toBeHidden();
    // ขั้นที่ 2: โฟกัสต้องกลับไปที่ปุ่ม Create
    test.fail(true, 'บั๊กข้อ 10: WebMenu.tsx:41-42 ปิดเมนูแต่ไม่คืนโฟกัส (เมนูบัญชีคืนโฟกัส: AgentWorkspace.web.tsx:172-175)');
    await expect(shell.createButton).toBeFocused({ timeout: 3_000 });
  });

  test('clicking outside closes the menu', async ({ page }) => {
    // ขั้นที่ 1: เปิดเมนู Create
    const shell = new AgentShell(page);
    await shell.createButton.click();
    await expect(shell.createList).toBeVisible();
    // ขั้นที่ 2: คลิกชื่อหน้าบนแถบบน (ไม่ใช่ปุ่ม) เมนูปิด (WebMenu.tsx:38-40)
    await shell.topbarTitle.click();
    await expect(shell.createList).toBeHidden();
  });

  test('the click that closes the menu does not also press what is under it', { tag: '@known-bug' }, async ({ page }) => {
    // ขั้นที่ 1: เปิดเมนู Create แล้วคลิกการ์ดตัวเลขใบแรกบนแดชบอร์ด (อยู่นอกเมนู กดแล้วไปหน้าห้อง: AgentOverview.web.tsx:227-234, 376-384)
    const shell = new AgentShell(page);
    await shell.createButton.click();
    await expect(shell.createList).toBeVisible();
    await shell.firstDashboardCard.click();
    await expect(shell.createList).toBeHidden();
    // ขั้นที่ 2: คลิกนั้นต้องแค่ปิดเมนู หน้าต้องไม่เปลี่ยน
    // แอปเปลี่ยน URL ใน effect หลังวาดหน้า (lib/web-routes.web.ts:114-132) จึงเฝ้า URL ไว้ช่วงหนึ่ง ไม่ตรวจทันทีหลังคลิก (test-reviewer)
    test.fail(true, 'บั๊กข้อ 10: WebMenu.tsx:38-40 ปิดเมนูตอน mousedown แต่ไม่กันการคลิก ของที่อยู่ข้างใต้จึงถูกกดด้วย');
    const navigated = await page.waitForURL((url) => url.pathname !== '/agent', { timeout: 3_000 }).then(
      () => true,
      () => false,
    );
    expect(navigated, `หน้าเปลี่ยนไป ${new URL(page.url()).pathname}`).toBe(false);
  });
});
