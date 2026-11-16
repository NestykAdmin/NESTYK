import type { Page } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { billReadsAllowed, type RequestGuard } from '../../src/web-ui/guard';
import { AgentTenantsPage } from '../../src/web-ui/pages/agent-tenants.page';
import { AgentTenantBillsPage, BILL_FILTERS, type BillCard, type BillFilterKey, type PaymentRow, type SummaryTile } from '../../src/web-ui/pages/agent-tenant-bills.page';
import { FLOW, fill } from '../../src/web-ui/labels';
import { ApiLog, apiPathOf, okJson, waitForApi } from '../../src/web-ui/support/api';
import { billTexts, type BillTexts } from '../../src/web-ui/support/bill-format';
import { watchForRequest } from '../../src/web-ui/support/wait';

/**
 * หัวข้อ Bills กับ Payments ในรายละเอียดผู้เช่าของนายหน้าบนจอกว้าง: เคส BIL-001 ถึง BIL-010
 * ตารางเคส: เอกสารโปรเจกต์ claude/nestyk-topic-bills-web-ui-part3.md Aof อนุมัติ 16 พ.ย. 2026
 * กฎ BL1-BL27: claude/nestyk-topic-bills-web-ui.md ; ผลนับข้อมูล: ...-part2.md
 * โค้ด: apps/consumer-app/components/AgentTenantsScreen.tsx (ATS), TenantBillsBody.tsx (TBB), TenantPaymentsBody.tsx (TPB),
 *   lib/tenant-detail.ts (TD), lib/bill-format.ts ; API: apps/api/src/billing/tenant-billing.service.ts (SVC)
 *   ที่ qa/e2e 5142425 (แอปและ API เท่ากับ pre/dev/review d3bcf28)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web, ตั้ง E2E_QA_AGENT_PASSWORD และ global-setup ยืนยันแล้วว่า GET บิลของ API นี้อ่านอย่างเดียว
 *   (E2E_WEB_BILL_READS = allowed ไม่อย่างนั้นตัวกันตัด GET /bills/agent/tenants/:id และทุกข้อในไฟล์นี้ข้าม)
 * ขอบเขต: ผู้เช่าทดสอบ (ชื่อขึ้นต้นด้วย E2E) ของ qa-agent ข้อมูลจริงตอนนับ 16 พ.ย. 2026 (Claude outputs/results/probe-bills-5142425-run1.txt):
 *   ผู้เช่า 3 รายมีบิล paid รายละ 2 ใบ (1 ใบเลยวันผ่อนผัน 1 ใบหักเงินจอง) กับรายการชำระ 2 รายการ ; ผู้เช่า 1 รายไม่มีบิล ; ไม่มีสลิปรอตรวจและไม่มีค่าปรับ
 *   สถานะรอชำระ สลิปรอตรวจ และค่าปรับที่ออกแล้ว จึงยังไม่ถูกตรวจด้วยข้อมูลจริงในไฟล์นี้
 *   เทสเลือกผู้เช่าจากคำตอบของ API ตอนรัน ถ้าไม่มีข้อมูลตามเงื่อนไข ข้อนั้นข้ามพร้อมเหตุผล
 * ทุกข้ออ่านอย่างเดียว:
 *   - ไม่กด "Issue a late fee invoice" (เปิดฟอร์มที่ส่ง POST /bills/agent/:id/late-fee), "Confirm payment", "Reject" และ "Review slip"
 *   - ทุกข้อตรวจท้ายข้อ (expectReadOnly) ว่าตัวกันไม่ได้ตัดคำขอเขียน และตั้งแต่เปิดผู้เช่าไม่มีคำขอไป API ที่ไม่ใช่การอ่าน ยกเว้น POST /auth/sync
 * คำขอที่หน้าเว็บส่งเองเมื่อเปิดผู้เช่า (GET ทั้งหมด): /agent/tenants/:id และ /bills/agent/tenants/:id (BL1: SVC:598-644 อ่านอย่างเดียว)
 *   หัวข้อ Payments ขอ GET /bills/agent/:id/payment-slip ต่อบิลรอตรวจ 1 ใบ (BL5, BL6: ขอลิงก์ที่มีอายุ ไม่เขียนฐานข้อมูล)
 * ค่าที่คาดของเงิน เดือน วันที่: คำนวณจากคำตอบของ GET /bills/agent/tenants/:id ด้วยสูตรเดียวกับแอป (src/web-ui/support/bill-format.ts)
 *
 * ข้อมูลบนจอ: ปิดภาพหน้าจอของไฟล์นี้ (แถบข้างของรายละเอียดมีชื่อผู้เช่า ; ข้อที่ไม่ผ่านยังมี error-context.md ซึ่งมีข้อความบนหน้า ห้ามส่งออกนอกทีม)
 *   เทสอ่านเฉพาะเนื้อหาของสองหัวข้อ ซึ่งมีแค่เดือน เลขที่เอกสาร ยอด วันที่ และป้ายสถานะของข้อมูลทดสอบ
 * วิธีหาชิ้นส่วนมาจากการอ่านโค้ด (สองหัวข้อนี้ไม่มี testID) ดูคำอธิบายใน src/web-ui/pages/agent-tenant-bills.page.ts
 */
test.use({ screenshot: 'off' });

type BillStatus = 'pending' | 'awaiting_review' | 'overdue' | 'paid';

/** เฉพาะส่วนของคำตอบ GET /agent/tenants ที่เทสใช้ (packages/types/src/agent-tenants.ts ; agent-contracts.ts:49-51) */
interface TenantRow {
  id: number;
  name: string;
  contracts: { formKind: string; status: string }[];
}

