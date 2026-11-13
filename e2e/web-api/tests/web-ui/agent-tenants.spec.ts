import type { Page, Response } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentTenantsPage, TENANT_SECTIONS, TILE_LABELS } from '../../src/web-ui/pages/agent-tenants.page';
import { alsoEnglish, FLOW, FLOW_EN, UI_LOCALE, fill } from '../../src/web-ui/labels';
import { ApiLog, apiPathOf, okJson, waitForApi } from '../../src/web-ui/support/api';
import { setInputValueHidden } from '../../src/web-ui/support/inputs';
import { watchForRequest } from '../../src/web-ui/support/wait';

/**
 * ผู้เช่าของนายหน้าบนจอกว้าง /agent/clients: เคส TEN-001 ถึง TEN-016
 * ตารางเคสและกฎ R1-R22: เอกสารโปรเจกต์ claude/nestyk-topic-tenants-web-ui.md (Aof อนุมัติ 13 พ.ย. 2026)
 * โค้ด: apps/consumer-app/components/AgentTenantsScreen.tsx, agent-web/TenantDirectoryTable.web.tsx, TenantWorkTable.web.tsx,
 *   TenantDetailFrame.web.tsx, lib/tenant-work.ts, lib/tenant-detail.ts ที่ qa/e2e ac7f3d8 (แอปเท่ากับ pre/dev/review d3bcf28)
 * เทส 2 ข้อเดิมของหน้านี้อยู่ใน agent-tenants-calendar.spec.ts (รายการทั้งหมดกับค้นไม่เจอ, กดแถวเปิดรายละเอียด)
 *   ไฟล์นี้ตรวจเรื่องอื่น มีซ้ำบางส่วนที่เดียว: TEN-004 ขั้นที่ 2 ค้นคำที่ไม่มีแล้วเห็น state.filtered เหมือนไฟล์นั้นบรรทัด 37-43
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web, ตั้ง E2E_QA_AGENT_PASSWORD
 * ทุกข้ออ่านอย่างเดียว: ไม่กดปุ่มท้ายแถวของตารางงาน ไม่ยืนยันสลิป ไม่สร้างสัญญา
 *   TEN-015 และ TEN-016 เปิดฟอร์มแก้ไขแต่ไม่มีคำขอ PATCH: แอปหยุดก่อนส่ง (AgentTenantsScreen.tsx:306-311) หรือเทสกด Cancel
 *   ถ้าแอปส่งคำขอเขียนไป API เอง ตัวกัน (src/web-ui/guard.ts ชนิด unexpected-write) ตัดคำขอนั้นและทำให้ข้อนั้นไม่ผ่าน
 *   ตัวกันไม่ครอบคำขอเขียนไป Supabase โดยตรง (guard.ts:28)
 * คำขอที่หน้าเว็บส่งเองเมื่อเปิดรายละเอียดผู้เช่า (TEN-009, 014, 015, 016): GET /agent/tenants/:id และ GET /bills/agent/tenants/:id
 *   (AgentTenantsScreen.tsx:166-181) คำขอบิลนี้ตัวกันปล่อยผ่านเมื่อ global-setup ตรวจแล้วว่า API อ่านอย่างเดียว ไม่อย่างนั้นตัดโดยไม่ทำให้เทสไม่ผ่าน
 *   (guard.ts:36-48 ; ดู agent-tenants-calendar.spec.ts:71-80) ไฟล์นี้ไม่ได้ตรวจกล่องบิล
 * ค่าที่คาดเทียบกับคำตอบของ GET /agent/tenants และ GET /bills/agent ในรอบเดียวกัน เพราะข้อมูลของ qa-agent ในฐานข้อมูลของทีมเปลี่ยนได้
 *   (ผลนับ 13 พ.ย. 2026: ผู้เช่า 10 ราย 10 โครงการ สัญญาเช่า active 2 ราย งานลงนาม 0 สลิปรอตรวจ 0)
 * "ไม่มีคำขอ API เพิ่ม" ในตารางเคส ไฟล์นี้ตรวจแคบกว่า: ตรวจเฉพาะ 2 คำขอรายการที่หน้าใช้ (GET /agent/tenants, GET /bills/agent)
 *   ด้วยจำนวนคำขอก่อนและหลัง (ApiLog) และช่วงเฝ้า 3 วินาทีที่เริ่มก่อนการกระทำสุดท้าย
 *
 * ตารางแสดงชื่อและเบอร์ของผู้เช่าจริง:
 *   - ปิดภาพหน้าจอของไฟล์นี้ (ข้อที่ไม่ผ่านยังมี error-context.md ซึ่งมีข้อความบนหน้า ห้ามส่งออกนอกทีม)
 *   - ค่าที่ตรวจเป็น id จำนวน และข้อความของแอป ไม่พิมพ์ชื่อหรือเบอร์
 *   - คำค้นที่มาจากข้อมูล (ชื่อโครงการ เลขที่สัญญา) ใส่ด้วย setInputValueHidden และเลือกผู้เช่าที่ชื่อขึ้นต้นด้วย E2E ก่อน
 *   - ช่องของฟอร์มแก้ไขมีชื่อและอีเมลจริง: ไม่ใช้ expect หรือ fill กับช่องโดยตรง (ดู AgentTenantsPage.field)
 *   - ถ้า TEN-015 หรือ TEN-016 ไม่ผ่านหลังกด Edit tenant แล้ว error-context.md ของข้อนั้นอาจมีค่าในช่องของฟอร์ม
 *     (ชื่อ เบอร์ อีเมล เลขบัตร: AgentTenantsScreen.tsx:698-753) ยังไม่ได้ลองว่า Playwright ใส่ค่าของช่องกรอกในไฟล์นั้นหรือไม่ ให้ถือว่ามี ห้ามส่งออกนอกทีม
 */
test.use({ screenshot: 'off' });

/** เฉพาะส่วนของคำตอบ GET /agent/tenants ที่เทสใช้ (packages/types/src/agent-tenants.ts:3-23, agent-contracts.ts:31-52) */
interface TenantRow {
  id: number;
  name: string;
  phone: string;
  property: string;
  room: string | null;
  hasAccount: boolean;
  contracts: { id: number; property: string; room: string | null; contractNo: string; formKind: string; status: string }[];
}

