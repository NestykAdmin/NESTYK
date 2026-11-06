import type { Page, Response } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { LeadsPage, enNumber } from '../../src/web-ui/pages/leads.page';
import { FLOW, fill } from '../../src/web-ui/labels';
import { okJson, waitForApi } from '../../src/web-ui/support/api';
import { setInputValueHidden } from '../../src/web-ui/support/inputs';

/**
 * หน้าลีดของนายหน้าบนจอกว้าง (แผน claude/nestyk-web-flows-readonly-plan-2026-11-06.md ข้อ L1-L7)
 * โค้ด: apps/consumer-app/components/agent-web/AgentLeadsPage.web.tsx และ lib/agent-leads-api.ts ที่ qa/e2e d6370ee (แอปเท่ากับ 648dd28)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web และเรียก API ของ staging, ตั้ง E2E_QA_AGENT_PASSWORD
 * ทุกข้ออ่านอย่างเดียว: ล็อกอิน (POST /auth/sync) แล้วเปิด ค้น กรอง เรียง เปลี่ยนหน้า ด้วย GET เท่านั้น ไม่กดปุ่มสร้างหรือแก้ลีด
 * ค่าที่คาดเทียบกับคำตอบของ API ในรอบเดียวกัน (จำนวนและลำดับของแถว) เพราะลีดของ qa-agent ใน staging เปลี่ยนได้ทุกวัน
 *
 * ตารางแสดงชื่อและเบอร์ของลูกค้าจริงในฐานข้อมูลของทีม:
 *   - ปิดภาพหน้าจอของไฟล์นี้ (test.use ด้านล่าง) แต่ข้อที่ไม่ผ่านยังมี error-context.md ซึ่งมีข้อความบนหน้า ห้าม commit หรือแนบส่งต่อ
 *   - ค่าที่ตรวจเป็นเลข id ของแถว จำนวน และป้ายสถานะ ไม่พิมพ์ชื่อหรือเบอร์ลงข้อความของการตรวจ
 *   - คำค้นมาจากชื่อลีด จึงใส่ด้วย setInputValueHidden (fill บันทึกค่าในชื่อขั้นของรายงาน HTML: support/inputs.ts)
 *     และตรวจค่าในช่องค้นแบบไม่ให้ค่าไปอยู่ในข้อความ error (ไม่ใช้ toHaveValue กับคำค้น)
 */
test.use({ screenshot: 'off' });

/** สถานะที่แสดง (packages/types/src/leads.ts LeadDisplayStatus) ลำดับเดียวกับชิป (AgentLeadsPage.web.tsx:18) */
const STATUSES = ['new', 'inprogress', 'viewing', 'booked', 'lost'] as const;
type LeadStatus = (typeof STATUSES)[number];

/** เฉพาะส่วนของคำตอบ GET /agent/leads ที่เทสใช้ (packages/types/src/leads.ts AgentLeadsPage) */
interface LeadsResult {
  items: { id: number; name: string }[];
  total: number;
  statusCounts?: Record<LeadStatus, number> | null;
}

const PAGE_SIZE = 20; // lib/agent-leads-api.ts:22 limit '20'

/** testid ของแถวตามลำดับของคำตอบ */
function rowIds(result: LeadsResult): string[] {
  return result.items.map((item) => `leads.table.row.${item.id}`);
}

/** testid ของแถวที่แสดงอยู่ ตามลำดับบนหน้า */
async function shownRowIds(leads: LeadsPage): Promise<string[]> {
  return leads.rows.evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid') ?? ''));
}

/** ข้อความช่วงของหน้าที่ page (1 เริ่มต้น) ตามกติกา pageRange (lib/agent-room-filters.ts:95-100) */
function rangeText(page: number, total: number): string {
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  return fill(FLOW.pageRange, { from: enNumber(from), to: enNumber(to), total: enNumber(total) });
}

