import type { Page } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import type { RequestGuard } from '../../src/web-ui/guard';
import { AgentTenantsPage } from '../../src/web-ui/pages/agent-tenants.page';
import { AgentContractsPage, SIGNED_MARK, SIGN_ROW_OTHER, type SignRow, type SignedKind } from '../../src/web-ui/pages/agent-contracts.page';
import { FLOW, UI_LOCALE } from '../../src/web-ui/labels';
import { ApiLog, okJson, waitForApi } from '../../src/web-ui/support/api';

/**
 * การ์ดลงนามในรายละเอียดเอกสารของนายหน้าบนจอกว้าง (รายละเอียดผู้เช่า หัวข้อ Contracts): เคส CSG-001 ถึง CSG-008
 * ตารางเคส: เอกสารโปรเจกต์ claude/nestyk-topic-contracts-sign-web-ui-part3.md Aof อนุมัติ 16 พ.ย. 2026
 * CSG-007 ติดเครื่องหมายบั๊กที่รู้แล้ว WEB-025 (e2e/KNOWN-BUGS.md) และรันเฉพาะภาษาอังกฤษ
 * กฎ SG1-SG33: claude/nestyk-topic-contracts-sign-web-ui.md, ...-part2.md และ ...-part3.md
 * โค้ด: apps/consumer-app/components/ContractsScreen.tsx (CS), AgentContractLibrary.tsx (LIB), lib/signature-log.ts ที่ qa/e2e 49df02b
 *   (แอปและ API เท่ากับ pre/dev/review d3bcf28)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web, ตั้ง E2E_QA_AGENT_PASSWORD
 * ขอบเขต: เอกสารของผู้เช่าทดสอบ (ชื่อขึ้นต้นด้วย E2E) ที่ลงนามครบทุกฝ่าย และปิดการลงนามแล้ว (สร้างฉบับสมบูรณ์แล้ว หรือสิ้นสุดแล้ว)
 *   ผลนับ 16 พ.ย. 2026 (Claude outputs/results/probe-contracts-sign-49df02b-run2.txt): สัญญาแต่งตั้ง active 4 ฉบับ หนังสือจอง terminated 3 ฉบับ
 *   สัญญาเช่า terminated 3 ฉบับ และไม่มีเอกสารที่ยังลงนามได้ จึงยังไม่มีเคสของแผ่นลงนาม ปุ่ม Share และปุ่มพยาน
 *   เทสเลือกเอกสารจากคำตอบของ API ตอนรัน ถ้าไม่มีเอกสารตามเงื่อนไข ข้อนั้นข้ามพร้อมเหตุผล
 * ทุกข้ออ่านอย่างเดียว:
 *   - ไม่กดปุ่ม "View ..." ของเอกสาร: ปุ่มนี้ส่ง POST ...-preview (CS:2752-2759, 2788-2795, 2855-2864) รวมถึง "View final document" (CS:3165-3171)
 *   - ไม่กดปุ่ม "Sign", "Share" และปุ่มพยาน (ไม่มีในเอกสารกลุ่มนี้อยู่แล้ว)
 *   - ทุกข้อตรวจท้ายข้อ (expectReadOnly) ว่าตัวกันไม่ได้ตัดคำขอเขียน และตั้งแต่หัวข้อ Contracts โหลดเสร็จไม่มีคำขอไป API ที่ไม่ใช่การอ่าน
 *     ยกเว้น POST /auth/sync ที่ตัวกันยอมให้ผ่าน (แบบเดียวกับ agent-contracts-create.spec.ts)
 * คำขอที่หน้าเว็บส่งเองเมื่อเปิดรายละเอียดเอกสาร (GET ทั้งหมด ตรวจโค้ด API ที่ 49df02b แล้วว่าไม่มีคำสั่งเขียน):
 *   - ทุกชนิด: GET /agent/contracts/:id (CS:3683-3689) และ GET /agent/contracts/:id/signatures (CS:516-531 ; API agent-contracts.service.ts:548-567)
 *   - หนังสือจองกับสัญญาเช่า: GET /agent/contracts/:id/attachments (CS:3035-3044 ; API agreement-attachments.service.ts:143-148, 197-241)
 *   - สัญญาเช่า: GET .../handover, .../handover/move-out, .../deposit-settlement (API handover.service.ts:306-308 ; deposit-settlement.ts:126-128)
 *     และ GET /agent/contracts/end-reasons (API contract-closure.ts:38-41)
 *
 * ข้อมูลบนจอ:
 *   - ปิดภาพหน้าจอของไฟล์นี้ (ข้อที่ไม่ผ่านยังมี error-context.md ซึ่งมีข้อความบนหน้า ห้ามส่งออกนอกทีม)
 *   - รายละเอียดเอกสารมีชื่อของคู่สัญญา เทสไม่อ่านและไม่พิมพ์ชื่อ: การ์ดลงนามอ่านผ่าน signRows ซึ่งคืนเฉพาะป้ายฝ่าย สถานะ และชื่อปุ่ม
 *     บรรทัดช่องทางใต้แถวที่ลงนามแล้วลงท้ายด้วยชื่อผู้กดลงนาม (lib/signature-log.ts:22) signRows จึงคืนแค่ข้อความช่องทางที่บรรทัดนั้นขึ้นต้น
 *   - เลขที่เอกสารที่ใช้หาการ์ดเป็นเลขของเอกสารทดสอบ ไม่ใช่ข้อมูลของคน
 * วิธีหาชิ้นส่วนมาจากการอ่านโค้ด (หน้าสัญญาไม่มี testID) ดูคำอธิบายใน src/web-ui/pages/agent-contracts.page.ts
 * ขั้นเปิดหน้าสัญญาของผู้เช่าซ้ำกับ openContracts ของ agent-contracts-create.spec.ts โดยตั้งใจ เพื่อไม่แก้ไฟล์ที่ผ่านการรันแล้ว (แผนไฟล์ 16 พ.ย. 2026)
 */
