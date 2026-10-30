import type { LeadDetail, LeadList, Paginated } from '../api/types';
import { expectJson } from '../support/http';
import type { WriterSession } from './write.fixture';

/**
 * ชุดข้อมูลถาวรของเทสที่เขียนข้อมูล และตัวนับรอยที่เทสทิ้งไว้
 *
 * ลีดไม่มีเส้นทางลบ เทสจึงไม่สร้างลีดใหม่ทุกรอบ แต่ใช้ลีดถาวร 1 รายของ qa-agent ซ้ำทุกรอบ
 *   - หาด้วยป้าย E2E-QA-LEAD-1 ถ้าเจอมากกว่า 1 รายให้หยุด
 *   - ถ้าไม่เจอ อ่านลีดทุกหน้าอีกรอบ และสร้างเฉพาะเมื่อไม่มีลีดที่ดูเหมือนลีดของเทสเลย (ดู findOrCreateQaLead)
 *   - ทุกข้อมูลที่เทสสร้างติดป้ายขึ้นต้นด้วย E2E- เพื่อให้นับและหาได้
 * เลขบรรทัดในไฟล์นี้หมายถึง apps/api/src/agent/leads/agent-leads.service.ts ที่ qa/e2e a7eb77c
 */

/** ป้ายที่ทุกข้อมูลของเทสใช้ขึ้นต้น */
export const E2E_PREFIX = 'E2E-';

/** ส่วนต้นของชื่อลีดทุกชุดของเทส ใช้หาลีดของเทสที่ถูกเปลี่ยนชื่อ */
const QA_LEAD_FAMILY = 'E2E-QA-LEAD';

/** ชื่อของลีดถาวร (ใส่เป็น firstName ไม่มีนามสกุล API จึงเก็บ name เป็นค่าเดียวกัน: validateLead บรรทัด 146-147) */
export const QA_LEAD_LABEL = 'E2E-QA-LEAD-1';

/** เบอร์ของลีดถาวร: ไม่ขึ้นต้นด้วย + API จึงเก็บตามที่ส่ง (validateLead บรรทัด 131-136) และไม่ใช่เบอร์ของคนจริง */
export const QA_LEAD_PHONE = '0000000000';

/** จำนวนสูงสุดต่อหน้าของ GET /agent/leads (list บรรทัด 262 ตัดที่ 50) */
export const MAX_LIMIT = 50;

/** ลีดของ qa-agent ที่ชื่อตรงกับป้ายของลีดถาวรทุกตัวอักษร (คำค้น q เทียบแบบมีคำนี้อยู่ จึงต้องกรองซ้ำ) */
async function findQaLeads(api: WriterSession): Promise<LeadDetail[]> {
  const list = await expectJson<LeadList>(await api.leads.list({ q: QA_LEAD_LABEL, limit: MAX_LIMIT }), 200);
  if (list.total > list.items.length) {
    throw new Error(`หยุด: ค้น ${QA_LEAD_LABEL} ได้ ${list.total} ราย เกิน 1 หน้า (${MAX_LIMIT}) ให้ตรวจลีดของ qa-agent ก่อน`);
  }
  return (list.items as LeadDetail[]).filter((lead) => lead.name === QA_LEAD_LABEL);
}

/**
 * เหตุผลที่ลีดดูเหมือนเป็นของเทส (ว่าง = ไม่ใช่)
 *   ชื่อหรือชื่อต้นมี E2E-QA-LEAD (ไม่สนตัวพิมพ์), ใช้เบอร์ของลีดถาวร,
 *   หรือ notes / lostReason ขึ้นต้นด้วย E2E- ซึ่งเทสเขียนทุกรอบ (จับลีดถาวรที่ถูกเปลี่ยนทั้งชื่อและเบอร์)
 */
function qaLeadReasons(lead: LeadDetail): string[] {
  const family = QA_LEAD_FAMILY.toLowerCase();
  const reasons: string[] = [];
  if (lead.name.toLowerCase().includes(family) || (lead.firstName ?? '').toLowerCase().includes(family)) reasons.push('ชื่อ');
  if (lead.phone === QA_LEAD_PHONE) reasons.push('เบอร์');
  if ((lead.notes ?? '').startsWith(E2E_PREFIX)) reasons.push('notes');
  if ((lead.lostReason ?? '').startsWith(E2E_PREFIX)) reasons.push('lostReason');
  return reasons;
}

/**
 * หาลีดถาวร ถ้ายังไม่มีให้สร้าง
 * คืนลีดที่อ่านจาก GET /agent/leads/:id หรือคำตอบของการสร้าง และบอกว่ารอบนี้สร้างใหม่หรือไม่
 * onCreated ถูกเรียกทันทีที่ API ตอบว่าสร้างแล้ว ก่อนตรวจผล ตัวนับรอยจึงรู้ว่ารอบนี้สร้าง แม้การตรวจหลังสร้างจะหยุด
 */