/** เฉพาะส่วนของคำตอบ GET /bills/agent ที่เทสใช้ (packages/types/src/contracts.ts:44-46 TenantBill) */
interface SlipRow {
  id: number;
  leaseContractId: number;
}

/** คำที่ไม่มีผู้เช่าหรืองานใดมี (ค่าเดียวกับ agent-tenants-calendar.spec.ts) */
const NO_MATCH = 'e2e-no-such-tenant';

/** ช่วงเฝ้าว่า "ไม่มีคำขอ" แบบเดียวกับ agent-tenants-calendar.spec.ts:38 */
const QUIET_MS = 3_000;

/** ตัวนับ "Showing {shown} of {total}" (TenantDirectoryTable.web.tsx:147-149) */
function showing(shown: number, total: number): string {
  return fill(FLOW.tenantsShowing, { shown: String(shown), total: String(total) });
}

/**
 * ข้อความที่แอปใช้ค้นในแท็บ All tenants คัดจาก TenantDirectoryTable.web.tsx:38-39
 * ชื่อ เบอร์ โครงการ ห้อง และโครงการ ห้อง เลขที่สัญญาของทุกสัญญา ต่อด้วยช่องว่าง แล้วทำเป็นตัวพิมพ์เล็ก
 */
function haystack(tenant: TenantRow): string {
  return `${tenant.name} ${tenant.phone} ${tenant.property} ${tenant.room ?? ''} ${tenant.contracts.map((x) => `${x.property} ${x.room ?? ''} ${x.contractNo}`).join(' ')}`.toLowerCase();
}

/** จำนวนผู้เช่าที่แอปต้องแสดงเมื่อค้นด้วยคำนี้ (แอปตัดช่องว่างหัวท้ายและทำเป็นตัวพิมพ์เล็ก: :34) */
function matching(tenants: TenantRow[], query: string): number {
  const needle = query.trim().toLowerCase();
  return tenants.filter((tenant) => haystack(tenant).includes(needle)).length;
}

/** เลือกผู้เช่าที่ตรงเงื่อนไข โดยเอาข้อมูลทดสอบ (ชื่อขึ้นต้นด้วย E2E) ก่อน เพื่อให้เทสแตะข้อมูลจริงน้อยที่สุด */
function pick(tenants: TenantRow[], wanted: (tenant: TenantRow) => boolean = () => true): TenantRow | undefined {
  return tenants.find((tenant) => tenant.name.startsWith('E2E') && wanted(tenant)) ?? tenants.find(wanted);
}

/** id ของผู้เช่าที่เป็นเจ้าของสัญญานี้ในคำตอบ GET /agent/tenants (null = ไม่พบ) */
function ownerOfContract(tenants: TenantRow[], contractId: number): number | null {
  return tenants.find((tenant) => tenant.contracts.some((contract) => contract.id === contractId))?.id ?? null;
}

/** คำขอรายการผู้เช่าหรือสลิปรอตรวจ (2 คำขอที่หน้าส่งตอนเปิด: AgentTenantsScreen.tsx:232-251) */
function isListRequest(url: string): boolean {
  const path = apiPathOf(url);
  return path === '/agent/tenants' || path === '/bills/agent';
}

/** จำนวนคำขอรายการที่แท็บนี้ส่งไปแล้ว */
function listCalls(log: ApiLog): number {
  return log.count('GET', '/agent/tenants') + log.count('GET', '/bills/agent');
}

interface Opened {
  screen: AgentTenantsPage;
  /** คำตอบของ GET /agent/tenants */
  tenants: TenantRow[];
  /** คำตอบของ GET /bills/agent (ยังไม่ได้ตรวจว่าสำเร็จ ให้ข้อที่ใช้เรียก okJson เอง) */
  slips: Promise<Response>;
  /** คำขอไป API ทั้งหมดของแท็บนี้ตั้งแต่ก่อนล็อกอิน */
  log: ApiLog;
  /** จำนวนบนแท็บ To do และ All tenants หลังโหลดเสร็จ */
  workCount: number;
  allCount: number;
}

/** เปิด /agent/clients ด้วย qa-agent แล้วรอจนโหลดเสร็จ (แท็บแสดงจำนวนเป็นตัวเลข: AgentTenantsScreen.tsx:810-811) */
async function openTenants(page: Page, loginAs: (role: 'agent', options?: { next?: string }) => Promise<void>): Promise<Opened> {
  const log = new ApiLog(page);
  const listed = waitForApi(page, 'GET', '/agent/tenants');
  const slips = waitForApi(page, 'GET', '/bills/agent');
  await loginAs('agent', { next: '/agent/clients' });
  const tenants = await okJson<TenantRow[]>(await listed);
  expect(Array.isArray(tenants), 'คำตอบของ GET /agent/tenants ต้องเป็นรายการ').toBe(true);
  const screen = new AgentTenantsPage(page);
  const workCount = await screen.tabCount('work');
  const allCount = await screen.tabCount('all');
  return { screen, tenants, slips, log, workCount, allCount };
}

/** เปิดแท็บ All tenants แล้วรอให้แถวครบ (ไม่มีคำค้นและตัวกรอง ทุกกลุ่มกางอยู่: TenantDirectoryTable.web.tsx:32, 172) */
async function showAll(screen: AgentTenantsPage, total: number): Promise<void> {
  await screen.tab('all').click();
  await expect(screen.all).toBeVisible();
  await expect(screen.count).toHaveText(showing(total, total));
  await expect(screen.rows).toHaveCount(total);
}

/** กดแถวของผู้เช่ารายนี้ แล้วรอรายละเอียด (GET /agent/tenants/:id: AgentTenantsScreen.tsx:268-281) */
async function openDetail(page: Page, screen: AgentTenantsPage, id: number): Promise<void> {
  const detail = waitForApi(page, 'GET', `/agent/tenants/${id}`);
  await screen.row(id).click();
  await okJson<unknown>(await detail);
  await expect(screen.detail).toBeVisible();
}