/** ตารางต้องแสดงแถวตรงกับคำตอบ ทั้งจำนวนและลำดับ และตัวนับต้องเท่ากับ total */
async function expectTableMatches(leads: LeadsPage, result: LeadsResult): Promise<void> {
  await expect(leads.count).toHaveText(fill(FLOW.leadsCount, { count: enNumber(result.total) }));
  if (result.items.length === 0) {
    await expect(leads.rows).toHaveCount(0);
    return;
  }
  await expect(leads.rows).toHaveCount(result.items.length);
  // รอจนหน้าวาดตามคำตอบนี้ (คำตอบถึง Playwright ก่อนที่แอปจะอ่านเนื้อคำตอบและ setState: AgentLeadsPage.web.tsx:93-105)
  await expect.poll(() => shownRowIds(leads), { message: 'ลำดับแถวบนหน้าต้องตรงกับลำดับในคำตอบของ API' }).toEqual(rowIds(result));
}

/** ล็อกอินเป็น qa-agent แล้วเปิดหน้าลีด คืนคำตอบของ GET /agent/leads ครั้งแรก */
async function openLeads(page: Page, loginAs: (role: 'agent', options?: { next?: string }) => Promise<void>): Promise<{ result: LeadsResult; response: Response }> {
  const first = waitForApi(page, 'GET', '/agent/leads');
  await loginAs('agent', { next: '/agent/leads' });
  const response = await first;
  return { result: await okJson<LeadsResult>(response), response };
}

/** คำค้นจากชื่อของลีดแถวแรก (คำแรก อย่างน้อย 2 ตัวอักษร) null = ใช้ไม่ได้ ไม่พิมพ์ค่านี้ออกรายงาน */
function searchTermOf(result: LeadsResult): { term: string; id: number } | null {
  const first = result.items[0];
  const word = first?.name.trim().split(/\s+/)[0] ?? '';
  return word.length >= 2 ? { term: word, id: first.id } : null;
}

test('the first page shows the rows, the total and the range from the API', async ({ page, loginAs }) => {
  // ขั้นที่ 1: เปิดหน้า คำขอแรกต้องเป็นหน้า 1 ขนาด 20 ไม่มีคำค้น และเรียงตามที่แก้ล่าสุด (:46-51 ค่าเริ่มต้น)
  const { result, response } = await openLeads(page, loginAs);
  const query = new URL(response.url()).searchParams;
  expect(Object.fromEntries(query)).toMatchObject({ q: '', page: '1', limit: String(PAGE_SIZE), sort: 'updated_desc' });
  expect(query.has('status'), 'คำขอแรกต้องไม่กรองสถานะ').toBe(false);

  // ขั้นที่ 2: ตารางตรงกับคำตอบ
  const leads = new LeadsPage(page);
  await expect(leads.root).toBeVisible();
  await expectTableMatches(leads, result);

  // ขั้นที่ 3: ไม่มีลีดเลย ต้องขึ้นสถานะว่าง ไม่มีตัวแบ่งหน้า ; มีลีด ต้องขึ้นช่วงของหน้า 1 (:394-401)
  if (result.total === 0) {
    await expect(leads.state('empty')).toBeVisible();
    await expect(leads.pager).toHaveCount(0);
  } else {
    await expect(leads.pageRange).toHaveText(rangeText(1, result.total));
  }
});

test('the All chip counts the same leads as the total', async ({ page, loginAs }) => {
  // ชิป All แสดงผลรวมของ statusCounts (:328) ตอนไม่กรอง ผลรวมนี้ต้องเท่ากับ total ของรายการ
  // ถ้าไม่เท่า แปลว่า API นับลีดบางรายการซ้ำหรือตกหล่นในตัวนับสถานะ (เช่น ลีดที่มีนัดดูห้องถูกนับทั้ง new และ viewing)
  const { result } = await openLeads(page, loginAs);
  test.skip(!result.statusCounts, 'คำตอบไม่มี statusCounts ชิปจึงไม่แสดงจำนวน');
  const counts = result.statusCounts as Record<LeadStatus, number>;
  // รวมทุก key แบบเดียวกับแอป (Object.values: :328) ถ้า API เพิ่มสถานะใหม่ ตัวเลขบนชิปยังตรงกัน และข้อความด้านล่างแสดง key ทั้งหมด
  const sum = Object.values(counts).reduce((total, n) => total + n, 0);
  const leads = new LeadsPage(page);
  await expect(leads.chip(FLOW.leadsStatusAll)).toHaveAccessibleName(`${FLOW.leadsStatusAll} ${sum}`);
  expect(sum, `ผลรวมของ statusCounts ${JSON.stringify(counts)} ต้องเท่ากับ total`).toBe(result.total);
});

