import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { MobileShell } from '../../src/web-ui/pages/mobile-shell.page';
import { PartyPage } from '../../src/web-ui/pages/party.page';
import { NARROW, ROLE_TABS, TAB } from '../../src/web-ui/labels.narrow';
import { FLOW, PARTY_COPY } from '../../src/web-ui/labels';
import { billReadsAllowed } from '../../src/web-ui/guard';
import { okJson, waitForApi } from '../../src/web-ui/support/api';

/**
 * ผู้เช่า ผู้ให้เช่า และ guest บนจอแคบ (แผน 9 พ.ย. 2026 ข้อ N10-N12) อ่านอย่างเดียว
 * โค้ด: apps/consumer-app/app/index.tsx, components/TenantBillsScreen.tsx, lib/tenant-bills-api.ts,
 *   packages/ui/src/components/MobileHeaderActions.tsx, shells/MobileProfileDrawer.tsx ที่ qa/e2e 74b46f4
 *
 * สิ่งที่ต้องมีก่อนรัน: เหมือนชุด tests/web-ui (เว็บเปิดด้วย npm run web และเรียก API ของ staging)
 *   และตั้ง E2E_QA_TENANT_PASSWORD กับ E2E_QA_LANDLORD_PASSWORD (ข้อ N12 ของ guest ไม่ต้องล็อกอิน)
 * POST /bills/mine/refresh และ /bills/received/refresh ถูกตัวกันตัดทุกครั้ง (guard.ts) GET บิลผ่านเฉพาะเมื่อ global-setup ยืนยันว่า API อ่านอย่างเดียว
 *   ข้อที่ต้องอ่านบิลจริงข้ามเมื่อ E2E_WEB_BILL_READS ไม่ใช่ allowed (แบบเดียวกับ tests/web-ui/party-pages.spec.ts)
 * หน้าบิลและรายได้แสดงชื่อผู้เช่า ภาพหน้าจอปิดทั้งชุดในค่าตั้ง
 */

/** ชื่อของบิลใบใดก็ได้บนหน้า "Rent <เดือน ปี>" (TenantBillsScreen.tsx:215, :259) แบบเดียวกับ party-pages.spec.ts */
const BILL_TITLE = new RegExp(`^${FLOW.rentFor.replace('{month}', '[^\\s{]')}`);

