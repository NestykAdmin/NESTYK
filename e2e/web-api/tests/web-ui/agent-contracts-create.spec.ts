import type { Page, Response } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { billReadsAllowed, type RequestGuard } from '../../src/web-ui/guard';
import { AgentTenantsPage } from '../../src/web-ui/pages/agent-tenants.page';
import {
  AgentContractsPage,
  BROKER_FIELDS,
  BOX_MISSING,
  BROKER_REQUIRED,
  DOCUMENT_KINDS,
  RESERVATION_TENANT_FIELDS,
  brokerFieldLabel,
  kindButtonName,
  type BrokerFieldKey,
  type ReservationFieldKey,
  type ReservationStep,
} from '../../src/web-ui/pages/agent-contracts.page';
import { CONTRACT_SAVE_CONFIRM, FLOW, UI_LOCALE } from '../../src/web-ui/labels';
import { ApiLog, apiPathOf, okJson, waitForApi } from '../../src/web-ui/support/api';
import { watchForRequest } from '../../src/web-ui/support/wait';

/**
 * นายหน้าสร้างเอกสารสัญญาบนจอกว้าง (รายละเอียดผู้เช่า หัวข้อ Contracts): เคส CCR-001 ถึง CCR-023
 * ตารางเคส: เอกสารโปรเจกต์ claude/nestyk-topic-contracts-create-web-ui-part2.md หัวข้อ 8 (CCR-001 ถึง CCR-011)
 *   และ claude/nestyk-topic-contracts-create-web-ui-part3.md (CCR-012 ถึง CCR-023) Aof อนุมัติ 13 พ.ย. 2026
 * CCR-012 ติดเครื่องหมายบั๊กที่รู้แล้ว WEB-024 (e2e/KNOWN-BUGS.md) และรันเฉพาะภาษาอังกฤษ
 * กฎ K1-K17: claude/nestyk-topic-contracts-create-web-ui.md หัวข้อ 1
 * โค้ด: apps/consumer-app/components/ContractsScreen.tsx (CS), ContractTypePicker.tsx (CTP), BrokerAppointmentFields.tsx (BAF),
 *   AgentContractLibrary.tsx, lib/contract-renewal.ts ที่ qa/e2e 40e0496 (แอปเท่ากับ pre/dev/review d3bcf28)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web, ตั้ง E2E_QA_AGENT_PASSWORD
 * ทุกข้ออ่านอย่างเดียว:
 *   - ไม่กดปุ่ม "บันทึกฉบับร่าง" ในกล่องยืนยัน (ปุ่มนี้ส่ง POST /agent/contracts: CS:2518-2520) และไม่กดปุ่ม "View ..." ของเอกสาร (K9)
 *   - ข้อที่กด "Save draft" ของฟอร์ม: แอปหยุดก่อนส่งคำขอ เพราะช่องผิด (CS:1616-1620) หรือเพราะเปิดกล่องยืนยันก่อน (CS:1697-1699)
 *   - ถ้าแอปส่งคำขอเขียนไป API เอง ตัวกัน (src/web-ui/guard.ts ชนิด unexpected-write) ตัดคำขอนั้นและทำให้ข้อนั้นไม่ผ่าน
 *     ทุกข้อจึงตรวจท้ายข้อ (expectReadOnly) ว่าไม่มีคำขอที่ถูกตัดชนิดนี้ และนับจาก ApiLog ว่าตั้งแต่เปิดหัวข้อ Contracts เสร็จ
 *     ไม่มีคำขอไป API ที่ไม่ใช่การอ่าน (GET, HEAD, OPTIONS) เลย ยกเว้น POST /auth/sync ที่ตัวกันยอมให้ผ่าน (ครอบชนิดที่ตัวกันตัดแบบเงียบด้วย)
 *     ตัวกันไม่ครอบคำขอเขียนไป Supabase โดยตรง (guard.ts:28)
 * คำขอที่หน้าเว็บส่งเอง (อ่านอย่างเดียวทั้งหมด ตรวจโค้ด API ที่ 40e0496 แล้ว):
 *   - เปิดรายละเอียดผู้เช่า: GET /agent/tenants/:id และ GET /bills/agent/tenants/:id (ดูหัวไฟล์ agent-tenants.spec.ts)
 *   - เปิดหัวข้อ Contracts: GET /agent/contracts, /agent/contracts/invoices, /agent/contracts/commission-confirmations (CS:327-358)
 *   - เปิดฟอร์มสัญญาแต่งตั้ง: GET /agent/contracts/types, /types/<code>/templates, /broker-appointment-defaults/<leadId> (CS:1868, 1357-1358, 1404-1407)
 *   - เปิดฟอร์มหนังสือจอง: GET types, แม่แบบ, /reservation-defaults/<leadId> และ GET /agent/leads/<leadId>/deal-offers (CS:1389-1391, 582-594)
 *     เทสไม่พิมพ์ในช่อง Search landlord ของฟอร์มหนังสือจอง เพราะช่องนั้นเรียก GET /agent/contracts/owner-users (ReservationLetterFields.tsx:278-305)
 *
 * ค่าที่คาดเรื่องการล็อกเทียบกับคำตอบของ GET /agent/tenants ในรอบเดียวกัน เพราะข้อมูลของ qa-agent ในฐานข้อมูลของทีมเปลี่ยนได้
 *   (ผลนับ 13 พ.ย. 2026: ผู้เช่า 10 ราย, ไม่มีเอกสารเลย 4 ราย, brokerAppointmentReady จริง 4 ราย ซึ่งเป็น E2E id 7-10, มีหนังสือจองที่ออกแล้ว 0 ราย)
 *   รายการสัญญาของผู้เช่าในคำตอบนี้กับรายการที่หน้าสัญญาใช้มาจากฟังก์ชันเดียวกันของ API และกรองด้วยผู้เช่าเหมือนกัน
 *   (apps/api/src/agent/tenants/agent-tenants.service.ts:193-202 ; CS:338-341)
 *
 * ข้อมูลบนจอ:
 *   - ปิดภาพหน้าจอของไฟล์นี้ (ข้อที่ไม่ผ่านยังมี error-context.md ซึ่งมีข้อความบนหน้า ห้ามส่งออกนอกทีม)
 *   - CCR-002 ต้องใช้ผู้เช่าที่ยังไม่มีเอกสาร ซึ่งอาจไม่ใช่ข้อมูลทดสอบ ข้อนั้นแค่เปิดตัวเลือกชนิดเอกสาร ไม่พิมพ์อะไร และไม่ใส่ชื่อในข้อความผล
 *   - CCR-013 กดปุ่มของการ์ดงานถัดไปของผู้เช่าที่ยังไม่มีเอกสาร ซึ่งอาจไม่ใช่ข้อมูลทดสอบ (Aof อนุมัติ 13 พ.ย. 2026) ฟอร์มสัญญาแต่งตั้งจะเปิดและแสดง
 *     ข้อมูลของผู้ให้เช่าบนจอ ข้อนั้นตรวจแค่หัวข้อของฟอร์ม ไม่อ่านและไม่พิมพ์ในช่อง
 *   - ข้อที่เปิดฟอร์ม (CCR-005 ถึง CCR-012 และ CCR-016 ถึง CCR-023) ใช้เฉพาะผู้เช่าที่ชื่อขึ้นต้นด้วย E2E ถ้าไม่มีจะข้าม เพราะฟอร์มเติมข้อมูลของผู้ให้เช่าและนายหน้ามาให้
 *     ค่าในช่องอ่านเป็น true/false ผ่าน fieldIsEmpty / fieldValueIs และตั้งค่าผ่าน setField เท่านั้น ไม่ใช้ fill หรือ expect กับช่องโดยตรง
 *     เพราะถ้าไม่ผ่าน Playwright จะพิมพ์ตัวชิ้นส่วนพร้อมค่าในช่องลงรายงาน ข้อความที่เทสพิมพ์เองขึ้นต้นด้วย E2E
 * วิธีหาชิ้นส่วนของหน้านี้มาจากการอ่านโค้ด (หน้าสัญญาไม่มี testID: K12) ดูคำอธิบายใน src/web-ui/pages/agent-contracts.page.ts
 */
test.use({ screenshot: 'off' });

/** เฉพาะส่วนของคำตอบ GET /agent/tenants ที่เทสใช้ (packages/types/src/agent-tenants.ts:3-23, agent-contracts.ts:31-52, 77) */
interface ContractRow {
  id: number;
  leadId: number;
  formKind: string;
  status: string;
  reservationLetterStatus?: string | null;
  /** วันสุดท้ายที่ควรลงนามหนังสือจองครบ (agent-contracts.ts:105-109) */
  signDueDate?: string | null;
}
interface TenantRow {
  id: number;
  leadId: number;
  name: string;
  /** ใช้ตรวจแค่ว่ามีค่าหรือไม่ ห้ามพิมพ์ค่า */
  email: string | null;
  identityNumber: string | null;
  brokerAppointmentReady: boolean;
  contracts: ContractRow[];
}

/** เฉพาะส่วนของคำตอบ GET /agent/contracts/types ที่เทสใช้ (packages/types/src/agent-contracts.ts:12-18) */
interface AgreementTypeRow {
  code: string;
  nameTh: string;
  formKind: string;
}

/** ช่วงเฝ้าว่า "ไม่มีคำขอ" แบบเดียวกับ agent-tenants.spec.ts */
const QUIET_MS = 3_000;

/** สถานะที่ถือว่าเอกสารสิ้นสุดแล้ว (CS:430) */
const ENDED = ['cancelled', 'expired', 'terminated'];

const isE2e = (tenant: TenantRow): boolean => tenant.name.startsWith('E2E');

/** เลือกผู้เช่าที่ตรงเงื่อนไข โดยเอาข้อมูลทดสอบ (ชื่อขึ้นต้นด้วย E2E) ก่อน */
function pick(tenants: TenantRow[], wanted: (tenant: TenantRow) => boolean = () => true): TenantRow | undefined {
  return tenants.find((tenant) => isE2e(tenant) && wanted(tenant)) ?? tenants.find(wanted);
}

/** ผู้เช่ารายนี้มีหนังสือจองที่ออกเอกสารแล้วและยังไม่สิ้นสุดหรือไม่ = เงื่อนไขที่แท็บสัญญาเช่าไม่ล็อก (finalizedReservation: CS:425-433) */
function hasIssuedReservation(tenant: TenantRow): boolean {
  return tenant.contracts.some(
    (row) => row.formKind === 'reservation' && row.reservationLetterStatus === 'ready' && !ENDED.includes(row.status) && row.leadId === tenant.leadId,
  );
}