test.use({ screenshot: 'off' });

type Party = 'owner' | 'tenant' | 'agent';

/** เฉพาะส่วนของสัญญาที่เทสใช้ จาก GET /agent/tenants (ช่อง contracts) และ GET /agent/contracts/:id (packages/types/src/agent-contracts.ts:31-86) */
interface ContractRow {
  id: number;
  formKind: string;
  status: string;
  /** เลขที่เอกสาร ใช้หาการ์ดในรายการ */
  contractNo: string;
  ownerSignedAt: string | null;
  tenantSignedAt: string | null;
  agentSignedAt: string | null;
  /** ใช้ตรวจแค่ว่ามีค่าหรือไม่ ห้ามพิมพ์ค่า (เป็นลิงก์ไฟล์) */
  ownerSignatureUrl: string | null;
  tenantSignatureUrl: string | null;
  agentSignatureUrl: string | null;
  reservationLetterStatus?: string | null;
  brokerAppointmentStatus?: string | null;
  leaseAgreementStatus?: string | null;
}
interface TenantRow {
  id: number;
  name: string;
  contracts: ContractRow[];
}

/** เฉพาะส่วนของคำตอบ GET /agent/contracts/:id/signatures ที่เทสใช้ (agent-contracts.ts:287-296) ไม่ประกาศช่อง signedBy เพราะเป็นชื่อคน */
interface SignatureEntry {
  party: string;
  channel: string;
  signedAt: string;
}

const isE2e = (tenant: TenantRow): boolean => tenant.name.startsWith('E2E');

/** ฝ่ายที่มีแถวลงนามของเอกสารแต่ละชนิด เรียงตามที่แสดง (SG14: CS:959-994) */
const SIGNERS: Record<SignedKind, readonly Party[]> = {
  broker_appointment: ['owner', 'agent'],
  reservation: ['owner', 'tenant', 'agent'],
  lease: ['owner', 'tenant'],
};

/** ป้ายของแถวลงนามตามชนิดเอกสารและฝ่าย (SG31: CS:959-994 ; สัญญาแต่งตั้งใช้ contracts.common.parties ชนิดอื่นใช้ agent.contracts) */
const ROW_LABELS: Record<SignedKind, Partial<Record<Party, string>>> = {
  broker_appointment: { owner: FLOW.csRowLandlord, agent: FLOW.csRowBroker },
  reservation: { owner: FLOW.csRowLessor, tenant: FLOW.csRowTenant, agent: FLOW.csRowAgent },
  lease: { owner: FLOW.csRowLessor, tenant: FLOW.csRowTenant },
};
const rowLabelsOf = (kind: SignedKind): string[] => SIGNERS[kind].map((party) => ROW_LABELS[kind][party] as string);

/** สถานะที่แอปไม่ให้ลงนามแล้ว (CS:995-1002 signingLocked) */
const SIGNING_CLOSED = ['cancelled', 'expired', 'terminated', 'active', 'awaiting_deposit', 'awaiting_handover'];

/** เอกสารสร้างฉบับสมบูรณ์แล้วหรือไม่ (CS:1003-1016 reservationLocked, brokerLocked, leaseLocked) */
function documentReady(contract: ContractRow): boolean {
  const status =
    contract.formKind === 'reservation'
      ? contract.reservationLetterStatus
      : contract.formKind === 'broker_appointment'
        ? contract.brokerAppointmentStatus
        : contract.formKind === 'lease'
          ? contract.leaseAgreementStatus
          : undefined;
  return status === 'ready';
}

const signedAt = (contract: ContractRow, party: Party): string | null => contract[`${party}SignedAt`];
const signatureUrl = (contract: ContractRow, party: Party): string | null => contract[`${party}SignatureUrl`];