export async function findOrCreateQaLead(
  api: WriterSession,
  onCreated: () => void,
): Promise<{ lead: LeadDetail; created: boolean }> {
  // ขั้นที่ 1: ค้นด้วยป้าย
  const found = await findQaLeads(api);
  if (found.length > 1) {
    throw new Error(
      `หยุด: qa-agent มีลีดชื่อ ${QA_LEAD_LABEL} ${found.length} ราย (id ${found.map((lead) => lead.id).join(', ')}) ต้องมีแค่ 1 ราย\n` +
        'ลีดลบไม่ได้ ให้แจ้งทีมว่ารายไหนเป็นของเทส ก่อนรันอีกครั้ง',
    );
  }
  if (found.length === 1) {
    const lead = await expectJson<LeadDetail>(await api.leads.getById(found[0].id), 200);
    if (lead.phone !== QA_LEAD_PHONE) {
      throw new Error(`หยุด: ลีด ${QA_LEAD_LABEL} (id ${lead.id}) มีเบอร์ที่ไม่ใช่เบอร์ของชุดข้อมูล อาจไม่ใช่ลีดของเทส ให้ตรวจก่อน`);
    }
    return { lead, created: false };
  }

  // ขั้นที่ 2: ค้นไม่เจอ ให้อ่านลีดทุกหน้าโดยไม่ใช้คำค้นก่อนสร้าง ถ้าเจอลีดที่ดูเหมือนของเทส (ถูกเปลี่ยนชื่อ หรือคำค้นของ API พัง) ให้หยุด
  //   เพราะลีดลบไม่ได้ ถ้าสร้างทุกครั้งที่หาไม่เจอ ลีดจะเพิ่มขึ้นรอบละ 1 ราย และตัวนับรอยยอมให้เพิ่ม 1 ในรอบที่สร้าง จึงจับไม่ได้
  const similar = (await scanAllLeads(api))
    .map((lead) => ({ id: lead.id, reasons: qaLeadReasons(lead) }))
    .filter((match) => match.reasons.length > 0);
  if (similar.length > 0) {
    throw new Error(
      `หยุด: ค้นด้วย q=${QA_LEAD_LABEL} ไม่เจอลีดถาวร แต่อ่านทุกหน้าแล้วเจอลีดที่อาจเป็นของเทส ` +
        `(${similar.map((match) => `id ${match.id} ตรงที่ ${match.reasons.join(', ')}`).join(' ; ')})\n` +
        `ลีดถาวรอาจถูกแก้ชื่อหรือเบอร์ คำค้นของ GET /agent/leads อาจทำงานผิด หรือเป็นลีดของทีมที่บังเอิญตรง ไม่ได้สร้างลีดใหม่ ให้ตรวจก่อน ` +
        `(ลีดถาวรต้องชื่อ ${QA_LEAD_LABEL} ไม่มีนามสกุล เบอร์ ${QA_LEAD_PHONE})`,
    );
  }

  // ขั้นที่ 3: สร้าง แล้วตรวจว่าที่บันทึกตรงกับที่ส่ง (ถ้าไม่ตรง รอบหน้าจะหาไม่เจอแล้วสร้างซ้ำ)
  const lead = await expectJson<LeadDetail>(
    await api.leadsWrite.create({ firstName: QA_LEAD_LABEL, phone: QA_LEAD_PHONE }),
    201,
  );
  onCreated();
  if (lead.name !== QA_LEAD_LABEL || lead.phone !== QA_LEAD_PHONE || lead.status !== 'new') {
    throw new Error(
      `หยุด: สร้างลีดถาวรแล้ว (id ${lead.id}) แต่ API บันทึกชื่อ เบอร์ หรือสถานะไม่ตรงกับที่ส่ง รอบหน้าจะหาลีดนี้ไม่เจอ\n` +
        'ห้ามรันซ้ำ ให้แจ้งทีมพร้อม id นี้',
    );
  }
  return { lead, created: true };
}

/** จำนวนหน้าสูงสุดที่อ่านตอนตรวจซ้ำก่อนสร้าง (50 x 40 = 2,000 ลีด) เกินนี้ให้หยุด */
const MAX_SCAN_PAGES = 40;

/** อ่านลีดของ qa-agent ทุกหน้าโดยไม่ใช้คำค้น เรียงตามเวลาสร้าง (created_asc เรียงด้วย created_at แล้ว id: applyLeadSort บรรทัด 424-426) */
async function scanAllLeads(api: WriterSession): Promise<LeadDetail[]> {
  const leads: LeadDetail[] = [];
  for (let page = 1; ; page += 1) {
    if (page > MAX_SCAN_PAGES) throw new Error(`หยุด: qa-agent มีลีดเกิน ${MAX_SCAN_PAGES * MAX_LIMIT} ราย ตรวจซ้ำก่อนสร้างลีดถาวรไม่ได้`);
    const list = await expectJson<LeadList>(await api.leads.list({ page, limit: MAX_LIMIT, sort: 'created_asc' }), 200);
    leads.push(...(list.items as LeadDetail[]));
    if (page * MAX_LIMIT >= list.total || list.items.length === 0) return leads;
  }
}

/** รอยของเทส: จำนวนข้อมูลของ qa-agent ที่มีคำว่า E2E- (ลีด: ชื่อ เบอร์ ทำเล ; ห้อง: ชื่อโครงการ ชื่อประกาศ ผู้ติดต่อ) */
export interface Footprint {
  leads: number;
  listings: number;
  /** ลีดทั้งหมดของ qa-agent ใช้พิมพ์ประกอบเท่านั้น ไม่ตรวจ เพราะคนในทีมเพิ่มลีดให้ qa-agent ระหว่างรันได้ */
  allLeads: number;
}

/** นับรอยของเทส ใช้เทียบก่อนกับหลังรัน: รอบปกติต้องเท่าเดิม รอบที่สร้างลีดถาวรเพิ่มได้ 1 ลีด */
export async function countFootprint(api: WriterSession): Promise<Footprint> {
  const leads = await expectJson<LeadList>(await api.leads.list({ q: E2E_PREFIX, limit: 1 }), 200);
  const listings = await expectJson<Paginated<unknown>>(await api.listings.list({ q: E2E_PREFIX, limit: 1 }), 200);
  const all = await expectJson<LeadList>(await api.leads.list({ limit: 1 }), 200);
  return { leads: leads.total, listings: listings.total, allLeads: all.total };
}