/** วันนี้ตามเวลากรุงเทพ รูปแบบ YYYY-MM-DD ใช้เติมช่องวันที่เมื่อช่องว่าง */
function bangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** คำขอ POST /agent/contracts = คำขอบันทึกร่างใหม่ (apps/consumer-app/lib/agent-contracts-api.ts:164-169) */
function isSaveDraftRequest(method: string, url: string): boolean {
  return method === 'POST' && apiPathOf(url) === '/agent/contracts';
}

/** method ที่ไม่เขียนข้อมูล (ชุดเดียวกับ guard.ts:77) */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** คำขอเขียนที่ตัวกันยอมให้ผ่าน (guard.ts:74): แอปส่ง POST /auth/sync เมื่อมีเหตุการณ์ของการล็อกอิน ซึ่งอาจเกิดซ้ำระหว่างเทส */
const ALLOWED_WRITES = ['POST /auth/sync'];

/** คำขอไป API ที่ไม่ใช่การอ่านและไม่อยู่ในรายการที่ยอม ตามลำดับที่เกิด เป็น "<method> <path>" (path มีแค่ชื่อเส้นทางกับเลข id) */
function writeCalls(log: ApiLog): string[] {
  return log.calls
    .filter((call) => !READ_METHODS.has(call.method))
    .map((call) => `${call.method} ${call.path}`)
    .filter((call) => !ALLOWED_WRITES.includes(call));
}

interface Opened {
  screen: AgentTenantsPage;
  docs: AgentContractsPage;
  tenants: TenantRow[];
  tenant: TenantRow;
  /** คำขอไป API ทั้งหมดของแท็บนี้ตั้งแต่ก่อนล็อกอิน */
  log: ApiLog;
  /** จำนวนคำขอที่ไม่ใช่การอ่าน ณ ตอนที่หัวข้อ Contracts โหลดเสร็จ (ก่อนหน้านั้นมีคำขอของการล็อกอิน) */
  writesBefore: number;
}

/**
 * ตรวจท้ายข้อว่าเทสไม่ทำให้เกิดคำขอเขียน: ไม่มีคำขอที่ตัวกันตัดเป็น unexpected-write
 * และตั้งแต่หัวข้อ Contracts โหลดเสร็จ ไม่มีคำขอไป API ที่ไม่ใช่การอ่าน (คำขอที่ถูกตัดก็ถูกจดใน ApiLog: support/api.ts)
 */
function expectReadOnly(guard: RequestGuard, opened: Pick<Opened, 'log' | 'writesBefore'>, what: string): void {
  expect(guard.of('unexpected-write').map((entry) => new URL(entry.target).pathname), `${what}แล้วมีคำขอเขียนที่ตัวกันตัด`).toEqual([]);
  expect(writeCalls(opened.log).slice(opened.writesBefore), `${what}แล้วมีคำขอไป API ที่ไม่ใช่การอ่าน`).toEqual([]);
}

type LoginAs = (role: 'agent', options?: { next?: string }) => Promise<void>;

/**
 * เปิด /agent/clients ด้วย qa-agent เลือกผู้เช่าจากคำตอบของ API เปิดรายละเอียด แล้วเปิดหัวข้อ Contracts
 * รอจนรายการเอกสารโหลดเสร็จ: ปุ่ม Create document เลิกปิด (AgentContractLibrary.tsx:124 disabled={busy || loading})
 * ถ้าไม่มีผู้เช่าที่ตรงเงื่อนไข เทสข้อนั้นข้ามพร้อมเหตุผล
 */
async function openContracts(page: Page, loginAs: LoginAs, choose: (tenants: TenantRow[]) => TenantRow | undefined, missing: string): Promise<Opened> {
  const log = new ApiLog(page);
  const listed = waitForApi(page, 'GET', '/agent/tenants');
  await loginAs('agent', { next: '/agent/clients' });
  const tenants = await okJson<TenantRow[]>(await listed);
  expect(Array.isArray(tenants), 'คำตอบของ GET /agent/tenants ต้องเป็นรายการ').toBe(true);
  const chosen = choose(tenants);
  test.skip(!chosen, missing);
  const tenant = chosen as TenantRow;

  const screen = new AgentTenantsPage(page);
  await screen.tabCount('all'); // รอจนหน้าโหลดเสร็จ (แท็บแสดงจำนวนเป็นตัวเลข)
  await screen.tab('all').click();
  const detail = waitForApi(page, 'GET', `/agent/tenants/${tenant.id}`);
  await screen.row(tenant.id).click();
  await okJson<unknown>(await detail);
  await expect(screen.detail).toBeVisible();

  const lists = [
    waitForApi(page, 'GET', '/agent/contracts'),
    waitForApi(page, 'GET', '/agent/contracts/invoices'),
    waitForApi(page, 'GET', '/agent/contracts/commission-confirmations'),
  ];
  await screen.section('contracts').click();
  await expect(screen.section('contracts')).toHaveAttribute('aria-current', 'page');
  for (const list of lists) await okJson<unknown>(await list);
  const docs = new AgentContractsPage(page);
  await expect(docs.createDocument).toBeEnabled();
  return { screen, docs, tenants, tenant, log, writesBefore: writeCalls(log).length };
}

/** กด Create document แล้วรอตัวเลือกชนิดเอกสาร (CS:3709) */
async function openPicker(docs: AgentContractsPage): Promise<void> {
  await docs.createDocument.click();
  await expect(docs.pickerTitle).toBeVisible();
}

interface BrokerForm {
  /** ประเภท "สัญญาแต่งตั้งนายหน้า" จากคำตอบของ GET /agent/contracts/types */
  type: AgreementTypeRow;
  /** คำตอบของคำขอแม่แบบและค่าตั้งต้น */
  templates: Response;
  defaults: Response;
  /** ชื่อชนิดที่หัวข้อของฟอร์มใช้ในภาษาที่รัน */
  headingType: string;
}

/**
 * กด "Create Broker appointment" ในตัวเลือกชนิดเอกสาร แล้วรอจนฟอร์มพร้อมให้พิมพ์
 * แอปขอ GET types → หาประเภทที่ formKind หรือ code เป็น broker_appointment (CS:1868-1875) → ขอแม่แบบและค่าตั้งต้น (CS:1357-1358, 1404-1407)
 * ระหว่างนั้นปุ่มและช่องถูกปิด (busy) จึงรอจนปุ่ม Save draft เลิกปิด (CS:1897-1899, 647-648)
 * หัวข้อของฟอร์ม: ภาษาที่ไม่ใช่ไทยใช้ชื่อชนิดจากไฟล์ภาษา ภาษาไทยใช้ชื่อไทยของประเภทจาก API (CS:2038-2047)
 */
async function openBrokerForm(page: Page, docs: AgentContractsPage, tenant: TenantRow): Promise<BrokerForm> {
  const typesAsked = waitForApi(page, 'GET', '/agent/contracts/types');
  const templatesAsked = waitForApi(page, 'GET', /^\/agent\/contracts\/types\/[^/]+\/templates$/);
  const defaultsAsked = waitForApi(page, 'GET', `/agent/contracts/broker-appointment-defaults/${tenant.leadId}`);
  await docs.kind('broker').click();
  const types = await okJson<AgreementTypeRow[]>(await typesAsked);
  const type = types.find((row) => row.formKind === 'broker_appointment' || row.code === 'broker_appointment');
  expect(type, 'คำตอบของ GET /agent/contracts/types ต้องมีประเภทสัญญาแต่งตั้งนายหน้า').toBeTruthy();
  const templates = await templatesAsked;
  const defaults = await defaultsAsked;
  const found = type as AgreementTypeRow;
  const headingType = UI_LOCALE === 'th' ? found.nameTh : FLOW.ccTypeBroker;
  await expect(docs.formHeading(headingType)).toBeVisible();
  await expect(docs.saveDraft).toBeEnabled();
  return { type: found, templates, defaults, headingType };
}

/** เปิดฟอร์มสัญญาแต่งตั้งของผู้เช่าทดสอบ (ชื่อขึ้นต้นด้วย E2E) ตั้งแต่ล็อกอิน */
async function openBrokerFormOfTestTenant(page: Page, loginAs: LoginAs): Promise<Opened & BrokerForm> {
  const opened = await openContracts(page, loginAs, (tenants) => tenants.find(isE2e), 'qa-agent ไม่มีผู้เช่าทดสอบ (ชื่อขึ้นต้นด้วย E2E) จึงไม่เปิดฟอร์มกับข้อมูลจริง');
  await openPicker(opened.docs);
  const form = await openBrokerForm(page, opened.docs, opened.tenant);
  return { ...opened, ...form };
}

/**
 * เติมช่องบังคับที่ยังว่างให้ผ่านการตรวจของหน้าเว็บ (BAF:61-74) โดยไม่แตะช่องที่มีค่าตั้งต้นอยู่แล้ว
 * ช่องวันที่เติมวันนี้ ช่องอื่นเติมข้อความขึ้นต้น E2E และล้างช่องค่าคอมแบบจำนวนเดือน เพื่อไม่ให้มีค่าคอม 2 แบบพร้อมกัน
 */
async function completeRequired(docs: AgentContractsPage): Promise<void> {
  for (const key of BROKER_REQUIRED) {
    const empty = await docs.fieldIsEmpty(key);
    expect(empty, `ต้องพบช่อง ${key} 1 ช่อง`).not.toBeNull();
    if (empty) await typeInto(docs, key, key === 'issueDate' ? bangkokToday() : `E2E ${key}`);
  }
  const months = await docs.fieldIsEmpty('commissionMonths');
  expect(months, 'ต้องพบช่อง commissionMonths 1 ช่อง').not.toBeNull();
  if (months === false) await typeInto(docs, 'commissionMonths', '');
}

/**
 * ตั้งค่าในช่องของฟอร์มแบบไม่ให้ค่าเดิมของช่องไปอยู่ในรายงาน (AgentContractsPage.setField) แล้วรอจนช่องมีค่านั้น
 * ข้อความที่ส่งเข้ามาเป็นของเทสเอง (ขึ้นต้น E2E วันที่ ตัวเลข หรือค่าว่าง) จึงใส่ในข้อความ error ได้
 */
async function typeInto(docs: AgentContractsPage, key: BrokerFieldKey, value: string): Promise<void> {
  expect(await docs.setField(key, value), `ตั้งค่าช่อง ${key}`).toBe('ok');
  await expect.poll(() => docs.fieldValueIs(key, value), { message: `ช่อง ${key} ต้องมีค่าที่เทสตั้ง` }).toBe(true);
}

