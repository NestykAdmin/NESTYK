import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { billReadsAllowed, type RequestGuard } from '../../src/web-ui/guard';
import { PartyBillsPage } from '../../src/web-ui/pages/party-bills.page';
import { FLOW, fill } from '../../src/web-ui/labels';
import { ApiLog, okJson, waitForApi } from '../../src/web-ui/support/api';
import { billTexts } from '../../src/web-ui/support/bill-format';

/**
 * หน้าบิลของผู้เช่า (/tenant/bills) และหน้า Income ของผู้ให้เช่า (/landlord/income) บนจอกว้าง: เคส BIL-011 ถึง BIL-013
 * ตารางเคส: เอกสารโปรเจกต์ claude/nestyk-topic-bills-web-ui-part3.md Aof อนุมัติ 16 พ.ย. 2026
 * กฎ BL1-BL27: claude/nestyk-topic-bills-web-ui.md
 * โค้ด: apps/consumer-app/components/TenantBillsScreen.tsx (TBS), TenantBillsContent.tsx (TBC), lib/tenant-workspace-copy.ts (TWC),
 *   lib/tenant-bills-api.ts, lib/bill-format.ts ที่ qa/e2e 5142425 (แอปและ API เท่ากับ pre/dev/review d3bcf28)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web, ตั้ง E2E_QA_TENANT_PASSWORD กับ E2E_QA_LANDLORD_PASSWORD และ global-setup ยืนยันแล้วว่า
 *   GET บิลของ API นี้อ่านอย่างเดียว (E2E_WEB_BILL_READS = allowed ไม่อย่างนั้นทุกข้อในไฟล์นี้ข้าม)
 * ข้อมูล: บิลของ qa-tenant กับ qa-landlord ซึ่งทีมใช้ร่วมกัน เทสอ่านค่าจากคำตอบของ API ตอนรัน และข้ามเมื่อไม่มีบิลตามเงื่อนไข
 *   ตอนนับ 16 พ.ย. 2026 (Claude outputs/results/probe-bills-5142425-run1.txt): แต่ละบัญชีมีบิล overdue 1 ใบ ไม่มีบิล paid
 *   บิล pending, บิลที่ส่งสลิปแล้ว และบิล paid ของสองหน้านี้ จึงยังไม่ถูกตรวจด้วยข้อมูลจริง
 * ทุกข้ออ่านอย่างเดียว:
 *   - สองหน้านี้ส่ง POST /bills/mine/refresh หรือ /bills/received/refresh เองทุกครั้งที่เปิด (lib/tenant-bills-api.ts) ตัวกันของชุดเทสตัดคำขอนี้ทุกครั้ง
 *     (guard.ts ชนิด bill-write) แอปอ่านรายการต่อได้ ; เทสตรวจท้ายข้อว่าคำขอที่ไม่ใช่การอ่านมีแค่ refresh ของหน้าที่ข้อนั้นเปิด
 *     กับคำขอของขั้นล็อกอินในรายการ LOGIN_WRITES (POST /auth/sync และ POST /auth/dev/roles ที่ตัวกันตัด)
 *   - ไม่กด "Report payment / attach slip", "Confirm payment" ไม่เลือกไฟล์ และไม่กดแถวของบิลที่ชำระแล้ว
 * ค่าที่คาดของเดือนกับวันที่: คำนวณจากคำตอบของ GET /bills/mine หรือ /bills/received ด้วยสูตรเดียวกับแอป (src/web-ui/support/bill-format.ts)
 *
 * ข้อมูลของคน: คำตอบของ API และหน้าเว็บมีชื่อผู้เช่า ชื่อบัญชีและเลขบัญชีรับโอน เทสใช้เฉพาะช่องที่ประกาศใน BillRow ข้างล่าง
 *   และอ่านจากจอเฉพาะช่องที่ระบุใน src/web-ui/pages/party-bills.page.ts ; ปิดภาพหน้าจอของไฟล์นี้
 *   (ข้อที่ไม่ผ่านยังมี error-context.md ซึ่งมีข้อความบนหน้า ห้ามส่งออกนอกทีม)
 * วิธีหาชิ้นส่วนมาจากการอ่านโค้ด (สองหน้านี้ไม่มี testID)
 */
test.use({ screenshot: 'off' });