/** บิล 1 ใบในคำตอบของ GET /bills/agent/tenants/:id (packages/types/src/agent-tenants.ts:26-42 ; SVC:609-613) */
interface BillRow {
  id: number;
  period: string;
  documentNo: string;
  dueDate: string;
  amount: number;
  reservationCredit: { rent: number; credit: number } | null;
  lateDays: number;
  lateFeePerDay: number | null;
  /** ใช้ตรวจแค่ว่าเป็น null หรือไม่ */
  lateFee: object | null;
  status: BillStatus;
  slipSubmittedAt: string | null;
  paidAt: string | null;
}

/** รายการชำระ 1 รายการ (packages/types/src/agent-tenants.ts:43-52 ; SVC:625-641) */
interface PaymentItem {
  id: string;
  kind: 'rent' | 'reservation';
  period: string | null;
  amount: number;
  paidAt: string;
  hasSlip: boolean;
  receiptIssued: boolean;
}

/** คำตอบของ GET /bills/agent/tenants/:id (packages/types/src/agent-tenants.ts:54-61) */
interface Billing {
  bills: BillRow[];
  upcoming: { period: string; issueDate: string; dueDate: string; amount: number } | null;
  advancePeriods: string[];
  payments: PaymentItem[];
}

const isE2e = (tenant: TenantRow): boolean => tenant.name.startsWith('E2E');
const isRental = (contract: { formKind: string }): boolean => contract.formKind === 'lease' || contract.formKind === 'renewal';
/** ผู้เช่ามีสัญญาเช่าหรือหนังสือต่อสัญญา (บิลออกจากสัญญา 2 ชนิดนี้เท่านั้น: SVC:235-244) ใช้เรียงลำดับผู้เช่าที่จะลองเปิด */
const hasRental = (tenant: TenantRow): boolean => Array.isArray(tenant.contracts) && tenant.contracts.some(isRental);
/** ผู้เช่ามีสัญญาเช่าหรือหนังสือต่อสัญญาที่ status = active (ถ้าไม่มี หน้าได้ leaseActive = false: ATS:640 ; TD:23-40) */
const hasActiveRental = (tenant: TenantRow): boolean => Array.isArray(tenant.contracts) && tenant.contracts.some((c) => isRental(c) && c.status === 'active');

/** ตัวกรองของหัวข้อ Bills ตรงกับบิลหรือไม่ (TBB:35-39) */
function matches(bill: BillRow, filter: BillFilterKey): boolean {
  return (
    filter === 'all' ||
    (filter === 'outstanding' && (bill.status === 'pending' || bill.status === 'overdue')) ||
    (filter === 'awaiting' && bill.status === 'awaiting_review') ||
    (filter === 'paid' && bill.status === 'paid')
  );
}
const sum = (rows: readonly { amount: number }[]): number => rows.reduce((total, row) => total + row.amount, 0);

/** method ที่ไม่เขียนข้อมูล (ชุดเดียวกับ guard.ts:77) */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/**
 * คำขอที่ไม่ใช่การอ่านซึ่งไม่ได้เกิดจากขั้นของเทส:
 *   POST /auth/sync ตัวกันยอมให้ผ่าน (guard.ts:74)
 *   POST /auth/dev/roles แอปรุ่น dev ส่งเองเมื่อล็อกอินหรือโหลดหน้าใหม่ ตัวกันตัดทุกครั้งเป็นชนิด dev-role-grant จึงไม่ถึง API (guard.ts:8-15, 86)
 *     (openTenant โหลดหน้าใหม่เมื่อต้องลองผู้เช่ารายถัดไป คำขอนี้จึงอาจมาหลังจุดที่จด writesBefore)
 */
const ALLOWED_WRITES = ['POST /auth/sync', 'POST /auth/dev/roles'];
/** คำขอไป API ที่ไม่ใช่การอ่านและไม่อยู่ในรายการที่ยอม เป็น "<method> <path>" (แบบเดียวกับ agent-contracts-create.spec.ts) */
function writeCalls(log: ApiLog): string[] {
  return log.calls
    .filter((call) => !READ_METHODS.has(call.method))
    .map((call) => `${call.method} ${call.path}`)
    .filter((call) => !ALLOWED_WRITES.includes(call));
}

/** ช่วงเฝ้าว่า "ไม่มีคำขอ" แบบเดียวกับ agent-tenants.spec.ts:61 */
const QUIET_MS = 3_000;
/** จำนวนผู้เช่าสูงสุดที่ลองเปิดต่อ 1 ข้อ ก่อนข้าม (ผู้เช่า E2E ของ qa-agent มี 4 ราย ณ 16 พ.ย. 2026) */
const MAX_TRIES = 4;
/** path ของคำขอลิงก์สลิปค่าเช่า (apps/consumer-app/lib/tenant-bills-api.ts:55-58) */
const SLIP_PATH = /^\/bills\/agent\/\d+\/payment-slip$/;

interface Opened {
  screen: AgentTenantsPage;
  bills: AgentTenantBillsPage;
  /** คำตอบของ GET /agent/tenants/:id ของผู้เช่าที่เปิด (เทสใช้เฉพาะ id กับ contracts) */
  tenant: TenantRow;
  /** คำตอบของ GET /bills/agent/tenants/:id ของผู้เช่าที่เปิด */
  billing: Billing;
  /** path ของคำขอนั้น */
  billingPath: string;
  /** คำขอไป API ทั้งหมดของแท็บนี้ตั้งแต่ก่อนล็อกอิน */
  log: ApiLog;
  /** จำนวนคำขอที่ไม่ใช่การอ่าน ณ ตอนที่รายละเอียดผู้เช่าเปิดเสร็จ */
  writesBefore: number;
}

type LoginAs = (role: 'agent', options?: { next?: string }) => Promise<void>;