/** เอกสารชนิดนี้ที่ลงนามครบทุกแถว และแอปไม่แสดงปุ่มลงนามแล้ว (สถานะปิดการลงนาม หรือสร้างฉบับสมบูรณ์แล้ว: CS:3091-3093) */
function signedAndClosed(kind: SignedKind): (contract: ContractRow) => boolean {
  return (contract) =>
    contract.formKind === kind &&
    SIGNERS[kind].every((party) => !!signedAt(contract, party)) &&
    (SIGNING_CLOSED.includes(contract.status) || documentReady(contract));
}

/** method ที่ไม่เขียนข้อมูล (ชุดเดียวกับ guard.ts:77) */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** คำขอเขียนที่ตัวกันยอมให้ผ่าน (guard.ts:74) */
const ALLOWED_WRITES = ['POST /auth/sync'];

/** คำขอไป API ที่ไม่ใช่การอ่านและไม่อยู่ในรายการที่ยอม เป็น "<method> <path>" (แบบเดียวกับ agent-contracts-create.spec.ts) */
function writeCalls(log: ApiLog): string[] {
  return log.calls
    .filter((call) => !READ_METHODS.has(call.method))
    .map((call) => `${call.method} ${call.path}`)
    .filter((call) => !ALLOWED_WRITES.includes(call));
}

interface Library {
  screen: AgentTenantsPage;
  docs: AgentContractsPage;
  /** เอกสารที่เลือก ตามคำตอบของ GET /agent/tenants */
  listed: ContractRow;
  /** คำขอไป API ทั้งหมดของแท็บนี้ตั้งแต่ก่อนล็อกอิน */
  log: ApiLog;
  /** จำนวนคำขอที่ไม่ใช่การอ่าน ณ ตอนที่หัวข้อ Contracts โหลดเสร็จ */
  writesBefore: number;
}

interface Detail extends Library {
  /** เอกสารตามคำตอบของ GET /agent/contracts/:id ซึ่งเป็นตัวที่หน้ารายละเอียดใช้ (CS:3685-3688) */
  contract: ContractRow;
  /** คำตอบของ GET /agent/contracts/:id/signatures */
  signatures: SignatureEntry[];
}

/** ตรวจท้ายข้อว่าเทสไม่ทำให้เกิดคำขอเขียน (แบบเดียวกับ agent-contracts-create.spec.ts) */
function expectReadOnly(guard: RequestGuard, opened: Pick<Library, 'log' | 'writesBefore'>, what: string): void {
  expect(guard.of('unexpected-write').map((entry) => new URL(entry.target).pathname), `${what}แล้วมีคำขอเขียนที่ตัวกันตัด`).toEqual([]);
  expect(writeCalls(opened.log).slice(opened.writesBefore), `${what}แล้วมีคำขอไป API ที่ไม่ใช่การอ่าน`).toEqual([]);
}

type LoginAs = (role: 'agent', options?: { next?: string }) => Promise<void>;

/** หมวดของเอกสารแต่ละชนิดในหน้ารายการ (SG30: lib/agent-contract-library.ts:27) */
const folderOf = (kind: SignedKind): 'rental' | 'brokerage' => (kind === 'broker_appointment' ? 'brokerage' : 'rental');

/**
 * เปิด /agent/clients ด้วย qa-agent เลือกผู้เช่าทดสอบที่มีเอกสารชนิดนี้ซึ่งลงนามครบและปิดการลงนามแล้ว เปิดรายละเอียด แล้วเปิดหัวข้อ Contracts
 * รอจนรายการเอกสารโหลดเสร็จ: ปุ่ม Create document เลิกปิด (LIB:124 disabled={busy || loading})
 * ใช้เฉพาะผู้เช่าที่ชื่อขึ้นต้นด้วย E2E ถ้าไม่มี ข้อนั้นข้ามพร้อมเหตุผล
 */
async function openLibrary(page: Page, loginAs: LoginAs, kind: SignedKind): Promise<Library> {
  const log = new ApiLog(page);
  const tenantsLoaded = waitForApi(page, 'GET', '/agent/tenants');
  await loginAs('agent', { next: '/agent/clients' });
  const tenants = await okJson<TenantRow[]>(await tenantsLoaded);
  expect(Array.isArray(tenants), 'คำตอบของ GET /agent/tenants ต้องเป็นรายการ').toBe(true);
  const wanted = signedAndClosed(kind);
  const tenant = tenants.find((row) => isE2e(row) && Array.isArray(row.contracts) && row.contracts.some(wanted));
  test.skip(!tenant, `qa-agent ไม่มีผู้เช่าทดสอบ (ชื่อขึ้นต้นด้วย E2E) ที่มีเอกสารชนิด ${kind} ซึ่งลงนามครบและปิดการลงนามแล้ว`);
  const chosen = tenant as TenantRow;
  const listed = chosen.contracts.find(wanted) as ContractRow;

  const screen = new AgentTenantsPage(page);
  await screen.tabCount('all'); // รอจนหน้าโหลดเสร็จ (แท็บแสดงจำนวนเป็นตัวเลข)
  await screen.tab('all').click();
  const detail = waitForApi(page, 'GET', `/agent/tenants/${chosen.id}`);
  await screen.row(chosen.id).click();
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
  return { screen, docs, listed, log, writesBefore: writeCalls(log).length };
}

