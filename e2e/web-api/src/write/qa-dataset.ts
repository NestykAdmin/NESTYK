import type { ListingsApi } from '../api/listings.api';
import type { AgentRoomsApi } from '../api/rooms.api';
import type { LeadDetail, LeadList, Paginated } from '../api/types';
import { expectJson, expectJsonQuiet } from '../support/http';
import { PNG_BLUE } from '../support/test-images';
// ต้องเป็น import type เท่านั้น: src/support/cross-agent.ts ซึ่งชุดอ่าน (tests/api) ใช้ import ไฟล์นี้ ถ้าโหลด write.fixture จริง ชุดอ่านจะโหลดตัวกันของชุดเขียนไปด้วย
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

// ---------------------------------------------------------------------------
// ห้องถาวรของเทสลิงก์แชร์ห้อง (tests/write/share-links.write.spec.ts)
// เลขบรรทัดในส่วนนี้หมายถึงไฟล์ใต้ apps/api/src/agent/ ที่ develop accb616
// ---------------------------------------------------------------------------

/** ชื่อประกาศของห้องถาวร (listingTitle) ชื่อโครงการคือ "<ชื่อนี้> Tower" */
export const QA_ROOM_LABEL = 'E2E-QA-ROOM-1';

/** ส่วนต้นของชื่อห้องทุกชุดของเทสลิงก์แชร์ ใช้หาห้องของเทสที่ถูกเปลี่ยนชื่อ และให้เทสข้ามนายหน้าไม่เลือกห้องนี้เป็นเป้าของการสั่งแก้ */
export const QA_ROOM_FAMILY = 'E2E-QA-ROOM';

/**
 * ผู้ติดต่อ 2 คนของห้องถาวร คนแรกเป็นผู้ติดต่อหลัก (rooms/agent-rooms.service.ts บรรทัด 303-311: is_primary = ลำดับแรก)
 * ทำไมต้องใช้เบอร์ที่ไม่มีผู้ติดต่อคนไหนของ qa-agent ใช้: ตอนสร้างห้อง API หาผู้ติดต่อเดิมด้วยเบอร์ แล้วเปลี่ยนชื่อและอีเมลของคนนั้นเป็นค่าที่ส่ง
 *   (resolveContactIds บรรทัด 607-620) ถ้าเบอร์ชนกับผู้ติดต่อของทีม ชื่อของคนนั้นจะถูกเขียนทับ จึงตรวจก่อนสร้างทุกครั้ง
 *   เบอร์ 0000000000 เป็นของลีดถาวร และ 0000000001 เป็นผู้ติดต่อของห้องในเทสวงจรเช่าห้อง จึงใช้ 0000000002 กับ 0000000003
 *   (เทสข้ามนายหน้าส่ง 0000000002 ในคำขอของ qa-agent2 ด้วย ไม่ชนกัน เพราะ API หาผู้ติดต่อเดิมเฉพาะของนายหน้าที่เรียก: บรรทัด 609-611)
 */
export const QA_ROOM_CONTACTS = [
  { name: `${QA_ROOM_LABEL} Contact A`, phone: '0000000002', email: 'e2e-room-contact-a@example.invalid' },
  { name: `${QA_ROOM_LABEL} Contact B`, phone: '0000000003', email: 'e2e-room-contact-b@example.invalid' },
] as const;

/** ราคาและเงื่อนไขของห้องถาวร (ใช้เป็นค่าที่คาดในหน้าแชร์สาธารณะ) */
export const QA_ROOM_TERMS = { contractTypeCode: 'monthly_12', price: 15_000, advanceRentMonths: 1, depositMonths: 2 } as const;

/** ที่ตั้งของห้องถาวร (พิกัดสมมติในกรุงเทพ) ใส่ครบทุกช่องที่หน้าแชร์ซ่อนเมื่อปิดส่วนที่ตั้ง (room-share-links.service.ts บรรทัด 309-345) */
export const QA_ROOM_LOCATION = {
  address: `${QA_ROOM_LABEL} Rd`,
  subdistrict: 'Khlong Tan',
  district: 'Khlong Toei',
  province: 'Bangkok',
  postalCode: '10110',
  latitude: 13.72,
  longitude: 100.56,
} as const;

