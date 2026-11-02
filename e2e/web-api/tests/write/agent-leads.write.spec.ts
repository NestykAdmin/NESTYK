import type { LeadDetail, LeadDisplayStatus, LeadList, LeadStatus } from '../../src/api/types';
import { expectJson } from '../../src/support/http';
import { countFootprint, findOrCreateQaLead, MAX_LIMIT, QA_LEAD_LABEL, type Footprint } from '../../src/write/qa-dataset';
import { expect, test, type WriterSession } from '../../src/write/write.fixture';

/**
 * เทสนำร่องที่เขียนข้อมูลจริง: แก้ลีดและเปลี่ยนสถานะลีด ด้วยบัญชี qa-agent
 *
 * สิ่งที่ต้องมีก่อนรัน (รายละเอียดใน README หัวข้อ "เทสที่เขียนข้อมูล")
 *   - รันด้วย E2E_ALLOW_WRITES=yes npm run test:write (playwright.write.config.ts) และตั้ง E2E_QA_AGENT_UUID
 *   - ทีมตกลงเรื่องข้อมูล E2E- ในฐานข้อมูล dev แล้ว (TEAM_DB_WRITES_AGREED = true ใน src/write/write-guard.ts ตั้งแต่ 2 พ.ย. 2026)
 *     ถ้าเปลี่ยนกลับเป็น false ต้องตั้ง E2E_WRITE_TARGET=own-db และ API ต้องต่อฐานข้อมูลที่ QA เป็นเจ้าของเท่านั้น
 *
 * ไฟล์นี้สร้างและแก้ข้อมูล
 *   - ลีดถาวร E2E-QA-LEAD-1 ของ qa-agent (src/write/qa-dataset.ts): รอบแรกสร้าง 1 ราย ลบไม่ได้ รอบต่อไปใช้ตัวเดิม
 *   - ทุกรอบแก้แถวของลีดนี้: notes, status, lost_reason และเวลาที่แก้ล่าสุด PATCH ยังลบแล้วใส่หมุดทำเลของลีดนี้ใหม่ (ตอนนี้ไม่มีหมุด)
 *   - เก็บกวาด: afterAll ทำให้ลีดจบที่ inprogress (สถานะ new ย้อนกลับไม่ได้ เพราะไม่มีเส้นทางที่เปลี่ยนกลับเป็น new)
 *   - ตรวจรอย: afterAll นับข้อมูลของ qa-agent ที่มีคำว่า E2E- ก่อนกับหลังรัน รอบปกติต้องเท่าเดิม รอบที่สร้างลีดถาวรเพิ่มได้ 1 ลีด
 *
 * รันทีละข้อตามลำดับ (serial) ถ้าข้อหนึ่งไม่ผ่าน ข้อที่เหลือไม่รัน แต่ afterAll ยังเก็บกวาด
 * ทุกข้อเตรียมสถานะที่ต้องใช้เอง จึงรันข้อเดียวด้วย -g ได้ ที่มาของพฤติกรรม: apps/api/src/agent/leads/agent-leads.service.ts ที่ qa/e2e a7eb77c
 * รหัส 201 ของ create, mark-lost และ mark-inprogress: ค่าเริ่มต้นของ @Post ใน NestJS (agent-leads.controller.ts บรรทัด 17, 20, 21 ไม่มี @HttpCode)
 */

test.describe.configure({ mode: 'serial' });

/** สถานะที่ตัวกรอง status รับ และเป็นชื่อช่องของ statusCounts (DISPLAY_STATUSES ใน agent-leads.service.ts บรรทัด 391) */
const DISPLAY_STATUSES: LeadDisplayStatus[] = ['new', 'inprogress', 'viewing', 'booked', 'lost'];

/** ลีดถาวรของรอบนี้ (ตั้งใน beforeAll หลังผ่านการตรวจลีดแล้วเท่านั้น) */
let leadId: number | undefined;
let createdThisRun = false;
let before: Footprint | undefined;

async function readLead(api: WriterSession, id: number): Promise<LeadDetail> {
  return expectJson<LeadDetail>(await api.leads.getById(id), 200);
}

function requireLeadId(): number {
  if (leadId === undefined) throw new Error('beforeAll ยังไม่ได้เตรียมลีดถาวร');
  return leadId;
}

/** จำนวนลีดของแต่ละสถานะ หลังย้ายลีด 1 รายจากสถานะ from ไป to */
function moved(counts: Record<LeadDisplayStatus, number>, from: LeadDisplayStatus, to: LeadDisplayStatus) {
  const next = { ...counts };
  next[from] -= 1;
  next[to] += 1;
  return next;
}