/** กดหมวดของเอกสารชนิดนี้ แล้วรอการ์ดของเอกสารที่เลือก (SG30) */
async function openFolder(library: Library, kind: SignedKind): Promise<void> {
  await library.docs.folder(folderOf(kind)).click();
  await expect(library.docs.documentCard(kind, library.listed.contractNo)).toBeVisible();
}

/**
 * กดการ์ดของเอกสาร แล้วรอคำขอที่หน้ารายละเอียดส่งเอง (SG1, SG2) และรอการ์ดลงนาม
 * ตรวจเงื่อนไขของเอกสารซ้ำกับคำตอบของ GET /agent/contracts/:id เพราะหน้ารายละเอียดใช้คำตอบนี้ ไม่ใช่ตัวที่อยู่ในรายการ
 */
async function openDocument(page: Page, library: Library, kind: SignedKind): Promise<Detail> {
  const id = library.listed.id;
  const loaded = waitForApi(page, 'GET', `/agent/contracts/${id}`);
  const signaturesLoaded = waitForApi(page, 'GET', `/agent/contracts/${id}/signatures`);
  await library.docs.documentCard(kind, library.listed.contractNo).click();
  const contract = await okJson<ContractRow>(await loaded);
  expect(signedAndClosed(kind)(contract), 'คำตอบของ GET /agent/contracts/:id ต้องตรงเงื่อนไขเดียวกับที่เลือกจากรายการ').toBe(true);
  const signatures = await okJson<SignatureEntry[]>(await signaturesLoaded);
  expect(Array.isArray(signatures), 'คำตอบของ GET /agent/contracts/:id/signatures ต้องเป็นรายการ').toBe(true);
  await expect(library.docs.signCardTitle).toBeVisible();
  return { ...library, contract, signatures };
}

/** เปิดรายละเอียดของเอกสารชนิดนี้ที่ลงนามครบและปิดการลงนามแล้ว (ขั้นเตรียมของ CSG-002, CSG-004 ถึง CSG-008) */
async function openSignedDocument(page: Page, loginAs: LoginAs, kind: SignedKind): Promise<Detail> {
  const library = await openLibrary(page, loginAs, kind);
  await openFolder(library, kind);
  return openDocument(page, library, kind);
}

/** ค่าที่ rowsOf คืนเมื่อหาการ์ดลงนามไม่เจอ หรือเจอมากกว่า 1 ใบ (ทำให้ expect ที่ตามมาไม่ผ่าน และข้อความบอกได้ว่าเป็นกรณีนี้ ไม่ใช่การ์ดที่ไม่มีแถว) */
const NO_SIGN_CARD: SignRow[] = [{ label: '(ไม่พบการ์ดลงนาม หรือพบมากกว่า 1 ใบ)', status: '', extra: [], buttons: [] }];

/** แถวของการ์ดลงนามตามที่อ่านได้บนจอ */
async function rowsOf(docs: AgentContractsPage): Promise<SignRow[]> {
  return (await docs.signRows()) ?? NO_SIGN_CARD;
}

/**
 * บรรทัดช่องทางที่คาดใต้สถานะของแถวแต่ละฝ่าย เรียงตามแถว คำนวณจากคำตอบของ GET /agent/contracts/:id/signatures
 * ฝ่ายที่ไม่มีรายการ หรือรายการแรกของฝ่ายนั้นมีช่องทางเป็น legacy ไม่มีบรรทัดนี้ (SG29: lib/signature-log.ts:18-22 ใช้รายการแรกของฝ่าย)
 */
function channelLines(kind: SignedKind, signatures: SignatureEntry[]): string[][] {
  const channels = FLOW.csSignedVia as Record<string, string>;
  return SIGNERS[kind].map((party) => {
    const entry = signatures.find((row) => row.party === party);
    if (!entry || entry.channel === 'legacy') return [];
    expect(Object.keys(channels), `ช่องทาง ${entry.channel} ของฝ่าย ${party} ต้องเป็นช่องทางที่แอปมีข้อความ (agent.contracts.signedVia en.ts:1456)`).toContain(entry.channel);
    return [channels[entry.channel]];
  });
}