/**
 * ข้อมูลเสริมของห้องถาวร ใส่ไว้เพื่อให้การตรวจ "ซ่อน" และ "ช่องภายใน" ในหน้าแชร์ไม่ผ่านเพียงเพราะห้องไม่มีค่า
 *   nearbyPin: สถานที่ใกล้เคียงแบบปักหมุดเอง 1 แห่ง (ชนิด custom_nearby ตามตัวตรวจ validateNearbyPlaces ใน places/nearby-places.ts บรรทัด 141-180)
 *   customFacility: สิ่งอำนวยความสะดวกที่พิมพ์เอง (แสดงเมื่อเปิดส่วน facilities: room-share-links.service.ts บรรทัด 293-302)
 *   nearbyOther และ document: ช่องภายในที่หน้าแชร์ต้องไม่เปิดเผยเสมอ (บรรทัด 368-374) document ต้องเป็น URL https (rooms/agent-rooms.service.ts บรรทัด 443-451)
 *     ใช้โดเมน example.invalid ซึ่งไม่มีอยู่จริง
 */
export const QA_ROOM_EXTRAS = {
  nearbyPin: { placeId: `custom-${QA_ROOM_LABEL.toLowerCase()}`, name: `${QA_ROOM_LABEL} Pin`, type: 'custom_nearby', latitude: 13.721, longitude: 100.561, distanceMeters: 0 },
  customFacility: `${QA_ROOM_LABEL} Extra`,
  nearbyOther: `${QA_ROOM_LABEL} nearby note`,
  document: { kind: 'other', mediaUrl: 'https://example.invalid/e2e-qa-room-1.pdf' },
} as const;

/** ห้องถาวรที่เทสใช้: id ของห้อง และ id ของผู้ติดต่อ 2 คนตามลำดับของ QA_ROOM_CONTACTS */
export interface QaRoom {
  roomId: number;
  contactIds: [number, number];
  /** ส่วนของ URL รูปหลัง /object/public/ (ใช้บันทึกเท่านั้น ไม่ใช่ URL เต็ม) เฉพาะรอบที่สร้างห้อง */
  uploadedPath: string | null;
}

interface RoomContactRow {
  id: number;
  name: string;
  phone: string;
}
interface MasterRow {
  id: number;
  code: string;
}
interface FacilityRow {
  code: string;
  groupCode: string;
}
interface ListingRow {
  id: number;
  listingTitle: string | null;
  isScoutRoom: boolean;
  property: { name: string } | null;
}

/** ผู้ติดต่อของ qa-agent ที่ใช้เบอร์ของห้องถาวร (อ่าน GET /agent/rooms/contacts ซึ่งมีข้อมูลของทีม จึงคืนเฉพาะแถวที่เบอร์ตรง) */
async function roomContactsByPhone(api: ShareRoomApis): Promise<RoomContactRow[]> {
  const rows = await expectJsonQuiet<RoomContactRow[]>(await api.rooms.contacts(), 200, 'GET /agent/rooms/contacts');
  const phones = new Set<string>(QA_ROOM_CONTACTS.map((contact) => contact.phone));
  return rows.filter((row) => phones.has(row.phone));
}

/** ห้องของ qa-agent ที่ชื่อประกาศ ชื่อโครงการ หรือชื่อผู้ติดต่อมีคำนี้ (GET /agent/listings q: listings/agent-listings.service.ts บรรทัด 223-227) */
async function roomsMatching(api: ShareRoomApis, q: string): Promise<ListingRow[]> {
  // หน้าละไม่เกิน 50 ห้อง (listMine ใน listings/agent-listings.service.ts บรรทัด 160)
  const list = await expectJsonQuiet<Paginated<ListingRow>>(await api.listings.list({ q, limit: 50 }), 200, `GET /agent/listings?q=${q}`);
  if (list.total > list.items.length) throw new Error(`หยุด: ค้นห้องด้วย ${q} ได้ ${list.total} ห้อง เกิน 1 หน้า (50) ให้ตรวจห้องของ qa-agent ก่อน`);
  return list.items;
}