/**
 * เปิด /agent/clients ด้วย qa-agent แล้วเปิดผู้เช่าทดสอบ (ชื่อขึ้นต้นด้วย E2E) รายแรกที่คำตอบของ GET /bills/agent/tenants/:id ตรงเงื่อนไข accept
 *   ลองตามลำดับของ order (รายที่น่าจะตรงก่อน) ไม่เกิน MAX_TRIES ราย ; จะลองรายถัดไปต้องกลับหน้ารายการ ซึ่งทำด้วยการโหลดหน้าใหม่
 *   (หน้ารายละเอียดไม่มีปุ่มกลับที่มี testID) ถ้าไม่มีรายไหนตรง ข้อนั้นข้ามพร้อมเหตุผล
 * รอจนรายละเอียดเปิดและคำขอบิลของผู้เช่านั้นสำเร็จ (BL4: ATS:166-181 ส่งเมื่อเลือกผู้เช่า)
 */
async function openTenant(
  page: Page,
  loginAs: LoginAs,
  order: (tenants: TenantRow[]) => TenantRow[],
  accept: (billing: Billing, tenant: TenantRow) => boolean,
  missing: string,
): Promise<Opened> {
  test.skip(!billReadsAllowed(), 'global-setup ไม่ได้ยืนยันว่า GET บิลของ API นี้อ่านอย่างเดียว (E2E_WEB_BILL_READS) ตัวกันจึงตัด GET /bills/agent/tenants/:id');
  const log = new ApiLog(page);
  const listed = waitForApi(page, 'GET', '/agent/tenants');
  await loginAs('agent', { next: '/agent/clients' });
  const tenants = await okJson<TenantRow[]>(await listed);
  expect(Array.isArray(tenants), 'คำตอบของ GET /agent/tenants ต้องเป็นรายการ').toBe(true);
  const candidates = order(tenants.filter(isE2e)).slice(0, MAX_TRIES);
  const screen = new AgentTenantsPage(page);

  for (const [index, tenant] of candidates.entries()) {
    if (index > 0) {
      const again = waitForApi(page, 'GET', '/agent/tenants');
      await page.reload();
      await okJson<unknown>(await again);
    }
    await screen.tabCount('all'); // รอจนหน้าโหลดเสร็จ (แท็บแสดงจำนวนเป็นตัวเลข)
    await screen.tab('all').click();
    const billingPath = `/bills/agent/tenants/${tenant.id}`;
    const detail = waitForApi(page, 'GET', `/agent/tenants/${tenant.id}`);
    const billingLoaded = waitForApi(page, 'GET', billingPath);
    await screen.row(tenant.id).click();
    // ผู้เช่าที่หน้าใช้ในรายละเอียดคือคำตอบของ GET /agent/tenants/:id (ATS:268-275) เงื่อนไขเรื่องสัญญาจึงดูจากคำตอบนี้ ไม่ใช่แถวของรายการ
    const shown = await okJson<TenantRow>(await detail);
    const billing = await okJson<Billing>(await billingLoaded);
    expect(Array.isArray(billing?.bills) && Array.isArray(billing?.payments), `คำตอบของ GET ${billingPath} ต้องมีรายการ bills กับ payments`).toBe(true);
    await expect(screen.detail).toBeVisible();
    if (accept(billing, shown)) {
      return { screen, bills: new AgentTenantBillsPage(page), tenant: shown, billing, billingPath, log, writesBefore: writeCalls(log).length };
    }
  }
  test.skip(true, `${missing} (ลองเปิด ${candidates.length} จากผู้เช่าทดสอบ ${tenants.filter(isE2e).length} ราย)`);
  throw new Error('ไม่ถึงบรรทัดนี้: test.skip หยุดข้อนี้แล้ว');
}

/** ผู้เช่าที่มีสัญญาเช่าหรือหนังสือต่อสัญญามาก่อน (รายที่น่าจะมีบิล) */
const rentalFirst = (tenants: TenantRow[]): TenantRow[] => [...tenants.filter(hasRental), ...tenants.filter((tenant) => !hasRental(tenant))];
/** ผู้เช่าที่ไม่มีสัญญาเช่าหรือหนังสือต่อสัญญาเลยมาก่อน (รายที่น่าจะไม่มีบิล) และตัดรายที่มีสัญญา active ออก */
const noRentalFirst = (tenants: TenantRow[]): TenantRow[] => {
  const idle = tenants.filter((tenant) => !hasActiveRental(tenant));
  return [...idle.filter((tenant) => !hasRental(tenant)), ...idle.filter(hasRental)];
};

/** กดหัวข้อ Bills แล้วรอจนเนื้อหาแสดง (ปุ่มตัวกรอง All ขึ้นหลังวงหมุนของการโหลดบิลหาย: ATS:551-552, 637-638) */
async function showBills(opened: Opened): Promise<void> {
  await opened.screen.section('bills').click();
  await expect(opened.screen.section('bills')).toHaveAttribute('aria-current', 'page');
  await expect(opened.bills.filter('all')).toBeVisible();
}

/** กดหัวข้อ Payments แล้วรอจนเนื้อหาแสดง (หัวข้อ "Payment history": TPB:207) */
async function showPayments(opened: Opened): Promise<void> {
  await opened.screen.section('payments').click();
  await expect(opened.screen.section('payments')).toHaveAttribute('aria-current', 'page');
  await expect(opened.bills.historyTitle).toBeVisible();
}