/** ข้อความผิดพลาดใต้ช่องทั้ง 18 ช่อง ตามลำดับของ BROKER_FIELDS (null = ไม่มี) */
async function fieldErrors(docs: AgentContractsPage): Promise<Record<string, string | null>> {
  const errors: Record<string, string | null> = {};
  for (const key of BROKER_FIELDS) errors[key] = await docs.fieldErrorText(key);
  return errors;
}

/** ค่าที่คาดของ fieldErrors: ช่องที่ระบุมีข้อความนี้ ช่องอื่นไม่มี */
function onlyErrors(expected: Partial<Record<BrokerFieldKey, string>>): Record<string, string | null> {
  const errors: Record<string, string | null> = {};
  for (const key of BROKER_FIELDS) errors[key] = expected[key] ?? null;
  return errors;
}

test.describe('contracts: choosing a document type', () => {
  test('Create document shows three groups and five document types', { tag: '@CCR-001' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดหัวข้อ Contracts ของผู้เช่ารายหนึ่ง แล้วกด Create document (K3: CS:3709)
    const opened = await openContracts(page, loginAs, (tenants) => pick(tenants), 'qa-agent ไม่มีผู้เช่า');
    const { docs } = opened;
    await openPicker(docs);

    // ค่าที่คาด: หัวข้อ คำถาม และชื่อกลุ่ม 3 กลุ่ม (CTP:62-67, 75-80 ; contracts.picker.title/question, contracts.screen.library.*)
    await expect(docs.pickerQuestion).toBeVisible();
    for (const title of [FLOW.ccGroupRental, FLOW.ccGroupFinance, FLOW.ccGroupBrokerage]) await expect(docs.pickerGroup(title)).toBeVisible();

    // ค่าที่คาด: ปุ่มชนิดเอกสาร 5 ปุ่ม ชื่อ "Create {label}" เรียงตามกลุ่ม และไม่มีปุ่มที่ 6 (CTP:74-86 ; ไม่มีหนังสือยืนยันค่าคอม: CTP:77)
    await expect.poll(() => docs.kindButtonNames(), { message: 'ชื่อของปุ่มชนิดเอกสารตามลำดับบนจอ' }).toEqual(DOCUMENT_KINDS.map(kindButtonName));

    expectReadOnly(guard, opened, 'เปิดตัวเลือกชนิดเอกสาร');
  });

  test('a tenant with no documents has the reservation, lease and renewal types locked, with the three reasons', { tag: '@CCR-002' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เลือกผู้เช่าที่ยังไม่มีเอกสารเลยและยังไม่มีสัญญาแต่งตั้งที่ใช้ได้ แล้วกด Create document
    const opened = await openContracts(
      page,
      loginAs,
      (tenants) => pick(tenants, (tenant) => tenant.contracts.length === 0 && tenant.brokerAppointmentReady !== true),
      'qa-agent ไม่มีผู้เช่าที่ยังไม่มีเอกสารและยังไม่มีสัญญาแต่งตั้งที่ใช้ได้',
    );
    const { docs } = opened;
    await openPicker(docs);

    // ค่าที่คาด: หนังสือจอง สัญญาเช่า และต่อสัญญาถูกปิด ส่วนใบแจ้งหนี้กับแต่งตั้งนายหน้าไม่ถูกปิด (K4: CS:1907-1923 ; CTP:83-86)
    //   หนังสือจอง: ไม่มีสัญญาแต่งตั้งที่ใช้ได้ (CS:1912-1915) ; สัญญาเช่า: ไม่มีหนังสือจองที่ออกแล้ว (CS:1920)
    //   ต่อสัญญา: ไม่มีสัญญาเช่าหรือหนังสือต่อสัญญาเลย (lib/contract-renewal.ts:51-57)
    for (const kind of ['reservation', 'lease', 'renewal'] as const) await expect(docs.kind(kind), `ปุ่ม ${kind} ต้องถูกปิด`).toBeDisabled();
    for (const kind of ['invoice', 'broker'] as const) await expect(docs.kind(kind), `ปุ่ม ${kind} ต้องไม่ถูกปิด`).toBeEnabled();

    // ค่าที่คาด: ข้อความเหตุผลเป็นข้อความเดียว มีเหตุผล 3 ข้อเรียงตามลำดับ หนังสือจอง → สัญญาเช่า → ต่อสัญญา คั่นด้วยขึ้นบรรทัดใหม่ (CS:1923-1928)
    const reasons = [FLOW.ccLockReservation, FLOW.ccLockLease, FLOW.ccLockRenewalNoLease];
    const hint = docs.lockHint(FLOW.ccLockLease);
    await expect(hint).toHaveCount(1);
    const text = (await hint.textContent()) ?? '';
    expect(text.split('\n').map((line) => line.trim()), 'เหตุผลที่ล็อก ทีละบรรทัด').toEqual(reasons);

    expectReadOnly(guard, opened, 'เปิดตัวเลือกชนิดเอกสาร');
  });

  test('a tenant with a valid broker appointment has the reservation type open', { tag: '@CCR-003' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เลือกผู้เช่าที่ API บอกว่ามีสัญญาแต่งตั้งที่ใช้ได้ (brokerAppointmentReady) แล้วกด Create document โดยไม่กดปุ่มชนิดเอกสาร
    const opened = await openContracts(
      page,
      loginAs,
      (tenants) => pick(tenants, (row) => row.brokerAppointmentReady === true),
      'qa-agent ไม่มีผู้เช่าที่มีสัญญาแต่งตั้งนายหน้าที่ใช้ได้',
    );
    const { docs, tenant } = opened;
    await openPicker(docs);

    // ค่าที่คาด: ปุ่มหนังสือจองไม่ถูกปิด และไม่มีข้อความเหตุผลของหนังสือจอง (K4: CS:1910-1915)
    await expect(docs.kind('reservation')).toBeEnabled();
    await expect(docs.lockHint(FLOW.ccLockReservation)).toHaveCount(0);

    // ค่าที่คาด: ปุ่มสัญญาเช่าถูกปิดเมื่อผู้เช่ารายนี้ไม่มีหนังสือจองที่ออกแล้วและยังไม่สิ้นสุด ไม่อย่างนั้นไม่ถูกปิด (K4: CS:1920, 425-433)
    const leaseOpen = hasIssuedReservation(tenant);
    test.info().annotations.push({ type: 'ผู้เช่ารายนี้มีหนังสือจองที่ออกแล้ว', description: leaseOpen ? 'มี (ตรวจว่าปุ่มสัญญาเช่าไม่ถูกปิด)' : 'ไม่มี (ตรวจว่าปุ่มสัญญาเช่าถูกปิด)' });
    if (leaseOpen) {
      await expect(docs.kind('lease')).toBeEnabled();
      await expect(docs.lockHint(FLOW.ccLockLease)).toHaveCount(0);
    } else {
      await expect(docs.kind('lease')).toBeDisabled();
      await expect(docs.lockHint(FLOW.ccLockLease)).toHaveCount(1);
    }

    expectReadOnly(guard, opened, 'เปิดตัวเลือกชนิดเอกสาร');
  });

  test('the back button of the type list returns to the documents of the tenant', { tag: '@CCR-004' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: กด Create document
    const opened = await openContracts(page, loginAs, (tenants) => pick(tenants), 'qa-agent ไม่มีผู้เช่า');
    const { docs } = opened;
    await openPicker(docs);

    // ขั้นที่ 2: กด "‹ Back to contracts" (K3: CTP:58-60 ; CS:1929-1932)
    await docs.pickerBack.click();

    // ค่าที่คาด: กลับมาหน้ารายการเอกสาร เห็นปุ่ม Create document และไม่เห็นหัวข้อของตัวเลือกชนิดเอกสาร
    await expect(docs.createDocument).toBeVisible();
    await expect(docs.pickerTitle).toHaveCount(0);

    expectReadOnly(guard, opened, 'เปิดและปิดตัวเลือกชนิดเอกสาร');
  });
});