/** เฉพาะช่องของบิลที่เทสใช้ จากคำตอบของ GET /bills/mine และ /bills/received (packages/types/src/contracts.ts:44-76) */
interface BillRow {
  id: number;
  period: string;
  documentNo: string;
  issueDate: string;
  dueDate: string;
  graceUntil: string;
  status: 'pending' | 'overdue' | 'paid';
  leaseActive: boolean;
  hasPaymentSlip: boolean;
  slipSubmitted: boolean;
}

const REFRESH_MINE = 'POST /bills/mine/refresh';
const REFRESH_RECEIVED = 'POST /bills/received/refresh';
/** method ที่ไม่เขียนข้อมูล (ชุดเดียวกับ guard.ts:77) */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * คำขอที่ไม่ใช่การอ่านซึ่งมีได้ทุกข้อ และไม่ได้เกิดจากขั้นของเทส:
 *   POST /auth/sync ตัวกันยอมให้ผ่าน (guard.ts:74)
 *   POST /auth/dev/roles แอปรุ่น dev ส่งเองตอนล็อกอิน ตัวกันตัดทุกครั้งเป็นชนิด dev-role-grant จึงไม่ถึง API (guard.ts:8-15, 86)
 */
const LOGIN_WRITES = ['POST /auth/sync', 'POST /auth/dev/roles'];

/**
 * ตรวจท้ายข้อว่าเทสไม่ทำให้เกิดคำขอเขียน:
 *   - ตัวกันไม่ได้ตัดคำขอเขียนชนิดอื่น (unexpected-write)
 *   - คำขอไป API ที่ไม่ใช่การอ่าน มีได้แค่รายการ LOGIN_WRITES กับ refresh ของหน้านี้
 *   - คำขอเขียนของบิลที่ตัวกันตัด มีแต่ refresh ของหน้านี้ และมีอย่างน้อย 1 ครั้ง (หน้าส่งเองทุกครั้งที่เปิด และถูกตัดจริง จึงไม่ถึง API)
 *     แบบเดียวกับ party-pages.spec.ts:124
 */
function expectReadOnly(guard: RequestGuard, log: ApiLog, refresh: string, what: string): void {
  expect(guard.of('unexpected-write').map((entry) => new URL(entry.target).pathname), `${what}แล้วมีคำขอเขียนที่ตัวกันตัด`).toEqual([]);
  const writes = log.calls.filter((call) => !READ_METHODS.has(call.method)).map((call) => `${call.method} ${call.path}`);
  expect(writes.filter((call) => !LOGIN_WRITES.includes(call) && call !== refresh), `${what}แล้วมีคำขอไป API ที่ไม่ใช่การอ่าน นอกจาก ${refresh}`).toEqual([]);
  // เทียบเฉพาะ path (ตัวกันตัดเส้นทางนี้ทุก method: guard.ts:93)
  const refreshPath = refresh.replace(/^POST /, '');
  const blocked = guard.of('bill-write').map((entry) => new URL(entry.target).pathname.replace(/^\/api\/v\d+/, ''));
  expect(blocked.filter((path) => path !== refreshPath), 'คำขอของบิลที่ตัวกันตัด นอกจาก refresh ของหน้านี้').toEqual([]);
  expect(blocked, `ตัวกันต้องตัด ${refresh} ที่หน้าส่งเอง`).toContain(refreshPath);
}

const SKIP_NO_BILL_READS = 'global-setup ไม่ได้ยืนยันว่า GET บิลของ API นี้อ่านอย่างเดียว (E2E_WEB_BILL_READS) ตัวกันจึงตัด GET บิล';