/** เตรียมข้อความของเงิน เดือน วันที่ ของทุกค่าในคำตอบบิลของผู้เช่ารายนี้ */
function textsOf(page: Page, billing: Billing): Promise<BillTexts> {
  const { bills, payments } = billing;
  return billTexts(page, {
    amounts: [
      0,
      sum(bills.filter((bill) => matches(bill, 'outstanding'))),
      sum(bills.filter((bill) => matches(bill, 'awaiting'))),
      sum(payments),
      ...bills.map((bill) => bill.amount),
      ...bills.flatMap((bill) => (bill.reservationCredit ? [bill.reservationCredit.rent, bill.reservationCredit.credit] : [])),
      ...bills.flatMap((bill) => (bill.lateFeePerDay != null ? [bill.lateFeePerDay] : [])),
      ...payments.map((payment) => payment.amount),
    ],
    periods: [...bills.map((bill) => bill.period), ...payments.flatMap((payment) => (payment.period ? [payment.period] : []))],
    dates: bills.map((bill) => bill.dueDate),
    instants: bills.flatMap((bill) => (bill.paidAt ? [bill.paidAt] : [])),
  });
}

/** ค่าที่ cardsOf คืนเมื่อหาเนื้อหาของหัวข้อ Bills ไม่เจอ หรือเจอมากกว่า 1 (ทำให้ expect ที่ตามมาไม่ผ่าน และข้อความบอกได้ว่าเป็นกรณีนี้) */
const NO_BILLS_BODY: BillCard[] = [{ title: '(ไม่พบเนื้อหาของหัวข้อ Bills หรือพบมากกว่า 1)', line: '', more: [], amount: '', status: '', late: null, buttons: [] }];
const NO_SUMMARY: SummaryTile[] = [{ label: '(ไม่พบช่องสรุป)', value: '', meta: '' }];
const NO_PAYMENTS: PaymentRow[] = [{ title: '(ไม่พบหัวข้อ Payment history หรือพบมากกว่า 1)', meta: '', amount: '' }];

/** การ์ดบิลตามที่อ่านได้บนจอ ใช้เทียบเนื้อหา (หาเนื้อหาของหัวข้อไม่เจอ ได้ NO_BILLS_BODY ซึ่งไม่เท่ากับค่าที่คาดใด ๆ) */
async function cardsOf(bills: AgentTenantBillsPage): Promise<BillCard[]> {
  return (await bills.billCards()) ?? NO_BILLS_BODY;
}

/** จำนวนการ์ดบิลบนจอ ใช้เทียบจำนวน (หาเนื้อหาของหัวข้อไม่เจอ ได้ -1 ซึ่งไม่เท่ากับจำนวนจริงใด ๆ) */
async function cardCount(bills: AgentTenantBillsPage): Promise<number> {
  return (await bills.billCards())?.length ?? -1;
}

/** ตรวจท้ายข้อว่าเทสไม่ทำให้เกิดคำขอเขียน (แบบเดียวกับ agent-contracts-create.spec.ts) */
function expectReadOnly(guard: RequestGuard, opened: Pick<Opened, 'log' | 'writesBefore'>, what: string): void {
  expect(guard.of('unexpected-write').map((entry) => new URL(entry.target).pathname), `${what}แล้วมีคำขอเขียนที่ตัวกันตัด`).toEqual([]);
  expect(writeCalls(opened.log).slice(opened.writesBefore), `${what}แล้วมีคำขอไป API ที่ไม่ใช่การอ่าน`).toEqual([]);
}

const hasBills = (billing: Billing): boolean => billing.bills.length > 0;
const NO_TENANT_WITH_BILLS = 'qa-agent ไม่มีผู้เช่าทดสอบ (ชื่อขึ้นต้นด้วย E2E) ที่มีบิลอย่างน้อย 1 ใบ';

test.describe('tenant bills: requests', () => {
  test('the bills of a tenant are asked for once, and opening Bills or Payments does not ask for them again', { tag: '@BIL-001' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: qa-agent ที่ /agent/clients เลือกผู้เช่า E2E ที่มีบิลอย่างน้อย 1 ใบ
    // ขั้นที่ 1: เปิดผู้เช่า ; ค่าที่คาด: มีคำขอ GET /bills/agent/tenants/:id ของผู้เช่านั้น 1 ครั้ง และสำเร็จ (BL4: ATS:166-181)
    //   (openTenant รอคำตอบและตรวจว่าสำเร็จแล้ว)
    const opened = await openTenant(page, loginAs, rentalFirst, hasBills, NO_TENANT_WITH_BILLS);
    const { log, billing, billingPath } = opened;
    expect(log.count('GET', billingPath), `ตอนเปิดผู้เช่าต้องมีคำขอ GET ${billingPath} 1 ครั้ง`).toBe(1);

    // ขั้นที่ 2: กดหัวข้อ Bills ; ขั้นที่ 3: กดหัวข้อ Payments
    const again = (request: { url(): string }): boolean => apiPathOf(request.url()) === billingPath;
    const duringClicks = watchForRequest(page, again, QUIET_MS);
    await showBills(opened);
    await showPayments(opened);
    // เฝ้าต่ออีก QUIET_MS นับจากหัวข้อ Payments แสดงแล้ว เผื่อคำขอที่ตามมาช้า
    const afterClicks = watchForRequest(page, again, QUIET_MS);

    // ค่าที่คาด: จำนวนคำขอ GET /bills/agent/:id/payment-slip เท่ากับจำนวนบิล awaiting_review ในคำตอบ (BL5: TPB:66-83, 181-199 รูปย่อของการ์ดสลิปขอเองตอนแสดง)
    const awaiting = billing.bills.filter((bill) => bill.status === 'awaiting_review').length;
    test.info().annotations.push({ type: 'บิลรอตรวจสลิปของผู้เช่าที่เปิด', description: `${awaiting} ใบ` });
    await expect.poll(() => log.count('GET', SLIP_PATH), { message: 'จำนวนคำขอ GET /bills/agent/:id/payment-slip หลังเปิดหัวข้อ Payments' }).toBe(awaiting);

    // ค่าที่คาด: ขั้นที่ 2 กับ 3 ไม่มีคำขอ GET /bills/agent/tenants/:id เพิ่ม (BL4: effect ไม่ขึ้นกับหัวข้อที่เปิด ATS:181)
    expect([await duringClicks, await afterClicks], `กดหัวข้อ Bills หรือ Payments แล้วมีคำขอ GET ${billingPath} เพิ่ม (ระหว่างกด, หลังกด)`).toEqual([false, false]);
    expect(log.count('GET', billingPath), `จำนวนคำขอ GET ${billingPath} หลังเปิดทั้ง 2 หัวข้อ`).toBe(1);
    expect(log.count('GET', SLIP_PATH), 'จำนวนคำขอ GET /bills/agent/:id/payment-slip หลังช่วงเฝ้า').toBe(awaiting);

    expectReadOnly(guard, opened, 'เปิดหัวข้อ Bills กับ Payments');
  });
});