test.describe('contracts: broker appointment form', () => {
  test('Create Broker appointment asks for the type, the template and the defaults, then shows the form', { tag: '@CCR-005' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: กด "Create Broker appointment" ในตัวเลือกชนิดเอกสารของผู้เช่าทดสอบ
    const opened = await openBrokerFormOfTestTenant(page, loginAs);
    const { docs, type, templates, defaults } = opened;

    // ค่าที่คาด: คำขอแม่แบบใช้ code ของประเภทที่เลือก และคำขอทั้ง 3 สำเร็จ (K5: CS:1868-1875, 1357-1358, 1404-1407 ; lib/agent-contracts-api.ts:257)
    //   คำขอ types กับหัวข้อของฟอร์มตรวจแล้วใน openBrokerForm (หัวข้อ: CS:2033-2050)
    expect(apiPathOf(templates.url()), 'คำขอแม่แบบต้องใช้ code ของประเภทสัญญาแต่งตั้งนายหน้า').toBe(`/agent/contracts/types/${encodeURIComponent(type.code)}/templates`);
    //   แม่แบบต้องมีอย่างน้อย 1 รายการ ไม่อย่างนั้นฟอร์มขึ้นข้อความว่าไม่มีแม่แบบและบันทึกไม่ได้ (CS:1458-1459, 1580-1582)
    const templateRows = await okJson<unknown[]>(templates);
    expect(Array.isArray(templateRows) && templateRows.length > 0, 'คำตอบของ GET แม่แบบต้องเป็นรายการที่มีอย่างน้อย 1 รายการ').toBe(true);
    expect(defaults.ok(), 'GET ค่าตั้งต้นของสัญญาแต่งตั้งต้องสำเร็จ').toBe(true);
    // ค่าที่คาด: ฟอร์มเปิดมาโดยไม่มีข้อความผิดพลาด (role alert) ในรายละเอียดผู้เช่า
    await expect(docs.alerts).toHaveCount(0);

    // ค่าที่คาด: ปุ่มกลับ หัวการ์ด และปุ่ม Save draft (CS:2021-2032, 2474-2481 ; BAF:139-148)
    //   ข้อความหัวการ์ดขึ้น 2 ที่: หัวข้อของกรอบนอก (CS:2248-2254) กับหัวการ์ดของช่อง (BAF:147) page object ใช้ที่หลังเป็นการ์ดของช่อง
    await expect(docs.backToTypes).toBeVisible();
    await expect(docs.brokerDetailsTitles).toHaveCount(2);
    await expect(docs.brokerCardTitle).toBeVisible();
    await expect(docs.saveDraft).toBeVisible();

    // ค่าที่คาด: การ์ดมีช่อง 18 ช่อง ป้ายเรียงตามโค้ด ช่องบังคับ 5 ช่องมี " *" ต่อท้าย (BAF:76-112, 149-174 ; MobileInput.tsx:59-63)
    expect(await docs.brokerCardChildCount(), 'จำนวนลูกของการ์ด = หัวการ์ด 1 + ช่อง 18').toBe(BROKER_FIELDS.length + 1);
    for (const key of BROKER_FIELDS) {
      await expect(docs.fieldLabel(key), `ป้ายของช่องลำดับที่ ${BROKER_FIELDS.indexOf(key) + 1}`).toHaveText(brokerFieldLabel(key));
      await expect(docs.field(key), `ช่องกรอกของ ${key}`).toHaveCount(1);
    }

    expectReadOnly(guard, opened, 'เปิดฟอร์มสัญญาแต่งตั้ง');
  });

  test('saving with every field empty marks exactly the five required fields and sends nothing', { tag: '@CCR-006' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดฟอร์ม แล้วล้างค่าทุกช่องของการ์ด (18 ช่อง)
    const opened = await openBrokerFormOfTestTenant(page, loginAs);
    const { docs } = opened;
    for (const key of BROKER_FIELDS) await typeInto(docs, key, '');

    // ขั้นที่ 2: กด Save draft
    const posted = watchForRequest(page, (request) => isSaveDraftRequest(request.method(), request.url()), QUIET_MS);
    await docs.saveDraft.click();

    // ค่าที่คาด: ข้อความรวม role alert (K5, K7: CS:1616-1620, 675-680 ; agent.contracts.notice.brokerRequired)
    await expect(docs.alert(FLOW.ccBrokerRequired)).toBeVisible();
    // ค่าที่คาด: "This field is required." ใต้ช่องบังคับ 5 ช่องพอดี ช่องอื่นไม่มีข้อความ (BAF:53-59, 66-68 ; contracts.validation.required)
    const required: Partial<Record<BrokerFieldKey, string>> = {};
    for (const key of BROKER_REQUIRED) required[key] = FLOW.ccRequired;
    expect(await fieldErrors(docs), 'ข้อความผิดพลาดใต้ช่องทั้ง 18 ช่อง').toEqual(onlyErrors(required));

    // ค่าที่คาด: ไม่มีคำขอ POST /agent/contracts ภายในช่วงเฝ้า และเมื่อครบช่วงเฝ้าแล้วก็ยังไม่มีกล่องยืนยัน (CS:1617-1620 return ก่อนถึง :1697)
    //   ตรวจกล่องหลังช่วงเฝ้า เพราะกล่อง mount ช้ากว่าการกด 1 รอบ render (MobileBottomSheet.tsx:72-79, 128)
    expect(await posted, `มีคำขอ POST /agent/contracts ภายใน ${QUIET_MS} ms หลังกด Save draft`).toBe(false);
    await expect(docs.confirmBackdrop).toHaveCount(0);
    expectReadOnly(guard, opened, 'กด Save draft ตอนช่องว่าง');
  });

  test('a date in the wrong format is refused with the date format message', { tag: '@CCR-007' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดฟอร์ม เติมช่องบังคับที่ว่างให้ครบ แล้วพิมพ์วันที่ผิดรูปแบบในช่อง Date
    const opened = await openBrokerFormOfTestTenant(page, loginAs);
    const { docs } = opened;
    await completeRequired(docs);
    await typeInto(docs, 'issueDate', '13/11/2026');

    // ขั้นที่ 2: กด Save draft
    const posted = watchForRequest(page, (request) => isSaveDraftRequest(request.method(), request.url()), QUIET_MS);
    await docs.saveDraft.click();

    // ค่าที่คาด: ข้อความรวม และใต้ช่อง Date ขึ้นข้อความรูปแบบวันที่ ช่องอื่นไม่มีข้อความ (K5: BAF:69-70 ; contracts.validation.dateFormat)
    await expect(docs.alert(FLOW.ccBrokerRequired)).toBeVisible();
    expect(await fieldErrors(docs), 'ข้อความผิดพลาดใต้ช่องทั้ง 18 ช่อง').toEqual(onlyErrors({ issueDate: FLOW.ccDateFormat }));

    // ค่าที่คาด: ไม่มีคำขอ POST /agent/contracts ภายในช่วงเฝ้า และเมื่อครบช่วงเฝ้าแล้วก็ยังไม่มีกล่องยืนยัน (CS:1617-1620 return ก่อนถึง :1697)
    //   ตรวจกล่องหลังช่วงเฝ้า เพราะกล่อง mount ช้ากว่าการกด 1 รอบ render (MobileBottomSheet.tsx:72-79, 128)
    expect(await posted, `มีคำขอ POST /agent/contracts ภายใน ${QUIET_MS} ms หลังกด Save draft`).toBe(false);
    await expect(docs.confirmBackdrop).toHaveCount(0);
    expectReadOnly(guard, opened, 'กด Save draft ตอนวันที่ผิด');
  });

  test('a commission given both as an amount and as months is refused', { tag: '@CCR-008' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดฟอร์ม เติมช่องบังคับที่ว่างให้ครบ แล้วกรอกค่าคอมทั้ง 2 ช่อง
    const opened = await openBrokerFormOfTestTenant(page, loginAs);
    const { docs } = opened;
    await completeRequired(docs);
    await typeInto(docs, 'commissionFee', '1000');
    await typeInto(docs, 'commissionMonths', '1');

    // ขั้นที่ 2: กด Save draft
    const posted = watchForRequest(page, (request) => isSaveDraftRequest(request.method(), request.url()), QUIET_MS);
    await docs.saveDraft.click();

    // ค่าที่คาด: ข้อความรวม และใต้ช่องค่าคอมแบบจำนวนเงินขึ้นข้อความให้เลือกอย่างเดียว ช่องอื่นไม่มีข้อความ (K5: BAF:71-72 ; contracts.validation.commissionEither)
    await expect(docs.alert(FLOW.ccBrokerRequired)).toBeVisible();
    expect(await fieldErrors(docs), 'ข้อความผิดพลาดใต้ช่องทั้ง 18 ช่อง').toEqual(onlyErrors({ commissionFee: FLOW.ccCommissionEither }));

    // ค่าที่คาด: ไม่มีคำขอ POST /agent/contracts ภายในช่วงเฝ้า และเมื่อครบช่วงเฝ้าแล้วก็ยังไม่มีกล่องยืนยัน (CS:1617-1620 return ก่อนถึง :1697)
    //   ตรวจกล่องหลังช่วงเฝ้า เพราะกล่อง mount ช้ากว่าการกด 1 รอบ render (MobileBottomSheet.tsx:72-79, 128)
    expect(await posted, `มีคำขอ POST /agent/contracts ภายใน ${QUIET_MS} ms หลังกด Save draft`).toBe(false);
    await expect(docs.confirmBackdrop).toHaveCount(0);
    expectReadOnly(guard, opened, 'กด Save draft ตอนค่าคอมซ้ำ 2 แบบ');
  });
});

test.describe('contracts: confirmation before saving a draft', () => {
  test('Save draft with a complete form opens the confirmation and does not send the draft yet', { tag: '@CCR-009' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดฟอร์ม เติมช่องบังคับ 5 ช่องให้ถูกต้อง ค่าคอมกรอกไม่เกิน 1 ช่อง
    const opened = await openBrokerFormOfTestTenant(page, loginAs);
    const { docs, type } = opened;
    await completeRequired(docs);

    // ขั้นที่ 2: กด Save draft ของฟอร์ม
    const posted = watchForRequest(page, (request) => isSaveDraftRequest(request.method(), request.url()), QUIET_MS);
    await docs.saveDraft.click();

    // ค่าที่คาด: กล่องยืนยันขึ้น หัวข้อ "บันทึก<ชื่อไทยของประเภท>นี้?" เนื้อความ และปุ่ม 2 ปุ่ม เป็นภาษาไทยทุกภาษา (K6: CS:1697-1699, 2488-2523)
    const title = `${CONTRACT_SAVE_CONFIRM.titlePrefix}${type.nameTh || CONTRACT_SAVE_CONFIRM.titleFallbackType}${CONTRACT_SAVE_CONFIRM.titleSuffix}`;
    await expect(docs.confirmTitle(title)).toBeVisible();
    await expect(docs.confirmBody).toBeVisible();
    await expect(docs.confirmCancel).toBeVisible();
    await expect(docs.confirmSave).toBeVisible();
    // ไม่มีข้อความผิดพลาดรวม เพราะผ่านการตรวจของหน้าเว็บแล้ว (CS:1622 ล้างข้อความใต้ช่อง แล้วไปถึง :1697)
    await expect(docs.alert(FLOW.ccBrokerRequired)).toHaveCount(0);

    // ค่าที่คาด: ยังไม่มีคำขอ POST /agent/contracts ภายในช่วงเฝ้า (เทสไม่กด "บันทึกฉบับร่าง" ในกล่อง)
    expect(await posted, `มีคำขอ POST /agent/contracts ภายใน ${QUIET_MS} ms หลังกด Save draft ทั้งที่ยังไม่ได้ยืนยัน`).toBe(false);
    expectReadOnly(guard, opened, 'เปิดกล่องยืนยัน');
  });

  test('the cancel button of the confirmation closes it and keeps what was typed', { tag: '@CCR-010' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: กล่องยืนยันเปิดอยู่ โดยพิมพ์ข้อความของเทสในช่อง Landlord first name ก่อนกด Save draft
    const marker = 'E2E-CCR010';
    const opened = await openBrokerFormOfTestTenant(page, loginAs);
    const { docs, headingType } = opened;
    await completeRequired(docs);
    await typeInto(docs, 'landlordFirstName', marker);
    await docs.saveDraft.click();
    await expect(docs.confirmCancel).toBeVisible();

    // ขั้นที่ 1: กด "ยกเลิก" ในกล่องยืนยัน (K6: CS:2506-2512 onPress ปิดกล่องอย่างเดียว)
    const posted = watchForRequest(page, (request) => isSaveDraftRequest(request.method(), request.url()), QUIET_MS);
    await docs.confirmCancel.click();

    // ค่าที่คาด: กล่องปิด ฟอร์มยังเปิดอยู่ และค่าที่พิมพ์ไว้ยังอยู่
    await expect(docs.confirmBackdrop).toHaveCount(0);
    await expect(docs.formHeading(headingType)).toBeVisible();
    await expect.poll(() => docs.fieldValueIs('landlordFirstName', marker), { message: 'ช่อง Landlord first name ยังเป็นข้อความที่เทสพิมพ์ไว้' }).toBe(true);

    // ค่าที่คาด: ไม่มีคำขอ POST /agent/contracts
    expect(await posted, `มีคำขอ POST /agent/contracts ภายใน ${QUIET_MS} ms หลังกด "ยกเลิก"`).toBe(false);
    expectReadOnly(guard, opened, 'เปิดและปิดกล่องยืนยัน');
  });

  test('going back to the type list throws away what was typed in the form', { tag: '@CCR-011' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: ฟอร์มเปิดอยู่ และพิมพ์ข้อความของเทสในช่อง Broker address
    const marker = 'E2E-CCR011';
    const opened = await openBrokerFormOfTestTenant(page, loginAs);
    const { docs, tenant } = opened;
    await typeInto(docs, 'brokerAddress', marker);

    // ขั้นที่ 1: กด "← Choose contract type" (K6: CS:2021-2031)
    await docs.backToTypes.click();
    // ค่าที่คาด: กลับมาที่ตัวเลือกชนิดเอกสาร
    await expect(docs.pickerTitle).toBeVisible();

    // ขั้นที่ 2: กด "Create Broker appointment" อีกครั้ง
    await openBrokerForm(page, docs, tenant);
    // ค่าที่คาด: ช่อง Broker address ไม่มีข้อความที่พิมพ์ไว้ เพราะฟอร์มถูกล้างแล้วเติมค่าตั้งต้นใหม่ (CS:1345, 1404-1407)
    expect(await docs.fieldValueIs('brokerAddress', marker), 'ช่อง Broker address ยังมีข้อความที่พิมพ์ไว้ก่อนกดกลับ').toBe(false);

    expectReadOnly(guard, opened, 'เปิดฟอร์ม กดกลับ แล้วเปิดใหม่');
  });
});

