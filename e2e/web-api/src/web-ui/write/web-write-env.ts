import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestInfo } from '@playwright/test';
import { makeRunId, TEAM_DB_WRITES_AGREED, WRITE_SWITCH } from '../../write/write-guard';
import type { LeadRow, StagingApi, ViewingRow } from './staging-api';

/**
 * ค่าตั้งและข้อมูลถาวรของเทสเขียนข้อมูลบนเว็บ (tests/web-ui-write, playwright.web-ui-write.config.ts)
 *
 * ใช้ข้อมูลถาวรชุดเดียวกับ tests/write (src/write/qa-dataset.ts ที่ qa/e2e 74b46f4) ค่าคัดลอกมา ไม่ import
 *   เพราะ qa-dataset.ts โหลดตัวเรียก API ของชุด API ด้วย
 * ลีดและห้องลบไม่ได้ (ไม่มีเส้นทางลบใน apps/api/src/agent/leads/agent-leads.controller.ts และ agent/rooms/agent-rooms.controller.ts)
 *   เทสจึงไม่สร้างลีดหรือห้องถาวรเอง ถ้า staging ไม่มี ให้หยุดและถามทีมก่อน (แผน claude/nestyk-web-write-flows-plan-2026-11-06.md)
 */

/** ชื่อของลีดถาวร (src/write/qa-dataset.ts QA_LEAD_LABEL) */
export const QA_LEAD_LABEL = 'E2E-QA-LEAD-1';
/** เบอร์ของลีดถาวร (src/write/qa-dataset.ts QA_LEAD_PHONE) */
export const QA_LEAD_PHONE = '0000000000';
/** ชื่อประกาศของห้องถาวร (src/write/qa-dataset.ts QA_ROOM_LABEL) */
export const QA_ROOM_LABEL = 'E2E-QA-ROOM-1';
/** ป้ายที่ทุกข้อมูลของเทสขึ้นต้น */
export const E2E_PREFIX = 'E2E-';

/**
 * ผู้ติดต่อถาวรของห้องที่สร้างผ่านตัวช่วยบนเว็บ (RW2) Aof เลือก 9 พ.ย. 2026: รอบแรกสร้างผ่านฟอร์มผู้ติดต่อใหม่ของตัวช่วย รอบต่อไปเลือกคนเดิม
 * ไม่ใช้ผู้ติดต่อของห้องถาวร (E2E-QA-ROOM-1 Contact A) เพราะคำค้นห้องของ API ค้นชื่อผู้ติดต่อด้วย (qa-dataset.ts:228)
 *   ห้องของเว็บที่สะสมทุกรอบจะตรงกับคำค้น E2E-QA-ROOM จนเกิน 1 หน้า (50 ห้อง) แล้ว tests/write หยุด
 * ชื่อจึงต้องไม่มีคำว่า E2E-QA-ROOM เบอร์ 0000000009 ไม่ใช่เบอร์ของคนจริง และไม่ซ้ำกับเบอร์ของชุดข้อมูลถาวร (0000000000-0000000003)
 *   service ใช้แถวเดิมถ้าเบอร์ตรงกับผู้ติดต่อของนายหน้าคนนี้แล้วเขียนทับชื่อ (agent-rooms.service.ts:607-621) จึงตรวจก่อนทุกครั้งว่าเบอร์นี้ไม่ใช่ของคนอื่น
 */
export const WIZ_CONTACT_NAME = `${E2E_PREFIX}WIZ-CONTACT`;
export const WIZ_CONTACT_PHONE = '0000000009';

/** ตัวแปรที่ global-setup ของชุดเขียนบนเว็บตั้งเป็นรหัสรอบ */
export const WEB_WRITE_RUN_ID = 'E2E_WEB_WRITE_RUN_ID';

/** ตรวจตอนเริ่มทั้งชุด: ผู้รันตั้ง E2E_ALLOW_WRITES=yes และทีมตกลงเรื่องข้อมูล E2E- แล้ว (src/write/write-guard.ts) คืนรหัสรอบ */
export function assertWebWriteAllowed(): string {
  if (process.env[WRITE_SWITCH] !== 'yes') {
    throw new Error(`หยุด: เทสชุดนี้เขียนข้อมูลลง staging ต้องตั้ง ${WRITE_SWITCH}=yes เองก่อนรัน (ดู README หัวข้อ "เทสเขียนข้อมูลบนเว็บ")`);
  }
  if (!TEAM_DB_WRITES_AGREED) {
    throw new Error('หยุด: TEAM_DB_WRITES_AGREED เป็น false ใน src/write/write-guard.ts (ทีมยังไม่ตกลงหรือขอให้หยุดเขียนข้อมูล E2E-)');
  }
  return makeRunId();
}

/** รหัสรอบที่ global-setup ตั้ง (ถ้าไม่มี แปลว่าไม่ได้รันผ่าน npm run test:web-ui-write: หยุด) */
export function runId(): string {
  const value = process.env[WEB_WRITE_RUN_ID];
  if (!value) throw new Error(`หยุด: ไม่มี ${WEB_WRITE_RUN_ID} ต้องรันด้วย npm run test:web-ui-write`);
  return value;
}

