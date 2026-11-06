import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentTenantsPage } from '../../src/web-ui/pages/agent-tenants.page';
import { FLOW, fill } from '../../src/web-ui/labels';
import { billReadsAllowed } from '../../src/web-ui/guard';
import { apiPathOf, okJson, waitForApi } from '../../src/web-ui/support/api';
import { watchForRequest } from '../../src/web-ui/support/wait';

/**
 * ผู้เช่าและปฏิทินของนายหน้าบนจอกว้าง (แผน claude/nestyk-web-flows-readonly-plan-2026-11-06.md ข้อ T1-T2, C1-C2 และ B5 ของระยะ 2)
 * โค้ด: apps/consumer-app/components/AgentTenantsScreen.tsx, agent-web/TenantDirectoryTable.web.tsx, AgentCalendarScreen.tsx,
 *   lib/agent-calendar-viewings.ts ที่ qa/e2e d6370ee (แอปเท่ากับ 648dd28)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web และเรียก API ของ staging, ตั้ง E2E_QA_AGENT_PASSWORD
 * ทุกข้ออ่านอย่างเดียว: ไม่กดปุ่มแก้ไข ยืนยันสลิป สร้างสัญญา หรือปุ่มในคอลัมน์ action ของตารางงาน
 * ตารางผู้เช่าแสดงชื่อและเบอร์ของผู้เช่าจริง: ปิดภาพหน้าจอ (ข้อที่ไม่ผ่านยังมี error-context.md ห้าม commit หรือแนบส่งต่อ)
 */
test.use({ screenshot: 'off' });

test.describe('tenants', () => {
  test('All tenants lists every tenant from the API, and searching is done in the page', async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิด /agent/clients หน้าเว็บขอรายชื่อผู้เช่าทั้งหมดครั้งเดียว (AgentTenantsScreen.tsx reload: listAgentTenants)
    const listed = waitForApi(page, 'GET', '/agent/tenants');
    await loginAs('agent', { next: '/agent/clients' });
    const tenants = await okJson<{ id: number }[]>(await listed);
    expect(Array.isArray(tenants), 'คำตอบของ GET /agent/tenants ต้องเป็นรายการ').toBe(true);

    // ขั้นที่ 2: เลือกแท็บ All tenants ตัวนับและจำนวนแถวต้องเท่ากับจำนวนในคำตอบ (กลุ่มเปิดทั้งหมดตอนเริ่ม: TenantDirectoryTable.web.tsx:32)
    const screen = new AgentTenantsPage(page);
    await screen.tab('all').click();
    await expect(screen.all).toBeVisible();
    const total = String(tenants.length);
    await expect(screen.count).toHaveText(fill(FLOW.tenantsShowing, { shown: total, total }));
    await expect(screen.rows).toHaveCount(tenants.length);

    // ขั้นที่ 3: ค้นด้วยคำที่ไม่มีผู้เช่าคนใดมี กรองในหน้าเว็บ (:34-41) ไม่มีคำขอ API เพิ่ม และขึ้นสถานะไม่พบตามตัวกรอง (:158-166)
    const refetch = watchForRequest(page, (request) => apiPathOf(request.url())?.startsWith('/agent/tenants') ?? false, 3_000);
    await screen.search.fill('e2e-no-such-tenant');
    await expect(screen.count).toHaveText(fill(FLOW.tenantsShowing, { shown: '0', total }));
    await expect(screen.rows).toHaveCount(0);
    if (tenants.length > 0) await expect(page.getByTestId('state.filtered')).toBeVisible();
    expect(await refetch, 'ค้นแล้วมีคำขอ /agent/tenants เพิ่ม').toBe(false);

    // ขั้นที่ 4: ล้างคำค้น รายการกลับมาครบ
    await screen.search.fill('');
    await expect(screen.count).toHaveText(fill(FLOW.tenantsShowing, { shown: total, total }));
  });

  test('a tenant row opens the tenant detail, and the bill box follows the bill guard', async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดแท็บ All tenants
    const listed = waitForApi(page, 'GET', '/agent/tenants');
    await loginAs('agent', { next: '/agent/clients' });
    const tenants = await okJson<{ id: number }[]>(await listed);
    test.skip(tenants.length === 0, 'qa-agent ไม่มีผู้เช่า');
    const screen = new AgentTenantsPage(page);
    await screen.tab('all').click();
    await expect(screen.rows).toHaveCount(tenants.length);

    // ขั้นที่ 2: กดแถวแรกบนหน้า หน้าเว็บขอรายละเอียดของผู้เช่าคนนั้น (open: AgentTenantsScreen.tsx:268-282)
    const firstRow = screen.rows.first();
    const id = Number((await firstRow.getAttribute('data-testid'))?.replace('tenants.table.row.', ''));
    expect(Number.isInteger(id), 'อ่าน id ของแถวแรกไม่ได้').toBe(true);
    const detail = waitForApi(page, 'GET', `/agent/tenants/${id}`);
    const billing = billReadsAllowed() ? waitForApi(page, 'GET', `/bills/agent/tenants/${id}`) : null;
    await firstRow.click();
    await okJson<unknown>(await detail);
    await expect(screen.detail).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === '/agent/clients');

    // ขั้นที่ 3: กล่องบิลของรายละเอียดขอ GET /bills/agent/tenants/:id (AgentTenantsScreen.tsx:166-181)
    if (billing) {
      // ระยะ 2 (B5): API อ่านอย่างเดียว ตัวกันปล่อยผ่าน คำตอบต้องสำเร็จ และไม่ขึ้นข้อความโหลดบิลไม่ได้
      await okJson<unknown>(await billing);
      await expect(screen.alert(FLOW.tenantsSlipsLoadError)).toHaveCount(0);
    } else {
      // ระยะ 1: ตัวกันตัดคำขอนี้ หน้าเว็บจึงขึ้นข้อความโหลดสลิปไม่ได้ (ผลของตัวกัน ไม่ใช่บั๊กของแอป)
      await expect(screen.alert(FLOW.tenantsSlipsLoadError)).toBeVisible();
      expect(guard.of('bill-write').map((entry) => new URL(entry.target).pathname)).toContain(`/api/v1/bills/agent/tenants/${id}`);
    }
  });
});