// ---------------- รอบที่ 2: การ์ดงานถัดไปในหน้า Overview และฟอร์มหนังสือจอง (CCR-012 ถึง CCR-023) ----------------
// ตารางเคสและกฎ K18-K26: เอกสารโปรเจกต์ claude/nestyk-topic-contracts-create-web-ui-part3.md (Aof อนุมัติ 13 พ.ย. 2026)

/** สิ่งที่ปุ่มของการ์ด "To do now" จะพาไป ตามลำดับของ tenantNextAction (apps/consumer-app/lib/tenant-detail.ts:149-173) */
type NextAction = 'slip' | 'confirm' | 'sign' | 'deposit' | 'handover' | 'reservation' | 'broker-open' | 'broker-create' | null;

/**
 * คัดลอกลำดับของ tenantNextAction: สลิปรอตรวจ → สัญญาที่ลงนามครบรอตรวจ → หนังสือจองเลยกำหนดลงนาม → รอลงนาม → รอเงินประกัน → รอส่งมอบ
 *   → ถ้าเอกสารที่ไม่ยกเลิกมีแต่สัญญาแต่งตั้ง (หรือไม่มีเลย): ทำหนังสือจองเมื่อมีสัญญาแต่งตั้งที่ใช้ได้ ไม่อย่างนั้นทำสัญญาแต่งตั้ง (เปิดร่างที่ค้างถ้ามี)
 * hasSlip = มีบิลสถานะ awaiting_review ในคำตอบของ GET /bills/agent/tenants/:id ของผู้เช่ารายนี้ (tenant-detail.ts:150-153)
 */
function nextActionOf(tenant: TenantRow, hasSlip: boolean): NextAction {
  if (hasSlip) return 'slip';
  const open = tenant.contracts.filter((row) => row.status !== 'cancelled');
  if (open.some((row) => row.status === 'awaiting_agent_review')) return 'confirm';
  const today = bangkokToday();
  if (open.some((row) => row.formKind === 'reservation' && !!row.signDueDate && today > row.signDueDate)) return 'sign';
  if (open.some((row) => row.status === 'awaiting_signatures')) return 'sign';
  if (open.some((row) => row.status === 'awaiting_deposit')) return 'deposit';
  if (open.some((row) => row.status === 'awaiting_handover')) return 'handover';
  if (open.every((row) => row.formKind === 'broker_appointment')) {
    if (tenant.brokerAppointmentReady === true) return 'reservation';
    return open.some((row) => row.status === 'draft') ? 'broker-open' : 'broker-create';
  }
  return null;
}

interface Overview {
  screen: AgentTenantsPage;
  docs: AgentContractsPage;
  tenant: TenantRow;
  log: ApiLog;
  /** จำนวนคำขอที่ไม่ใช่การอ่าน ณ ตอนที่หน้า Overview ของผู้เช่าโหลดเสร็จ */
  writesBefore: number;
}

/**
 * เปิด /agent/clients เลือกผู้เช่าจากคำตอบของ API โดยถือว่ายังไม่มีสลิปรอตรวจ แล้วเปิดรายละเอียด (หน้า Overview)
 * หน้าเว็บขอ GET /bills/agent/tenants/:id เมื่อเปิดรายละเอียด (AgentTenantsScreen.tsx:166-181) และใช้คำตอบนั้นตัดสินการ์ดงานถัดไป (:558)
 *   ถ้าตัวกันปล่อยคำขอบิลผ่าน (guard.ts billReadsAllowed) เทสรอคำตอบนั้น แล้วข้ามข้อนี้เมื่อผู้เช่าที่เลือกมีบิลรอตรวจ เพราะการ์ดจะเป็นของสลิปแทน
 *   ถ้าตัวกันตัดคำขอบิล หน้าเว็บไม่ได้ข้อมูลบิล จึงไม่มีข้อสลิป (tenantNextAction รับ billing เป็น null)
 */
async function openOverview(page: Page, loginAs: LoginAs, wanted: (tenant: TenantRow) => boolean, missing: string): Promise<Overview> {
  const log = new ApiLog(page);
  const listed = waitForApi(page, 'GET', '/agent/tenants');
  await loginAs('agent', { next: '/agent/clients' });
  const tenants = await okJson<TenantRow[]>(await listed);
  expect(Array.isArray(tenants), 'คำตอบของ GET /agent/tenants ต้องเป็นรายการ').toBe(true);
  const chosen = pick(tenants, wanted);
  test.skip(!chosen, missing);
  const list = chosen as TenantRow;

  const screen = new AgentTenantsPage(page);
  await screen.tabCount('all');
  await screen.tab('all').click();
  const detail = waitForApi(page, 'GET', `/agent/tenants/${list.id}`);
  const billing = billReadsAllowed() ? waitForApi(page, 'GET', `/bills/agent/tenants/${list.id}`) : null;
  await screen.row(list.id).click();
  // แอปตัดสินการ์ดจากคำตอบของ GET /agent/tenants/:id (AgentTenantsScreen.tsx:275, 558) จึงยืนยันเงื่อนไขซ้ำกับคำตอบนี้ และใช้คำตอบนี้ต่อ
  const tenant = await okJson<TenantRow>(await detail);
  expect(wanted(tenant), 'คำตอบของ GET /agent/tenants/:id ต้องตรงเงื่อนไขเดียวกับที่เลือกจากรายการ').toBe(true);
  await expect(screen.detail).toBeVisible();
  await expect(screen.section('overview')).toHaveAttribute('aria-current', 'page');
  if (billing) {
    const bills = (await okJson<{ bills?: { status: string }[] }>(await billing)).bills ?? [];
    test.skip(bills.some((bill) => bill.status === 'awaiting_review'), 'ผู้เช่าที่เลือกมีบิลรอตรวจ การ์ดงานถัดไปจึงเป็นของสลิป');
  }
  // ระหว่างข้อมูลบิลกำลังโหลด หน้าแสดงตัวหมุนแทนหน้า Overview (AgentTenantsScreen.tsx:551-554) จึงต้องรอให้การโหลดบิลจบก่อนตรวจการ์ด
  //   กรณีตัวกันปล่อยคำขอบิล: รอคำตอบแล้วข้างบน
  //   กรณีตัวกันตัดคำขอบิล: รอข้อความโหลดสลิปไม่ได้ ซึ่งแอปตั้งพร้อมกับตอนเลิกหมุน (:175-178) แบบเดียวกับ agent-tenants-calendar.spec.ts ระยะ 1
  //     ไม่รอแค่ป้ายเบอร์โทร เพราะหน้า Overview แสดงได้ 1 รอบก่อนตัวหมุนขึ้น (billingLoading ถูกตั้งใน effect หลังแสดงรอบแรก: :166-169)
  if (!billing) await expect(screen.alert(FLOW.tenantsSlipsLoadError)).toBeVisible();
  const docs = new AgentContractsPage(page);
  await expect(docs.overviewPhoneLabel).toBeVisible();
  return { screen, docs, tenant, log, writesBefore: writeCalls(log).length };
}

type FormKind = 'broker' | 'reservation';

/**
 * เริ่มรอคำขอที่แอปส่งเมื่อเปิดฟอร์มสร้างเอกสาร (ต้องเรียกก่อนกดปุ่มที่เปิดฟอร์ม) แล้วคืนฟังก์ชันที่รอจนฟอร์มพร้อม
 * ใช้ได้ทั้งเมื่อเปิดจากตัวเลือกชนิดเอกสารและจากปุ่มของการ์ดงานถัดไป (ContractsScreen.tsx:359-372 เริ่มฟอร์มหลังรายการเอกสารโหลดเสร็จ)
 * ฟอร์มพร้อมเมื่อปุ่มหลักเลิกปิด: สัญญาแต่งตั้งคือ Save draft ส่วนหนังสือจองคือ Next ของขั้นที่ 1 (ปุ่มจาก button() ปิดระหว่าง busy: :647-648)
 */
function expectForm(page: Page, docs: AgentContractsPage, tenant: TenantRow, kind: FormKind): () => Promise<BrokerForm> {
  const formKind = kind === 'broker' ? 'broker_appointment' : 'reservation';
  const typesAsked = waitForApi(page, 'GET', '/agent/contracts/types');
  const templatesAsked = waitForApi(page, 'GET', /^\/agent\/contracts\/types\/[^/]+\/templates$/);
  const defaultsAsked = waitForApi(page, 'GET', `/agent/contracts/${kind === 'broker' ? 'broker-appointment' : 'reservation'}-defaults/${tenant.leadId}`);
  return async () => {
    const types = await okJson<AgreementTypeRow[]>(await typesAsked);
    const type = types.find((row) => row.formKind === formKind || row.code === formKind);
    expect(type, `คำตอบของ GET /agent/contracts/types ต้องมีประเภท ${formKind}`).toBeTruthy();
    const templates = await templatesAsked;
    const defaults = await defaultsAsked;
    const found = type as AgreementTypeRow;
    const headingType = UI_LOCALE === 'th' ? found.nameTh : kind === 'broker' ? FLOW.ccTypeBroker : FLOW.ccTypeReservation;
    await expect(docs.formHeading(headingType)).toBeVisible();
    await expect(kind === 'broker' ? docs.saveDraft : docs.nextButton(1)).toBeEnabled();
    return { type: found, templates, defaults, headingType };
  };
}