test.describe('contract signing: opening a signed document', () => {
  test('a signed broker appointment opens from the Brokerage category with its signature card', { tag: '@CSG-001' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: ผู้เช่าทดสอบที่มีสัญญาแต่งตั้งซึ่งลงนามครบแล้ว เปิดหัวข้อ Contracts
    const library = await openLibrary(page, loginAs, 'broker_appointment');
    const { docs, listed } = library;

    // ขั้นที่ 1: กดหมวด "Brokerage" ; ค่าที่คาด: การ์ด "Broker appointment {เลขที่}" ของเอกสารขึ้น (SG30: lib/agent-contract-library.ts:27 ; LIB:75-76, 126-143)
    await docs.folder('brokerage').click();
    await expect(docs.documentCard('broker_appointment', listed.contractNo)).toBeVisible();

    // ขั้นที่ 2: กดการ์ดของเอกสาร
    const loaded = waitForApi(page, 'GET', `/agent/contracts/${listed.id}`);
    const signaturesLoaded = waitForApi(page, 'GET', `/agent/contracts/${listed.id}/signatures`);
    await docs.documentCard('broker_appointment', listed.contractNo).click();

    // ค่าที่คาด: มีคำขอ GET รายละเอียดกับประวัติลายเซ็นของเอกสารนั้น ทั้งคู่สำเร็จ (SG1: CS:3683-3689 ; SG2: CS:516-531)
    expect((await loaded).ok(), 'GET /agent/contracts/:id ต้องสำเร็จ').toBe(true);
    expect((await signaturesLoaded).ok(), 'GET /agent/contracts/:id/signatures ต้องสำเร็จ').toBe(true);
    // ค่าที่คาด: การ์ดหัวข้อ "Counterparty signatures" แสดง (CS:3046 ; agent.contracts.signatories en.ts:1451)
    await expect(docs.signCardTitle).toBeVisible();

    expectReadOnly(guard, library, 'เปิดรายละเอียดของสัญญาแต่งตั้ง');
  });

  test('a signed reservation letter opens from the Rental category and loads its attachments', { tag: '@CSG-003' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: ผู้เช่าทดสอบที่มีหนังสือจองซึ่งลงนามครบแล้ว เปิดหมวด "Rental"
    const library = await openLibrary(page, loginAs, 'reservation');
    await openFolder(library, 'reservation');

    // ขั้นที่ 1: กดการ์ด "Reservation letter {เลขที่}"
    const attachmentsLoaded = waitForApi(page, 'GET', `/agent/contracts/${library.listed.id}/attachments`);
    const detail = await openDocument(page, library, 'reservation');

    // ค่าที่คาด: มีคำขอ GET รายการเอกสารแนบของเอกสารนั้นเพิ่มจาก 2 คำขอของ CSG-001 และสำเร็จ (SG2: CS:3035-3044)
    expect((await attachmentsLoaded).ok(), 'GET /agent/contracts/:id/attachments ต้องสำเร็จ').toBe(true);
    // ค่าที่คาด: การ์ดลงนามมี 3 แถว "Lessor", "Tenant", "Agent" และไม่มีแถว "Witness" (SG14, SG31: CS:959-994 ; en.ts:1452-1454)
    await expect.poll(async () => (await rowsOf(detail.docs)).map((row) => row.label), { message: 'ป้ายของแถวในการ์ดลงนามของหนังสือจอง' }).toEqual(rowLabelsOf('reservation'));

    expectReadOnly(guard, detail, 'เปิดรายละเอียดของหนังสือจอง');
  });
});

