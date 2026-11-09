import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { MobileShell } from '../../src/web-ui/pages/mobile-shell.page';
import { NARROW, QA_DATA, TAB } from '../../src/web-ui/labels.narrow';
import { FLOW } from '../../src/web-ui/labels';
import { okJson, waitForApi } from '../../src/web-ui/support/api';

/**
 * หน้ารายการของนายหน้าบนจอแคบ (แผน 9 พ.ย. 2026 ข้อ N6-N9) อ่านอย่างเดียว
 * โค้ด: apps/consumer-app/components/AgentLeadsScreen.tsx, AgentRoomsScreen.tsx, AgentTenantsScreen.tsx, AgentCalendarScreen.tsx,
 *   AgentMoreToolsBody.tsx และ packages/feature-listing/src/components/MobileAgentListingsBody.tsx ที่ qa/e2e 74b46f4
 *
 * สิ่งที่ต้องมีก่อนรัน: เหมือนชุด tests/web-ui (เว็บเปิดด้วย npm run web และเรียก API ของ staging) และตั้ง E2E_QA_AGENT_PASSWORD
 * ค้นด้วยข้อมูลถาวรของชุดเขียนข้อมูล (E2E-QA-LEAD-1, E2E-QA-ROOM-1: labels.narrow.ts QA_DATA) ซึ่งไม่ใช่ข้อมูลของลูกค้าจริง
 *   ถ้า staging ไม่มีข้อมูลถาวรนี้ ข้อ N6, N7 ไม่ผ่านที่การตรวจคำตอบของ API ("API ต้องคืน...") ให้ตรวจข้อมูลก่อน อย่าแก้เทส
 * ไม่เปิดแถวผู้เช่า (ชื่อลูกค้าจริง และเปิดแล้วเรียก GET /bills/agent/tenants/:id: AgentTenantsScreen.tsx:173)
 * ไม่พิมพ์ชื่อลูกค้าจากหน้าเว็บหรือคำตอบของ API ลง annotation (ภาพหน้าจอปิดทั้งชุดในค่าตั้ง)
 */

test('N6 searching leads finds the persistent lead, and its detail page hides the bottom tabs', async ({ page, loginAs }) => {
  const shell = new MobileShell(page, 'agent');
  await loginAs('agent', { next: '/agent/leads' });
  const search = shell.leadsSearch;
  await expect(search).toBeVisible({ timeout: 20_000 });

  // ขั้นที่ 1: พิมพ์ชื่อลีดถาวร หน้าเว็บขอ GET /agent/leads?q=<คำค้น> หลังหยุดพิมพ์ 250ms (AgentLeadsScreen.tsx:168-193)
  const searched = waitForApi(page, 'GET', '/agent/leads', { query: (q) => q.get('q') === QA_DATA.leadName });
  await search.fill(QA_DATA.leadName);
  const result = await okJson<{ items: { name: string }[] }>(await searched);
  const expected = result.items.filter((lead) => lead.name === QA_DATA.leadName).length;
  expect(expected, `API ต้องคืนลีดชื่อ ${QA_DATA.leadName} อย่างน้อย 1 ราย`).toBeGreaterThan(0);

  // ขั้นที่ 2: แถวของลีดชื่อ "Lead details: <ชื่อ>" (AgentLeadsScreen.tsx:435) ต้องมีเท่ากับที่ API คืน
  const row = page.getByRole('button', { name: `${NARROW.leadDetails}: ${QA_DATA.leadName}`, exact: true });
  await expect(row).toHaveCount(expected);

  // ขั้นที่ 3: เปิดลีด หน้ารายละเอียดเรียก GET /agent/leads/:id (AgentLeadDetailBody.tsx:204) ไม่มี path ของตัวเอง URL จึงค้างที่ /agent/leads
  //   แท็บล่างซ่อนในหน้ารายละเอียดลีด (app/index.tsx:1929) และหัวหน้ามีปุ่ม Back แทน Menu (:853 leading back)
  const detail = waitForApi(page, 'GET', /^\/agent\/leads\/\d+$/);
  await row.first().click();
  await okJson<unknown>(await detail);
  await expect(shell.backButton).toBeVisible();
  await expect(shell.tabBar).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === '/agent/leads');

  // ขั้นที่ 4: กด Back กลับรายการ แท็บล่างกลับมา และคำค้นยังอยู่ (รายการจำสถานะไว้ในตัวแปรระดับโมดูล: AgentLeadsScreen.tsx:92)
  //   หน้ารายการถูกสร้างใหม่ จึงมีตัวโหลดอีกรอบก่อนช่องค้นขึ้น (AgentLeadsScreen.tsx:234-240) รอนานเท่าขั้นที่ 1
  await shell.backButton.click();
  await expect(shell.tab(TAB.listingLead)).toBeVisible();
  await expect(search).toHaveValue(QA_DATA.leadName, { timeout: 20_000 });
  await expect(row).toHaveCount(expected);
});

