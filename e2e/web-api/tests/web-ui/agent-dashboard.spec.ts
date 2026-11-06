import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentOverview } from '../../src/web-ui/pages/agent-overview.page';
import { enNumber } from '../../src/web-ui/pages/leads.page';
import { FLOW, HARDCODED } from '../../src/web-ui/labels';
import { okJson, waitForApi } from '../../src/web-ui/support/api';

/**
 * แดชบอร์ดและหน้า Coming soon ของนายหน้าบนจอกว้าง (แผน claude/nestyk-web-flows-readonly-plan-2026-11-06.md ข้อ D1-D3, S1)
 * โค้ด: apps/consumer-app/components/agent-web/AgentOverview.web.tsx, lib/agent-dashboard.ts, app/index.tsx:935-960, :1361-1370
 *   ที่ qa/e2e d6370ee (แอปเท่ากับ 648dd28)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web และเรียก API ของ staging, ตั้ง E2E_QA_AGENT_PASSWORD
 * ทุกข้ออ่านอย่างเดียว: กดเฉพาะการ์ดตัวเลข ซึ่งพาไปหน้ารายการ ไม่กดปุ่มเพิ่มห้องหรือเพิ่มลีด
 * แดชบอร์ดแสดงชื่อผู้ติดต่อจริง (AgentOverview.web.tsx:409) และข้อการ์ดเปิดหน้าลีดกับหน้าผู้เช่า จึงปิดภาพหน้าจอ
 *   ข้อที่ไม่ผ่านยังมี error-context.md ที่มีข้อความบนหน้า ห้าม commit หรือแนบส่งต่อ
 */
test.use({ screenshot: 'off' });

/** เฉพาะส่วนของคำตอบ GET /agent/dashboard ที่เทสใช้ (lib/agent-dashboard.ts:23 ชนิด AgentDashboardData) */
interface DashboardResult {
  business: { status: string; availableListings: number; openLeads: number; currentClients: number };
  schedule: { status: string; items: { kind: string; startsAt: string }[] };
}

/** วันที่ตามเวลา Bangkok แบบ YYYY-MM-DD (กติกาเดียวกับ bangkokDay: AgentOverview.web.tsx:105) */
function bangkokDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

test('the dashboard cards show the numbers from GET /agent/dashboard', async ({ page, loginAs }) => {
  // ขั้นที่ 1: ล็อกอินแล้วหน้าแรกของนายหน้าขอตัวเลขของแดชบอร์ด
  const dashboard = waitForApi(page, 'GET', '/agent/dashboard');
  await loginAs('agent');
  const data = await okJson<DashboardResult>(await dashboard);
  expect(data.business.status, 'ส่วน business ของคำตอบต้องพร้อมแสดง (isReady: AgentOverview.web.tsx:31-32)').toBe('available');

  // ขั้นที่ 2: การ์ด 3 ใบแรกต้องแสดงตัวเลขเดียวกับคำตอบ (Intl.NumberFormat ของ en-GB: :82, :91-92)
  const overview = new AgentOverview(page);
  await expect(overview.root).toBeVisible();
  await expect(overview.kpis).toHaveCount(AgentOverview.KPI_LABELS.length);
  await expect(overview.kpiValue(FLOW.kpiAvailableListings)).toHaveText(enNumber(data.business.availableListings));
  await expect(overview.kpiValue(FLOW.kpiOpenLeads)).toHaveText(enNumber(data.business.openLeads));
  await expect(overview.kpiValue(FLOW.kpiCurrentTenants)).toHaveText(enNumber(data.business.currentClients));

  // ขั้นที่ 3: การ์ดนัดวันนี้ = จำนวน schedule.items ชนิด viewing ที่เริ่มวันนี้ตามเวลา Bangkok (:105-110, :262)
  // คิดจากคำตอบเดียวกัน ถ้ารันคร่อมเที่ยงคืน ค่าอาจต่างกัน 1 วัน (ไม่ได้กันไว้)
  expect(data.schedule.status, 'ส่วน schedule ของคำตอบต้องพร้อมแสดง').toBe('available');
  const today = bangkokDay(new Date());
  const viewingsToday = data.schedule.items.filter((item) => item.kind === 'viewing' && bangkokDay(new Date(item.startsAt)) === today).length;
  await expect(overview.kpiValue(FLOW.kpiViewingsToday)).toHaveText(enNumber(viewingsToday));
  await expect(overview.root.getByText(FLOW.kpiLoadFailed, { exact: true })).toHaveCount(0);
});