export interface QaData {
  lead: LeadRow;
  roomId: number;
}

/**
 * หาลีดและห้องถาวรบน staging (ชื่อตรงทุกตัวอักษร ต้องเจอตัวละ 1) และตรวจสภาพก่อนเขียน
 * หยุดเมื่อ:
 *   - ไม่เจอ: staging กับฐานข้อมูลของ tests/write น่าจะเป็นคนละฐาน ต้องถามทีมก่อนสร้างข้อมูลถาวรบน staging
 *   - เจอมากกว่า 1: ต้องตรวจข้อมูลของ qa-agent ก่อน
 *   - ลีดเป็น booked (ย้อนไม่ได้) หรือมีนัดที่ยังไม่ถึงเวลาซึ่งไม่ได้มาจากเทส (note ไม่ขึ้นต้น E2E-)
 * นัด scheduled ที่ note ขึ้นต้น E2E- (ค้างจากรอบก่อนที่ล้มกลางทาง) ถูกยกเลิกที่นี่ก่อน
 */
export async function findQaData(api: StagingApi): Promise<QaData> {
  const leads = (await api.leads(QA_LEAD_LABEL)).items.filter((row) => row.name === QA_LEAD_LABEL);
  if (leads.length !== 1) {
    throw new Error(
      `หยุดก่อนเขียน: staging มีลีดชื่อ ${QA_LEAD_LABEL} ${leads.length} ราย (ต้องมี 1)` +
        (leads.length === 0 ? ' แปลว่า staging กับฐานข้อมูลของ tests/write น่าจะเป็นคนละฐาน ต้องถามทีมก่อนสร้างข้อมูลถาวรบน staging' : ''),
    );
  }
  const found = await api.listings(QA_ROOM_LABEL);
  if (found.total > found.items.length) {
    throw new Error(`หยุดก่อนเขียน: ค้นห้องด้วย ${QA_ROOM_LABEL} ได้ ${found.total} ห้อง เกิน 1 หน้า (คำค้นตรงชื่อผู้ติดต่อด้วย) ให้ตรวจห้องของ qa-agent ก่อน`);
  }
  const rooms = found.items.filter((row) => row.listingTitle === QA_ROOM_LABEL);
  if (rooms.length !== 1) {
    throw new Error(`หยุดก่อนเขียน: staging มีห้องชื่อ ${QA_ROOM_LABEL} ${rooms.length} ห้อง (ต้องมี 1)`);
  }
  let lead = await api.lead(leads[0].id);
  if (lead.phone !== QA_LEAD_PHONE) {
    throw new Error(`หยุดก่อนเขียน: ลีด ${QA_LEAD_LABEL} (id ${lead.id}) มีเบอร์ที่ไม่ใช่เบอร์ของชุดข้อมูล อาจไม่ใช่ลีดของเทส ให้ตรวจก่อน`);
  }
  if (lead.status === 'booked') throw new Error(`หยุดก่อนเขียน: ลีด ${QA_LEAD_LABEL} เป็น booked แล้ว (ย้อนไม่ได้) ต้องตรวจกับทีม`);
  // ลีดที่ค้างเป็น lost จากรอบก่อนที่ล้มกลางทาง: ย้ายกลับเป็น inprogress ก่อน (นัดสร้างไม่ได้ถ้าลีดปิด: lead-viewings.service.ts:122-124)
  if (lead.status === 'lost') lead = await api.markInProgress(lead.id);

  const viewings = await api.viewings(lead.id);
  const upcoming = viewings.filter((row) => row.status === 'scheduled' && Date.parse(row.scheduledAt) > Date.now());
  const foreign = upcoming.filter((row) => !(row.note ?? '').startsWith(E2E_PREFIX));
  if (foreign.length) {
    throw new Error(`หยุดก่อนเขียน: ลีด ${QA_LEAD_LABEL} มีนัดที่ไม่ได้มาจากเทส ${foreign.length} นัด (id ${foreign.map((row) => row.id).join(', ')})`);
  }
  await cancelTestViewings(api, upcoming);
  return { lead: await api.lead(lead.id), roomId: rooms[0].id };
}

/** ยกเลิกนัด scheduled ที่ note ขึ้นต้น E2E- (ใช้ทั้งตอนเตรียมและเก็บกวาด) คืนจำนวนที่ยกเลิก */
export async function cancelTestViewings(api: StagingApi, rows: ViewingRow[]): Promise<number> {
  const mine = rows.filter((row) => row.status === 'scheduled' && (row.note ?? '').startsWith(E2E_PREFIX));
  for (const row of mine) await api.updateViewing(row.id, { status: 'cancelled' });
  return mine.length;
}