test.describe('tenant bills: the Bills section', () => {
  test('the three summary tiles add up the bills of the API', { tag: '@BIL-002' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: หัวข้อ Bills ของผู้เช่า E2E ที่มีบิล
    const opened = await openTenant(page, loginAs, rentalFirst, hasBills, NO_TENANT_WITH_BILLS);
    await showBills(opened);
    const text = await textsOf(page, opened.billing);
    const { bills } = opened.billing;

    // ขั้นที่ 1: อ่านช่องสรุป 3 ช่อง
    // ค่าที่คาด: Outstanding = ยอดรวมของบิล pending กับ overdue ; Slip to review = ยอดรวมของบิล awaiting_review ; Paid = "{จำนวนบิล paid} periods"
    //   (TBB:141-175 ; TD:94-106 ; en.ts:700-703)
    const expected: SummaryTile[] = [
      { label: FLOW.blSummary.outstanding, value: text.amount(sum(bills.filter((bill) => matches(bill, 'outstanding')))), meta: '' },
      { label: FLOW.blSummary.awaiting, value: text.amount(sum(bills.filter((bill) => matches(bill, 'awaiting')))), meta: '' },
      { label: FLOW.blSummary.paid, value: fill(FLOW.blPeriods, { count: bills.filter((bill) => matches(bill, 'paid')).length }), meta: '' },
    ];
    await expect.poll(async () => (await opened.bills.billsSummary()) ?? NO_SUMMARY, { message: 'ช่องสรุปของหัวข้อ Bills' }).toEqual(expected);

    expectReadOnly(guard, opened, 'อ่านช่องสรุปของหัวข้อ Bills');
  });

  test('the four filters count the bills of the API and show the matching cards', { tag: '@BIL-003' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: หัวข้อ Bills ของผู้เช่า E2E ที่มีบิล
    const opened = await openTenant(page, loginAs, rentalFirst, hasBills, NO_TENANT_WITH_BILLS);
    await showBills(opened);
    const { bills } = opened.billing;
    const countOf = (filter: BillFilterKey): number => bills.filter((bill) => matches(bill, filter)).length;

    // ขั้นที่ 1: อ่านชื่อปุ่มตัวกรอง 4 ปุ่ม ; ค่าที่คาด: "All N", "Outstanding N", "To review N", "Paid N" โดย N นับจากคำตอบของ API
    //   (TBB:177-187 ; packages/ui/src/components/MobileFilterChip.tsx:59 ; en.ts:704-707)
    await expect.poll(() => opened.bills.filterNames(), { message: 'ชื่อปุ่มตัวกรองของหัวข้อ Bills' }).toEqual(BILL_FILTERS.map((filter) => `${FLOW.blFilter[filter]} ${countOf(filter)}`));

    // ขั้นที่ 2: กด "Paid" ; ค่าที่คาด: จำนวนการ์ดบิลเท่ากับจำนวนบิล paid และทุกใบมีป้าย "Paid" (TBB:35-39, 140 ; en.ts:753)
    await opened.bills.filter('paid').click();
    await expect.poll(() => cardCount(opened.bills), { message: 'จำนวนการ์ดบิลเมื่อเลือกตัวกรอง Paid' }).toBe(countOf('paid'));
    expect((await cardsOf(opened.bills)).map((card) => card.status), 'ป้ายสถานะของการ์ดบิลเมื่อเลือกตัวกรอง Paid').toEqual(bills.filter((bill) => matches(bill, 'paid')).map(() => FLOW.blStatus.paid));
    test.info().annotations.push({
      type: 'ตัวกรอง Paid',
      description: countOf('paid') === bills.length ? 'บิลทุกใบของผู้เช่ารายนี้เป็น paid ขั้นที่ 2 จึงแยกไม่ได้ว่าหน้ากรองจริงหรือไม่' : `กรองเหลือ ${countOf('paid')} จาก ${bills.length} ใบ`,
    });

    // ขั้นที่ 3: กดตัวกรองที่จำนวนเป็น 0 (ถ้ามี) ; ค่าที่คาด: ขึ้น "No bills match this filter" และไม่มีการ์ดบิล (TBB:277-281 ; en.ts:756)
    const emptyFilter = BILL_FILTERS.find((filter) => filter !== 'all' && countOf(filter) === 0);
    test.info().annotations.push({ type: 'ตัวกรองที่จำนวนเป็น 0', description: emptyFilter ?? 'ไม่มี ขั้นที่ 3 จึงไม่ได้ตรวจ' });
    if (emptyFilter) {
      await opened.bills.filter(emptyFilter).click();
      await expect(opened.bills.emptyFilter).toBeVisible();
      expect(await cardCount(opened.bills), `จำนวนการ์ดบิลเมื่อเลือกตัวกรอง ${emptyFilter}`).toBe(0);
    }

    // ขั้นที่ 4: กด "All" ; ค่าที่คาด: จำนวนการ์ดเท่ากับจำนวนบิลทั้งหมด และข้อความว่างหายไป
    await opened.bills.filter('all').click();
    await expect.poll(() => cardCount(opened.bills), { message: 'จำนวนการ์ดบิลเมื่อเลือกตัวกรอง All' }).toBe(bills.length);
    await expect(opened.bills.emptyFilter).toHaveCount(0);

    expectReadOnly(guard, opened, 'กดปุ่มตัวกรองของหัวข้อ Bills');
  });

  test('each bill card shows the month, document number, due date, amount and status of the API, in the same order', { tag: '@BIL-004' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: หัวข้อ Bills ของผู้เช่า E2E ที่มีบิล ตัวกรอง All (ค่าเริ่มต้น: TBB:65)
    const opened = await openTenant(page, loginAs, rentalFirst, hasBills, NO_TENANT_WITH_BILLS);
    await showBills(opened);
    const text = await textsOf(page, opened.billing);

    // ขั้นที่ 1: อ่านการ์ดบิลทุกใบตามลำดับ
    // ค่าที่คาด: หัว "{เดือน} rent" ; บรรทัด "{เลขที่เอกสาร} · Due {วันครบกำหนด}" ; ยอด ; ป้ายสถานะตามช่อง status ; ลำดับเท่ากับคำตอบของ API
    //   (TBB:86-91, 206-215, 234-237 ; ลำดับของ API: SVC:605-606 ; en.ts:710, 747, 750-753)
    const expected = opened.billing.bills.map((bill) => ({
      title: fill(FLOW.blBillRent, { month: text.month(bill.period) }),
      line: `${bill.documentNo} · ${fill(FLOW.blBillDue, { date: text.date(bill.dueDate) })}`,
      amount: text.amount(bill.amount),
      status: FLOW.blStatus[bill.status],
    }));
    await expect
      .poll(async () => (await cardsOf(opened.bills)).map(({ title, line, amount, status }) => ({ title, line, amount, status })), { message: 'การ์ดบิลของหัวข้อ Bills ตามลำดับ' })
      .toEqual(expected);

    expectReadOnly(guard, opened, 'อ่านการ์ดบิล');
  });

  test('a paid bill shows the day it was confirmed, by the calendar of Bangkok', { tag: '@BIL-005' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: ผู้เช่า E2E ที่มีบิล paid ซึ่งมี paidAt
    const paid = (bill: BillRow): boolean => bill.status === 'paid' && !!bill.paidAt;
    const opened = await openTenant(page, loginAs, rentalFirst, (billing) => billing.bills.some(paid), 'qa-agent ไม่มีผู้เช่าทดสอบที่มีบิล paid ซึ่งมีเวลายืนยัน (paidAt)');
    await showBills(opened);
    const text = await textsOf(page, opened.billing);
    const index = opened.billing.bills.findIndex(paid);
    const bill = opened.billing.bills[index];
    await expect.poll(() => cardCount(opened.bills), { message: 'จำนวนการ์ดบิลของหัวข้อ Bills' }).toBe(opened.billing.bills.length);
    const card = (await cardsOf(opened.bills))[index];
    expectReadOnly(guard, opened, 'อ่านบรรทัดวันยืนยัน');

    // ขั้นที่ 1: อ่านบรรทัดวันยืนยันของบิล paid ใบแรก
    // ค่าที่คาด: "Confirmed {วันที่}" โดยวันที่เป็นวันตามเวลากรุงเทพของ paidAt (ข้อความ: TBB:228-232 ; en.ts:749)
    //   ที่มาของวันที่: ข้ออนุมานที่ Aof อนุมัติ 16 พ.ย. 2026 (ทาง ก ของ BIL-005): วันยืนยันควรเป็นวันตามเวลากรุงเทพ เหมือน "วันนี้" ที่แอปใช้ (TBB:20-22)
    //   จากโค้ด แอปตัดวันที่จาก 10 ตัวแรกของ paidAt ซึ่ง API ส่งเป็นเวลา UTC (lib/bill-format.ts:8-11 ; SVC:427)
    //   ถ้าบิลใบนี้ถูกยืนยันช่วง 00:00-06:59 น. เวลากรุงเทพ ข้อนี้จะไม่ผ่าน (วันบนจอช้าไป 1 วัน) ; นอกช่วงนั้นสองค่าเท่ากัน ข้อนี้ผ่านและไม่ได้พิสูจน์เรื่องเขตเวลา
    //   ยังไม่ติดเครื่องหมายบั๊ก รอ Aof ตัดสินจากผลรัน
    const sameDay = (bill.paidAt as string).slice(0, 10) === (await page.evaluate((iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)), bill.paidAt as string));
    test.info().annotations.push({ type: 'วันตามเวลา UTC กับวันตามเวลากรุงเทพของ paidAt', description: sameDay ? 'วันเดียวกัน ข้อนี้ไม่ได้พิสูจน์เรื่องเขตเวลา' : 'คนละวัน ข้อนี้พิสูจน์เรื่องเขตเวลา' });
    expect(card.more, `บรรทัดใต้เลขที่เอกสารของบิล ${bill.documentNo}`).toContain(fill(FLOW.blPaidAt, { date: text.bangkokDate(bill.paidAt as string) }));
  });

  test('the reservation deduction line shows on the bills that have one, and only on them', { tag: '@BIL-006' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: ผู้เช่า E2E ที่มีบิลซึ่ง reservationCredit ไม่เป็น null
    const opened = await openTenant(
      page,
      loginAs,
      rentalFirst,
      (billing) => billing.bills.some((bill) => bill.reservationCredit != null),
      'qa-agent ไม่มีผู้เช่าทดสอบที่มีบิลซึ่งหักเงินจอง (reservationCredit)',
    );
    await showBills(opened);
    const text = await textsOf(page, opened.billing);
    const { bills } = opened.billing;
    await expect.poll(() => cardCount(opened.bills), { message: 'จำนวนการ์ดบิลของหัวข้อ Bills' }).toBe(bills.length);
    const cards = await cardsOf(opened.bills);

    // ขั้นที่ 1: อ่านบรรทัดหักเงินจองของแต่ละบิล
    // ค่าที่คาด: บิลที่มี reservationCredit มีบรรทัด "Rent {ค่าเช่า} less reservation {เงินจอง}" ; บิลที่ช่องนี้เป็น null ไม่มีบรรทัดนี้ (TBB:216-222 ; en.ts:711)
    // ส่วนต้นของบรรทัดหักเงินจอง ก่อนยอดค่าเช่า ("Rent " หรือ "ค่าเช่า ") บรรทัดอื่นใต้เลขที่เอกสาร (วันส่งสลิป วันยืนยัน) ไม่ขึ้นต้นแบบนี้ (en.ts:748-749)
    const prefix = FLOW.blReservationDeduction.split('{rent}')[0];
    const expected = bills.map((bill) =>
      bill.reservationCredit ? [fill(FLOW.blReservationDeduction, { rent: text.amount(bill.reservationCredit.rent), credit: text.amount(bill.reservationCredit.credit) })] : [],
    );
    expect(cards.map((card) => card.more.filter((line) => line.startsWith(prefix))), 'บรรทัดหักเงินจองของแต่ละบิล ตามลำดับการ์ด').toEqual(expected);

    expectReadOnly(guard, opened, 'อ่านบรรทัดหักเงินจอง');
  });

  test('a bill past its grace date shows the days and one button to issue a late fee invoice', { tag: '@BIL-007' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: ผู้เช่า E2E ที่มีบิลซึ่ง lateDays > 0 และ lateFee เป็น null
    const lateNoFee = (bill: BillRow): boolean => bill.lateDays > 0 && bill.lateFee == null;
    const opened = await openTenant(page, loginAs, rentalFirst, (billing) => billing.bills.some(lateNoFee), 'qa-agent ไม่มีผู้เช่าทดสอบที่มีบิลเลยวันผ่อนผัน (lateDays > 0) ซึ่งยังไม่มีค่าปรับ');
    await showBills(opened);
    const text = await textsOf(page, opened.billing);
    const { bills } = opened.billing;
    await expect.poll(() => cardCount(opened.bills), { message: 'จำนวนการ์ดบิลของหัวข้อ Bills' }).toBe(bills.length);
    const cards = await cardsOf(opened.bills);

    // ขั้นที่ 1: อ่านบล็อกค่าปรับของแต่ละบิล (เทสไม่กดปุ่ม)
    // ค่าที่คาด: บิลที่ lateDays > 0 มีข้อความ "{lateDays} days past the grace date" ต่อด้วย " · Contract late fee {ยอด} per day" เมื่อ lateFeePerDay ไม่เป็น null
    //   บิลที่ lateDays = 0 และไม่มี lateFee ไม่มีบล็อกนี้ (TBB:242-247 ; en.ts:714, 715)
    const lateText = (bill: BillRow): string | null =>
      bill.lateDays > 0 || bill.lateFee != null
        ? `${fill(FLOW.blLateDays, { days: bill.lateDays })}${bill.lateFeePerDay != null ? ` · ${fill(FLOW.blLateRate, { amount: text.amount(bill.lateFeePerDay) })}` : ''}`
        : null;
    expect(cards.map((card) => card.late), 'บรรทัดแรกของบล็อกค่าปรับของแต่ละบิล ตามลำดับการ์ด').toEqual(bills.map(lateText));
    // ค่าที่คาด: การ์ดของบิลที่ lateDays > 0 และ lateFee เป็น null มีปุ่ม "Issue a late fee invoice" 1 ปุ่ม การ์ดอื่นไม่มี (TBB:269-271 ; en.ts:712)
    expect(cards.map((card) => card.buttons.filter((name) => name === FLOW.blLateCreate).length), 'จำนวนปุ่ม Issue a late fee invoice ในแต่ละการ์ด').toEqual(bills.map((bill) => (lateNoFee(bill) ? 1 : 0)));
    // ค่าที่คาด: จำนวนปุ่มนี้ทั้งหัวข้อเท่ากับจำนวนบิลที่ lateDays > 0 และ lateFee เป็น null
    await expect(opened.bills.lateFeeCreate).toHaveCount(bills.filter(lateNoFee).length);

    expectReadOnly(guard, opened, 'อ่านบล็อกค่าปรับ');
  });

  test('a tenant without bills or an active lease only sees that bills start once the lease is active', { tag: '@BIL-008' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: ผู้เช่า E2E ที่ไม่มีบิล ไม่มีงวดถัดไป และไม่มีสัญญาเช่าหรือหนังสือต่อสัญญาที่สถานะ active
    const opened = await openTenant(
      page,
      loginAs,
      noRentalFirst,
      (billing, tenant) => billing.bills.length === 0 && billing.upcoming == null && !hasActiveRental(tenant),
      'qa-agent ไม่มีผู้เช่าทดสอบที่ไม่มีบิล ไม่มีงวดถัดไป และไม่มีสัญญาเช่าที่ active',
    );

    // ขั้นที่ 1: เปิดหัวข้อ Bills
    await opened.screen.section('bills').click();
    await expect(opened.screen.section('bills')).toHaveAttribute('aria-current', 'page');

    // ค่าที่คาด: ขึ้นข้อความ "Bills start once the lease is active" (TBB:76-84 ; leaseActive: ATS:640, TD:23-40 ; en.ts:693)
    await expect(opened.bills.noLease).toBeVisible();
    // ค่าที่คาด: ไม่มีปุ่มตัวกรองและไม่มีช่องสรุป (หน้าคืนการ์ดข้อความใบเดียวก่อนถึงส่วนนั้น: TBB:76-84)
    await expect(opened.bills.filters).toHaveCount(0);
    expect(await opened.bills.noLeaseBodyChildren(), 'จำนวนลูกของเนื้อหาหัวข้อ Bills (ต้องมีแค่การ์ดข้อความ 1 ใบ ไม่มีช่องสรุป)').toBe(1);

    expectReadOnly(guard, opened, 'เปิดหัวข้อ Bills ของผู้เช่าที่ไม่มีบิล');
  });
});