test('each card opens its list page', async ({ page, loginAs }) => {
  // การ์ดที่มีปลายทางเป็นปุ่ม (:474-482) ปลายทางตาม :233-268 และ URL ตาม lib/app-routes.ts:187-198
  const dashboard = waitForApi(page, 'GET', '/agent/dashboard');
  await loginAs('agent');
  const data = await okJson<DashboardResult>(await dashboard);
  const overview = new AgentOverview(page);
  const targets: { label: string; path: string }[] = [
    { label: FLOW.kpiAvailableListings, path: '/agent/rooms' },
    { label: FLOW.kpiOpenLeads, path: '/agent/leads' },
    { label: FLOW.kpiCurrentTenants, path: '/agent/clients' },
    { label: FLOW.kpiViewingsToday, path: '/agent/calendar' },
  ];

  for (const target of targets) {
    await test.step(target.label, async () => {
      await expect(overview.root).toBeVisible();
      // จดตัวเลขของหน้ารายการไว้เทียบกับการ์ด (ข้อ D3 ของแผน: ยังไม่ตรวจ เพราะยังไม่รู้นิยามของ API ต้องถามทีมก่อน)
      const leads = target.path === '/agent/leads' ? waitForApi(page, 'GET', '/agent/leads') : null;
      const rooms = target.path === '/agent/rooms' ? waitForApi(page, 'GET', '/agent/listings') : null;
      await overview.kpi(target.label).click();
      await expect(page).toHaveURL((url) => url.pathname === target.path);
      if (leads) {
        const list = await okJson<{ total: number; statusCounts?: Record<string, number> | null }>(await leads);
        test.info().annotations.push({
          type: 'D3 Open leads เทียบหน้าลีด',
          description: `การ์ด ${data.business.openLeads} / หน้าลีดทั้งหมด ${list.total} / statusCounts ${JSON.stringify(list.statusCounts ?? null)}`,
        });
      }
      if (rooms) {
        const list = await okJson<{ total: number; items: { roomStatusCode: string | null }[] }>(await rooms);
        const availableOnPage = list.items.filter((room) => room.roomStatusCode === 'available').length;
        test.info().annotations.push({
          type: 'D3 Available listings เทียบหน้าห้อง',
          description: `การ์ด ${data.business.availableListings} / หน้าห้องทั้งหมด ${list.total} / สถานะ available ในหน้า 1: ${availableOnPage} จาก ${list.items.length}`,
        });
      }
      await page.goBack();
      await expect(page).toHaveURL((url) => url.pathname === '/agent');
    });
  }
});

test('Contracts, Contacts and Services say Coming soon and show no sample text', async ({ page, loginAs }) => {
  // หน้าใน AGENT_COMING_SOON_TABS (packages/ui/src/config/agentComingSoon.ts:9) แสดงการ์ด Coming soon (index.tsx:1361-1370)
  // แทนข้อความตัวอย่าง "(mock ...)" ที่ยังอยู่ในโค้ดด้านล่าง (index.tsx:1378, :1390)
  await loginAs('agent');
  for (const path of ['/agent/contracts', '/agent/contacts', '/agent/services']) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname === path);
      // ดูเฉพาะพื้นที่เนื้อหาของหน้า (.aw-page-content: AgentWorkspace.web.tsx:1178) ไม่นับเมนูข้างที่มีป้าย Coming soon ของตัวเอง
      const content = page.locator('.aw-page-content');
      await expect(content.getByText(FLOW.unavailableSection, { exact: true }).first()).toBeVisible();
      await expect(content.getByText(HARDCODED.mockMarker)).toHaveCount(0);
    });
  }
});