test.describe('tenant: the Bills page', () => {
  test('each unpaid bill has a card with its month, number, status, dates and the pay button', { tag: '@BIL-011' }, async ({ page, loginAs, guard }) => {
    test.skip(!billReadsAllowed(), SKIP_NO_BILL_READS);
    // เงื่อนไขตั้งต้น: qa-tenant ที่ /tenant/bills และคำตอบของ GET /bills/mine มีบิลที่ยังไม่ paid อย่างน้อย 1 ใบ
    const log = new ApiLog(page);
    const loaded = waitForApi(page, 'GET', '/bills/mine');
    const contracts = waitForApi(page, 'GET', '/contracts/mine');
    await loginAs('tenant', { next: '/tenant/bills' });
    const rows = await okJson<BillRow[]>(await loaded);
    await okJson<unknown>(await contracts); // หน้ารอทั้ง 2 คำขอก่อนแสดงรายการ (TBS:63-71)
    expect(Array.isArray(rows), 'คำตอบของ GET /bills/mine ต้องเป็นรายการ').toBe(true);
    // บิลค้างชำระ เรียงวันครบกำหนดเก่าไปใหม่ แล้วตาม id (TBC:174-177)
    const open = rows.filter((bill) => bill.status !== 'paid').sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);
    test.skip(open.length === 0, 'qa-tenant ไม่มีบิลที่ยังไม่ชำระ');
    const bills = new PartyBillsPage(page);
    const text = await billTexts(page, { periods: open.map((bill) => bill.period), dates: open.flatMap((bill) => [bill.issueDate, bill.dueDate, bill.graceUntil]) });

    // ขั้นที่ 1: อ่านการ์ดบิลค้างชำระทุกใบ
    // ค่าที่คาด: จำนวนการ์ด "Current bill" เท่ากับจำนวนบิลที่ยังไม่ paid (TBC:467-475 ; TWC:103)
    await expect(bills.currentBillLabels).toHaveCount(open.length);
    const cards = await bills.tenantOpenCards();
    // ค่าที่คาด: แต่ละใบ เรียงตามวันครบกำหนด: หัว "Rent {เดือน}" (TBC:476-478 ; en.ts:406) ; "Bill no. {เลขที่เอกสาร}" (TBC:479-481 ; TWC:104)
    //   วันที่ใต้ "Issued" = issueDate, "Due date" = dueDate, หลัง "Pay by" = graceUntil (TBC:508-527 ; en.ts:419, 420, 426)
    expect(
      cards.map(({ title, billNo, issued, due, payBy }) => ({ title, billNo, issued, due, payBy })),
      'การ์ดบิลค้างชำระของผู้เช่า ตามลำดับ',
    ).toEqual(
      open.map((bill) => ({
        title: fill(FLOW.rentFor, { month: text.month(bill.period) }),
        billNo: `${FLOW.blBillNo} ${bill.documentNo}`,
        issued: text.date(bill.issueDate),
        due: text.date(bill.dueDate),
        payBy: text.date(bill.graceUntil),
      })),
    );
    // ค่าที่คาด: ป้าย "Overdue" เมื่อ status เป็น overdue ; "Unpaid" เมื่อเป็น pending และยังไม่ส่งสลิป (TBC:298-309 ; en.ts:423)
    //   บิล pending ที่ส่งสลิปแล้ว ไม่ตรวจป้ายของใบนั้น: รอคำตอบข้อ 6 ของทีม (claude/nestyk-web-bills-questions-for-dev-2026-11-16.md)
    const statusOf = (bill: BillRow): string | null => (bill.status === 'overdue' ? FLOW.blTenantStatus.overdue : bill.slipSubmitted ? null : FLOW.blTenantStatus.pending);
    expect(
      cards.map((card, index) => (statusOf(open[index]) === null ? null : card.status)),
      'ป้ายสถานะของการ์ดบิลค้างชำระ ตามลำดับ (null = ใบที่ไม่ตรวจ)',
    ).toEqual(open.map(statusOf));
    // ค่าที่คาด: บิลที่ไม่มีสลิป (ยังไม่แนบและยังไม่ส่ง) มีปุ่ม "Report payment / attach slip" 1 ปุ่ม (TBC:537-571 ; TWC:108) เทสไม่กดปุ่ม
    //   บิลที่มีสลิปแล้ว ไม่ตรวจจำนวนปุ่มของใบนั้น
    const noSlip = (bill: BillRow): boolean => !bill.slipSubmitted && !bill.hasPaymentSlip;
    expect(
      cards.map((card, index) => (noSlip(open[index]) ? card.payButtons : null)),
      'จำนวนปุ่ม Report payment / attach slip ของการ์ดบิลที่ไม่มีสลิป (null = ใบที่ไม่ตรวจ)',
    ).toEqual(open.map((bill) => (noSlip(bill) ? 1 : null)));
    test.info().annotations.push({
      type: 'บิลค้างชำระของ qa-tenant ที่ตรวจ',
      description: `${open.length} ใบ: overdue ${open.filter((bill) => bill.status === 'overdue').length}, pending ${open.filter((bill) => bill.status === 'pending').length}, ส่งสลิปแล้ว ${open.filter((bill) => bill.slipSubmitted).length}`,
    });

    expectReadOnly(guard, log, REFRESH_MINE, 'อ่านการ์ดบิลค้างชำระของผู้เช่า');
  });

  test('the Paid and Unpaid filters switch between the paid rows and the unpaid cards', { tag: '@BIL-012' }, async ({ page, loginAs, guard }) => {
    test.skip(!billReadsAllowed(), SKIP_NO_BILL_READS);
    // เงื่อนไขตั้งต้น: qa-tenant ที่ /tenant/bills (ไม่ต้องมีบิลค้าง)
    const log = new ApiLog(page);
    const loaded = waitForApi(page, 'GET', '/bills/mine');
    const contracts = waitForApi(page, 'GET', '/contracts/mine');
    await loginAs('tenant', { next: '/tenant/bills' });
    const rows = await okJson<BillRow[]>(await loaded);
    await okJson<unknown>(await contracts);
    expect(Array.isArray(rows), 'คำตอบของ GET /bills/mine ต้องเป็นรายการ').toBe(true);
    // ไม่มีบิลเลย หน้าแสดงตัวกรองเฉพาะเมื่อมีงวดถัดไป (TBS:193) ซึ่งเทสนี้ไม่ได้คำนวณ ; ข้อความของหน้าที่ไม่มีบิลตรวจใน party-pages.spec.ts แล้ว
    test.skip(rows.length === 0, 'qa-tenant ไม่มีบิลเลย หน้าอาจไม่แสดงปุ่มตัวกรอง (TBS:193)');
    const bills = new PartyBillsPage(page);
    // บิลที่หน้าแสดง: บิลของสัญญาที่ยังมีผล หรือบิลที่ยังไม่ paid (TBC:174) ; ค้างชำระ = ยังไม่ paid ; ชำระแล้ว = paid ของสัญญาที่ยังมีผล (TBC:175-180)
    const open = rows.filter((bill) => bill.status !== 'paid');
    const paid = rows.filter((bill) => bill.status === 'paid' && bill.leaseActive);
    test.info().annotations.push({ type: 'บิลของ qa-tenant', description: `ค้างชำระ ${open.length} ใบ, ชำระแล้วของสัญญาที่ยังมีผล ${paid.length} ใบ` });
    // ตัวกรองเริ่มที่ "Unpaid" (TBC:128, 189-193 ; หน้านี้ไม่ได้เลือกห้อง) รอจนการ์ดบิลค้างครบก่อนกด
    await expect(bills.tenantFilter('unpaid')).toBeVisible();
    await expect(bills.currentBillLabels).toHaveCount(open.length);

    // ขั้นที่ 1: กดปุ่มตัวกรอง "Paid" (TBC:461-465 ; TWC:101)
    await bills.tenantFilter('paid').click();
    // ค่าที่คาด: การ์ดบิลค้างชำระหายไป (แสดงเฉพาะตัวกรอง Unpaid: TBC:467)
    await expect(bills.currentBillLabels).toHaveCount(0);
    // ค่าที่คาด: ไม่มีบิล paid ของสัญญาที่ยังมีผล ขึ้น "No paid bills yet" (TBC:603-605 ; TWC:115) ไม่อย่างนั้นจำนวนแถวเท่ากับจำนวนบิลกลุ่มนั้น (TBC:606-611)
    await expect(bills.tenantPaidRows).toHaveCount(paid.length);
    await expect(bills.noPaid).toHaveCount(paid.length === 0 ? 1 : 0);

    // ขั้นที่ 2: กด "Unpaid" (TBC:455-460 ; TWC:107)
    await bills.tenantFilter('unpaid').click();
    // ค่าที่คาด: กลับมาเห็นการ์ดบิลค้างเท่าเดิม และแถวของบิลที่ชำระแล้วหายไป
    await expect(bills.currentBillLabels).toHaveCount(open.length);
    await expect(bills.tenantPaidRows).toHaveCount(0);
    await expect(bills.noPaid).toHaveCount(0);
    if (open.length > 0) {
      // มีบิลค้าง: ไม่ขึ้น "No unpaid bills" (TBC:600-602)
      await expect(bills.noUnpaid).toHaveCount(0);
    } else {
      // ไม่มีบิลค้าง: ขึ้น "No unpaid bills" เมื่อไม่มีงวดถัดไป ไม่อย่างนั้นขึ้นการ์ด "Next rent bill" (TBC:577-602 ; TWC:116)
      //   งวดถัดไปคำนวณจากสัญญา (TBS:66) เทสนี้ไม่ได้คำนวณ จึงรับได้ทั้ง 2 อย่าง แต่ต้องมีอย่างใดอย่างหนึ่ง
      await expect(bills.noUnpaid.or(bills.nextRentBill).first()).toBeVisible();
    }

    expectReadOnly(guard, log, REFRESH_MINE, 'กดปุ่มตัวกรองของหน้าบิลผู้เช่า');
  });
});