/**
 * ช่องของลีดที่ฟอร์มแก้ลีดส่งไปทุกครั้ง (CreateLeadForm.tsx:463-483) และ :484-503 (งบ จำนวนผู้อยู่) ชื่อเดียวกับที่ GET คืน (toLead: agent-leads.service.ts:454-477)
 * PATCH เอาค่าที่ส่งทับของเดิมทีละช่อง (update :230-243) restoreLead จึงส่งค่าก่อนเทสของช่องที่เปลี่ยนกลับไปได้
 */
export const LEAD_FORM_FIELDS = [
  'firstName', 'lastName', 'phone', 'email', 'otherContacts', 'nationality', 'occupation', 'visaTypeId', 'desiredRoomTypeId',
  'leaseDurationMonths', 'budgetMin', 'budgetMax', 'occupantCount', 'hasPets', 'usesCar', 'isSmoker', 'province', 'locations',
  'pins', 'radiusKm', 'preferredLocation', 'moveInPlan', 'notes',
] as const;

/** ค่าของช่องที่ระบุ (ช่องที่ไม่มีถือเป็น null) */
export function pickFields(lead: LeadRow, fields: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((key) => [key, lead[key] ?? null]));
}

/**
 * ทำให้ลีดถาวรกลับเป็นค่าก่อนเทส (before) ทุกช่องที่ฟอร์มแก้ได้ และจบที่ inprogress
 * ไม่คืนแค่ notes เพราะถ้าฟอร์มส่งช่องอื่นผิด ค่าที่ผิดจะกลายเป็น "ค่าก่อนเทส" ของรอบถัดไป แล้วเทสจะผ่านเอง
 */
export async function restoreLead(api: StagingApi, id: number, before: LeadRow): Promise<LeadRow> {
  let lead = await api.lead(id);
  if (lead.status !== 'inprogress' && lead.status !== 'booked') lead = await api.markInProgress(id);
  const changed = LEAD_FORM_FIELDS.filter((key) => JSON.stringify(lead[key] ?? null) !== JSON.stringify(before[key] ?? null));
  if (changed.length) lead = await api.patchLead(id, pickFields(before, changed));
  return lead;
}

/**
 * งานเก็บกวาดของข้อที่กำลังรัน ให้ test.afterEach ของทุกไฟล์เรียก runCleanups
 * ไม่ใช้ finally ในตัวเทส: ถ้าข้อนั้นหมดเวลา Playwright ทิ้งตัวเทสที่ค้างอยู่ แล้วรัน afterEach ด้วยเวลาแยก (afterHooksSlot)
 *   ก่อนปิด page (node_modules/playwright/lib/worker/workerProcessEntry.js ที่ 1.63) finally ในตัวเทสจะทำงานหลังปิด page ซึ่งเรียก API ไม่ได้แล้ว
 */
const cleanups: Array<() => Promise<unknown>> = [];
// ข้อตกลง: ทุกไฟล์เทสที่เรียก onCleanup ต้องมี test.afterEach(runCleanups) ไม่อย่างนั้นงานค้างไปรันใน afterEach ของไฟล์อื่น
//   onCleanup จึงหยุดทันทีถ้ามีงานของข้อก่อนค้างอยู่ (แปลว่าข้อก่อนไม่มี afterEach)

let cleanupOwner: string | null = null;

export function onCleanup(task: () => Promise<unknown>, info: TestInfo): void {
  if (cleanups.length && cleanupOwner !== info.testId) {
    throw new Error('หยุด: มีงานเก็บกวาดของข้อก่อนค้างอยู่ ไฟล์เทสของข้อนั้นไม่ได้เรียก runCleanups ใน test.afterEach');
  }
  cleanupOwner = info.testId;
  cleanups.push(task);
}

/** ทำงานเก็บกวาดทุกงานแม้งานก่อนหน้าล้ม (ย้อนลำดับ) แล้วโยน error แรกถ้ามี */
export async function runCleanups(): Promise<void> {
  const errors: unknown[] = [];
  while (cleanups.length) {
    const task = cleanups.pop() as () => Promise<unknown>;
    await task().catch((error: unknown) => errors.push(error));
  }
  cleanupOwner = null;
  if (errors.length) throw errors[0];
}

/**
 * จำนวนลีดและห้องที่มีป้าย E2E- ก่อนรัน เก็บเป็นไฟล์ใต้ outputDir ของรอบนี้
 * ไม่เก็บในตัวแปร: ข้อที่แดงทำให้ Playwright เริ่ม worker ใหม่ ค่าในตัวแปรของไฟล์เทสจะหาย
 */
export type Footprint = { leads: number; listings: number };

function footprintFile(info: TestInfo): string {
  return join(info.project.outputDir, `footprint-before-${runId()}.json`);
}

export function saveFootprint(info: TestInfo, value: Footprint): void {
  mkdirSync(info.project.outputDir, { recursive: true });
  writeFileSync(footprintFile(info), JSON.stringify(value));
}

export function loadFootprint(info: TestInfo): Footprint | null {
  try {
    return JSON.parse(readFileSync(footprintFile(info), 'utf8')) as Footprint;
  } catch {
    return null;
  }
}