test.describe('contract signing: rows of the signature card', () => {
  test('a broker appointment has a landlord row and a broker row only', { tag: '@CSG-002' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: รายละเอียดของสัญญาแต่งตั้งที่ลงนามครบแล้วเปิดอยู่
    const detail = await openSignedDocument(page, loginAs, 'broker_appointment');

    // ขั้นที่ 1: อ่านแถวในการ์ดลงนาม
    // ค่าที่คาด: มี 2 แถว "Landlord" กับ "Broker" ไม่มีแถว "Tenant" และไม่มีแถว "Witness"
    //   (SG14, SG31: CS:989-990 ตัดแถวผู้เช่าออก ; CS:3122 แถวพยานมีเฉพาะสัญญาเช่า ; contracts/en.ts:54, 56)
    await expect.poll(async () => (await rowsOf(detail.docs)).map((row) => row.label), { message: 'ป้ายของแถวในการ์ดลงนามของสัญญาแต่งตั้ง' }).toEqual(rowLabelsOf('broker_appointment'));

    expectReadOnly(guard, detail, 'อ่านแถวลงนามของสัญญาแต่งตั้ง');
  });

  test('a lease has a lessor row, a tenant row and a witness row', { tag: '@CSG-004' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: ผู้เช่าทดสอบที่มีสัญญาเช่าซึ่งลงนามครบแล้ว เปิดหมวด "Rental"
    const library = await openLibrary(page, loginAs, 'lease');
    await openFolder(library, 'lease');

    // ขั้นที่ 1: กดการ์ด "Lease agreement {เลขที่}"
    const detail = await openDocument(page, library, 'lease');

    // ค่าที่คาด: การ์ดลงนามมีแถว "Lessor", "Tenant" และแถว "Witness" ไม่มีแถว "Agent" (SG14, SG27, SG31: CS:991-992, 3122-3125 ; en.ts:1452, 1453, 1458)
    const labels = [...rowLabelsOf('lease'), FLOW.csRowWitness];
    await expect.poll(async () => (await rowsOf(detail.docs)).map((row) => row.label), { message: 'ป้ายของแถวในการ์ดลงนามของสัญญาเช่า' }).toEqual(labels);

    // ค่าที่คาด: แถว Witness ขึ้น ✓ เมื่อประวัติลายเซ็นจาก API มีรายการของพยาน ไม่อย่างนั้นขึ้น "Not signed" (SG27: CS:532, 3127-3130 ; en.ts:1455)
    //   ก่อนแอปได้ประวัติลายเซ็น แถวนี้ขึ้น "Not signed" อยู่แล้ว (CS:522, 532) จึงรอสัญญาณว่าแอปใช้ประวัติลายเซ็นแล้วก่อนตรวจ:
    //   บรรทัดช่องทางของแถวผู้ให้เช่ากับผู้เช่า ซึ่งขึ้นหลังประวัติลายเซ็นโหลดเสร็จเท่านั้น (CS:3064-3066)
    //   ถ้าทั้ง 2 ฝ่ายไม่มีบรรทัดนี้ (รายการเป็น legacy) และไม่มีรายการของพยาน จะไม่มีสัญญาณให้รอ รอบนั้นตรวจได้แค่ค่าที่เห็น ณ ตอนอ่าน (จดไว้ใน annotation)
    const witnessed = detail.signatures.some((entry) => entry.party === 'witness');
    const partyLines = channelLines('lease', detail.signatures);
    const loadedSignal = witnessed || partyLines.some((lines) => lines.length > 0);
    test.info().annotations.push({
      type: 'กรณีของแถวพยานที่ตรวจ',
      description: `ประวัติลายเซ็นจาก API ${witnessed ? 'มี' : 'ไม่มี'}รายการของพยาน ; ${loadedSignal ? 'มี' : 'ไม่มี'}สัญญาณบนจอว่าแอปใช้ประวัติลายเซ็นแล้ว`,
    });
    await expect
      .poll(async () => (await rowsOf(detail.docs)).slice(0, partyLines.length).map((row) => row.extra), { message: 'บรรทัดช่องทางของแถวผู้ให้เช่ากับผู้เช่า (สัญญาณว่าแอปใช้ประวัติลายเซ็นแล้ว)' })
      .toEqual(partyLines);
    await expect
      .poll(async () => {
        const status = (await rowsOf(detail.docs))[labels.length - 1]?.status ?? '';
        return witnessed ? status.startsWith(SIGNED_MARK) : status === FLOW.csUnsigned;
      }, { message: `สถานะของแถวพยาน (ประวัติลายเซ็นจาก API ${witnessed ? 'มี' : 'ไม่มี'}รายการของพยาน)` })
      .toBe(true);

    expectReadOnly(guard, detail, 'เปิดรายละเอียดของสัญญาเช่า');
  });

  test('a fully signed document shows every row as signed and offers no Sign or Share button', { tag: '@CSG-005' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: รายละเอียดของเอกสารที่ลงนามครบแล้ว (ใช้สัญญาแต่งตั้ง)
    const detail = await openSignedDocument(page, loginAs, 'broker_appointment');
    const { docs, contract } = detail;

    // ขั้นที่ 1: อ่านแถวและปุ่มในการ์ดลงนาม
    // ค่าที่คาด: ทุกแถวขึ้น ✓ (SG15: CS:3059-3062)
    await expect.poll(async () => (await rowsOf(docs)).map((row) => row.status.startsWith(SIGNED_MARK)), { message: 'ทุกแถวของการ์ดลงนามต้องขึ้น ✓' }).toEqual(SIGNERS.broker_appointment.map(() => true));
    // ค่าที่คาด: ไม่มีข้อความ "Not signed" (en.ts:1455)
    await expect(docs.signCardUnsigned).toHaveCount(0);
    // ค่าที่คาด: ไม่มีปุ่ม "Sign" และไม่มีปุ่ม "Share" หรือ "Sent" (SG15: CS:3091-3093 ปุ่มมีเฉพาะแถวที่ยังไม่ลงนาม และเมื่อยังไม่ปิดการลงนาม ; en.ts:1466, 1467, 1470)
    await expect(docs.signCardButton(FLOW.csSign)).toHaveCount(0);
    await expect(docs.signCardButton(FLOW.csShare)).toHaveCount(0);
    await expect(docs.signCardButton(FLOW.csShareSent)).toHaveCount(0);
    // ค่าที่คาด: จำนวนปุ่ม "View signature" เท่ากับจำนวนฝ่ายที่คำตอบของ API มีทั้งเวลาลงนามและลิงก์รูปลายเซ็น (SG15: CS:3076 ; en.ts:1536)
    const withImage = SIGNERS.broker_appointment.filter((party) => !!signedAt(contract, party) && !!signatureUrl(contract, party)).length;
    await expect(docs.signCardButton(FLOW.csViewSignature)).toHaveCount(withImage);

    expectReadOnly(guard, detail, 'อ่านการ์ดลงนามของเอกสารที่ลงนามครบแล้ว');
  });

  test('the line under a signed row starts with how it was signed', { tag: '@CSG-008' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: รายละเอียดของเอกสารที่ลงนามแล้ว และประวัติลายเซ็นจาก API มีรายการของฝ่ายนั้นที่ช่องทางไม่ใช่ legacy
    const detail = await openSignedDocument(page, loginAs, 'broker_appointment');
    // บรรทัดที่คาดของแต่ละแถว: ข้อความช่องทางตามคำตอบของ API ; ฝ่ายที่ไม่มีรายการ หรือช่องทางเป็น legacy ไม่มีบรรทัดนี้ (SG29: lib/signature-log.ts:18-22)
    const expected = channelLines('broker_appointment', detail.signatures);
    // เทสดูเฉพาะสัญญาแต่งตั้งฉบับแรกที่ตรงเงื่อนไข (ฉบับเดียวกับ CSG-002, CSG-005 ถึง CSG-007) เอกสารฉบับอื่นอาจมีช่องทางจริง
    test.skip(
      expected.every((lines) => lines.length === 0),
      `ประวัติลายเซ็นของสัญญาแต่งตั้ง id ${detail.contract.id} ไม่มีรายการที่ช่องทางไม่ใช่ legacy จึงไม่มีบรรทัดช่องทางให้ตรวจ (เทสดูเฉพาะฉบับนี้)`,
    );

    // ขั้นที่ 1: อ่านบรรทัดใต้วันเวลาของแต่ละแถว
    // ค่าที่คาด: บรรทัดขึ้นต้นด้วยข้อความของช่องทางตามคำตอบของ API (SG29: CS:3064-3066) เทสไม่พิมพ์บรรทัดจริง เพราะส่วนท้ายเป็นชื่อคน
    //   signRows คืนข้อความช่องทางที่บรรทัดนั้นขึ้นต้น หรือ SIGN_ROW_OTHER ; บรรทัดนี้ขึ้นหลังประวัติลายเซ็นโหลดเสร็จ จึงรอจนตรง
    await expect.poll(async () => (await rowsOf(detail.docs)).map((row) => row.extra), { message: `บรรทัดใต้สถานะของแต่ละแถว (${SIGN_ROW_OTHER} = บรรทัดที่ไม่ขึ้นต้นด้วยข้อความช่องทาง)` }).toEqual(expected);

    expectReadOnly(guard, detail, 'อ่านบรรทัดช่องทางของแถวที่ลงนามแล้ว');
  });
});