test.describe('landlord: the Income page', () => {
  test('each unpaid bill shows under Awaiting payment with its month, status, dates and number, and no pay buttons', { tag: '@BIL-013' }, async ({ page, loginAs, guard }) => {
    test.skip(!billReadsAllowed(), SKIP_NO_BILL_READS);
    // เงื่อนไขตั้งต้น: qa-landlord ที่ /landlord/income และคำตอบของ GET /bills/received มีบิลที่ยังไม่ paid อย่างน้อย 1 ใบ
    const log = new ApiLog(page);
    const loaded = waitForApi(page, 'GET', '/bills/received');
    await loginAs('landlord', { next: '/landlord/income' });
    const rows = await okJson<BillRow[]>(await loaded);
    expect(Array.isArray(rows), 'คำตอบของ GET /bills/received ต้องเป็นรายการ').toBe(true);
    // บิลที่ยังไม่ได้รับชำระ ตามลำดับของคำตอบ (TBS:159 ไม่เรียงใหม่)
    const open = rows.filter((bill) => bill.status !== 'paid');
    test.skip(open.length === 0, 'qa-landlord ไม่มีบิลที่ยังไม่ได้รับชำระ');
    const bills = new PartyBillsPage(page);
    const text = await billTexts(page, { periods: open.map((bill) => bill.period), dates: open.flatMap((bill) => [bill.dueDate, bill.graceUntil]) });

    // ขั้นที่ 1: อ่านส่วน "Awaiting payment"
    // ค่าที่คาด: มีหัวข้อ "Awaiting payment" (TBS:209 ; en.ts:467)
    await expect(bills.ownerCurrentTitle).toBeVisible();
    // ค่าที่คาด: จำนวนการ์ดเท่ากับจำนวนบิลที่ยังไม่ paid (TBS:159, 210 ; นับจากป้าย "Payable until" ซึ่งมี 1 ป้ายต่อการ์ด: TBS:245-248 ; en.ts:481)
    await expect(bills.ownerPayableLabels).toHaveCount(open.length);
    // ค่าที่คาด: แต่ละใบ: หัว "Rent {เดือน}" (TBS:214-216 ; en.ts:469) ; ป้าย "Overdue" หรือ "Unpaid" ตามช่อง status (TBS:162-166, 220 ; en.ts:483)
    //   วันที่หลัง "Due date" = dueDate กับ "Payable until" = graceUntil (TBS:241-248 ; en.ts:480, 481) ; เลขที่เอกสาร (TBS:249)
    expect(await bills.ownerOpenCards(), 'การ์ดของบิลที่ยังไม่ได้รับชำระ ตามลำดับ').toEqual(
      open.map((bill) => ({
        title: fill(FLOW.rentFor, { month: text.month(bill.period) }),
        status: FLOW.blOwnerStatus[bill.status as 'pending' | 'overdue'],
        due: text.date(bill.dueDate),
        payable: text.date(bill.graceUntil),
        documentNo: bill.documentNo,
      })),
    );
    // ค่าที่คาด: ทั้งหน้าไม่มีปุ่ม "Report payment / attach slip" และ "Confirm payment" (หน้าเจ้าของไม่ใช้ส่วนอัปโหลดของผู้เช่า: TBS:46, 193 ; TWC:108 ; en.ts tenant.bills.confirmPayment)
    await expect(bills.button(FLOW.blPay)).toHaveCount(0);
    await expect(bills.button(FLOW.blTenantConfirm)).toHaveCount(0);
    test.info().annotations.push({
      type: 'บิลที่ยังไม่ได้รับชำระของ qa-landlord ที่ตรวจ',
      description: `${open.length} ใบ: overdue ${open.filter((bill) => bill.status === 'overdue').length}, pending ${open.filter((bill) => bill.status === 'pending').length}`,
    });

    expectReadOnly(guard, log, REFRESH_RECEIVED, 'อ่านส่วน Awaiting payment ของหน้า Income');
  });
});