test.describe('tenant', () => {
  test('N10 Payment history on a narrow screen adds history=1, and Back removes it', async ({ page, loginAs }) => {
    // หัวหน้าบิลแบบมือถือ (MobileSectionHeader: app/index.tsx:1854-1888) ปุ่มขวาชื่อ "Payment history" (:1887) และปุ่มซ้ายเป็น Back เมื่อเปิดประวัติ (:1873)
    // ขั้นที่ 1: เปิด /tenant/bills (app-routes.ts:204) ได้หน้าบิลแบบมือถือที่มีแท็บล่าง
    await loginAs('tenant', { next: '/tenant/bills' });
    await expect(page).toHaveURL((url) => url.pathname === '/tenant/bills' && url.search === '');
    const shell = new MobileShell(page, 'tenant');
    await expect(shell.tab(TAB.bills)).toBeVisible();

    // ขั้นที่ 2: กด Payment history URL ต้องมี history=1 (app-routes.ts:297)
    await page.getByRole('button', { name: PARTY_COPY.paymentHistory, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/tenant/bills' && url.searchParams.get('history') === '1');

    // ขั้นที่ 3: กด Back บนหัวหน้า (onBackPress -> setBillHistory(false): index.tsx:1874-1877) URL กลับเป็น /tenant/bills
    await shell.backButton.click();
    await expect(page).toHaveURL((url) => url.pathname === '/tenant/bills' && url.search === '');
    await expect(page.getByRole('button', { name: PARTY_COPY.paymentHistory, exact: true })).toBeVisible();
  });

  test('N10b Bills on a narrow screen shows the bills from GET /bills/mine and still blocks the refresh', async ({ page, loginAs, guard }) => {
    test.skip(!billReadsAllowed(), 'ระยะ 2: global-setup ไม่ได้ยืนยันว่า GET บิลของ API นี้อ่านอย่างเดียว (E2E_WEB_BILL_READS)');
    // ขั้นที่ 1: หน้าบิลรอ GET /bills/mine กับ /contracts/mine ก่อนแสดง (TenantBillsScreen.tsx:63-71) จึงรอทั้ง 2 คำตอบ
    const bills = waitForApi(page, 'GET', '/bills/mine');
    const contracts = waitForApi(page, 'GET', '/contracts/mine');
    await loginAs('tenant', { next: '/tenant/bills' });
    const rows = await okJson<unknown[]>(await bills);
    await okJson<unknown[]>(await contracts);
    test.info().annotations.push({ type: 'บิลของ qa-tenant', description: `${rows.length} รายการ` });

    // ขั้นที่ 2: ไม่มีบิล ต้องขึ้น "No bills yet" ; มีบิล ต้องเห็นชื่อบิลไม่น้อยกว่าจำนวนในคำตอบ และ refresh ต้องถูกตัด
    const party = new PartyPage(page);
    if (rows.length === 0) {
      await expect(party.text(FLOW.tenantBillsEmpty)).toBeVisible();
    } else {
      await expect.poll(() => page.getByText(BILL_TITLE).count(), { message: 'จำนวนชื่อบิล "Rent <เดือน>" บนหน้า' }).toBeGreaterThanOrEqual(rows.length);
      await expect(party.text(FLOW.tenantBillsEmpty)).toHaveCount(0);
    }
    await expect(party.text(FLOW.tenantBillsLoadFailed)).toHaveCount(0);
    expect(guard.of('bill-write').map((entry) => new URL(entry.target).pathname)).toContain('/api/v1/bills/mine/refresh');
  });
});

test.describe('landlord', () => {
  test('N11 Income on a narrow screen shows the bills from GET /bills/received', async ({ page, loginAs }) => {
    test.skip(!billReadsAllowed(), 'ระยะ 2: global-setup ไม่ได้ยืนยันว่า GET บิลของ API นี้อ่านอย่างเดียว (E2E_WEB_BILL_READS)');
    // ขั้นที่ 1: /landlord/income (app-routes.ts:211) แท็บ income ใช้ TenantBillsScreen mode owner หัวหน้าเป็น "Rental Income" (getScreenTitle: index.tsx:162-163)
    const bills = waitForApi(page, 'GET', '/bills/received');
    await loginAs('landlord', { next: '/landlord/income' });
    const rows = await okJson<unknown[]>(await bills);
    await expect(page).toHaveURL((url) => url.pathname === '/landlord/income');
    test.info().annotations.push({ type: 'รายได้ของ qa-landlord', description: `${rows.length} บิล` });

    // ขั้นที่ 2: หน้าแบบมือถือมีแท็บ Income และหัวหน้า Rental Income ; ไม่มีบิล ต้องขึ้นข้อความว่าง มีบิล ต้องเห็นชื่อบิล
    const shell = new MobileShell(page, 'landlord');
    await expect(shell.tab(TAB.income)).toBeVisible();
    await expect(page.getByText(NARROW.incomeTitle, { exact: true }).first()).toBeVisible();
    const party = new PartyPage(page);
    if (rows.length === 0) {
      await expect(party.text(FLOW.ownerIncomeEmpty)).toBeVisible();
    } else {
      await expect(page.getByText(BILL_TITLE).first()).toBeVisible();
      await expect(party.text(FLOW.ownerIncomeEmpty)).toHaveCount(0);
    }
    await expect(party.text(FLOW.ownerLoadFailed)).toHaveCount(0);
    await expect(party.alerts).toHaveCount(0);
  });
});

test.describe('guest', () => {
  test('N12 the guest home shows the guest tabs and footer, and Sign In goes to /login', async ({ page }) => {
    // ขั้นที่ 1: guest ไม่มีโครงหน้าเดสก์ท็อป (index.tsx:757-760) หน้า / จึงเป็นแบบมือถือทุกความกว้าง
    await page.goto('/');
    const shell = new MobileShell(page, 'guest');
    await expect(shell.tabBar).toBeVisible({ timeout: 20_000 });
    expect(await shell.tabNames(), 'แท็บล่างของ guest (mobileTabMatrix.ts:16-21)').toEqual([...ROLE_TABS.guest]);
    // ส่วนท้ายหน้าของ guest (index.tsx:1964-1966, legal/GuestPublicFooter.web.tsx:15)
    await expect(page.getByTestId('guest.footer')).toBeVisible();

    // ขั้นที่ 2: ปุ่มรูปคนบนหัวหน้า (ชื่อ "Sign in": MobileHeaderActions.tsx:34) เปิดเมนูด้านข้าง (index.tsx:1896) ไม่ได้ไปหน้า login ทันที
    await page.getByRole('button', { name: NARROW.signInHeader, exact: true }).click();
    await expect(shell.drawer).toBeVisible();
    // ขั้นที่ 3: ปุ่ม "Sign In" ในเมนู (MobileButton ไม่มี role: MobileProfileDrawer.tsx:469-473) เรียก handleAuthAction -> router.push('/login') (index.tsx:1635-1639)
    await shell.drawer.getByText(NARROW.signInDrawer, { exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/login');
  });
});