test.describe('contract signing: viewing a signature', () => {
  test('View signature opens the signature image, and Cancel closes it', { tag: '@CSG-006' }, async ({ page, loginAs, guard }) => {
    // เงื่อนไขตั้งต้น: รายละเอียดของเอกสารที่ลงนามครบแล้ว และมีปุ่ม "View signature" อย่างน้อย 1 ปุ่ม
    const detail = await openSignedDocument(page, loginAs, 'broker_appointment');
    const { docs, contract, log } = detail;
    const withImage = SIGNERS.broker_appointment.filter((party) => !!signedAt(contract, party) && !!signatureUrl(contract, party));
    test.skip(withImage.length === 0, 'คำตอบของ API ไม่มีลิงก์รูปลายเซ็นของฝ่ายไหนเลย จึงไม่มีปุ่ม View signature');
    await expect(docs.signCardButton(FLOW.csViewSignature)).toHaveCount(withImage.length);
    // แถวแรกที่มีปุ่ม = ฝ่ายแรกตามลำดับของการ์ดที่มีลิงก์รูปลายเซ็น
    const rowLabel = ROW_LABELS.broker_appointment[withImage[0]] as string;
    const callsBefore = log.calls.length;

    // ขั้นที่ 1: กดปุ่ม "View signature" ของแถวแรก
    await docs.signCardButton(FLOW.csViewSignature).first().click();
    // ค่าที่คาด: แผ่นขึ้น หัวข้อ "{ป้ายของแถว} signature" และมีรูปที่มีชื่อเดียวกับหัวข้อ (SG28: CS:3346-3361 ; en.ts:1537)
    await expect(docs.signatureSheetTitle(rowLabel)).toBeVisible();
    await expect(docs.signatureSheetImage(rowLabel)).toBeVisible();

    // ขั้นที่ 2: กด "Cancel"
    await docs.signatureSheetCancel.click();
    // ค่าที่คาด: แผ่นปิด และรายละเอียดเอกสารยังอยู่ (SG28: CS:3364-3374 ; common.cancel en.ts:13)
    //   หลังกด Cancel หัวข้อเปลี่ยนเป็น "View signature" ทันที (CS:3347-3349) แต่แผ่นยังอยู่จนภาพเคลื่อนไหวปิดจบ จึงตรวจปุ่มพื้นหลัง "Close"
    //   ซึ่งหายเมื่อแผ่นเลิกแสดงจริงเท่านั้น (packages/ui/src/components/MobileBottomSheet.tsx:81-89, 128)
    await expect(docs.signatureSheetTitle(rowLabel)).toHaveCount(0);
    await expect(docs.confirmBackdrop).toHaveCount(0);
    await expect(docs.signCardTitle).toBeVisible();

    // ค่าที่คาด: ไม่มีคำขอไป API เพิ่มทั้ง 2 ขั้น (รูปโหลดจากลิงก์ของที่เก็บไฟล์ที่ติดมากับคำตอบ ไม่ผ่าน API: CS:3082-3085)
    expect(log.calls.slice(callsBefore).map((call) => `${call.method} ${call.path}`), 'คำขอไป API ระหว่างเปิดและปิดแผ่นดูลายเซ็น').toEqual([]);
    expectReadOnly(guard, detail, 'เปิดและปิดแผ่นดูลายเซ็น');
  });
});