function sumOf(counts: Record<LeadDisplayStatus, number>): number {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

/** ลีดในผลค้นต้องมีคำค้นอยู่ในช่องใดช่องหนึ่งที่ API ค้น (list บรรทัด 274: ชื่อ เบอร์ ทำเล จังหวัด เขต ชื่อหมุด) */
function containsLabel(lead: LeadDetail): boolean {
  const raw = lead as unknown as Record<string, unknown>;
  const fields = [
    lead.name,
    lead.firstName,
    lead.lastName,
    lead.phone,
    lead.province ?? '',
    typeof raw.preferredLocation === 'string' ? raw.preferredLocation : '',
    ...lead.locations,
    ...lead.pins.map((pin) => pin.name),
  ];
  return fields.some((field) => field.toLowerCase().includes(QA_LEAD_LABEL.toLowerCase()));
}

/** ทำให้ลีดไม่ใช่ lost (ใช้ตอนเตรียมของข้อที่ต้องเห็นการเปลี่ยนเป็น lost) */
async function ensureNotLost(api: WriterSession, id: number): Promise<void> {
  if ((await readLead(api, id)).status === 'lost') {
    await expectJson<LeadDetail>(await api.leadsWrite.markInProgress(id), 201);
  }
}

test.beforeAll(async ({ writer }) => {
  // ขั้นที่ 1: นับรอยก่อนสร้างหรือแก้อะไร
  before = await countFootprint(writer);
  // ขั้นที่ 2: หาหรือสร้างลีดถาวร
  const { lead, created } = await findOrCreateQaLead(writer, () => {
    createdThisRun = true;
  });
  console.log(`[เทสเขียนข้อมูล] ลีดถาวร id ${lead.id} สถานะ ${lead.status}${created ? ' (สร้างใหม่รอบนี้)' : ''}`);
  // ขั้นที่ 3: ลีด booked เปลี่ยนสถานะไม่ได้ (409) และลีดที่มีนัดดูห้องจะนับเป็น viewing ซึ่งทำให้ข้อ statusCounts ผิด
  //   หยุดก่อนตั้ง leadId เพื่อให้ afterAll ไม่แตะลีดนี้
  if (lead.status === 'booked') throw new Error(`หยุด: ลีดถาวร id ${lead.id} ถูกจองแล้ว (booked) เทสเปลี่ยนสถานะไม่ได้ ให้ตรวจก่อน`);
  if (lead.nextViewingAt !== null) throw new Error(`หยุด: ลีดถาวร id ${lead.id} มีนัดดูห้อง เทสชุดนี้ต้องใช้ลีดที่ไม่มีนัด`);
  leadId = lead.id;
});

test.afterAll(async ({ writer }) => {
  // beforeAll หยุดก่อนนับรอย (เช่น API ไม่ตอบ) แปลว่ายังไม่ได้เขียนอะไร
  if (before === undefined) return;
  // ขั้นที่ 1: เก็บกวาด ให้ลีดจบที่ inprogress (ข้ามถ้า beforeAll หยุดก่อนรับลีด)
  let endStatus = '(ไม่ได้แตะลีด)';
  if (leadId !== undefined) {
    if ((await readLead(writer, leadId)).status !== 'inprogress') {
      await expectJson<LeadDetail>(await writer.leadsWrite.markInProgress(leadId), 201);
    }
    endStatus = (await readLead(writer, leadId)).status;
  }
  // ขั้นที่ 2: นับรอยหลังรัน (รอบที่สร้างลีดถาวรแล้วหยุดใน beforeAll ก็ยอมให้เพิ่ม 1 ลีด)
  const after = await countFootprint(writer);
  const allowedLeads = createdThisRun ? 1 : 0;
  console.log(
    `[เทสเขียนข้อมูล] สถานะสุดท้าย ${endStatus} | ลีดที่มี E2E- ${before.leads} -> ${after.leads} (เพิ่มได้ ${allowedLeads})` +
      ` | ห้องที่มี E2E- ${before.listings} -> ${after.listings} (เพิ่มได้ 0)` +
      ` | ลีดทั้งหมดของ qa-agent ${before.allLeads} -> ${after.allLeads} (ไม่ตรวจ)`,
  );
  if (leadId !== undefined) expect(endStatus, 'ลีดถาวรต้องจบที่ inprogress').toBe('inprogress');
  expect(after.leads - before.leads, 'จำนวนลีดที่มี E2E- ที่เพิ่มในรอบนี้').toBe(allowedLeads);
  expect(after.listings - before.listings, 'จำนวนห้องที่มี E2E- ที่เพิ่มในรอบนี้').toBe(0);
});

test('search by the dataset label returns only matching leads and the dataset lead once', async ({ writer }) => {
  const id = requireLeadId();
  // ขั้นที่ 1: ค้นด้วยป้าย
  const list = await expectJson<LeadList>(await writer.leads.list({ q: QA_LEAD_LABEL, limit: MAX_LIMIT }), 200);
  const items = list.items as LeadDetail[];
  // ขั้นที่ 2: เจอลีดถาวร 1 ครั้ง และมีลีดชื่อนี้ตรงทุกตัวอักษรรายเดียว
  expect(items.filter((lead) => lead.id === id)).toHaveLength(1);
  expect(items.filter((lead) => lead.name === QA_LEAD_LABEL)).toHaveLength(1);
  // ขั้นที่ 3: ทุกรายการต้องมีคำค้นจริง และ total นับเฉพาะรายการที่ตรงคำค้น (ผลค้นป้ายนี้ไม่เกิน 1 หน้า: findOrCreateQaLead หยุดถ้าเกิน)
  expect(items.filter((lead) => !containsLabel(lead)).map((lead) => lead.id)).toEqual([]);
  expect(list.total).toBe(items.length);

  // ขั้นที่ 4: ค้นแบบตัวพิมพ์เล็กต้องเจอเหมือนกัน (API ค้นด้วย ILIKE)
  const lower = await expectJson<LeadList>(await writer.leads.list({ q: QA_LEAD_LABEL.toLowerCase(), limit: MAX_LIMIT }), 200);
  expect(lower.items.filter((lead) => lead.id === id)).toHaveLength(1);
});

test('PATCH notes saves the notes and keeps every other field', async ({ writer, runId }) => {
  const id = requireLeadId();
  // ขั้นที่ 1: อ่านค่าเดิม ค่าใหม่ต้องต่างจากค่าเดิม ไม่อย่างนั้นเทสผ่านได้แม้ API ไม่บันทึก
  const beforePatch = await readLead(writer, id);
  const notes = `E2E-${runId}`;
  expect(beforePatch.notes).not.toBe(notes);

  // ขั้นที่ 2: แก้ notes อย่างเดียว
  const patched = await expectJson<LeadDetail>(await writer.leadsWrite.update(id, { notes }), 200);
  expect(patched.notes).toBe(notes);

  // ขั้นที่ 3: อ่านกลับ notes ต้องเป็นค่าใหม่ และทุกช่องอื่นต้องเหมือนเดิม
  const read = await readLead(writer, id);
  expect(read.notes).toBe(notes);
  expect({ ...read, notes: null }).toEqual({ ...beforePatch, notes: null });
});

test('PATCH with a status field does not change the status', async ({ writer }) => {
  const id = requireLeadId();
  const beforePatch = await readLead(writer, id);
  // ขั้นที่ 1: ส่งทุกสถานะที่ต่างจากสถานะปัจจุบัน ยกเว้น booked
  //   ไม่ส่ง booked เพราะถ้า API บันทึกจริง ลีดจะเปลี่ยนสถานะไม่ได้อีก (mark-lost และ mark-inprogress ตอบ 409: service บรรทัด 312, 322)
  //   ส่วน new กับ lost ถ้า API บันทึกผิด afterAll ย้อนเป็น inprogress ได้
  const candidates: LeadStatus[] = (['new', 'inprogress', 'lost'] as LeadStatus[]).filter((status) => status !== beforePatch.status);
  for (const status of candidates) {
    // ขั้นที่ 2: API รับคำขอ (200) แต่ไม่บันทึก status: leadColumns ไม่มีช่อง status (service บรรทัด 342-354)
    const patched = await expectJson<LeadDetail>(await writer.leadsWrite.update(id, { status }), 200);
    expect(patched.status, `PATCH status=${status}`).toBe(beforePatch.status);
    // ขั้นที่ 3: อ่านกลับ สถานะและเหตุผลต้องเหมือนเดิม
    const read = await readLead(writer, id);
    expect(read.status, `อ่านกลับหลัง PATCH status=${status}`).toBe(beforePatch.status);
    expect(read.lostReason).toBe(beforePatch.lostReason);
  }
});

test('mark-lost with a reason sets lost and saves the reason', async ({ writer, runId }) => {
  const id = requireLeadId();
  // ขั้นที่ 1: เตรียม ให้ลีดไม่ใช่ lost ก่อน จะได้เห็นว่าสถานะเปลี่ยนจริง
  await ensureNotLost(writer, id);
  const reason = `E2E-${runId} mark-lost`;

  // ขั้นที่ 2: เปลี่ยนเป็น lost พร้อมเหตุผล
  const lost = await expectJson<LeadDetail>(await writer.leadsWrite.markLost(id, { lostReason: reason }), 201);
  expect(lost.status).toBe('lost');
  expect(lost.lostReason).toBe(reason);

  // ขั้นที่ 3: อ่านกลับ
  const read = await readLead(writer, id);
  expect(read.status).toBe('lost');
  expect(read.lostReason).toBe(reason);
});

test('mark-inprogress sets inprogress and clears the lost reason', async ({ writer, runId }) => {
  const id = requireLeadId();
  // ขั้นที่ 1: เตรียม ให้ลีดเป็น lost ที่มีเหตุผลก่อน
  const lost = await expectJson<LeadDetail>(
    await writer.leadsWrite.markLost(id, { lostReason: `E2E-${runId} before mark-inprogress` }),
    201,
  );
  expect(lost.lostReason).not.toBeNull();

  // ขั้นที่ 2: เปลี่ยนเป็น inprogress
  const inprogress = await expectJson<LeadDetail>(await writer.leadsWrite.markInProgress(id), 201);
  expect(inprogress.status).toBe('inprogress');
  expect(inprogress.lostReason).toBeNull();

  // ขั้นที่ 3: อ่านกลับ
  const read = await readLead(writer, id);
  expect(read.status).toBe('inprogress');
  expect(read.lostReason).toBeNull();
});

test('statusCounts follow mark-lost and mark-inprogress', async ({ writer, runId }) => {
  const id = requireLeadId();
  // ขั้นที่ 1: เตรียม ให้ลีดไม่ใช่ lost ก่อน
  await ensureNotLost(writer, id);
  const start = (await readLead(writer, id)).status;
  // statusCounts นับเฉพาะลีดที่ตรงคำค้นและตัวกรองทำเล ก่อนใช้ตัวกรอง status (list บรรทัด 279-285)
  //   ข้อนี้จึงเทียบการเปลี่ยนของลีดถาวร ไม่ผูกกับจำนวนลีดทั้งหมดของ qa-agent
  const counts = async (status?: LeadDisplayStatus) =>
    expectJson<LeadList>(await writer.leads.list({ q: QA_LEAD_LABEL, limit: MAX_LIMIT, status }), 200);

  // ขั้นที่ 2: ก่อนเปลี่ยน ผลรวมของทุกสถานะต้องเท่ากับ total ของคำค้นนี้
  const c0 = await counts();
  expect(sumOf(c0.statusCounts)).toBe(c0.total);

  // ขั้นที่ 3: mark-lost แล้วลีดถาวรย้ายจากสถานะเดิมไป lost
  await expectJson<LeadDetail>(await writer.leadsWrite.markLost(id, { lostReason: `E2E-${runId} statusCounts` }), 201);
  const c1 = await counts();
  expect(c1.statusCounts).toEqual(moved(c0.statusCounts, start, 'lost'));
  expect(c1.total).toBe(c0.total);

  // ขั้นที่ 4: ตัวกรอง status=lost ต้องมีลีดถาวร
  const lostOnly = await counts('lost');
  expect(lostOnly.items.filter((lead) => lead.id === id)).toHaveLength(1);
  // ขั้นที่ 5: statusCounts ของทุกตัวกรอง status ต้องเท่ากับตอนไม่กรอง เพราะนับก่อนใช้ตัวกรอง status
  //   ต้องลองทุกสถานะ: ถ้าลีดที่ตรงคำค้นเป็น lost ทั้งหมด ตัวกรอง lost อย่างเดียวจะได้ค่าเท่ากันแม้ API นับหลังกรอง
  //   (ห้องทดลอง 30 ต.ค. 2026: mutant M12 ผ่านข้อนี้เมื่อลองแค่ lost) ส่วนตัวกรองที่ไม่ใช่ lost ไม่มีลีดถาวรซึ่งเป็น lost จึงต่างเสมอ
  for (const status of DISPLAY_STATUSES) {
    const filtered = status === 'lost' ? lostOnly : await counts(status);
    expect(filtered.statusCounts, `statusCounts เมื่อกรอง status=${status}`).toEqual(c1.statusCounts);
  }

  // ขั้นที่ 6: mark-inprogress แล้วลีดถาวรย้ายจาก lost ไป inprogress และหายจากผลกรอง lost
  await expectJson<LeadDetail>(await writer.leadsWrite.markInProgress(id), 201);
  const c2 = await counts();
  expect(c2.statusCounts).toEqual(moved(c1.statusCounts, 'lost', 'inprogress'));
  expect(c2.total).toBe(c0.total);
  const lostAfter = await counts('lost');
  expect(lostAfter.items.filter((lead) => lead.id === id)).toHaveLength(0);
});