test('N7 searching rooms finds the persistent room', async ({ page, loginAs }) => {
  const shell = new MobileShell(page, 'agent');
  await loginAs('agent', { next: '/agent/rooms' });
  const search = shell.roomsSearch;
  await expect(search).toBeVisible({ timeout: 20_000 });

  const cards = page.getByRole('button', { name: new RegExp(`^${NARROW.viewRoom}: `) });
  test.info().annotations.push({ type: 'การ์ดห้องก่อนค้น', description: `${await cards.count()} ใบ` });

  // ขั้นที่ 1: พิมพ์ชื่อประกาศของห้องถาวร หน้าเว็บขอ GET /agent/listings?q=<คำค้น> (AgentRoomsScreen.tsx:320-333)
  const searched = waitForApi(page, 'GET', '/agent/listings', { query: (q) => q.get('q') === QA_DATA.roomTitle });
  await search.fill(QA_DATA.roomTitle);
  const result = await okJson<{ items: { listingTitle?: string | null }[]; total: number }>(await searched);
  const expected = result.items.filter((room) => room.listingTitle === QA_DATA.roomTitle).length;
  expect(expected, `API ต้องคืนห้องชื่อประกาศ ${QA_DATA.roomTitle} อย่างน้อย 1 ห้อง`).toBeGreaterThan(0);
  // หน้าห้องโหลดหน้าถัดไปเองเมื่อเนื้อหาสั้นกว่าจอ (onEndReached: AgentRoomsScreen.tsx:365-374, PAGE_SIZE 20 ที่ :79)
  //   การเทียบจำนวนการ์ดด้านล่างจึงใช้ได้เฉพาะเมื่อผลค้นอยู่ในหน้าเดียว ถ้าไม่ใช่ ให้ตรวจข้อมูลบน staging ก่อน
  expect(result.total, `ผลค้น ${QA_DATA.roomTitle} ต้องอยู่ในหน้าเดียว (ไม่เกิน ${result.items.length} ห้อง)`).toBe(result.items.length);

  // ขั้นที่ 2: การ์ดของห้องชื่อ "View room: <ชื่อประกาศ>" (MobileAgentListingsBody.tsx:187, :351, :443)
  //   หน้าห้องไม่ล้างรายการเดิมระหว่างค้น (AgentRoomsScreen.tsx:310) การ์ดของห้องถาวรอาจอยู่ในรายการแรกแล้ว
  //   จึงตรวจว่าการ์ดทั้งหมดบนหน้าเท่ากับผลค้นก่อน แล้วจึงนับการ์ดของห้องถาวร
  //   การตรวจนี้แยกรายการเดิมกับผลค้นได้เมื่อรายการเดิมมีห้องอื่นด้วย จำนวนการ์ดก่อนค้นจดไว้ใน annotation ให้ดูว่าเป็นแบบนั้นจริง
  //   ไม่เปิดการ์ด: หน้าต่างรายละเอียดห้องแสดงชื่อและเบอร์ของผู้ติดต่อ
  await expect(cards).toHaveCount(result.items.length);
  await expect(page.getByRole('button', { name: `${NARROW.viewRoom}: ${QA_DATA.roomTitle}`, exact: true })).toHaveCount(expected);
});