test.describe('contract signing: date of a signature', () => {
  test('the date of a signature on the English page is in the Gregorian year', { tag: ['@CSG-007', '@known-bug'] }, async ({ page, loginAs, guard }) => {
    // ตรวจเฉพาะภาษาอังกฤษ: ปี พ.ศ. ถูกต้องอยู่แล้วในหน้าภาษาไทย
    test.skip(UI_LOCALE !== 'en', 'ตรวจเฉพาะหน้าภาษาอังกฤษ (หน้าภาษาไทยแสดงปี พ.ศ. ได้)');

    // เงื่อนไขตั้งต้น: รายละเอียดของเอกสารที่ลงนามแล้ว บนหน้าภาษาอังกฤษ
    const detail = await openSignedDocument(page, loginAs, 'broker_appointment');
    const first = SIGNERS.broker_appointment[0];
    const signed = signedAt(detail.contract, first) as string;
    // ปีของเวลาลงนามตามเขตเวลาของเบราว์เซอร์ ซึ่งเป็นเขตเวลาเดียวกับที่หน้าเว็บใช้แสดง
    const year = await page.evaluate((iso) => new Date(iso).getFullYear(), signed);
    expect(Number.isInteger(year), 'อ่านปีจากเวลาลงนามของ API ไม่ได้').toBe(true);

    // ขั้นที่ 1: อ่านวันเวลาหลัง ✓ ของแถวแรก
    let status = '';
    await expect
      .poll(async () => (status = (await rowsOf(detail.docs))[0]?.status ?? ''), { message: 'แถวแรกของการ์ดลงนามต้องขึ้น ✓' })
      .toContain(SIGNED_MARK);
    expectReadOnly(guard, detail, 'อ่านวันเวลาของลายเซ็น');

    // ค่าที่คาด: ปีที่แสดงเป็นปี ค.ศ. ของเวลาลงนาม ไม่ใช่ปี พ.ศ. (ค.ศ. + 543)
    //   ที่มา: ข้ออนุมานที่ Aof อนุมัติ 16 พ.ย. 2026 (ทางที่ 1 ของ CSG-007): หน้าภาษาอังกฤษควรใช้รูปแบบของภาษาอังกฤษ
    //   เหมือนวันที่บนการ์ดเอกสารของหน้าเดียวกัน (SG33: LIB:33-34 ใช้ localeTag(locale))
    //   ผลรัน 16 พ.ย. 2026 ที่ 49df02b: หน้าภาษาอังกฤษแสดง "✓ 12/11/2569 14:11:43" เพราะ CS:3061 ใช้ toLocaleString("th-TH") ตายตัว (SG17)
    //   Aof ตัดสินว่าเป็นบั๊กเมื่อ 16 พ.ย. 2026 (WEB-025)
    // test.fail อยู่ตรงนี้เพื่อให้ความล้มของขั้นเตรียมข้างบนยังทำให้ข้อนี้แดง (แบบเดียวกับ CCR-012 ใน agent-contracts-create.spec.ts)
    test.fail(true, 'WEB-025: วันเวลาของลายเซ็นในการ์ดลงนามแสดงแบบไทยและปี พ.ศ. ในหน้าภาษาอังกฤษ (ContractsScreen.tsx:3061 ใช้ th-TH ตายตัว)');
    expect(status, 'วันเวลาของลายเซ็นในหน้าภาษาอังกฤษต้องเป็นปี ค.ศ.').toContain(String(year));
    expect(status, 'วันเวลาของลายเซ็นในหน้าภาษาอังกฤษต้องไม่เป็นปี พ.ศ.').not.toContain(String(year + 543));
  });
});