test.describe('tenant bills: the Payments section', () => {
  const hasPayments = (billing: Billing): boolean => billing.payments.length > 0;
  const NO_TENANT_WITH_PAYMENTS = 'qa-agent ไม่มีผู้เช่าทดสอบ (ชื่อขึ้นต้นด้วย E2E) ที่มีรายการชำระอย่างน้อย 1 รายการ';

  test('the summary adds up the payments and the slips to review of the API', { tag: '@BIL-009' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: ผู้เช่า E2E ที่มีรายการชำระอย่างน้อย 1 รายการ เปิดหัวข้อ Payments
    const opened = await openTenant(page, loginAs, rentalFirst, hasPayments, NO_TENANT_WITH_PAYMENTS);
    await showPayments(opened);
    const text = await textsOf(page, opened.billing);
    const { bills, payments } = opened.billing;
    const awaiting = bills.filter((bill) => matches(bill, 'awaiting'));

    // ขั้นที่ 1: อ่านสรุป 2 ช่อง
    // ค่าที่คาด: "Total received" = ยอดรวมของ payments[].amount กับ "{จำนวนรายการ} payments" ; "To review" = ยอดรวมของบิล awaiting_review กับ "{จำนวน} payments"
    //   (TPB:157-173 ใช้ receivedCount ทั้ง 2 ช่อง ; TD:94-106 ; en.ts:757-759)
    const expected: SummaryTile[] = [
      { label: FLOW.blReceivedTotal, value: text.amount(sum(payments)), meta: fill(FLOW.blReceivedCount, { count: payments.length }) },
      { label: FLOW.blAwaitingTotal, value: text.amount(sum(awaiting)), meta: fill(FLOW.blReceivedCount, { count: awaiting.length }) },
    ];
    await expect.poll(async () => (await opened.bills.paymentsSummary()) ?? NO_SUMMARY, { message: 'สรุปของหัวข้อ Payments' }).toEqual(expected);

    // ขั้นที่ 2: นับปุ่ม "Confirm payment" ; ค่าที่คาด: เท่ากับจำนวนบิล awaiting_review (TPB:181-203 การ์ดสลิป 1 ใบต่อบิลรอตรวจ 1 ใบ ; en.ts:763) เทสไม่กดปุ่ม
    await expect(opened.bills.confirmPayment).toHaveCount(awaiting.length);

    expectReadOnly(guard, opened, 'อ่านสรุปของหัวข้อ Payments');
  });

  test('the payment history lists the payments of the API, newest first, with their slip and receipt marks', { tag: '@BIL-010' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: ผู้เช่า E2E ที่มีรายการชำระอย่างน้อย 1 รายการ เปิดหัวข้อ Payments
    const opened = await openTenant(page, loginAs, rentalFirst, hasPayments, NO_TENANT_WITH_PAYMENTS);
    await showPayments(opened);
    const text = await textsOf(page, opened.billing);

    // ขั้นที่ 1: อ่านประวัติการรับเงิน
    // ค่าที่คาด: หัวข้อ "Payment history" (showPayments รอแล้ว: TPB:207 ; en.ts:774) ; จำนวนแถวเท่ากับ payments.length เรียง paidAt ใหม่ไปเก่า (TPB:135)
    //   ชื่อแถว "Reservation fee" เมื่อ kind เป็น reservation หรือไม่มี period ไม่อย่างนั้น "{เดือน} rent" (TPB:226-230 ; en.ts:710, 775)
    //   บรรทัดรองต่อจากวันที่: "Slip attached" เมื่อ hasSlip และ "Receipt issued" เมื่อ receiptIssued (TPB:231-239 ; en.ts:776, 777)
    //   ยอด (TPB:241) ; วันที่ในบรรทัดรองไม่ตรวจในข้อนี้ (รูปแบบวันที่ตรวจที่ BIL-004 เรื่องเขตเวลาตรวจที่ BIL-005)
    const sorted = [...opened.billing.payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
    const expected = sorted.map((payment) => ({
      title: payment.kind === 'reservation' || !payment.period ? FLOW.blReservationFee : fill(FLOW.blBillRent, { month: text.month(payment.period) }),
      marks: [payment.hasSlip ? FLOW.blHasSlip : null, payment.receiptIssued ? FLOW.blReceiptIssued : null].filter((mark): mark is string => mark !== null),
      amount: text.amount(payment.amount),
    }));
    await expect
      .poll(
        async () =>
          ((await opened.bills.paymentRows()) ?? NO_PAYMENTS).map((row) => ({
            title: row.title,
            // บรรทัดรองคือ "{วันที่} · {เครื่องหมาย} · {เครื่องหมาย}" ตัดส่วนแรก (วันที่) ออก
            marks: row.meta.split(' · ').slice(1),
            amount: row.amount,
          })),
        { message: 'แถวประวัติการรับเงิน ตามลำดับ' },
      )
      .toEqual(expected);

    expectReadOnly(guard, opened, 'อ่านประวัติการรับเงิน');
  });
});
