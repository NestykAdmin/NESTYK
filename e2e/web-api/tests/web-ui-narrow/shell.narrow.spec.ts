import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { MobileShell } from '../../src/web-ui/pages/mobile-shell.page';
import { NARROW, ROLE_TABS, TAB } from '../../src/web-ui/labels.narrow';
import { FLOW, HARDCODED } from '../../src/web-ui/labels';

/**
 * โครงหน้าเว็บบนจอแคบ: แท็บล่าง เมนูด้านข้าง และ URL (แผน 9 พ.ย. 2026 ข้อ N1-N5)
 * โค้ด: apps/consumer-app/app/index.tsx, lib/app-routes.ts, packages/ui/src/config/mobileTabMatrix.ts,
 *   mobileDrawerMenuMatrix.ts, agentComingSoon.ts, shells/MobileProfileDrawer.tsx ที่ qa/e2e 74b46f4
 *
 * สิ่งที่ต้องมีก่อนรัน: เหมือนชุด tests/web-ui (เว็บเปิดด้วย npm run web และเรียก API ของ staging)
 *   ตั้ง E2E_QA_AGENT_PASSWORD, E2E_QA_TENANT_PASSWORD, E2E_QA_LANDLORD_PASSWORD, E2E_QA_ADMIN_PASSWORD (ไม่ตั้งบัญชีไหน ข้อของบัญชีนั้นข้าม)
 * ทุกข้ออ่านอย่างเดียว คำขอเขียนที่เกิดเองตอนเปิดหน้า (POST /auth/sync ผ่าน, POST /bills/*\/refresh ถูกตัด) จัดการโดยตัวกันเดิม (guard.ts)
 */

/** ความกว้างที่เว็บเริ่มใช้โครงหน้าเดสก์ท็อป (app/index.tsx:188 WEB_SHELL_MIN_WIDTH; :756 ใช้ >=) */
const WEB_SHELL_MIN_WIDTH = 768;
const NARROW_HEIGHT = 844;