test.describe('tenants: tabs', () => {
  test('the first tab follows whether there is open work', { tag: '@TEN-001' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิด /agent/clients รอโหลดเสร็จ อ่านจำนวนบนแท็บ To do
    const { screen, workCount } = await openTenants(page, loginAs);
    // รอบหนึ่งตรวจได้ทางเดียว ขึ้นกับข้อมูล จดไว้ให้คนอ่านผลรู้ว่ารอบนี้ตรวจทางไหน
    test.info().annotations.push({ type: 'จำนวนงานบนแท็บ To do', description: String(workCount) });

    // ขั้นที่ 2: ยังไม่ได้กดแท็บ มีงานค้างเปิดแท็บ To do ไม่มีเปิด All tenants (R2: AgentTenantsScreen.tsx:219)
    if (workCount > 0) {
      await expect(screen.work).toBeVisible();
      await expect(screen.all).toHaveCount(0);
    } else {
      await expect(screen.all).toBeVisible();
      await expect(screen.work).toHaveCount(0);
    }
  });

  test('the All tenants tab counts the tenants of the API, and the slips to review are asked for once', { tag: '@TEN-002' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดหน้า หน้าเว็บขอ GET /agent/tenants และ GET /bills/agent พร้อมกัน (R1: AgentTenantsScreen.tsx:232-251)
    const { screen, tenants, slips, log, allCount } = await openTenants(page, loginAs);
    const late = watchForRequest(page, (request) => apiPathOf(request.url()) === '/bills/agent', QUIET_MS);

    // ขั้นที่ 2: จำนวนบนแท็บ All tenants เท่ากับจำนวนรายการในคำตอบ (R3: AgentTenantsScreen.tsx:811)
    expect(allCount, 'จำนวนบนแท็บ All tenants ต้องเท่ากับจำนวนรายการใน GET /agent/tenants').toBe(tenants.length);

    // ขั้นที่ 3: คำขอสลิปรอตรวจสำเร็จ และไม่ขึ้นข้อความโหลดสลิปไม่ได้ (:244 ขึ้นเมื่อคำขอนี้ล้ม)
    expect(Array.isArray(await okJson<unknown>(await slips)), 'คำตอบของ GET /bills/agent ต้องเป็นรายการ').toBe(true);
    for (const text of alsoEnglish(FLOW.tenantsSlipsLoadError, FLOW_EN.tenantsSlipsLoadError)) await expect(screen.alert(text)).toHaveCount(0);

    // ขั้นที่ 4: ตอนเปิดหน้ามีคำขอ GET /bills/agent 1 ครั้ง และไม่มีครั้งที่ 2 ตามมาภายในช่วงเฝ้า
    //   หน้าโหลดรายการ 1 ครั้งต่อการเปิด 1 ครั้ง (effect ที่ :252-261 ผูกกับ reloadToken)
    //   reloadToken ของหน้านี้คือ billsReloadToken (app/index.tsx:1357) ซึ่งเปลี่ยนเฉพาะเมื่อกดรีเฟรช (handlePageRefresh :1055-1079)
    //   และจอกว้างไม่มีปุ่มรีเฟรช (agent-web/AgentWorkspace.web.tsx:1166-1173) ; ผู้เรียก GET /bills/agent มีที่เดียวคือหน้านี้ (lib/tenant-bills-api.ts:45-48)
    //   กรณีที่ได้ 2 ครั้งโดยแอปไม่ผิด: คำขอแรกได้ 401 แอปต่ออายุ session แล้วส่งซ้ำ (lib/api.ts:160-167) ถ้าข้อนี้ไม่ผ่าน ให้ดูรหัสตอบกลับของคำขอแรกก่อน
    expect(await late, 'มีคำขอ GET /bills/agent ตามมาอีกหลังหน้าโหลดเสร็จ').toBe(false);
    test.info().annotations.push({ type: 'จำนวนคำขอ GET /agent/tenants ตอนเปิดหน้า', description: String(log.count('GET', '/agent/tenants')) });
    expect(log.count('GET', '/bills/agent'), 'ตอนเปิดหน้าต้องมีคำขอ GET /bills/agent 1 ครั้ง').toBe(1);
  });
});