/** เปิดฟอร์มหนังสือจองของผู้เช่าทดสอบ (ชื่อขึ้นต้นด้วย E2E และแท็บหนังสือจองไม่ล็อก) จากตัวเลือกชนิดเอกสาร */
async function openReservationFormOfTestTenant(page: Page, loginAs: LoginAs): Promise<Opened & BrokerForm & { offers: Response }> {
  const opened = await openContracts(
    page,
    loginAs,
    (tenants) => tenants.find((tenant) => isE2e(tenant) && tenant.brokerAppointmentReady === true),
    'qa-agent ไม่มีผู้เช่าทดสอบ (ชื่อขึ้นต้นด้วย E2E) ที่มีสัญญาแต่งตั้งนายหน้าที่ใช้ได้',
  );
  await openPicker(opened.docs);
  const ready = expectForm(page, opened.docs, opened.tenant, 'reservation');
  // ฟอร์มหนังสือจองขอข้อเสนอของลีดเพื่อรู้ว่าต้องล็อกช่องตัวเลขหรือไม่ (ContractsScreen.tsx:582-594)
  const offersAsked = waitForApi(page, 'GET', `/agent/leads/${opened.tenant.leadId}/deal-offers`);
  await opened.docs.kind('reservation').click();
  const form = await ready();
  const offers = await offersAsked;
  await expect(opened.docs.stepHeader(1)).toBeVisible();
  return { ...opened, ...form, offers };
}

/** ตั้งค่าในช่องของฟอร์มหนังสือจองแบบไม่ให้ค่าเดิมของช่องไปอยู่ในรายงาน แล้วรอจนช่องมีค่านั้น (ข้อความที่ส่งเข้ามาเป็นของเทสเอง) */
async function typeIntoReservation(docs: AgentContractsPage, key: ReservationFieldKey, value: string): Promise<void> {
  expect(await docs.rSetField(key, value), `ตั้งค่าช่อง ${key}`).toBe('ok');
  await expect.poll(() => docs.rFieldValueIs(key, value), { message: `ช่อง ${key} ต้องมีค่าที่เทสตั้ง` }).toBe(true);
}

/** ข้อมูลผู้ให้เช่าของเทส (ไม่ใช่ข้อมูลจริง) */
const TEST_LANDLORD = { landlordFirstName: 'E2E Landlord', landlordPhone: '0800000000', landlordEmail: 'e2e-landlord@example.com' } as const;

/** ช่องผู้ให้เช่าที่ขั้น Parties บังคับ (ReservationLetterFields.tsx:65-70, 105-106) ชนิดผูกกับ TEST_LANDLORD เพื่อให้คีย์ที่ไม่มีค่าของเทสไม่ผ่านการตรวจชนิด */
const LANDLORD_REQUIRED: readonly (keyof typeof TEST_LANDLORD)[] = ['landlordFirstName', 'landlordPhone', 'landlordEmail'];

/** กด "+ Add landlord" (ล้างช่องผู้ให้เช่าและแสดงช่อง: ReservationLetterFields.tsx:334-353) แล้วรอให้ช่องผู้ให้เช่าขึ้น */
async function addLandlord(docs: AgentContractsPage): Promise<void> {
  await docs.addLandlord.click();
  for (const key of LANDLORD_REQUIRED) await expect(docs.rField(key), `ช่อง ${key} ต้องขึ้นหลังกด + Add landlord`).toHaveCount(1);
}

/** กด "+ Add landlord" แล้วกรอกผู้ให้เช่าของเทสให้ผ่านการตรวจของขั้น Parties */
async function fillTestLandlord(docs: AgentContractsPage): Promise<void> {
  await addLandlord(docs);
  for (const key of LANDLORD_REQUIRED) await typeIntoReservation(docs, key, TEST_LANDLORD[key]);
}

/**
 * กด Next ของขั้นนี้ในฐานะขั้นเตรียม (ไม่ใช่สิ่งที่ข้อนั้นตรวจ) แล้วรอขั้นถัดไป
 * ถ้าแอปหยุดที่ขั้นเดิมพร้อมข้อความรวม (ContractsScreen.tsx:467-470) แปลว่าข้อมูลตั้งต้นของผู้เช่าทดสอบไม่ผ่านการตรวจของฟอร์ม
 *   ข้อนั้นข้ามพร้อมเหตุผล แต่ถ้าช่องที่เทสกรอกเอง (typedByTest) มีข้อความผิดพลาด หรือขั้นที่ 1 กับ 3 ไม่พบช่องที่ผิดเลย ถือว่าเป็นความผิดของเทสหรือของแอป ข้อนั้นแดง
 */
async function advance(docs: AgentContractsPage, from: 1 | 2 | 3, why: string, typedByTest: readonly ReservationFieldKey[] = []): Promise<void> {
  const next = (from + 1) as ReservationStep;
  await docs.nextButton(from).click();
  await expect(docs.stepHeader(next).or(docs.alert(FLOW.ccStepRequired))).toBeVisible();
  if (await docs.stepHeader(next).isVisible()) return;
  // ช่องที่เทสกรอกเองต้องไม่ใช่สาเหตุ ไม่อย่างนั้นเป็นความผิดของเทสหรือของแอป ไม่ใช่ของข้อมูลตั้งต้น
  for (const key of typedByTest) expect(await docs.rFieldErrorText(key), `ช่อง ${key} ที่เทสกรอกเองต้องไม่มีข้อความผิดพลาด`).toBeNull();
  // จดชื่อคีย์ของช่องที่มีข้อความผิดพลาดบนขั้นนี้ (เฉพาะชื่อคีย์ ไม่จดค่าและไม่จดข้อความ) ให้คนอ่านผลรู้ว่าข้ามเพราะช่องไหน
  const failing: string[] = [];
  for (const key of Object.keys(FLOW.ccReservationFields) as ReservationFieldKey[]) {
    const error = await docs.rFieldErrorText(key);
    if (error !== null && error !== BOX_MISSING) failing.push(key);
  }
  test.info().annotations.push({ type: `ช่องที่มีข้อความผิดพลาดตอนกด Next ของขั้นที่ ${from}`, description: failing.join(', ') || '(ไม่พบในช่องที่เทสรู้จัก)' });
  // ขั้นที่ 1 และ 3: ทุกช่องที่แอปตรวจอยู่ในรายการที่เทสรู้จัก (ขั้น 1 = tenant*/landlord*, ขั้น 3 = reservationPayment: ContractsScreen.tsx:410-415 ; ReservationLetterFields.tsx:83-120)
  //   ถ้าข้อความรวมขึ้นแต่ไม่มีช่องไหนมีข้อความผิดพลาด จึงเป็นความผิดของแอปหรือของตัวหาช่อง ไม่ใช่ของข้อมูลตั้งต้น → แดง ไม่ข้าม
  //   ขั้นที่ 2 ยังข้ามได้ เพราะช่อง issueDate กับ termTo ไม่อยู่ในรายการที่เทสรู้จัก
  if (from !== 2) expect(failing.length, `ขั้นที่ ${from} ขึ้นข้อความรวม แต่ไม่พบช่องที่มีข้อความผิดพลาด`).toBeGreaterThan(0);
  test.skip(true, why);
}

const PARTIES_BLOCKED = 'ข้อมูลของผู้เช่าทดสอบ (เบอร์ อีเมล หรือเลขบัตร) ไม่ผ่านการตรวจของขั้น Parties จึงไปขั้นถัดไปไม่ได้';
const ROOM_BLOCKED = 'ค่าตั้งต้นของขั้น Room and contract ของผู้เช่าทดสอบไม่ผ่านการตรวจ จึงไปขั้นถัดไปไม่ได้';
const AMOUNTS_BLOCKED = 'ค่าตั้งต้นของขั้น Amounts and payment ของผู้เช่าทดสอบไม่ผ่านการตรวจ จึงไปขั้นถัดไปไม่ได้';

/** ข้ามข้อนี้เมื่อช่องถูกล็อกจากข้อเสนอที่ผู้ให้เช่ายืนยันแล้ว (K25: ContractsScreen.tsx:580-594, 2265 ; ReservationLetterFields.tsx:381) */
async function skipIfLocked(docs: AgentContractsPage, key: ReservationFieldKey): Promise<void> {
  const locked = await docs.rFieldReadOnly(key);
  expect(locked, `ต้องพบช่อง ${key} 1 ช่อง`).not.toBeNull();
  test.skip(locked === true, `ช่อง ${key} ถูกล็อกจากข้อเสนอที่ยืนยันแล้ว จึงพิมพ์ไม่ได้`);
}

