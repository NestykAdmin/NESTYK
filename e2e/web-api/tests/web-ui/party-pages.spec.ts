import type { Page, Response } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { PartyPage } from '../../src/web-ui/pages/party.page';
import { alsoEnglish, EN, FLOW, FLOW_EN, HARDCODED, PARTY_COPY } from '../../src/web-ui/labels';
import { billReadsAllowed } from '../../src/web-ui/guard';
import { okJson, waitForApi } from '../../src/web-ui/support/api';

/**
 * หน้าของผู้เช่า (qa-tenant) และผู้ให้เช่า (qa-landlord) บนจอกว้าง
 *   (แผน claude/nestyk-web-flows-readonly-plan-2026-11-06.md ข้อ P1-P4 ของระยะ 1 และ B1-B4, E1 ของระยะ 2)
 * โค้ด: apps/consumer-app/app/index.tsx, components/PartyContractsScreen.tsx, TenantContractList.tsx, TenantBillsScreen.tsx,
 *   TenantNextBillCard.tsx, OwnerConfirmedRent.tsx, lib/tenant-bills-api.ts ที่ qa/e2e d6370ee (แอปเท่ากับ 648dd28)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web และเรียก API ของ staging, ตั้ง E2E_QA_TENANT_PASSWORD และ E2E_QA_LANDLORD_PASSWORD
 * ทุกข้ออ่านอย่างเดียว ไม่กด "View contract" (เอกสารที่ยังไม่มี URL ส่ง POST /contracts/mine/:id/document: lib/party-contracts-api.ts:25-27)
 * POST /bills/mine/refresh และ /bills/received/refresh ถูกตัวกันตัดทุกครั้ง (guard.ts) GET บิลผ่านเฉพาะเมื่อ global-setup ยืนยันว่า API อ่านอย่างเดียว
 *   ข้อที่ต้องอ่านบิลจริง (B1, B3, B4) ข้ามเมื่อ E2E_WEB_BILL_READS ไม่ใช่ allowed
 * ข้อ E1 และข้อการ์ด Confirmed rent ทำให้ GET บิลล้มเองด้วย page.route (คำขอไม่ออกจากเบราว์เซอร์) จึงรันได้ทั้ง 2 ระยะ
 * หน้าบิลและรายได้แสดงชื่อผู้เช่า (OwnerConfirmedRent.tsx:82, TenantBillsScreen.tsx:217) จึงปิดภาพหน้าจอ
 *   ข้อที่ไม่ผ่านยังมี error-context.md ที่มีข้อความบนหน้า ห้าม commit หรือแนบส่งต่อ
 */
test.use({ screenshot: 'off' });

/** ชื่อของบิลใบใดก็ได้บนหน้า "Rent <เดือน ปี>" (rentFor ใช้ทั้งหน้าบิลของผู้เช่าและหน้ารายได้: TenantBillsScreen.tsx:215, :259, TenantBillsContent.tsx:478) */
//   เดือนจัดรูปแบบตามภาษา (lib/bill-format.ts: Intl month long) ภาษาไทยเป็นชื่อเดือนไทย จึงรับตัวอักษรใดก็ได้ที่ไม่ใช่ช่องว่างหรือ { (ถ้าแอปลืมแทนค่า ข้อความ {month} จะไม่นับเป็นชื่อบิล)
const BILL_TITLE = new RegExp(`^${FLOW.rentFor.replace('{month}', '[^\\s{]')}`);

/** อ่าน JSON ของคำตอบที่อาจว่าง (GET /bills/mine/next ตอบ null ได้เมื่อไม่มีบิลถัดไป) */
async function okJsonOrNull<T>(response: Response): Promise<T | null> {
  expect(response.ok(), `${response.request().method()} ${new URL(response.url()).pathname} ตอบ ${response.status()}`).toBe(true);
  const text = (await response.text()).trim();
  return text === '' || text === 'null' ? null : (JSON.parse(text) as T);
}

/** ให้ GET <path> ของ API ล้มแบบเครือข่ายขาด ก่อนถึงตัวกันของ context (route ของ page ทำงานก่อน route ของ context) */
async function failApi(page: Page, path: string): Promise<void> {
  await page.route(
    (url) => url.pathname.toLowerCase() === `/api/v1${path}`,
    (route) => (route.request().method() === 'GET' ? route.abort('failed') : route.fallback()),
  );
}