test.describe('calendar', () => {
  test('?date= picks that day and asks for the viewings of its month', async ({ page, loginAs }) => {
    // วันที่ 10 ของเดือนที่ห่างจากวันรัน 4 เดือน ถ้าแอปไม่สนใจ ?date= แล้วขอนัดของเดือนปัจจุบัน ช่วงของคำขอจะไม่ครอบเดือนนั้น และข้อนี้แดง
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + 4, 10, 12);
    const pad = (value: number) => String(value).padStart(2, '0');
    const key = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-10`;
    const following = new Date(target.getFullYear(), target.getMonth() + 1, 1, 12);
    const monthStart = Date.parse(`${target.getFullYear()}-${pad(target.getMonth() + 1)}-01T00:00:00+07:00`);
    const monthEnd = Date.parse(`${following.getFullYear()}-${pad(following.getMonth() + 1)}-01T00:00:00+07:00`);

    // ขั้นที่ 1: เปิด /agent/calendar?date=<key> หน้าเว็บขอนัดของเดือนนั้น บวกลบ 7 วัน (calendarViewingRange: lib/agent-calendar-viewings.ts:61-66)
    // รอคำขอที่ช่วงครอบเดือนเป้าหมาย ถ้าแอปไม่เคยขอเดือนนั้น ข้อนี้หมดเวลาที่นี่ (ข้อเสนอของ test-reviewer รอบ 2 เผื่อแอปขอเดือนปัจจุบันก่อน)
    // ค่า from ของทุกคำขอจดไว้ใน annotation
    const seen: string[] = [];
    page.on('request', (request) => {
      if (apiPathOf(request.url()) === '/agent/viewings') seen.push(new URL(request.url()).searchParams.get('from') ?? '');
    });
    const viewings = waitForApi(page, 'GET', '/agent/viewings', {
      query: (q) => Date.parse(q.get('from') ?? '') <= monthStart && Date.parse(q.get('to') ?? '') >= monthEnd,
    });
    await loginAs('agent', { next: `/agent/calendar?date=${key}` });
    const response = await viewings;
    await okJson<unknown>(response);
    test.info().annotations.push({ type: 'GET /agent/viewings ค่า from ที่ขอ', description: seen.join(', ') });
    const query = new URL(response.url()).searchParams;
    const from = Date.parse(query.get('from') ?? '');
    const to = Date.parse(query.get('to') ?? '');
    expect(from, `from=${query.get('from')} ต้องไม่หลังวันแรกของเดือนของ ${key}`).toBeLessThanOrEqual(monthStart);
    expect(to, `to=${query.get('to')} ต้องไม่ก่อนวันแรกของเดือนถัดไป`).toBeGreaterThanOrEqual(monthEnd);
    // API รับช่วงไม่เกิน 62 วัน (คอมเมนต์ของ calendarViewingRange)
    expect(to - from, 'ช่วงที่ขอต้องไม่เกิน 62 วัน').toBeLessThanOrEqual(62 * 24 * 60 * 60 * 1000);

    // ขั้นที่ 2: หัวข้อของวันที่เลือกเป็นวันนั้น (Intl en-GB weekday long day numeric month long: AgentCalendarScreen.tsx:31, :43)
    const heading = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(target);
    await expect(page.getByText(heading, { exact: true })).toBeVisible();
    await expect(page.getByText(FLOW.calendarLoadError, { exact: true })).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === '/agent/calendar' && url.searchParams.get('date') === key);
  });

  test('?date=abc falls back to today', async ({ page, loginAs }) => {
    // isValidDateKey ทิ้งค่าที่ไม่ใช่ YYYY-MM-DD (lib/app-routes.ts:226-231 ที่ 648dd28) แบบเดียวกับข้อ 2026-02-30 ใน navigation.spec.ts
    await loginAs('agent');
    await page.goto('/agent/calendar?date=abc');
    const today = await page.evaluate(() => {
      const now = new Date();
      const pad = (value: number) => String(value).padStart(2, '0');
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    });
    await expect(page).toHaveURL((url) => url.pathname === '/agent/calendar' && url.searchParams.get('date') === today);
  });
});