/** เส้นทางที่ส่วนห้องถาวรใช้ (ส่ง ShareWriterSession ของ write.fixture.ts มาได้เลย) */
export interface ShareRoomApis {
  listings: ListingsApi;
  rooms: AgentRoomsApi;
}

/**
 * หาห้องถาวร ถ้ายังไม่มีให้สร้าง (ห้องไม่มีเส้นทางลบ จึงสร้างครั้งเดียวแล้วใช้ซ้ำ แบบเดียวกับลีดถาวร)
 *   - ห้องต้องเป็นห้อง scout ของ qa-agent เพราะลิงก์แชร์สร้างได้เฉพาะห้องแบบนี้ (listings/room-share-links.service.ts บรรทัด 78-84)
 *   - ห้องมีรูป 1 รูป ราคา 1 แถว สิ่งอำนวยความสะดวก 1 รายการ และผู้ติดต่อ 2 คน เพื่อให้เห็นว่าการซ่อนแต่ละส่วนในหน้าแชร์ทำงาน
 *     ถ้าห้องไม่มีรูป ข้อ "ซ่อนรูป" จะผ่านทั้งที่ระบบไม่ได้ซ่อน
 *   - รูปต้องอัปผ่าน POST /agent/rooms/media/upload ของ qa-agent เอง (ห้องรับเฉพาะรูปที่นายหน้าอัป: rooms/agent-rooms.service.ts บรรทัด 214)
 *     จึงมีไฟล์ใน Storage (bucket property-images) ค้างถาวร 1 ไฟล์ ถ้าการสร้างห้องล้มหลังอัปรูป ไฟล์นั้นค้างโดยไม่มีห้องใช้ (onUploaded บันทึก path ไว้)
 * หยุดก่อนเขียนเมื่อ: เจอห้องชื่อนี้มากกว่า 1 ห้อง, เจอห้องที่ชื่อขึ้นต้นด้วย E2E-QA-ROOM แต่ไม่ตรงทั้งชื่อ (อาจถูกแก้ชื่อ),
 *   หรือยังไม่มีห้องแต่มีผู้ติดต่อของ qa-agent ที่ใช้เบอร์ของห้องถาวรอยู่แล้ว (สร้างต่อจะเขียนทับชื่อของคนนั้น)
 */