test.describe('tenants: All tenants', () => {
  test('each status filter shows as many rows as the number on it', { tag: '@TEN-003' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดแท็บ All tenants
    const { screen, tenants, log } = await openTenants(page, loginAs);
    test.skip(tenants.length === 0, 'qa-agent ไม่มีผู้เช่า');
    const total = tenants.length;
    await showAll(screen, total);
    const callsBefore = listCalls(log);

    // ขั้นที่ 2: กดตัวกรองทีละปุ่ม จำนวนบนปุ่ม = shown ในตัวนับ = จำนวนแถว (R5, R6: TenantDirectoryTable.web.tsx:136-149)
    //   กรองในหน้าเว็บ ไม่มีคำขอรายการเพิ่ม (:35-41) ช่วงเฝ้าเริ่มก่อนการกดครั้งสุดท้าย
    const counts = { all: 0, signing: 0, active: 0 };
    let late: Promise<boolean> = Promise.resolve(false);
    for (const key of ['signing', 'active', 'all'] as const) {
      counts[key] = await screen.filterCount(key);
      if (key === 'all') late = watchForRequest(page, (request) => isListRequest(request.url()), QUIET_MS);
      await screen.filter(key).click();
      await expect(screen.count).toHaveText(showing(counts[key], total));
      await expect(screen.rows).toHaveCount(counts[key]);
    }
    test.info().annotations.push({ type: 'จำนวนบนตัวกรอง', description: `All ${counts.all} / Signing contract ${counts.signing} / Tenant ${counts.active}` });

    // ขั้นที่ 3: เทียบกับคำตอบของ API (เลขบนปุ่ม ตัวนับ และแถว แอปคำนวณจากที่เดียวกัน จึงต้องมีค่าจากข้างนอกมาเทียบ)
    //   All = ผู้เช่าทั้งหมด
    //   Tenant = ผู้เช่าที่มีสัญญาเช่าหรือต่ออายุสถานะ active อย่างน้อย 1 ฉบับ
    //     (tenantLease คืนฉบับ active ถ้ามี: lib/tenant-detail.ts:23-39 ; tenantStage เป็น active เมื่อฉบับนั้น active: :129-131 ; ตัวกรองใช้ tenantStage: lib/tenant-work.ts:92-95)
    //   Signing contract + Tenant ไม่เกิน All เพราะผู้เช่าที่สัญญาสิ้นสุดแล้วอยู่ใต้ All อย่างเดียว
    const activeInApi = tenants.filter((tenant) => tenant.contracts.some((contract) => (contract.formKind === 'lease' || contract.formKind === 'renewal') && contract.status === 'active')).length;
    expect(counts.all, 'จำนวนบนตัวกรอง All ต้องเท่ากับผู้เช่าทั้งหมด').toBe(total);
    expect(counts.active, 'จำนวนบนตัวกรอง Tenant ต้องเท่ากับผู้เช่าที่มีสัญญาเช่า active ในคำตอบ').toBe(activeInApi);
    expect(counts.signing + counts.active, 'Signing contract + Tenant ต้องไม่เกิน All').toBeLessThanOrEqual(total);
    expect(await late, 'กดตัวกรองแล้วมีคำขอ /agent/tenants หรือ /bills/agent เพิ่ม').toBe(false);
    expect(listCalls(log), 'จำนวนคำขอรายการต้องเท่าเดิมหลังกดตัวกรอง').toBe(callsBefore);
  });

  test('Clear filters empties the search and goes back to the All filter', { tag: '@TEN-004' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดแท็บ All tenants แล้วเลือกตัวกรอง Tenant ก่อน เพื่อให้เห็นว่าปุ่มล้างคืนตัวกรองด้วย
    const { screen, tenants } = await openTenants(page, loginAs);
    test.skip(tenants.length === 0, 'qa-agent ไม่มีผู้เช่า');
    const total = tenants.length;
    await showAll(screen, total);
    const active = await screen.filterCount('active');
    await screen.filter('active').click();
    await expect(screen.count).toHaveText(showing(active, total));
    // ถ้า Tenant = ทั้งหมด รอบนี้แยกไม่ได้ว่าตัวกรองถูกคืนหรือไม่ จดไว้ให้คนอ่านผลรู้
    test.info().annotations.push({ type: 'ตัวกรอง Tenant ก่อนล้าง', description: `${active} จาก ${total}${active === total ? ' (รอบนี้พิสูจน์การคืนตัวกรองไม่ได้)' : ''}` });

    // ขั้นที่ 2: ค้นคำที่ไม่มี ขึ้นสถานะกรองแล้วไม่เจอ (R7: TenantDirectoryTable.web.tsx:156-165)
    await screen.search.fill(NO_MATCH);
    await expect(screen.filteredState).toBeVisible();
    await expect(screen.rows).toHaveCount(0);

    // ขั้นที่ 3: กด Clear filters ช่องค้นว่าง ตัวกรองกลับเป็น All แถวกลับมาครบ (:161-164)
    await screen.clearFilters.click();
    await expect(screen.search).toHaveValue('');
    await expect(screen.count).toHaveText(showing(total, total));
    await expect(screen.rows).toHaveCount(total);
    await expect(screen.filteredState).toHaveCount(0);
  });

  test('searching by a project name keeps the tenants whose text has it, without asking the API', { tag: '@TEN-005' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดแท็บ All tenants เลือกชื่อโครงการของผู้เช่ารายหนึ่งจากคำตอบ API
    const { screen, tenants, log } = await openTenants(page, loginAs);
    const sample = pick(tenants, (tenant) => tenant.property.trim() !== '');
    test.skip(!sample, 'qa-agent ไม่มีผู้เช่าที่มีชื่อโครงการ');
    const total = tenants.length;
    await showAll(screen, total);
    const query = (sample as TenantRow).property;
    const expected = matching(tenants, query);
    test.info().annotations.push({ type: 'ผู้เช่าที่ควรเหลือหลังค้นด้วยชื่อโครงการ', description: `${expected} จาก ${total}` });

    // ขั้นที่ 2: ค้นด้วยชื่อโครงการนั้น shown = จำนวนผู้เช่าที่ข้อความรวมมีคำนั้น (R4: TenantDirectoryTable.web.tsx:34-41)
    const callsBefore = listCalls(log);
    const late = watchForRequest(page, (request) => isListRequest(request.url()), QUIET_MS);
    await setInputValueHidden(screen.search, query);
    await expect(screen.count).toHaveText(showing(expected, total));
    await expect(screen.rows).toHaveCount(expected);
    await expect(screen.row((sample as TenantRow).id)).toBeVisible();
    expect(await late, 'ค้นแล้วมีคำขอ /agent/tenants หรือ /bills/agent เพิ่ม').toBe(false);
    expect(listCalls(log), 'จำนวนคำขอรายการต้องเท่าเดิมหลังค้น').toBe(callsBefore);
  });

  test('searching by a contract number finds the tenant of that contract', { tag: '@TEN-006' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดแท็บ All tenants เลือกเลขที่สัญญาของผู้เช่ารายหนึ่งจากคำตอบ API
    const { screen, tenants } = await openTenants(page, loginAs);
    const sample = pick(tenants, (tenant) => tenant.contracts.some((contract) => contract.contractNo.trim() !== ''));
    test.skip(!sample, 'qa-agent ไม่มีผู้เช่าที่มีเลขที่สัญญา');
    const total = tenants.length;
    await showAll(screen, total);
    const owner = sample as TenantRow;
    const query = (owner.contracts.find((contract) => contract.contractNo.trim() !== '') as TenantRow['contracts'][number]).contractNo;
    const expected = matching(tenants, query);

    // ขั้นที่ 2: ค้นด้วยเลขที่สัญญา ผู้เช่ารายนั้นอยู่ในผลค้น และจำนวนตรงกับที่คำนวณจากคำตอบ (R4: TenantDirectoryTable.web.tsx:38)
    await setInputValueHidden(screen.search, query);
    await expect(screen.count).toHaveText(showing(expected, total));
    await expect(screen.row(owner.id)).toBeVisible();
    await expect(screen.rows).toHaveCount(expected);
  });

  test('tenants are grouped by project, in name order, and every group starts open', { tag: '@TEN-007' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดแท็บ All tenants
    const { screen, tenants } = await openTenants(page, loginAs);
    test.skip(tenants.length === 0, 'qa-agent ไม่มีผู้เช่า');
    const total = tenants.length;
    await showAll(screen, total);

    // ขั้นที่ 2: จำนวนหัวกลุ่ม = จำนวนชื่อโครงการที่ต่างกันหลังตัดช่องว่างหัวท้าย (R8: lib/tenant-work.ts:108-113)
    const projects = new Set(tenants.map((tenant) => tenant.property.trim())).size;
    await expect(screen.groupHeads).toHaveCount(projects);

    // ขั้นที่ 3: อ่านหัวกลุ่มทุกกลุ่ม ชื่อคือ "{โครงการ}, {จำนวน} people" (TenantDirectoryTable.web.tsx:180)
    const heads = await screen.groupHeadStates();
    expect(heads.filter((head) => head.group === null).length, 'หัวกลุ่มที่ aria-label ไม่ตรงรูปแบบ "{โครงการ}, {จำนวน} people"').toBe(0);
    const groups = heads.map((head) => head.group as { property: string; count: number });

    // ขั้นที่ 4: ผลรวมจำนวนของทุกกลุ่ม = shown (ตอนนี้ไม่มีคำค้นและตัวกรอง shown = ทั้งหมด) และทุกกลุ่มกางอยู่ (:32, 172, 179)
    expect(groups.reduce((sum, group) => sum + group.count, 0), 'ผลรวมจำนวนของทุกกลุ่มต้องเท่ากับจำนวนที่แสดง').toBe(total);
    expect(heads.filter((head) => !head.expanded).length, 'หัวกลุ่มที่ไม่ได้กางตอนเปิดหน้า').toBe(0);

    // ขั้นที่ 5: หัวกลุ่มเรียงตามชื่อโครงการด้วย localeCompare ของภาษาที่เปิด (lib/tenant-work.ts:114-115)
    //   เรียงในเบราว์เซอร์เดียวกับแอป เพื่อใช้กฎการเรียงชุดเดียวกัน ; ไม่พิมพ์ชื่อโครงการในข้อความ error
    //   กลุ่มของผู้เช่าที่ไม่มีชื่อโครงการแสดงชื่อ "No project" แต่แอปเรียงด้วยค่าว่าง (TenantDirectoryTable.web.tsx:173) จึงแปลงกลับก่อนเทียบ
    const names = groups.map((group) => (group.property === FLOW.tenantsNoProject ? '' : group.property));
    const sorted = await page.evaluate(([list, locale]) => [...(list as string[])].sort((a, b) => a.localeCompare(b, locale as string)), [names, UI_LOCALE] as const);
    expect(JSON.stringify(names) === JSON.stringify(sorted), 'หัวกลุ่มไม่ได้เรียงตามชื่อโครงการ').toBe(true);
  });

  test('a group heading folds and unfolds its rows', { tag: '@TEN-008' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดแท็บ All tenants อ่านจำนวนของกลุ่มแรก
    const { screen, tenants } = await openTenants(page, loginAs);
    test.skip(tenants.length === 0, 'qa-agent ไม่มีผู้เช่า');
    const total = tenants.length;
    await showAll(screen, total);
    const first = (await screen.groupHeadStates())[0];
    expect(first?.group ?? null, 'หัวกลุ่มแรกมี aria-label ไม่ตรงรูปแบบ "{โครงการ}, {จำนวน} people"').not.toBeNull();
    const inGroup = (first.group as { count: number }).count;
    expect(inGroup, 'กลุ่มแรกต้องมีผู้เช่าอย่างน้อย 1 ราย').toBeGreaterThan(0);
    const head = screen.groupHeads.first();
    await expect(head).toHaveAttribute('aria-expanded', 'true');

    // ขั้นที่ 2: กดหัวกลุ่ม กลุ่มพับ แถวของกลุ่มนั้นหาย ตัวนับไม่เปลี่ยน (R8: TenantDirectoryTable.web.tsx:69-75, 187-198)
    await head.click();
    await expect(head).toHaveAttribute('aria-expanded', 'false');
    await expect(screen.rows).toHaveCount(total - inGroup);
    await expect(screen.count).toHaveText(showing(total, total));

    // ขั้นที่ 3: กดซ้ำ แถวกลับมา
    await head.click();
    await expect(head).toHaveAttribute('aria-expanded', 'true');
    await expect(screen.rows).toHaveCount(total);
  });
});