test('each status chip asks the API for that status and shows only rows of that status', async ({ page, loginAs }) => {
  const { result } = await openLeads(page, loginAs);
  test.skip(!result.statusCounts, 'คำตอบไม่มี statusCounts');
  const counts = result.statusCounts as Record<LeadStatus, number>;
  const leads = new LeadsPage(page);
  await expect(leads.count).toHaveText(fill(FLOW.leadsCount, { count: enNumber(result.total) }));

  for (const status of STATUSES) {
    const label = FLOW.leadStatus[status];
    await test.step(`chip ${label}`, async () => {
      // ขั้นที่ 1: กดชิป ชิปที่ยังไม่เลือกจะเปลี่ยนตัวกรองเป็นสถานะนี้และเริ่มจากหน้า 1 (:337-340)
      const filtered = waitForApi(page, 'GET', '/agent/leads', { query: (query) => query.get('status') === status });
      await leads.chip(label).click();
      const response = await filtered;
      expect(new URL(response.url()).searchParams.get('page')).toBe('1');
      const next = await okJson<LeadsResult>(response);

      // ขั้นที่ 2: จำนวนบนชิป (จากคำตอบแรก) ต้องเท่ากับจำนวนลีดที่ API ส่งเมื่อกรองสถานะนี้
      expect(next.total, `จำนวนบนชิป ${label} ต้องเท่ากับ total เมื่อกรอง status=${status}`).toBe(counts[status]);
      await expectTableMatches(leads, next);

      // ขั้นที่ 3: ทุกแถวต้องแสดงป้ายสถานะนี้ (ป้ายใช้ leadDisplayStatus: AgentLeadDetailBody.tsx:85-89)
      // ไม่มีแถว ต้องขึ้นสถานะ "ไม่พบตามตัวกรอง" ไม่ใช่สถานะว่าง (WebTable.tsx:136-137)
      if (next.items.length === 0) {
        await expect(leads.state('filtered')).toBeVisible();
      } else {
        for (const item of next.items) {
          await expect(leads.statusBadges(leads.row(item.id)), `ป้ายสถานะของลีด id ${item.id}`).toContainText(label);
        }
      }
    });
  }
});

test('searching sends the term with page 1 and shows the rows the API returns', async ({ page, loginAs }) => {
  // ขั้นที่ 1: ใช้คำแรกของชื่อลีดแถวแรกเป็นคำค้น ลีดนั้นต้องอยู่ในผลค้น
  const { result } = await openLeads(page, loginAs);
  const pick = searchTermOf(result);
  test.skip(pick === null, 'ไม่มีลีด หรือชื่อของลีดแถวแรกสั้นเกินจะใช้ค้น');
  const { term, id } = pick as { term: string; id: number };
  const leads = new LeadsPage(page);

  // ขั้นที่ 2: พิมพ์คำค้น หน้าเว็บรอ 250ms แล้วขอหน้า 1 ด้วยคำค้นนี้ (:70-79)
  const searched = waitForApi(page, 'GET', '/agent/leads', { query: (query) => query.get('q') === term });
  await setInputValueHidden(leads.search, term);
  const response = await searched;
  expect(new URL(response.url()).searchParams.get('page')).toBe('1');
  const found = await okJson<LeadsResult>(response);

  // ขั้นที่ 3: ลีดที่เป็นที่มาของคำค้นต้องอยู่ในผล และตารางตรงกับคำตอบ
  expect(found.items.map((item) => item.id), 'ผลค้นต้องมีลีดที่เป็นที่มาของคำค้น').toContain(id);
  await expectTableMatches(leads, found);
});

test('changing the sort asks the API for that sort and keeps its order', async ({ page, loginAs }) => {
  const { result } = await openLeads(page, loginAs);
  test.skip(result.total === 0, 'ไม่มีลีดให้เรียง');
  const leads = new LeadsPage(page);
  await expectTableMatches(leads, result);

  // เลือก "ชื่อ ก-ฮ" (ค่า name_asc :128) หน้าเว็บขอใหม่ที่หน้า 1 (:307-310) และแสดงตามลำดับของคำตอบ (การเรียงเป็นงานของ API)
  const sorted = waitForApi(page, 'GET', '/agent/leads', { query: (query) => query.get('sort') === 'name_asc' });
  await leads.sort.selectOption('name_asc');
  const response = await sorted;
  expect(new URL(response.url()).searchParams.get('page')).toBe('1');
  await expectTableMatches(leads, await okJson<LeadsResult>(response));
});