/** ข้อความดิบที่ Chromium ใส่ใน TypeError เมื่อ fetch ล้มเพราะเครือข่าย */
const RAW_NETWORK_ERROR = 'Failed to fetch';

test.describe('tenant', () => {
  test('My contracts loads GET /contracts/mine and says so when there is none', async ({ page, loginAs }) => {
    // ขั้นที่ 1: /tenant/contracts เปิดรายการสัญญาของผู้เช่า (app-routes.ts:203 partyInbox contracts)
    const contracts = waitForApi(page, 'GET', '/contracts/mine');
    await loginAs('tenant', { next: '/tenant/contracts' });
    const rows = await okJson<unknown[]>(await contracts);
    await expect(page).toHaveURL((url) => url.pathname === '/tenant/contracts');
    test.info().annotations.push({ type: 'สัญญาของ qa-tenant', description: `${rows.length} รายการ` });

    // ขั้นที่ 2: ไม่มีสัญญา ต้องขึ้นข้อความว่าง (TenantContractList.tsx:486) และไม่มีข้อความผิดพลาด (PartyContractsScreen.tsx:102-106)
    const party = new PartyPage(page);
    if (rows.length === 0) await expect(party.text(PARTY_COPY.emptyContracts)).toBeVisible();
    await expect(party.alerts).toHaveCount(0);
  });

  test('/tenant/home does not show a sample lease to every account', async ({ page, loginAs }) => {
    // เดิมแท็บ living (/tenant/home: app-routes.ts:202) แสดงสัญญาที่เขียนตรงในโค้ด "The Base Sukhumvit 77 (Room 1804)" ให้ทุกบัญชี
    // ทีมแก้ที่ pre/dev/review fc1a351: หน้านี้แสดง "Coming soon" (agent.dashboard.comingSoon + unavailableSection: app/index.tsx)
    //   ยืนยันด้วยผลรัน 9 พ.ย. 2026 (API บนเครื่อง qa/e2e 03a45a3) ว่าข้อนี้ขึ้น "Expected to fail, but passed" จึงเอา test.fail ออก
    await loginAs('tenant', { next: '/tenant/home' });
    await expect(page).toHaveURL((url) => url.pathname === '/tenant/home');
    // ขั้นเตรียม: รอให้พื้นที่เนื้อหาของหน้ามีข้อความแล้ว (.aw-page-content: AgentWorkspace.web.tsx:1178) และไม่มีตัวหมุนโหลด
    // ไม่อย่างนั้นการตรวจด้านล่างผ่านได้ตั้งแต่หน้ายังว่าง ไม่มีข้อความอื่นของหน้านี้ที่ไม่ใช่ข้อความตัวอย่าง จึงยึดได้แค่นี้
    const content = page.locator('.aw-page-content');
    await expect(content).toContainText(/\S/);
    await expect(content.getByRole('progressbar')).toHaveCount(0);
    // และต้องไม่ใช่หน้าแรกของผู้เช่า (/tenant แสดง "Tenant home": index.tsx:1135-1150) ที่อาจค้างก่อนแอปเปลี่ยนแท็บตาม URL
    await expect(content.getByText(FLOW.tenantHomeTitle, { exact: true })).toHaveCount(0);
    // หน้าต้องแสดง Coming soon (หัวเรื่องกับคำอธิบายเป็นข้อความเดียวกันในภาษา en และ th จึงใช้ตัวแรก) และไม่มีสัญญาตัวอย่าง
    await expect(content.getByText(EN.comingSoon, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(HARDCODED.sampleLease, { exact: true })).toHaveCount(0, { timeout: 15_000 });
  });

  test('Payment history opens /tenant/bills?history=1', async ({ page, loginAs }) => {
    // ปุ่มบนหัวหน้าบิล (app/index.tsx:1878-1887) ตั้ง billHistory และ URL เพิ่ม history=1 (lib/app-routes.ts:297)
    await loginAs('tenant', { next: '/tenant/bills' });
    await expect(page).toHaveURL((url) => url.pathname === '/tenant/bills' && url.search === '');
    const party = new PartyPage(page);
    await party.paymentHistory.click();
    await expect(page).toHaveURL((url) => url.pathname === '/tenant/bills' && url.searchParams.get('history') === '1');
  });

  test('a failed bill request shows the translated message, not the browser error', async ({ page, loginAs }) => {
    // GET /bills/mine ล้มแบบเครือข่ายขาด เดิมภาษา en ขึ้นข้อความดิบ "Failed to fetch" แทนข้อความสำรอง "Could not load bills" (TenantBillsScreen.tsx:72-74)
    // ทีมแก้ที่ fc1a351: lib/api.ts ห่อเป็น NETWORK_ERROR และ localizedError ใช้ข้อความสำรองทุกภาษา (packages/i18n/src/error-message.ts developerOnly)
    //   ยืนยันด้วยผลรัน 9 พ.ย. 2026 ว่าข้อนี้ขึ้น "Expected to fail, but passed" จึงเอา test.fail ออก
    await failApi(page, '/bills/mine');
    await loginAs('tenant', { next: '/tenant/bills' });
    const party = new PartyPage(page);
    // ขั้นเตรียม: ข้อความผิดพลาดต้องเป็นของการโหลดบิล (ข้อความสำรองที่แปลแล้ว หรือข้อความดิบ) ไม่ใช่ alert เรื่องอื่น
    const billAlert = party.alerts.filter({ hasText: new RegExp(`^(${FLOW.tenantBillsLoadFailed}|${RAW_NETWORK_ERROR})$`) });
    await expect(billAlert).toHaveCount(1, { timeout: 20_000 });
    await expect(billAlert).toHaveText(FLOW.tenantBillsLoadFailed);
  });

  test('Bills shows the bills from GET /bills/mine and still blocks the refresh', async ({ page, loginAs, guard }) => {
    test.skip(!billReadsAllowed(), 'ระยะ 2: global-setup ไม่ได้ยืนยันว่า GET บิลของ API นี้อ่านอย่างเดียว (E2E_WEB_BILL_READS)');
    // ขั้นที่ 1: เปิด /tenant/bills หน้าเว็บเรียก refresh ก่อน (ถูกตัด แอปอ่านต่อ: lib/tenant-bills-api.ts:12-24) แล้วอ่านบิล
    // หน้าบิลรอทั้ง 2 คำขอก่อนแสดง (Promise.all ของ listMyBills กับ listMyContracts: TenantBillsScreen.tsx:63-71)
    // จึงรอคำตอบของ /contracts/mine ด้วย ถ้าช้าหรือค้าง ข้อนี้หมดเวลาที่นี่พร้อมชื่อคำขอ (ผลรันชุดเต็ม 6 พ.ย. 2026 หน้าหมุนโหลดค้างเกิน 10 วินาที)
    const bills = waitForApi(page, 'GET', '/bills/mine');
    const contracts = waitForApi(page, 'GET', '/contracts/mine');
    await loginAs('tenant', { next: '/tenant/bills' });
    const rows = await okJson<unknown[]>(await bills);
    await okJson<unknown[]>(await contracts);
    test.info().annotations.push({ type: 'บิลของ qa-tenant', description: `${rows.length} รายการ` });

    // ขั้นที่ 2: ไม่มีบิล ต้องขึ้น "No bills yet" (TenantBillsScreen.tsx:182-190) ; มีบิล ต้องเห็นชื่อบิล "Rent <เดือน>" ก่อน แล้วไม่มีข้อความว่าง
    // ข้อความโหลดไม่ได้ต้องไม่มีทั้ง 2 กรณี (ตรวจหลังหน้าแสดงผลแล้ว เพราะ toHaveCount(0) ผ่านได้ตั้งแต่หน้ายังโหลด)
    const party = new PartyPage(page);
    if (rows.length === 0) {
      await expect(party.text(FLOW.tenantBillsEmpty)).toBeVisible();
    } else {
      // ชื่อบิลต้องมีไม่น้อยกว่าจำนวนบิลในคำตอบ (อาจมีชื่อของบิลถัดไปที่คำนวณจากสัญญาเพิ่ม: TenantBillsScreen.tsx:65)
      await expect.poll(() => page.getByText(BILL_TITLE).count(), { message: 'จำนวนชื่อบิล "Rent <เดือน>" บนหน้า' }).toBeGreaterThanOrEqual(rows.length);
      for (const text of alsoEnglish(FLOW.tenantBillsEmpty, FLOW_EN.tenantBillsEmpty)) await expect(party.text(text)).toHaveCount(0);
    }
    for (const text of alsoEnglish(FLOW.tenantBillsLoadFailed, FLOW_EN.tenantBillsLoadFailed)) await expect(party.text(text)).toHaveCount(0);
    expect(guard.of('bill-write').map((entry) => new URL(entry.target).pathname)).toContain('/api/v1/bills/mine/refresh');
  });

  test('the tenant home card shows the next bill from GET /bills/mine/next', async ({ page, loginAs }) => {
    test.skip(!billReadsAllowed(), 'ระยะ 2: global-setup ไม่ได้ยืนยันว่า GET บิลของ API นี้อ่านอย่างเดียว (E2E_WEB_BILL_READS)');
    // หน้าแรกของผู้เช่า (/tenant แท็บ dashboard) มีการ์ดบิลถัดไป (index.tsx:1153-1158 TenantNextBillCard)
    const next = waitForApi(page, 'GET', '/bills/mine/next');
    await loginAs('tenant');
    await expect(page).toHaveURL((url) => url.pathname === '/tenant');
    const bill = await okJsonOrNull<unknown>(await next);
    const party = new PartyPage(page);
    await expect(party.text(FLOW.tenantHomeTitle)).toBeVisible();
    // ไม่มีบิลถัดไป ต้องขึ้น "No upcoming bill" (TenantNextBillCard.tsx:57) ; มีบิล ต้องขึ้นหัวการ์ด "Next bill" (:64) และไม่มี "No upcoming bill"
    if (bill === null) {
      await expect(party.text(FLOW.tenantNoUpcomingBill)).toBeVisible();
    } else {
      await expect(party.text(FLOW.tenantNextBill)).toBeVisible();
      for (const text of alsoEnglish(FLOW.tenantNoUpcomingBill, FLOW_EN.tenantNoUpcomingBill)) await expect(party.text(text)).toHaveCount(0);
    }
    for (const text of alsoEnglish(FLOW.tenantBillsLoadFailed, FLOW_EN.tenantBillsLoadFailed)) await expect(party.text(text)).toHaveCount(0);
  });
});

test.describe('landlord', () => {
  test('Contracts and Tenants load GET /contracts/mine and say so when there is none', async ({ page, loginAs }) => {
    // ขั้นที่ 1: /landlord/contracts (app-routes.ts:209) ผู้ให้เช่าขอสัญญาและห้องของตัวเอง (PartyContractsScreen.tsx:70-74)
    const contracts = waitForApi(page, 'GET', '/contracts/mine');
    const ownedRooms = waitForApi(page, 'GET', '/contracts/mine/rooms');
    await loginAs('landlord', { next: '/landlord/contracts' });
    const rows = await okJson<unknown[]>(await contracts);
    const rooms = await okJson<unknown[]>(await ownedRooms);
    await expect(page).toHaveURL((url) => url.pathname === '/landlord/contracts');
    test.info().annotations.push({ type: 'qa-landlord', description: `สัญญา ${rows.length} รายการ ห้อง ${rooms.length} ห้อง` });
    const party = new PartyPage(page);
    // ไม่มีทั้งสัญญาและห้อง ต้องขึ้นข้อความว่างของรายการห้อง (TenantContractList.tsx:330)
    if (rows.length === 0 && rooms.length === 0) await expect(party.text(PARTY_COPY.emptyContracts)).toBeVisible();
    await expect(party.alerts).toHaveCount(0);

    // ขั้นที่ 2: /landlord/tenants (app-routes.ts:210 ประวัติผู้เช่า) ไม่มีสัญญา ต้องขึ้น "No tenant history yet" (TenantContractList.tsx:471)
    const again = waitForApi(page, 'GET', '/contracts/mine');
    await page.goto('/landlord/tenants');
    const history = await okJson<unknown[]>(await again);
    await expect(page).toHaveURL((url) => url.pathname === '/landlord/tenants');
    if (history.length === 0) await expect(party.text(PARTY_COPY.emptyTenantHistory)).toBeVisible();
    await expect(party.alerts).toHaveCount(0);
  });

  test('Confirmed rent does not say "no rent yet" when the bills failed to load', async ({ page, loginAs }) => {
    // เดิม OwnerConfirmedRent.tsx แสดงทั้งข้อความผิดพลาดและข้อความว่างตอนโหลดล้ม ทีมแก้ที่ fc1a351 (เพิ่ม && !error)
    //   ยืนยันด้วยผลรัน 9 พ.ย. 2026 ว่าข้อนี้ขึ้น "Expected to fail, but passed" จึงเอา test.fail ออก
    await failApi(page, '/bills/received');
    await loginAs('landlord');
    await expect(page).toHaveURL((url) => url.pathname === '/landlord');
    const party = new PartyPage(page);
    await expect(party.confirmedRentTitle).toBeVisible();
    // ข้อความผิดพลาดของการ์ดไม่มี role ใช้ข้อความ: ข้อความสำรองที่แปลแล้ว หรือข้อความดิบ (ดูข้อ E1 ของผู้ให้เช่าด้านล่าง)
    await expect(party.text(FLOW.ownerLoadFailed).or(party.text(RAW_NETWORK_ERROR))).toBeVisible({ timeout: 20_000 });
    await expect(party.text(FLOW.ownerConfirmedEmpty)).toHaveCount(0);
  });

  test('a failed income request on the landlord home shows the translated message', async ({ page, loginAs }) => {
    // แบบเดียวกับข้อ E1 ของผู้เช่า: ข้อความสำรองของการ์ดคือ owner.bills.loadFailed (OwnerConfirmedRent.tsx:34)
    await failApi(page, '/bills/received');
    await loginAs('landlord');
    const party = new PartyPage(page);
    await expect(party.confirmedRentTitle).toBeVisible();
    await expect(party.text(FLOW.ownerLoadFailed).or(party.text(RAW_NETWORK_ERROR))).toBeVisible({ timeout: 20_000 });
    // ทีมแก้ที่ fc1a351 (NETWORK_ERROR + localizedError) ยืนยันด้วยผลรัน 9 พ.ย. 2026 จึงเอา test.fail ออก และตรวจข้อความสำรองเพิ่ม
    await expect(party.text(RAW_NETWORK_ERROR)).toHaveCount(0);
    await expect(party.text(FLOW.ownerLoadFailed)).toBeVisible();
  });

  test('Income shows the bills from GET /bills/received', async ({ page, loginAs }) => {
    test.skip(!billReadsAllowed(), 'ระยะ 2: global-setup ไม่ได้ยืนยันว่า GET บิลของ API นี้อ่านอย่างเดียว (E2E_WEB_BILL_READS)');
    // /landlord/income (app-routes.ts:211 แท็บ income) ใช้ TenantBillsScreen mode owner (index.tsx:1226-1234)
    const bills = waitForApi(page, 'GET', '/bills/received');
    await loginAs('landlord', { next: '/landlord/income' });
    const rows = await okJson<unknown[]>(await bills);
    await expect(page).toHaveURL((url) => url.pathname === '/landlord/income');
    test.info().annotations.push({ type: 'รายได้ของ qa-landlord', description: `${rows.length} บิล` });
    const party = new PartyPage(page);
    // ไม่มีบิล ต้องขึ้น "No rental income yet" ; มีบิล ต้องเห็นชื่อบิล "Rent <เดือน>" (TenantBillsScreen.tsx:215, :259) และไม่มีข้อความว่าง
    if (rows.length === 0) {
      await expect(party.text(FLOW.ownerIncomeEmpty)).toBeVisible();
    } else {
      await expect(page.getByText(BILL_TITLE).first()).toBeVisible();
      for (const text of alsoEnglish(FLOW.ownerIncomeEmpty, FLOW_EN.ownerIncomeEmpty)) await expect(party.text(text)).toHaveCount(0);
    }
    for (const text of alsoEnglish(FLOW.ownerLoadFailed, FLOW_EN.ownerLoadFailed)) await expect(party.text(text)).toHaveCount(0);
    await expect(party.alerts).toHaveCount(0);
  });
});