test.describe('tenants: detail', () => {
  test('the side menu has seven sections and marks the one that is open', { tag: '@TEN-009' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดแท็บ All tenants แล้วเปิดผู้เช่ารายหนึ่ง
    const { screen, tenants } = await openTenants(page, loginAs);
    const sample = pick(tenants);
    test.skip(!sample, 'qa-agent ไม่มีผู้เช่า');
    await showAll(screen, tenants.length);
    await openDetail(page, screen, (sample as TenantRow).id);

    // ขั้นที่ 2: เมนูข้างมี 7 รายการ เริ่มที่ Overview (R10: TenantDetailFrame.web.tsx:18-26, 42-58)
    await expect(screen.sections).toHaveCount(TENANT_SECTIONS.length);
    for (const key of TENANT_SECTIONS) await expect(screen.section(key)).toBeVisible();
    await expect(screen.section('overview')).toHaveAttribute('aria-current', 'page');
    await expect(screen.currentSections).toHaveCount(1);

    // ขั้นที่ 3: กดทีละรายการ aria-current ย้ายตาม มีรายการเดียวที่เปิดอยู่ และ URL ไม่เปลี่ยน
    for (const key of TENANT_SECTIONS.filter((item) => item !== 'overview')) {
      await screen.section(key).click();
      await expect(screen.section(key)).toHaveAttribute('aria-current', 'page');
      await expect(screen.currentSections).toHaveCount(1);
      await expect(page).toHaveURL((url) => url.pathname === '/agent/clients');
    }

    // ขั้นที่ 4: กลับ Overview ได้ และตลอดข้อนี้ไม่มีคำขอเขียนไป API (ตัวกันจดคำขอที่ไม่ใช่ GET ไว้เป็น unexpected-write)
    await screen.section('overview').click();
    await expect(screen.section('overview')).toHaveAttribute('aria-current', 'page');
    expect(guard.of('unexpected-write').map((entry) => new URL(entry.target).pathname), 'เปิดหัวข้อของผู้เช่าแล้วมีคำขอเขียน').toEqual([]);
  });

  test('saving a tenant without a first name shows the message and sends nothing', { tag: '@TEN-015' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดผู้เช่ารายหนึ่งที่มีเบอร์ จำชื่อที่หัวเมนูข้างไว้ (เก็บในหน่วยความจำของเทส ไม่พิมพ์)
    //   ต้องมีเบอร์: แอปขึ้นข้อความเดียวกันเมื่อชื่อว่างหรือเบอร์ว่าง (AgentTenantsScreen.tsx:308-310) และฟอร์มเอาเบอร์จากผู้เช่า (:296)
    //   ถ้าเบอร์ว่างอยู่แล้ว ข้อความจะขึ้นแม้แอปเลิกตรวจชื่อ ข้อนี้จะผ่านผิด
    const { screen, tenants } = await openTenants(page, loginAs);
    const sample = pick(tenants, (tenant) => tenant.phone.trim() !== '');
    test.skip(!sample, 'qa-agent ไม่มีผู้เช่าที่มีเบอร์โทร');
    await showAll(screen, tenants.length);
    await openDetail(page, screen, (sample as TenantRow).id);
    const nameBefore = await screen.detailName.innerText();
    const firstName = `${FLOW.tenantsFieldFirstName} *`;

    // ขั้นที่ 2: กด Edit tenant ฟอร์มแก้ไขเปิดที่หัวข้อ profile ช่องชื่อแก้ได้ (AgentTenantsScreen.tsx:397-401, 698-712)
    await screen.editButton.click();
    await expect.poll(() => screen.fieldReadOnly(firstName), { message: 'หลังกด Edit tenant ต้องมีช่องชื่อ 1 ช่องที่แก้ได้' }).toBe(false);
    await expect(screen.section('profile')).toHaveAttribute('aria-current', 'page');

    // ขั้นที่ 3: ลบชื่อ (ไม่ใช้ fill: ช่องมีชื่อจริง) แล้วกด Save ขึ้นข้อความในแถบล่าง และไม่มีคำขอ PATCH (R16: AgentTenantsScreen.tsx:306-311)
    //   ช่วงเฝ้าเริ่มก่อนกด Save ; ถ้าแอปส่ง PATCH ตัวกันตัดก่อนถึง API และข้อนี้ไม่ผ่าน
    await setInputValueHidden(screen.field(firstName), '');
    await expect.poll(() => screen.fieldIsEmpty(firstName), { message: 'ช่องชื่อต้องว่างหลังลบ' }).toBe(true);
    const patch = watchForRequest(
      page,
      (request) => request.method() === 'PATCH' && (apiPathOf(request.url())?.startsWith('/agent/tenants/') ?? false),
      QUIET_MS,
    );
    await screen.saveButton.click();
    await expect(screen.editAlert).toHaveText(FLOW.tenantsRequiredNamePhone);
    expect(await patch, 'กด Save ทั้งที่ชื่อว่าง แล้วมีคำขอ PATCH /agent/tenants/:id').toBe(false);

    // ขั้นที่ 4: กด Cancel แถบล่างหาย ปุ่ม Edit tenant กลับมา (:376-383, :362)
    await screen.cancelButton.click();
    await expect(screen.cancelButton).toHaveCount(0);
    await expect(screen.editButton).toBeVisible();

    // ขั้นที่ 5: ชื่อเดิมยังอยู่: กด Edit tenant อีกครั้ง ช่องชื่อไม่ว่าง (ฟอร์มเติมค่าจากผู้เช่าใหม่ทุกครั้งที่เปิด: :292-300) แล้วกด Cancel
    //   ชื่อที่หัวเมนูข้างเป็นการตรวจประกอบ: ค่านี้มาจากผู้เช่าที่โหลดไว้ (:517) และเปลี่ยนเฉพาะเมื่อ PATCH สำเร็จ (:325)
    await screen.editButton.click();
    await expect.poll(() => screen.fieldIsEmpty(firstName), { message: 'เปิดฟอร์มแก้ไขอีกครั้ง ช่องชื่อต้องมีชื่อเดิม' }).toBe(false);
    await screen.cancelButton.click();
    await expect(screen.cancelButton).toHaveCount(0);
    expect((await screen.detailName.innerText()) === nameBefore, 'ชื่อผู้เช่าที่หัวเมนูข้างเปลี่ยนไปหลังกด Cancel').toBe(true);
    expect(guard.of('unexpected-write').map((entry) => new URL(entry.target).pathname), 'เปิดและปิดฟอร์มแก้ไขแล้วมีคำขอเขียน').toEqual([]);
  });

  test('the email of a tenant who already has a login cannot be edited', { tag: '@TEN-016' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เลือกผู้เช่าที่มีบัญชีล็อกอินแล้วจากคำตอบ API (hasAccount: packages/types/src/agent-tenants.ts:11-12) แล้วเปิดรายละเอียด
    const { screen, tenants } = await openTenants(page, loginAs);
    const sample = pick(tenants, (tenant) => tenant.hasAccount === true);
    test.skip(!sample, 'qa-agent ไม่มีผู้เช่าที่มีบัญชีล็อกอินแล้ว');
    await showAll(screen, tenants.length);
    await openDetail(page, screen, (sample as TenantRow).id);

    // ขั้นที่ 2: กด Edit tenant ช่องชื่อแก้ได้ (ตัวเทียบ) แต่ช่องอีเมลแก้ไม่ได้ และมีข้อความบอกเหตุผล
    //   (R18: AgentTenantsScreen.tsx:747 editable เป็น false เมื่อ hasAccount, :749-751 ข้อความ emailLocked)
    //   แอปตั้ง editable={false} ; เทสอ่านแอตทริบิวต์ readonly ของ <input> ซึ่งเป็นสิ่งที่ react-native-web วาดให้ (ยังไม่มีผลรันยืนยัน รอบแรกจะบอก)
    await screen.editButton.click();
    await expect.poll(() => screen.fieldReadOnly(`${FLOW.tenantsFieldFirstName} *`), { message: 'หลังกด Edit tenant ต้องมีช่องชื่อ 1 ช่องที่แก้ได้' }).toBe(false);
    await expect.poll(() => screen.fieldReadOnly(FLOW.tenantsFieldEmail), { message: 'ช่องอีเมลของผู้เช่าที่มีบัญชีแล้วต้องแก้ไม่ได้' }).toBe(true);
    await expect(screen.emailLockedNote).toBeVisible();

    // ขั้นที่ 3: กด Cancel แถบล่างหาย ไม่มีคำขอเขียน
    await screen.cancelButton.click();
    await expect(screen.cancelButton).toHaveCount(0);
    expect(guard.of('unexpected-write').map((entry) => new URL(entry.target).pathname), 'เปิดและปิดฟอร์มแก้ไขแล้วมีคำขอเขียน').toEqual([]);
  });
});