test('the next page asks for page 2 and shows its range', async ({ page, loginAs }) => {
  const { result } = await openLeads(page, loginAs);
  test.skip(result.total <= PAGE_SIZE, `มีลีด ${result.total} รายการ ไม่เกิน ${PAGE_SIZE} จึงมีหน้าเดียว`);
  const leads = new LeadsPage(page);
  await expect(leads.pageRange).toHaveText(rangeText(1, result.total));

  const second = waitForApi(page, 'GET', '/agent/leads', { query: (query) => query.get('page') === '2' });
  await leads.nextPage.click();
  const next = await okJson<LeadsResult>(await second);
  await expect(leads.pageRange).toHaveText(rangeText(2, next.total));
  await expectTableMatches(leads, next);
});

test('opening a lead keeps the URL, and Back brings the list back with the same search', async ({ page, loginAs }) => {
  // ขั้นที่ 1: ค้นด้วยคำจากลีดแถวแรก (แบบเดียวกับข้อค้น)
  const { result } = await openLeads(page, loginAs);
  const pick = searchTermOf(result);
  test.skip(pick === null, 'ไม่มีลีด หรือชื่อของลีดแถวแรกสั้นเกินจะใช้ค้น');
  const { term, id } = pick as { term: string; id: number };
  const leads = new LeadsPage(page);
  const searched = waitForApi(page, 'GET', '/agent/leads', { query: (query) => query.get('q') === term });
  await setInputValueHidden(leads.search, term);
  await okJson<LeadsResult>(await searched);
  await expect(leads.row(id)).toBeVisible();

  // ขั้นที่ 2: กดแถว หน้าเว็บขอรายละเอียดของลีดนั้น และ URL ยังเป็น /agent/leads (หน้ารายละเอียดลีดไม่มี path จึงคง URL ของรายการ: index.tsx:718 และ lib/app-routes.ts:292 ไม่พบหน้าคืน null)
  const detail = waitForApi(page, 'GET', `/agent/leads/${id}`);
  await leads.row(id).click();
  await okJson<unknown>(await detail);
  await expect(leads.detail).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === '/agent/leads');

  // ขั้นที่ 3: กดกลับ รายการกลับมาพร้อมคำค้นเดิม และขอรายการด้วยคำค้นเดิม (หน้าเว็บจำค่าไว้ใน memory :23-31, :65-67)
  const again = waitForApi(page, 'GET', '/agent/leads', { query: (query) => query.get('q') === term });
  await leads.back.click();
  await expect(leads.root).toBeVisible();
  await expect.poll(async () => (await leads.search.inputValue()) === term, { message: 'ช่องค้นต้องคงคำค้นเดิม' }).toBe(true);
  await okJson<LeadsResult>(await again);
  await expect(leads.row(id)).toBeVisible();
});

test('?q= in the URL is dropped and does not filter the list', async ({ page, loginAs }) => {
  // q ไม่ใช่ค่าที่ stateToRoute เขียนกลับ (lib/app-routes.ts:296-297 เก็บเฉพาะ date และ history) หน้าเว็บจึงแทน URL เป็น /agent/leads
  // ค่าที่คาดนี้บันทึกพฤติกรรมของ 648dd28 ถ้าทีมตั้งใจให้ ?q= กรองได้ ข้อนี้ต้องเปลี่ยน
  await loginAs('agent');
  const first = waitForApi(page, 'GET', '/agent/leads');
  await page.goto('/agent/leads?q=abc');
  const response = await first;
  expect(new URL(response.url()).searchParams.get('q'), 'คำขอแรกต้องไม่มีคำค้นจาก URL').toBe('');
  await expect(page).toHaveURL((url) => url.pathname === '/agent/leads' && url.search === '');
  await expect(new LeadsPage(page).search).toHaveValue('');
});