export async function findOrCreateQaRoom(api: ShareRoomApis, onUploaded: (objectPath: string) => void): Promise<QaRoom & { created: boolean }> {
  // ขั้นที่ 1: ค้นด้วยชื่อ
  const family = await roomsMatching(api, QA_ROOM_FAMILY);
  const exact = family.filter((room) => room.listingTitle === QA_ROOM_LABEL);
  if (exact.length > 1) {
    throw new Error(`หยุด: qa-agent มีห้องชื่อ ${QA_ROOM_LABEL} ${exact.length} ห้อง (id ${exact.map((room) => room.id).join(', ')}) ต้องมีแค่ 1 ห้อง ห้องลบไม่ได้ ให้แจ้งทีมว่าห้องไหนเป็นของเทส`);
  }
  if (exact.length === 1) {
    const room = exact[0];
    if (!room.isScoutRoom || room.property?.name !== `${QA_ROOM_LABEL} Tower`) {
      throw new Error(`หยุด: ห้อง ${QA_ROOM_LABEL} (id ${room.id}) ไม่ใช่ห้อง scout หรือชื่อโครงการถูกแก้ ให้ตรวจก่อน`);
    }
    // ผู้ติดต่อของห้องจาก GET /agent/listings/:id (viewMine ใน listings/agent-listings.service.ts บรรทัด 353-400 เรียงผู้ติดต่อหลักก่อน)
    //   ต้องมี 2 คนตามลำดับของ QA_ROOM_CONTACTS และคนแรกเป็นผู้ติดต่อหลัก ไม่อย่างนั้นห้องถูกแก้ในแอป
    const detail = await expectJsonQuiet<{ contacts?: { id: number; name: string; phone: string; isPrimary: boolean }[] }>(
      await api.listings.getById(room.id),
      200,
      'GET /agent/listings/:id (ห้องถาวร)',
    );
    const linked = detail.contacts ?? [];
    const sameContacts =
      linked.length === QA_ROOM_CONTACTS.length &&
      QA_ROOM_CONTACTS.every((want, i) => linked[i].name === want.name && linked[i].phone === want.phone && linked[i].isPrimary === (i === 0));
    if (!sameContacts) {
      throw new Error(`หยุด: ห้อง ${QA_ROOM_LABEL} (id ${room.id}) มีอยู่ แต่ผู้ติดต่อของห้องไม่ใช่ 2 คนของห้องถาวร (ถูกแก้ชื่อ เบอร์ ผู้ติดต่อหลัก หรือจำนวนคน) ให้ตรวจก่อน`);
    }
    return { roomId: room.id, contactIds: [linked[0].id, linked[1].id], uploadedPath: null, created: false };
  }
  const renamed = family.filter((room) => room.listingTitle !== QA_ROOM_LABEL);
  if (renamed.length > 0) {
    throw new Error(
      `หยุด: ไม่เจอห้อง ${QA_ROOM_LABEL} แต่เจอห้องที่ชื่อโครงการ ชื่อประกาศ หรือชื่อผู้ติดต่อมี ${QA_ROOM_FAMILY} (id ${renamed.map((room) => room.id).join(', ')})\n` +
        'ห้องถาวรอาจถูกแก้ชื่อ ไม่ได้สร้างห้องใหม่ ให้ตรวจก่อน',
    );
  }

  // ขั้นที่ 2: ก่อนสร้าง ตรวจว่าไม่มีผู้ติดต่อของ qa-agent ใช้เบอร์ของห้องถาวร (บอกแค่ id ไม่พิมพ์ชื่อ เพราะอาจเป็นข้อมูลของทีม)
  const clash = await roomContactsByPhone(api);
  if (clash.length > 0) {
    throw new Error(
      `หยุด: ยังไม่มีห้อง ${QA_ROOM_LABEL} แต่ผู้ติดต่อของ qa-agent (id ${clash.map((row) => row.id).join(', ')}) ใช้เบอร์ของห้องถาวรอยู่แล้ว\n` +
        'ถ้าสร้างห้อง API จะเปลี่ยนชื่อผู้ติดต่อคนนั้น ไม่ได้สร้าง ให้ตรวจก่อน (ถ้าเป็นข้อมูลของทีม ให้เปลี่ยนเบอร์ใน QA_ROOM_CONTACTS)',
    );
  }

  // ขั้นที่ 3: ข้อมูลอ้างอิง
  const contractType = (await expectJsonQuiet<MasterRow[]>(await api.rooms.contractTypes(), 200, 'GET /agent/rooms/contract-types')).find((row) => row.code === QA_ROOM_TERMS.contractTypeCode);
  const roomType = (await expectJsonQuiet<MasterRow[]>(await api.rooms.roomTypes(), 200, 'GET /agent/rooms/room-types')).find((row) => row.code === 'studio');
  const propertyType = (await expectJsonQuiet<MasterRow[]>(await api.rooms.propertyTypes(), 200, 'GET /agent/rooms/property-types')).find((row) => row.code === 'condo');
  // studio และ condo คือรหัสที่ supabase/seed/masters.sql ใส่ไว้ (เทสวงจรเช่าห้องใช้ชุดเดียวกัน) ; สิ่งอำนวยความสะดวกใช้รายการแรกของแคตตาล็อก
  //   (listFacilities ใน rooms/agent-rooms.service.ts บรรทัด 89-109) เทสไม่ผูกกับรหัสใด จึงตรวจแค่ว่ามี 1 รายการ
  const facility = (await expectJsonQuiet<FacilityRow[]>(await api.rooms.facilities(), 200, 'GET /agent/rooms/facilities'))[0];
  if (!contractType || !roomType || !propertyType || !facility) {
    throw new Error('หยุด: ไม่มีประเภทสัญญา monthly_12 ประเภทห้อง studio ประเภทโครงการ condo หรือรายการสิ่งอำนวยความสะดวกในฐานข้อมูล ไม่ได้สร้างห้อง');
  }

  // ขั้นที่ 4: อัปรูป 1 รูป (สีพื้น ไม่มีข้อมูลของใคร) แล้วสร้างห้อง
  const photo = await expectJsonQuiet<{ mediaUrl: string }>(await api.rooms.uploadMultipart({ file: PNG_BLUE() }), 200, 'POST /agent/rooms/media/upload');
  const uploadedPath = photo.mediaUrl.split('/object/public/')[1] ?? '(ไม่ใช่ URL สาธารณะของ Storage)';
  onUploaded(uploadedPath);
  const createResponse = await api.rooms.create({
      visibility: 'private',
      listingTitle: QA_ROOM_LABEL,
      listingSourceCode: 'owner',
      roomTypeId: roomType.id,
      contacts: QA_ROOM_CONTACTS.map((contact) => ({ ...contact })),
      property: {
        name: `${QA_ROOM_LABEL} Tower`,
        propertyTypeId: propertyType.id,
        address: QA_ROOM_LOCATION.address,
        subdistrict: QA_ROOM_LOCATION.subdistrict,
        district: QA_ROOM_LOCATION.district,
        province: QA_ROOM_LOCATION.province,
        postalCode: QA_ROOM_LOCATION.postalCode,
        latitude: QA_ROOM_LOCATION.latitude,
        longitude: QA_ROOM_LOCATION.longitude,
      },
      latitude: QA_ROOM_LOCATION.latitude,
      longitude: QA_ROOM_LOCATION.longitude,
      prices: [{ contractTypeId: contractType.id, price: QA_ROOM_TERMS.price, advanceRentMonths: QA_ROOM_TERMS.advanceRentMonths, depositMonths: QA_ROOM_TERMS.depositMonths }],
      advanceRentMonths: QA_ROOM_TERMS.advanceRentMonths,
      depositMonths: QA_ROOM_TERMS.depositMonths,
      layout: [
        { code: 'bedroom', value: '1' },
        { code: 'bathroom', value: '1' },
      ],
      facilities: [{ code: facility.code, groupCode: facility.groupCode }],
      customFacilities: [QA_ROOM_EXTRAS.customFacility],
      nearbyPlaces: [{ ...QA_ROOM_EXTRAS.nearbyPin }],
      nearbyOther: QA_ROOM_EXTRAS.nearbyOther,
      documents: [{ ...QA_ROOM_EXTRAS.document }],
      medias: [{ mediaUrl: photo.mediaUrl, mediaType: 'image', isCover: true }],
    });
  // ถ้าสร้างห้องไม่สำเร็จ รูปที่อัปแล้วค้างใน Storage โดยไม่มีห้องใช้ และรอบถัดไปจะอัปรูปใหม่อีก จึงบอกให้หยุดก่อนรันซ้ำ
  if (createResponse.status() !== 201) {
    console.log(`[เทสเขียนข้อมูล] สร้างห้องถาวรไม่สำเร็จ (รหัส ${createResponse.status()}) รูปที่อัปแล้วค้างใน Storage: ${uploadedPath}`);
    throw new Error(
      `หยุด: อัปรูปของห้องถาวรแล้ว 1 ไฟล์ (path ใน annotation "ไฟล์ที่อัป" และบรรทัดข้างบน) แต่ POST /agent/rooms ได้รหัส ${createResponse.status()} (คาด 201)\n` +
        'ห้ามรันซ้ำก่อนแก้สาเหตุ เพราะทุกรอบจะอัปรูปค้างเพิ่ม 1 ไฟล์ ส่ง path นี้ให้ทีมลบ',
    );
  }
  const created = (await createResponse.json()) as { id: number; contactIds: number[] };
  if (created.contactIds.length !== 2) {
    throw new Error(`หยุด: สร้างห้องถาวรแล้ว (id ${created.id}) แต่ API ผูกผู้ติดต่อ ${created.contactIds.length} คน (คาด 2) ห้ามรันซ้ำ ให้แจ้งทีมพร้อม id นี้`);
  }
  return { roomId: created.id, contactIds: [created.contactIds[0], created.contactIds[1]], uploadedPath, created: true };
}