test.describe('agent', () => {
  test('N1 at 390px the agent gets the bottom tabs, and the desktop shell starts at 768px', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินที่ 390px (ค่าตั้งของชุดนี้) หน้าแรกของนายหน้าต้องเป็นแบบมือถือ
    await loginAs('agent', { next: '/agent' });
    await expect(page).toHaveURL((url) => url.pathname === '/agent');
    const shell = new MobileShell(page, 'agent');
    await expect(shell.tabBar).toBeVisible();
    expect(await shell.tabNames(), 'แท็บล่างของนายหน้า (mobileTabMatrix.ts:36-42)').toEqual([...ROLE_TABS.agent]);
    await expect(shell.desktopShell).toHaveCount(0);
    // หัวหน้าแรกของนายหน้าเป็น MobileWorkspaceHeader ที่มีปุ่ม Menu (app/index.tsx:798-811)
    await expect(shell.menuButton).toBeVisible();
    // ข้อสังเกตเรื่องการเข้าถึง: แท็บส่ง accessibilityState.selected ซึ่ง react-native-web 0.21 ไม่แปลงเป็น aria-selected
    test.info().annotations.push({
      type: 'ข้อสังเกต (การเข้าถึง)',
      description: `แท็บล่างที่มี aria-selected: ${await shell.tabsWithSelectedState()} จาก ${ROLE_TABS.agent.length}`,
    });

    // ขั้นที่ 2: กว้าง 768px พอดี ต้องสลับเป็นโครงหน้าเดสก์ท็อปทันทีโดยไม่โหลดหน้าใหม่ (useWindowDimensions: index.tsx:193, :756 ใช้ >=)
    await page.setViewportSize({ width: WEB_SHELL_MIN_WIDTH, height: NARROW_HEIGHT });
    await expect(shell.desktopShell).toBeVisible();
    await expect(shell.tabBar).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === '/agent');

    // ขั้นที่ 3: แคบลงเป็น 767px ต้องกลับเป็นแบบมือถือ (รอแท็บล่างขึ้นก่อน แล้วจึงตรวจว่าโครงหน้าเดสก์ท็อปหายไป)
    //   ตรวจขอบล่างหลังหน้าเป็นเดสก์ท็อปแล้ว เพื่อให้การตรวจต้องรอการเปลี่ยนจริง ไม่ผ่านจากสภาพเดิมของหน้า
    await page.setViewportSize({ width: WEB_SHELL_MIN_WIDTH - 1, height: NARROW_HEIGHT });
    await expect(shell.tabBar).toBeVisible();
    await expect(shell.desktopShell).toHaveCount(0);
  });

  test('N3 the bottom tabs change the URL, and More keeps the URL of the page before it', async ({ page, loginAs }) => {
    await loginAs('agent', { next: '/agent' });
    const shell = new MobileShell(page, 'agent');

    // ขั้นที่ 1: Leads -> /agent/leads (app-routes.ts:191) ยืนยันหน้าด้วยช่องค้นของหน้าลีดแบบมือถือ (ขึ้นหลังตัวโหลด: AgentLeadsScreen.tsx:234-240)
    await shell.tab(TAB.listingLead).click();
    await expect(page).toHaveURL((url) => url.pathname === '/agent/leads');
    await expect(shell.leadsSearch).toBeVisible({ timeout: 20_000 });

    // ขั้นที่ 2: Listing -> /agent/rooms (app-routes.ts:189) ช่องค้นของหน้าห้อง (AgentRoomsScreen.tsx:614)
    await shell.tab(TAB.listingRoom).click();
    await expect(page).toHaveURL((url) => url.pathname === '/agent/rooms');
    await expect(shell.roomsSearch).toBeVisible({ timeout: 20_000 });
    await expect(shell.leadsSearch).toHaveCount(0);

    // ขั้นที่ 3: Tenants -> /agent/clients (app-routes.ts:193) แท็บ All tenants ของรายการแบบมือถือ (AgentTenantsScreen.tsx:808-815)
    await shell.tab(TAB.clients).click();
    await expect(page).toHaveURL((url) => url.pathname === '/agent/clients');
    await expect(page.getByRole('tab', { name: new RegExp(`^${FLOW.tenantsTabAll} `) })).toBeVisible({ timeout: 20_000 });

    // ขั้นที่ 4: More ไม่มี path ของตัวเอง (ไม่อยู่ใน ROUTE_PAGES: app-routes.ts:181-216 และ stateToRoute คืน null: :281-292)
    //   URL จึงค้างที่หน้าก่อนหน้า ยืนยันหน้าด้วยปุ่ม Calendar ของแท็บ More (AgentMoreToolsBody.tsx:27, :58)
    await shell.tab(TAB.more).click();
    await expect(shell.moreCalendarButton).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === '/agent/clients');
    // ปุ่มของเครื่องมือที่ยังไม่เปิดใช้ต้องกดไม่ได้ (Contacts: agentComingSoon.ts:9, AgentMoreToolsBody.tsx:51-59)
    await expect(page.getByRole('button', { name: `${NARROW.moreContacts}, ${NARROW.comingSoon}`, exact: true })).toBeDisabled();
  });

  test('N4 opening agent URLs directly on a narrow screen', async ({ page, loginAs }) => {
    const shell = new MobileShell(page, 'agent');

    // ขั้นที่ 1: /agent/leads ตรง ๆ ได้หน้าลีดแบบมือถือ
    await loginAs('agent', { next: '/agent/leads' });
    await expect(page).toHaveURL((url) => url.pathname === '/agent/leads');
    await expect(shell.leadsSearch).toBeVisible({ timeout: 20_000 });
    await expect(shell.tabBar).toBeVisible();

    // ขั้นที่ 2: /agent/contracts เป็นหน้าที่ยังไม่เปิดใช้ ต้องได้การ์ด Coming soon (app/index.tsx:1362-1370) ไม่ใช่หน้าว่างหรือหน้าอื่น
    await page.goto('/agent/contracts');
    await expect(page).toHaveURL((url) => url.pathname === '/agent/contracts');
    await expect(page.getByText(NARROW.comingSoon, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    // หน้าสัญญาเดิมเป็นข้อมูลตัวอย่าง "(mock)" (index.tsx:1390) หน้านี้ต้องไม่แสดงแล้ว
    await expect(page.getByText(HARDCODED.mockMarker)).toHaveCount(0);

    // ขั้นที่ 3: /agent/more เป็นชื่อเดิมของแท็บ More ถูกพาไป /agent (ROUTE_ALIASES: app-routes.ts:219-221)
    await page.goto('/agent/more');
    await expect(page).toHaveURL((url) => url.pathname === '/agent');
    await expect(shell.menuButton).toBeVisible();
    await expect(shell.tabBar).toBeVisible();
  });

  test('N5 the agent side menu marks unfinished items as coming soon and opens the calendar', async ({ page, loginAs }) => {
    await loginAs('agent', { next: '/agent' });
    const shell = new MobileShell(page, 'agent');

    // ขั้นที่ 1: กด Menu บนหัวหน้า เมนูด้านข้างเปิด (app/index.tsx:798 openMenu)
    await shell.menuButton.click();
    await expect(shell.drawer).toBeVisible();

    // ขั้นที่ 2: รายการที่ยังไม่เปิดใช้ต้องมีคำว่า Coming soon และกดไม่ได้ (mobileDrawerMenuMatrix.ts:196-210 agentContracts, commission) ส่วน More tools กดได้
    await expect(shell.drawerSoonItem(NARROW.drawerContracts)).toBeDisabled();
    await expect(shell.drawerSoonItem(NARROW.drawerCommission)).toBeDisabled();
    await expect(shell.drawerItem(NARROW.drawerMoreTools)).toBeEnabled();

    // ขั้นที่ 3: กด CRM แล้วรายการย่อยกางออก Contact ยังไม่เปิดใช้ Calendar กดได้ (mobileDrawerMenuMatrix.ts:186-194)
    await shell.drawerItem(NARROW.drawerCrm).click();
    await expect(shell.drawerSoonItem(NARROW.drawerContact)).toBeDisabled();
    await expect(shell.drawerItem(NARROW.drawerCalendar)).toBeEnabled();

    // ขั้นที่ 4: กด Calendar เมนูปิด และไปหน้าปฏิทิน /agent/calendar (app-routes.ts:196)
    await shell.drawerItem(NARROW.drawerCalendar).click();
    await expect(page).toHaveURL((url) => url.pathname === '/agent/calendar');
    await expect(shell.drawer).toHaveCount(0);
    await expect(page.getByRole('button', { name: NARROW.nextMonth, exact: true })).toBeVisible({ timeout: 20_000 });

    // ขั้นที่ 5: เปิดเมนูอีกครั้งแล้วกด Escape เมนูต้องปิด (RN Modal onRequestClose บนเว็บ)
    await shell.menuButton.click();
    await expect(shell.drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(shell.drawer).toHaveCount(0);
  });
});

test.describe('other roles', () => {
  const homes = [
    { role: 'tenant', home: '/tenant' },
    { role: 'landlord', home: '/landlord' },
    { role: 'admin', home: '/admin' },
  ] as const;

  for (const { role, home } of homes) {
    test(`N2 ${role} gets its own bottom tabs on a narrow screen`, async ({ page, loginAs }) => {
      await loginAs(role, { next: home });
      await expect(page).toHaveURL((url) => url.pathname === home);
      const shell = new MobileShell(page, role);
      await expect(shell.tabBar).toBeVisible();
      expect(await shell.tabNames(), `แท็บล่างของ ${role} (mobileTabMatrix.ts:15-49)`).toEqual([...ROLE_TABS[role]]);
      await expect(shell.desktopShell).toHaveCount(0);
    });
  }
});