test.describe('contracts: the next step card of a tenant', () => {
  test('a tenant with no documents is offered a broker appointment, and the button opens that form', { tag: '@CCR-013' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดรายละเอียดของผู้เช่าที่ยังไม่มีเอกสารและยังไม่มีสัญญาแต่งตั้งที่ใช้ได้ (หน้า Overview)
    const opened = await openOverview(
      page,
      loginAs,
      (tenant) => tenant.contracts.length === 0 && nextActionOf(tenant, false) === 'broker-create',
      'qa-agent ไม่มีผู้เช่าที่ยังไม่มีเอกสารและยังไม่มีสัญญาแต่งตั้งที่ใช้ได้',
    );
    const { screen, docs, tenant } = opened;

    // ค่าที่คาด: การ์ด "To do now" หัวข้อ "Broker appointment first" ปุ่ม "Create broker appointment" (K18: TenantDetailHub.tsx:119-124, 194-213)
    await expect(docs.nowLabel).toBeVisible();
    await expect(docs.nowTitle(FLOW.ccNowBrokerTitle)).toBeVisible();
    await expect(docs.nowButton(FLOW.ccNowBrokerCta)).toBeVisible();

    // ขั้นที่ 2: กดปุ่มของการ์ด (เทสไม่อ่านและไม่พิมพ์ในช่องของฟอร์ม เพราะผู้เช่ารายนี้อาจไม่ใช่ข้อมูลทดสอบ)
    const ready = expectForm(page, docs, tenant, 'broker');
    await docs.nowButton(FLOW.ccNowBrokerCta).click();

    // ค่าที่คาด: หัวข้อ Contracts ถูกเลือก และฟอร์มสัญญาแต่งตั้งเปิดพร้อมคำขอค่าตั้งต้นของลีดนี้ (K19: AgentTenantsScreen.tsx:454-457 ; CS:359-372)
    await expect(screen.section('contracts')).toHaveAttribute('aria-current', 'page');
    const form = await ready();
    expect(form.defaults.ok(), 'GET ค่าตั้งต้นของสัญญาแต่งตั้งต้องสำเร็จ').toBe(true);
    await expect(docs.brokerCardTitle).toBeVisible();

    expectReadOnly(guard, opened, 'กดปุ่มของการ์ดงานถัดไป (สัญญาแต่งตั้ง)');
  });

  test('a tenant ready for a reservation letter is offered one, and the button opens that form', { tag: '@CCR-014' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดรายละเอียดของผู้เช่าที่งานถัดไปคือหนังสือจอง และมีอีเมลกับเลขบัตรแล้ว (ถ้าขาด ปุ่มจะพาไปแก้ข้อมูลผู้เช่าแทน: AgentTenantsScreen.tsx:459-462)
    const opened = await openOverview(
      page,
      loginAs,
      (tenant) => nextActionOf(tenant, false) === 'reservation' && !!tenant.email && !!tenant.identityNumber,
      'qa-agent ไม่มีผู้เช่าที่งานถัดไปคือหนังสือจองและมีอีเมลกับเลขบัตรครบ',
    );
    const { screen, docs, tenant } = opened;

    // ค่าที่คาด: หัวข้อ "Next step: reservation letter" ปุ่ม "Make reservation letter" (K18: TenantDetailHub.tsx:149-154)
    await expect(docs.nowLabel).toBeVisible();
    await expect(docs.nowTitle(FLOW.ccNowReservationTitle)).toBeVisible();
    await expect(docs.nowButton(FLOW.ccNowReservationCta)).toBeVisible();

    // ขั้นที่ 2: กดปุ่มของการ์ด
    const ready = expectForm(page, docs, tenant, 'reservation');
    await docs.nowButton(FLOW.ccNowReservationCta).click();

    // ค่าที่คาด: หัวข้อ Contracts ถูกเลือก ฟอร์มหนังสือจองเปิดที่ขั้น "01 Parties" พร้อมคำขอค่าตั้งต้นของลีดนี้ (K19: AgentTenantsScreen.tsx:463-464 ; CS:1389-1391)
    await expect(screen.section('contracts')).toHaveAttribute('aria-current', 'page');
    const form = await ready();
    expect(form.defaults.ok(), 'GET ค่าตั้งต้นของหนังสือจองต้องสำเร็จ').toBe(true);
    await expect(docs.stepHeader(1)).toBeVisible();

    expectReadOnly(guard, opened, 'กดปุ่มของการ์ดงานถัดไป (หนังสือจอง)');
  });

  test('a tenant with nothing to do next has no next step card', { tag: '@CCR-015' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดรายละเอียดของผู้เช่าที่ไม่มีงานถัดไปตามลำดับของแอป (K2, K20)
    const opened = await openOverview(page, loginAs, (tenant) => nextActionOf(tenant, false) === null, 'qa-agent ไม่มีผู้เช่าที่ไม่มีงานถัดไป');
    const { screen, docs } = opened;

    // ค่าที่คาด: ไม่มีการ์ด "To do now" (K18: TenantDetailHub.tsx:194 แสดงเมื่อมีงานถัดไปเท่านั้น) ตรวจหลังหน้า Overview และข้อมูลบิลโหลดเสร็จแล้ว
    await expect(screen.detailName).toBeVisible();
    await expect(docs.nowLabel).toHaveCount(0);

    expectReadOnly(guard, opened, 'เปิดหน้า Overview ของผู้เช่า');
  });
});