test('N8 All tenants shows the count the API returned', async ({ page, loginAs }) => {
  // ขั้นที่ 1: เปิด /agent/clients หน้าเว็บขอรายชื่อผู้เช่า (AgentTenantsScreen.tsx:237-240) ไม่พิมพ์ชื่อ จดแค่จำนวน
  // หน้าผู้เช่าบนจอแคบใช้รายการแบบมือถือ ไม่ใช่ตาราง (AgentTenantsScreen.tsx:215-218 ใช้เส้น 768px เดียวกับโครงหน้า)
  const tenants = waitForApi(page, 'GET', '/agent/tenants');
  await loginAs('agent', { next: '/agent/clients' });
  const rows = await okJson<unknown[]>(await tenants);
  test.info().annotations.push({ type: 'ผู้เช่าของ qa-agent', description: `${rows.length} ราย` });

  // ขั้นที่ 2: แท็บ All tenants แสดงจำนวนผู้เช่าทั้งหมด "All tenants <n>" (AgentTenantsScreen.tsx:811, MobileSegmentedTabs.tsx:63)
  await expect(page.getByRole('tab', { name: `${FLOW.tenantsTabAll} ${rows.length}`, exact: true })).toBeVisible({ timeout: 20_000 });
  // แท็บ To do แสดงจำนวนงานที่ต้องทำ ตรวจแค่ว่าเป็นตัวเลข ไม่ใช่ขีดของตอนโหลด (:810) ไม่ได้เทียบจำนวน (คำนวณจากผู้เช่ากับสลิป: tenantWorkItems)
  await expect(page.getByRole('tab', { name: new RegExp(`^${FLOW.tenantsTabWork} \\d+$`) })).toBeVisible();
  await expect(new MobileShell(page, 'agent').desktopShell).toHaveCount(0);
});

test('N9 the calendar opens from the More tab and Next month asks for the next range', async ({ page, loginAs }) => {
  const shell = new MobileShell(page, 'agent');
  await loginAs('agent', { next: '/agent' });

  // ขั้นที่ 1: แท็บ More แล้วกดปุ่ม Calendar (AgentMoreToolsBody.tsx:27, :58) ไปหน้า /agent/calendar ซึ่งขอนัดของเดือนที่เห็น
  await shell.tab(TAB.more).click();
  const first = waitForApi(page, 'GET', '/agent/viewings');
  await shell.moreCalendarButton.click();
  await expect(page).toHaveURL((url) => url.pathname === '/agent/calendar');
  const firstResponse = await first;
  await okJson<unknown[]>(firstResponse);
  const firstQuery = new URL(firstResponse.url()).searchParams;
  const firstFrom = Date.parse(firstQuery.get('from') ?? '');
  const firstTo = Date.parse(firstQuery.get('to') ?? '');
  expect(Number.isNaN(firstFrom) || Number.isNaN(firstTo), 'คำขอแรกต้องมีค่า from และ to').toBe(false);

  // ขั้นที่ 2: กด Next month หน้าเว็บต้องขอนัดของเดือนถัดไปพอดี
  //   ช่วงของแต่ละเดือนคือวันที่ 1 ลบ 7 วัน ถึงวันที่ 1 ของเดือนถัดไปบวก 7 วัน (calendarViewingRange: lib/agent-calendar-viewings.ts:61-66)
  //   เดือนที่ติดกันจึงซ้อนกัน 14 วัน: from ของเดือนถัดไปต้องอยู่หลัง from แรก แต่ก่อน to แรก (ถ้าข้ามไป 2 เดือน from จะไม่ก่อน to แรก)
  const next = waitForApi(page, 'GET', '/agent/viewings', { query: (q) => Date.parse(q.get('from') ?? '') > firstFrom });
  await page.getByRole('button', { name: NARROW.nextMonth, exact: true }).click();
  const nextResponse = await next;
  await okJson<unknown[]>(nextResponse);
  const nextFrom = Date.parse(new URL(nextResponse.url()).searchParams.get('from') ?? '');
  expect(nextFrom, 'from ของเดือนถัดไปต้องอยู่ก่อน to ของคำขอแรก').toBeLessThan(firstTo);
  await expect(page.getByText(FLOW.calendarLoadError, { exact: true })).toHaveCount(0);
});