test.describe('tenants: To do', () => {
  /** เปิดแท็บ To do แล้วอ่านจำนวนในกล่องทั้ง 4 (ตรวจว่าอ่านได้ครบ) */
  async function openWork(screen: AgentTenantsPage): Promise<number[]> {
    await screen.tab('work').click();
    await expect(screen.work).toBeVisible();
    await expect(screen.tiles).toHaveCount(TILE_LABELS.length);
    const counts = await screen.tileCounts();
    expect(counts.map((count, index) => (count === null ? TILE_LABELS[index] : null)).filter(Boolean), 'กล่องที่ aria-label ไม่ขึ้นต้นด้วย "<ชื่อ> <จำนวน>, " ตามลำดับ slip, overdue, signing, renewal').toEqual([]);
    return counts as number[];
  }

  test('the four work tiles are in order, Overdue is off, and the numbers follow the API', { tag: '@TEN-010' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดแท็บ To do อ่านกล่อง 4 กล่อง ลำดับ slip, overdue, signing, renewal (R11: TenantWorkTable.web.tsx:151-176, lib/tenant-work.ts:6)
    const { screen, tenants, slips, workCount } = await openTenants(page, loginAs);
    const bills = await okJson<SlipRow[]>(await slips);
    const counts = await openWork(screen);
    test.info().annotations.push({ type: 'จำนวนในกล่อง slip / overdue / signing / renewal', description: counts.join(' / ') });

    // ขั้นที่ 2: กล่อง Overdue ถูกปิดเสมอ กล่องอื่นกดได้ (TenantWorkTable.web.tsx:154, 160)
    await expect(screen.tiles.nth(1)).toBeDisabled();
    for (const index of [0, 2, 3]) await expect(screen.tiles.nth(index)).toBeEnabled();

    // ขั้นที่ 3: ผลรวม 4 กล่อง = จำนวนบนแท็บ To do (lib/tenant-work.ts:84-88, AgentTenantsScreen.tsx:810)
    //   2 เลขนี้แอปนับจากรายการงานชุดเดียวกัน ข้อนี้จึงจับได้แค่กรณีที่จออ่านคนละชุด ค่าจากข้างนอกอยู่ในขั้นที่ 4
    expect(counts.reduce((sum, count) => sum + count, 0), 'ผลรวมของ 4 กล่องต้องเท่ากับจำนวนบนแท็บ To do').toBe(workCount);

    // ขั้นที่ 4: เทียบ 3 กล่องกับคำตอบของ API (กล่อง renewal ขึ้นกับวันที่รันและกฎหลายข้อ lib/tenant-work.ts:59-70 ไม่เทียบที่นี่)
    //   slip = บิลใน GET /bills/agent ที่สัญญาเช่าเป็นของผู้เช่าของบัญชีนี้ (lib/tenant-detail.ts:176-179, lib/tenant-work.ts:52)
    //   overdue = 0 เสมอ ฝั่งนายหน้ายังไม่มีแหล่งข้อมูล (lib/tenant-work.ts:46-47)
    //   signing = สัญญาสถานะ awaiting_signatures หรือ awaiting_agent_review (lib/tenant-work.ts:53-57)
    const slipsInApi = bills.filter((bill) => ownerOfContract(tenants, bill.leaseContractId) !== null).length;
    const signingInApi = tenants.reduce((sum, tenant) => sum + tenant.contracts.filter((contract) => contract.status === 'awaiting_signatures' || contract.status === 'awaiting_agent_review').length, 0);
    expect(counts[0], 'กล่อง slip ต้องเท่ากับสลิปรอตรวจของผู้เช่าในคำตอบ').toBe(slipsInApi);
    expect(counts[1], 'กล่อง overdue ต้องเป็น 0').toBe(0);
    expect(counts[2], 'กล่อง signing ต้องเท่ากับสัญญาที่รอลงนามหรือรอยืนยันในคำตอบ').toBe(signingInApi);
  });

  test('a work tile filters the work table, and Show all work brings every row back', { tag: '@TEN-011' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดแท็บ To do ตารางงานแสดงงานทุกรายการ
    const { screen, workCount } = await openTenants(page, loginAs);
    test.skip(workCount === 0, 'qa-agent ไม่มีงานค้าง (รอบนี้ TEN-012 เป็นข้อที่รัน)');
    const counts = await openWork(screen);
    await expect(screen.workRows).toHaveCount(workCount);

    // ขั้นที่ 2: กดกล่องแรกที่มีงาน (ไม่ใช่ Overdue) ตารางเหลือเฉพาะงานชนิดนั้น (R12: TenantWorkTable.web.tsx:84-88, 163, 184-191)
    const index = [0, 2, 3].find((item) => counts[item] > 0);
    expect(index, 'แท็บ To do มีงาน แต่กล่อง slip, signing, renewal เป็น 0 ทุกกล่อง').toBeDefined();
    const tile = screen.tiles.nth(index as number);
    await tile.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.workFilteredBar).toContainText(fill(FLOW.tenantsWorkFiltered, { label: TILE_LABELS[index as number] }));
    await expect(screen.workRows).toHaveCount(counts[index as number]);

    // ขั้นที่ 3: กด Show all work แถวกลับมาเท่าจำนวนบนแท็บ และกล่องเลิกถูกเลือก
    await screen.showAllWork.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'false');
    await expect(screen.workFilteredBar).toHaveCount(0);
    await expect(screen.workRows).toHaveCount(workCount);
  });

  test('with no open work the table says there is nothing to do', { tag: '@TEN-012' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดแท็บ To do (ไม่มีงาน หน้าเปิดที่ All tenants ก่อน จึงต้องกดแท็บ)
    const { screen, workCount } = await openTenants(page, loginAs);
    test.skip(workCount > 0, 'qa-agent มีงานค้าง (รอบนี้ TEN-011 เป็นข้อที่รัน)');
    const counts = await openWork(screen);

    // ขั้นที่ 2: ตารางงานแสดงสถานะว่างพร้อมข้อความ (R14: TenantWorkTable.web.tsx:217, agent-web/ui/WebTable.tsx:134-147)
    await expect(screen.workState('empty')).toBeVisible();
    await expect(screen.workState('empty')).toContainText(FLOW.tenantsWorkEmpty);
    await expect(screen.workRows).toHaveCount(0);
    // ทุกกล่องเป็น 0 (ตามมาจากจำนวนบนแท็บเป็น 0 เก็บไว้ตามตารางเคส)
    expect(counts, 'ไม่มีงานค้าง ทุกกล่องต้องเป็น 0').toEqual([0, 0, 0, 0]);
  });

  test('the work search filters in the page', { tag: '@TEN-013' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดแท็บ To do ตารางงานแสดงงานทุกรายการ
    const { screen, log, workCount } = await openTenants(page, loginAs);
    await openWork(screen);
    await expect(screen.workRows).toHaveCount(workCount);
    const callsBefore = listCalls(log);

    // ขั้นที่ 2: ค้นคำที่ไม่มี แถวเป็น 0 และสถานะเป็น "กรองแล้วไม่เจอ" ไม่ใช่ "ไม่มีงาน" (R13: TenantWorkTable.web.tsx:83-88, 212)
    await screen.workSearch.fill(NO_MATCH);
    await expect(screen.workRows).toHaveCount(0);
    await expect(screen.workState('filtered')).toBeVisible();
    await expect(screen.workState('empty')).toHaveCount(0);

    // ขั้นที่ 3: ล้างคำค้น แถวกลับมาเท่าเดิม (ไม่มีงาน = กลับเป็นสถานะว่าง) กรองในหน้าเว็บ ไม่มีคำขอรายการเพิ่ม
    //   ช่วงเฝ้าเริ่มก่อนการกระทำสุดท้าย
    const late = watchForRequest(page, (request) => isListRequest(request.url()), QUIET_MS);
    await screen.workSearch.fill('');
    await expect(screen.workState('filtered')).toHaveCount(0);
    await expect(screen.workRows).toHaveCount(workCount);
    if (workCount === 0) await expect(screen.workState('empty')).toBeVisible();
    expect(await late, 'ค้นในแท็บ To do แล้วมีคำขอ /agent/tenants หรือ /bills/agent เพิ่ม').toBe(false);
    expect(listCalls(log), 'จำนวนคำขอรายการต้องเท่าเดิมหลังค้น').toBe(callsBefore);
  });

  test('a work row opens the tenant that owns that work, on the Overview', { tag: '@TEN-014' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดแท็บ To do
    const { screen, tenants, slips, workCount } = await openTenants(page, loginAs);
    test.skip(workCount === 0, 'qa-agent ไม่มีงานค้าง');
    const bills = await okJson<SlipRow[]>(await slips);
    await openWork(screen);
    await expect(screen.workRows).toHaveCount(workCount);

    // ขั้นที่ 2: หาเจ้าของงานของแถวแรกจาก key ของแถว (TenantWorkTable.web.tsx:20-21) กับคำตอบของ API
    //   renewal-<id ผู้เช่า> / overdue-<id ผู้เช่า> ได้ id ตรง ๆ
    //   sign-<id สัญญา> เจ้าของสัญญาในคำตอบ GET /agent/tenants
    //   slip-<id บิล> บิลใน GET /bills/agent บอกสัญญาเช่า (leaseContractId) แล้วหาเจ้าของสัญญา (lib/tenant-detail.ts:176-179)
    const row = screen.workRows.first();
    const key = await screen.workRowKey(row);
    expect(key, 'อ่าน key ของแถวงานแรกไม่ได้').not.toBeNull();
    const { kind, id } = key as { kind: string; id: number };
    test.info().annotations.push({ type: 'ชนิดของแถวงานแรก', description: kind });
    const expectedId =
      kind === 'renewal' || kind === 'overdue'
        ? id
        : kind === 'sign'
          ? ownerOfContract(tenants, id)
          : kind === 'slip'
            ? ownerOfContract(tenants, bills.find((bill) => bill.id === id)?.leaseContractId ?? -1)
            : null;
    expect(expectedId, `หาเจ้าของงานชนิด ${kind} ของแถวแรกจากคำตอบของ API ไม่ได้`).not.toBeNull();

    // ขั้นที่ 3: กดที่แถว (ช่องแรก ไม่ใช่ปุ่มท้ายแถว) หน้าเว็บขอรายละเอียดของผู้เช่ารายนั้น แล้วเปิดที่ Overview (R15: AgentTenantsScreen.tsx:844, 268-281)
    const detail = waitForApi(page, 'GET', /^\/agent\/tenants\/\d+$/);
    await screen.workRowCell(row).click();
    const response = await detail;
    await okJson<unknown>(response);
    expect(Number((apiPathOf(response.url()) ?? '').split('/').pop()), 'ผู้เช่าที่เปิดต้องเป็นเจ้าของงานของแถวที่กด').toBe(expectedId);
    await expect(screen.detail).toBeVisible();
    await expect(screen.section('overview')).toHaveAttribute('aria-current', 'page');
  });
});