test.describe('contracts: reservation letter form', () => {
  test('Create Reservation letter opens a four-step form with the tenant fields locked', { tag: '@CCR-016' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: กด "Create Reservation letter" ในตัวเลือกชนิดเอกสารของผู้เช่าทดสอบ
    const opened = await openReservationFormOfTestTenant(page, loginAs);
    const { docs, type, templates, defaults, offers } = opened;

    // ค่าที่คาด: คำขอ GET ประเภท แม่แบบ ค่าตั้งต้น และข้อเสนอของลีด สำเร็จ (K21, K25: CS:1868, 1357-1358, 1389-1391, 582-594)
    expect(apiPathOf(templates.url()), 'คำขอแม่แบบต้องใช้ code ของประเภทหนังสือจอง').toBe(`/agent/contracts/types/${encodeURIComponent(type.code)}/templates`);
    const templateRows = await okJson<unknown[]>(templates);
    expect(Array.isArray(templateRows) && templateRows.length > 0, 'คำตอบของ GET แม่แบบต้องเป็นรายการที่มีอย่างน้อย 1 รายการ').toBe(true);
    expect(defaults.ok(), 'GET ค่าตั้งต้นของหนังสือจองต้องสำเร็จ').toBe(true);
    expect(offers.ok(), 'GET ข้อเสนอของลีดต้องสำเร็จ').toBe(true);
    await expect(docs.alerts).toHaveCount(0);

    // ค่าที่คาด: ชื่อขั้น 4 ขั้น หัวของขั้น "01 Parties" ปุ่ม Next ของขั้นที่ 1 และยังไม่มีปุ่ม Save draft (K21: CS:407-409, 2139-2142, 2463-2481)
    for (const step of [1, 2, 3, 4] as const) await expect(docs.stepLabel(step), `ชื่อขั้นที่ ${step}`).toBeVisible();
    await expect(docs.stepHeader(1)).toBeVisible();
    await expect(docs.nextButton(1)).toBeVisible();
    await expect(docs.saveDraft).toHaveCount(0);

    // ค่าที่คาด: ข้อความ "From tenant details · read-only" และช่องผู้เช่า 6 ช่องแก้ไม่ได้ (K24: ReservationLetterFields.tsx:131-138, 381, 499)
    await expect(docs.tenantLockedNote).toBeVisible();
    for (const key of RESERVATION_TENANT_FIELDS) expect(await docs.rFieldReadOnly(key), `ช่อง ${key} ต้องแก้ไม่ได้`).toBe(true);

    expectReadOnly(guard, opened, 'เปิดฟอร์มหนังสือจอง');
  });

  test('Next on the first step asks for the landlord name, phone and email', { tag: '@CCR-017' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดฟอร์ม แล้วกด "+ Add landlord" (ช่องผู้ให้เช่าว่างทั้งหมด)
    const opened = await openReservationFormOfTestTenant(page, loginAs);
    const { docs } = opened;
    await addLandlord(docs);

    // ขั้นที่ 2: กด Next
    const posted = watchForRequest(page, (request) => isSaveDraftRequest(request.method(), request.url()), QUIET_MS);
    await docs.nextButton(1).click();

    // ค่าที่คาด: ข้อความรวมของขั้น และ "This field is required." ใต้ช่องชื่อ เบอร์ และอีเมลของผู้ให้เช่า (K22, K23: CS:455-470 ; ReservationLetterFields.tsx:88-90, 105-106)
    //   ไม่ตรวจข้อความของช่องผู้เช่า เพราะขึ้นกับข้อมูลของผู้เช่ารายนั้น
    await expect(docs.alert(FLOW.ccStepRequired)).toBeVisible();
    for (const key of LANDLORD_REQUIRED) expect(await docs.rFieldErrorText(key), `ข้อความใต้ช่อง ${key}`).toBe(FLOW.ccRequired);
    // ค่าที่คาด: ยังอยู่ขั้น "01 Parties" และไม่มีคำขอบันทึก
    await expect(docs.stepHeader(1)).toBeVisible();
    expect(await posted, `มีคำขอ POST /agent/contracts ภายใน ${QUIET_MS} ms หลังกด Next`).toBe(false);
    expectReadOnly(guard, opened, 'กด Next ตอนช่องผู้ให้เช่าว่าง');
  });

  test('a landlord email in the wrong format is refused on the first step', { tag: '@CCR-018' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: เปิดฟอร์ม กด "+ Add landlord" แล้วพิมพ์ชื่อ เบอร์ และอีเมลที่ผิดรูปแบบ
    const opened = await openReservationFormOfTestTenant(page, loginAs);
    const { docs } = opened;
    await addLandlord(docs);
    await typeIntoReservation(docs, 'landlordFirstName', TEST_LANDLORD.landlordFirstName);
    await typeIntoReservation(docs, 'landlordPhone', TEST_LANDLORD.landlordPhone);
    await typeIntoReservation(docs, 'landlordEmail', 'e2e-not-an-email');

    // ขั้นที่ 2: กด Next
    await docs.nextButton(1).click();

    // ค่าที่คาด: ข้อความรวม ใต้ช่องอีเมลผู้ให้เช่าขึ้น "Invalid email format" ส่วนชื่อกับเบอร์ไม่มีข้อความ และยังอยู่ขั้น "01 Parties" (K23: ReservationLetterFields.tsx:107-112)
    await expect(docs.alert(FLOW.ccStepRequired)).toBeVisible();
    expect(await docs.rFieldErrorText('landlordEmail'), 'ข้อความใต้ช่องอีเมลผู้ให้เช่า').toBe(FLOW.ccEmailFormat);
    expect(await docs.rFieldErrorText('landlordFirstName'), 'ข้อความใต้ช่องชื่อผู้ให้เช่า').toBeNull();
    expect(await docs.rFieldErrorText('landlordPhone'), 'ข้อความใต้ช่องเบอร์ผู้ให้เช่า').toBeNull();
    await expect(docs.stepHeader(1)).toBeVisible();
    expectReadOnly(guard, opened, 'กด Next ตอนอีเมลผู้ให้เช่าผิดรูปแบบ');
  });

  test('a complete first step leads to the second step, and Back keeps what was typed', { tag: '@CCR-019' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: ฟอร์มเปิดที่ขั้น Parties และกรอกผู้ให้เช่าของเทสถูกต้อง
    const opened = await openReservationFormOfTestTenant(page, loginAs);
    const { docs } = opened;
    await fillTestLandlord(docs);

    // ขั้นที่ 1: กด Next ; ค่าที่คาด: หัวของขั้นเป็น "02 Room and contract" (K21, K22: CS:472-473)
    await advance(docs, 1, PARTIES_BLOCKED, LANDLORD_REQUIRED);
    await expect(docs.stepHeader(2)).toBeVisible();
    await expect(docs.stepHeader(1)).toHaveCount(0);

    // ขั้นที่ 2: กด "← Back" ; ค่าที่คาด: กลับมา "01 Parties" และค่าผู้ให้เช่าที่พิมพ์ทั้ง 3 ช่องยังอยู่ (K21: CS:2455-2461)
    await docs.backButton.click();
    await expect(docs.stepHeader(1)).toBeVisible();
    for (const key of LANDLORD_REQUIRED) {
      await expect.poll(() => docs.rFieldValueIs(key, TEST_LANDLORD[key]), { message: `ช่อง ${key} ยังเป็นข้อความที่เทสพิมพ์ไว้` }).toBe(true);
    }

    expectReadOnly(guard, opened, 'ไปขั้นที่ 2 แล้วกลับ');
  });

  test('the second step needs the project name', { tag: '@CCR-020' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: อยู่ขั้น "02 Room and contract"
    const opened = await openReservationFormOfTestTenant(page, loginAs);
    const { docs } = opened;
    await fillTestLandlord(docs);
    await advance(docs, 1, PARTIES_BLOCKED, LANDLORD_REQUIRED);

    // ขั้นที่ 1: ล้างช่อง Project ; ขั้นที่ 2: กด Next
    await typeIntoReservation(docs, 'project', '');
    await docs.nextButton(2).click();

    // ค่าที่คาด: ข้อความรวม "This field is required." ใต้ช่อง Project และยังอยู่ขั้น 02 (K22, K23: CS:413 ; ReservationLetterFields.tsx:65-70, 88-90)
    await expect(docs.alert(FLOW.ccStepRequired)).toBeVisible();
    expect(await docs.rFieldErrorText('project'), 'ข้อความใต้ช่อง Project').toBe(FLOW.ccRequired);
    await expect(docs.stepHeader(2)).toBeVisible();
    expectReadOnly(guard, opened, 'กด Next ตอนช่อง Project ว่าง');
  });

  test('a start date in the wrong format is refused on the second step', { tag: '@CCR-021' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: อยู่ขั้น "02 Room and contract" และช่องวันเริ่มไม่ถูกล็อกจากข้อเสนอ
    const opened = await openReservationFormOfTestTenant(page, loginAs);
    const { docs } = opened;
    await fillTestLandlord(docs);
    await advance(docs, 1, PARTIES_BLOCKED, LANDLORD_REQUIRED);
    await skipIfLocked(docs, 'termFrom');

    // ขั้นที่ 1: พิมพ์วันที่ผิดรูปแบบในช่อง Start / move-in date ; ขั้นที่ 2: กด Next
    await typeIntoReservation(docs, 'termFrom', '13/11/2026');
    await docs.nextButton(2).click();

    // ค่าที่คาด: ข้อความรวม ใต้ช่องขึ้น "Invalid date format (YYYY-MM-DD)" และยังอยู่ขั้น 02 (K23: ReservationLetterFields.tsx:96-100)
    await expect(docs.alert(FLOW.ccStepRequired)).toBeVisible();
    expect(await docs.rFieldErrorText('termFrom'), 'ข้อความใต้ช่องวันเริ่ม').toBe(FLOW.ccDateFormat);
    await expect(docs.stepHeader(2)).toBeVisible();
    expectReadOnly(guard, opened, 'กด Next ตอนวันเริ่มผิดรูปแบบ');
  });

  test('the third step needs the reservation fee', { tag: '@CCR-022' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: อยู่ขั้น "03 Amounts and payment" และช่องค่าจองไม่ถูกล็อกจากข้อเสนอ
    const opened = await openReservationFormOfTestTenant(page, loginAs);
    const { docs } = opened;
    await fillTestLandlord(docs);
    await advance(docs, 1, PARTIES_BLOCKED, LANDLORD_REQUIRED);
    await advance(docs, 2, ROOM_BLOCKED);
    await skipIfLocked(docs, 'reservationPayment');

    // ขั้นที่ 1: ล้างช่อง Reservation fee (THB) ; ขั้นที่ 2: กด Next
    await typeIntoReservation(docs, 'reservationPayment', '');
    await docs.nextButton(3).click();

    // ค่าที่คาด: ข้อความรวม "This field is required." ใต้ช่องค่าจอง และยังอยู่ขั้น 03 (K22, K23: ReservationLetterFields.tsx:65-70, 88-90, 174)
    await expect(docs.alert(FLOW.ccStepRequired)).toBeVisible();
    expect(await docs.rFieldErrorText('reservationPayment'), 'ข้อความใต้ช่องค่าจอง').toBe(FLOW.ccRequired);
    await expect(docs.stepHeader(3)).toBeVisible();
    expectReadOnly(guard, opened, 'กด Next ตอนช่องค่าจองว่าง');
  });

  test('Save draft on the last step opens the reservation confirmation, and cancelling it sends nothing', { tag: '@CCR-023' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: อยู่ขั้น "04 Review" โดยทุกขั้นผ่านการตรวจ (ช่องค่าจองที่ว่างเติม 5000 ถ้าไม่ถูกล็อก ; 5000 คือค่าตัวอย่างในช่อง: ReservationLetterFields.tsx:174)
    const opened = await openReservationFormOfTestTenant(page, loginAs);
    const { docs, type } = opened;
    await fillTestLandlord(docs);
    await advance(docs, 1, PARTIES_BLOCKED, LANDLORD_REQUIRED);
    await advance(docs, 2, ROOM_BLOCKED);
    const feeEmpty = await docs.rFieldIsEmpty('reservationPayment');
    expect(feeEmpty, 'ต้องพบช่อง reservationPayment 1 ช่อง').not.toBeNull();
    if (feeEmpty) {
      await skipIfLocked(docs, 'reservationPayment');
      await typeIntoReservation(docs, 'reservationPayment', '5000');
    }
    await advance(docs, 3, AMOUNTS_BLOCKED, feeEmpty ? ['reservationPayment'] : []);
    await expect(docs.stepHeader(4)).toBeVisible();

    // ขั้นที่ 1: กด Save draft ของฟอร์ม (K21: ปุ่มนี้มีที่ขั้นสุดท้ายเท่านั้น CS:2474-2481)
    const posted = watchForRequest(page, (request) => isSaveDraftRequest(request.method(), request.url()), QUIET_MS);
    await docs.saveDraft.click();

    // ค่าที่คาด: กล่องยืนยันขึ้น หัวข้อ "บันทึก<ชื่อไทยของประเภท>นี้?" เนื้อความของหนังสือจอง และปุ่ม 2 ปุ่ม (K26: CS:1595-1610, 1697-1699, 2495-2523)
    const title = `${CONTRACT_SAVE_CONFIRM.titlePrefix}${type.nameTh || CONTRACT_SAVE_CONFIRM.titleFallbackType}${CONTRACT_SAVE_CONFIRM.titleSuffix}`;
    await expect(docs.confirmTitle(title)).toBeVisible();
    await expect(docs.confirmBodyReservation).toBeVisible();
    await expect(docs.confirmCancel).toBeVisible();
    await expect(docs.confirmSave).toBeVisible();
    // ค่าที่คาด: ยังไม่มีคำขอ POST /agent/contracts ภายในช่วงเฝ้า (เทสไม่กด "บันทึกฉบับร่าง" ในกล่อง)
    expect(await posted, `มีคำขอ POST /agent/contracts ภายใน ${QUIET_MS} ms หลังกด Save draft ทั้งที่ยังไม่ได้ยืนยัน`).toBe(false);

    // ขั้นที่ 2: กด "ยกเลิก" ในกล่อง ; ค่าที่คาด: กล่องปิด ฟอร์มยังอยู่ขั้น 04 และไม่มีคำขอ POST (CS:2506-2512)
    const postedAfterCancel = watchForRequest(page, (request) => isSaveDraftRequest(request.method(), request.url()), QUIET_MS);
    await docs.confirmCancel.click();
    await expect(docs.confirmBackdrop).toHaveCount(0);
    await expect(docs.stepHeader(4)).toBeVisible();
    expect(await postedAfterCancel, `มีคำขอ POST /agent/contracts ภายใน ${QUIET_MS} ms หลังกด "ยกเลิก"`).toBe(false);
    expectReadOnly(guard, opened, 'เปิดและปิดกล่องยืนยันของหนังสือจอง');
  });
});

test.describe('contracts: language of the confirmation', () => {
  test('the confirmation before saving is in the language of the page', { tag: ['@CCR-012', '@known-bug'] }, async ({ page, loginAs, guard }) => {
    // ตรวจเฉพาะภาษาอังกฤษ: ข้อความในกล่องเขียนเป็นภาษาไทยตายตัว (CS:2494-2525) ในหน้าภาษาไทยจึงถูกอยู่แล้ว
    test.skip(UI_LOCALE !== 'en', 'ตรวจเฉพาะหน้าภาษาอังกฤษ (กล่องยืนยันเป็นภาษาไทยตายตัว จึงถูกอยู่แล้วในหน้าภาษาไทย)');

    // เงื่อนไขตั้งต้น: กล่องยืนยันของฟอร์มสัญญาแต่งตั้งเปิดอยู่ (ขั้นเดียวกับ CCR-009) หากล่องจากปุ่มพื้นหลังซึ่งไม่ขึ้นกับภาษา
    const opened = await openBrokerFormOfTestTenant(page, loginAs);
    const { docs } = opened;
    await completeRequired(docs);
    await docs.saveDraft.click();
    await expect(docs.confirmBackdrop).toBeVisible();
    // รอจนกล่องมีข้อความ โดยไม่อาศัยข้อความภาษาไทย เพื่อให้ข้อนี้ยังทำงานได้เมื่อทีมแก้บั๊กแล้ว
    await expect.poll(async () => (await docs.confirmText()).trim().length, { message: 'กล่องยืนยันต้องมีข้อความ' }).toBeGreaterThan(0);
    const text = await docs.confirmText();
    expectReadOnly(guard, opened, 'เปิดกล่องยืนยัน');

    // ขั้นที่ 1: อ่านข้อความในกล่อง ; ค่าที่คาด: ไม่มีตัวอักษรไทยในกล่องยืนยันของหน้าภาษาอังกฤษ (S2 ; Aof ตัดสินว่าเป็นบั๊ก 13 พ.ย. 2026)
    // test.fail อยู่ตรงนี้เพื่อให้ความล้มของขั้นเตรียมข้างบนยังทำให้ข้อนี้แดง (test.fail กลับผลเฉพาะความล้มที่เกิดหลังบรรทัดนี้)
    test.fail(true, 'WEB-024: กล่องยืนยันก่อนบันทึกสัญญาเป็นภาษาไทยในหน้าภาษาอังกฤษ (ข้อความเขียนตายตัวใน ContractsScreen.tsx:2494-2525)');
    expect(text, 'ข้อความในกล่องยืนยันของหน้าภาษาอังกฤษต้องไม่มีตัวอักษรไทย').not.toMatch(/[\u0E00-\u0E7F]/);
  });
});
