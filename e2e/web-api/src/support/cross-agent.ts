import { expect, type APIResponse } from '@playwright/test';
import type { ApiClient } from '../api/api-client';
import { ContractsApi } from '../api/contracts.api';
import { LeadsApi } from '../api/leads.api';
import { ListingsApi } from '../api/listings.api';
import { TenantsApi } from '../api/tenants.api';
import { LeadViewingsApi } from '../api/viewings.api';
import { expectJson } from './http';
import { MAX_PAGE_SIZE } from './pagination';
import { QA_ROOM_FAMILY } from '../write/qa-dataset';

/**
 * ตัวช่วยของเทสข้ามนายหน้า (tests/api/cross-agent.spec.ts และ tests/write/cross-agent.write.spec.ts)
 *
 * เป้าหมายคือข้อมูลของ qa-agent ที่ติดป้าย E2E- (ข้อมูลที่ทีมตกลงให้เทสใช้ ฉบับที่ 8, 2 พ.ย. 2026)
 *   ลีดถาวร E2E-QA-LEAD-1 (tests/write/agent-leads.write.spec.ts) และข้อมูลของเทสวงจรเช่าห้อง (E2E-LC-<รหัสรอบ>)
 *   ห้องถาวร E2E-QA-ROOM-1 ของเทสลิงก์แชร์อยู่ในรายการห้องที่ตรวจ แต่ไม่ถูกเลือกเป็นห้องเป้าหมายของการสั่งแก้ (roomId)
 * ทุกฟังก์ชันในไฟล์นี้อ่านอย่างเดียวด้วยบัญชี qa-agent และไม่ผูกกับ id ตายตัว
 * ที่มาของตัวกรองตามนายหน้า (develop bc77a8b): ทุกเส้นทาง /agent/* ค้นด้วย created_by_user_id ของผู้ล็อกอิน
 *   ของนายหน้าอีกคนจึงได้ 404 ข้อความเดียวกับ id ที่ไม่มีจริง เช่น requireLead ใน agent-leads.service.ts บรรทัด 335-339
 */

/** ป้ายของข้อมูลเทสทุกชุด */
const E2E = 'E2E-';

/** id ที่ไม่มีจริงแน่นอน (ค่าสูงสุดที่ DatabaseIdPipe รับ) ใช้เทียบคำตอบ 404 */
export const NONEXISTENT_ID = 2147483647;

/** ตัวเรียกแบบอ่านอย่างเดียวที่ใช้หาเป้าหมาย สร้างจากตัวส่งคำขอของ qa-agent */
export interface TargetReaders {
  leads: LeadsApi;
  listings: ListingsApi;
  tenants: TenantsApi;
  contracts: ContractsApi;
  viewings: LeadViewingsApi;
}

export function targetReaders(client: ApiClient): TargetReaders {
  return {
    leads: new LeadsApi(client),
    listings: new ListingsApi(client),
    tenants: new TenantsApi(client),
    contracts: new ContractsApi(client),
    viewings: new LeadViewingsApi(client),
  };
}

/** ข้อมูล E2E- ของ qa-agent ที่ใช้เป็นเป้าหมาย (undefined = ยังไม่มีข้อมูลชนิดนั้น เทสที่ต้องใช้จะข้าม) */
export interface CrossAgentTargets {
  /** id ลีดที่ชื่อขึ้นต้นด้วย E2E- ทุกราย (ทุกหน้าของผลค้น q=E2E-) */
  leadIds: number[];
  /** ลีดที่ยังไม่ถูกจอง (ใช้กับคำขอแก้ลีด) */
  openLeadId?: number;
  /** ลีดที่มีผู้เช่าแล้ว (ใช้กับคำขอสร้างสัญญา) */
  bookedLeadId?: number;
  roomIds: number[];
  roomId?: number;
  tenantIds: number[];
  tenantId?: number;
  contractIds: number[];
  contractId?: number;
  viewingId?: number;
  /** ลีดที่เป็นเจ้าของนัด viewingId */
  viewingLeadId?: number;
}

interface NamedRow {
  id: number;
  name?: string | null;
  firstName?: string | null;
  status?: string;
  tenantId?: number | null;
}

/** หน้าสูงสุดที่อ่าน (50 x 20 = 1,000 รายการ) เกินนี้ให้หยุด เพราะข้อมูลเทสไม่ควรมากขนาดนั้น */
const MAX_PAGES = 20;

/** อ่านทุกหน้าของรายการแบบแบ่งหน้า (ค้นด้วย q=E2E-) */
async function allPages<T>(list: (query: { q: string; page: number; limit: number }) => Promise<APIResponse>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const body = await expectJson<{ items: T[]; total: number }>(await list({ q: E2E, page, limit: MAX_PAGE_SIZE }), 200);
    rows.push(...body.items);
    if (page * MAX_PAGE_SIZE >= body.total || body.items.length === 0) return rows;
  }
  throw new Error(`ข้อมูลที่ค้นด้วย ${E2E} มีเกิน ${MAX_PAGES * MAX_PAGE_SIZE} รายการ ให้แจ้งทีมก่อน (เทสข้ามนายหน้าหยุด)`);
}

/** อ่านเป้าหมายด้วยบัญชี qa-agent (อ่านอย่างเดียว) เลือกตัวที่ id มากที่สุดของแต่ละชนิด */
export async function findTargets(owner: TargetReaders): Promise<CrossAgentTargets> {
  const leads = (await allPages<NamedRow>((query) => owner.leads.list(query))).filter((lead) => (lead.name ?? lead.firstName ?? '').startsWith(E2E));
  const rooms = (await allPages<{ id: number; listingTitle?: string | null }>((query) => owner.listings.list(query))).filter((room) =>
    (room.listingTitle ?? '').startsWith(E2E),
  );
  const tenants = (await expectJson<NamedRow[]>(await owner.tenants.list(), 200)).filter((tenant) => (tenant.name ?? '').startsWith(E2E));
  const contracts = (await expectJson<{ id: number; property?: string | null }[]>(await owner.contracts.list(), 200)).filter((contract) =>
    (contract.property ?? '').startsWith(E2E),
  );
  const newest = (ids: number[]) => (ids.length ? Math.max(...ids) : undefined);
  const leadIds = leads.map((lead) => lead.id);
  const targets: CrossAgentTargets = {
    leadIds,
    openLeadId: newest(leads.filter((lead) => lead.status !== 'booked').map((lead) => lead.id)),
    bookedLeadId: newest(leads.filter((lead) => lead.status === 'booked').map((lead) => lead.id)),
    roomIds: rooms.map((room) => room.id),
    // ไม่ใช้ห้องถาวรของเทสลิงก์แชร์เป็นเป้าของการสั่งแก้ ถ้าระบบกันข้ามนายหน้าพัง PATCH ของ qa-agent2 จะเขียนทับห้องนั้น
    //   (ห้องลบไม่ได้ และเทสลิงก์แชร์เทียบหน้าแชร์กับค่าที่ใส่ตอนสร้าง) ห้องนี้ยังอยู่ใน roomIds สำหรับเทสอ่านที่ตรวจรายการ
    roomId: newest(rooms.filter((room) => !(room.listingTitle ?? '').startsWith(QA_ROOM_FAMILY)).map((room) => room.id)),
    tenantIds: tenants.map((tenant) => tenant.id),
    tenantId: newest(tenants.map((tenant) => tenant.id)),
    contractIds: contracts.map((contract) => contract.id),
    contractId: newest(contracts.map((contract) => contract.id)),
  };
  // นัดดูห้อง: ไล่ลีดจาก id มากไปน้อย หยุดที่ลีดแรกที่มีนัด (อ่านอย่างเดียว)
  for (const leadId of [...leadIds].sort((a, b) => b - a)) {
    const viewings = await expectJson<{ id: number }[]>(await owner.viewings.listForLead(leadId), 200);
    if (viewings.length) {
      targets.viewingId = Math.max(...viewings.map((viewing) => viewing.id));
      targets.viewingLeadId = leadId;
      break;
    }
  }
  return targets;
}

/**
 * คำตอบของนายหน้าอีกคนต้องเหมือนคำตอบของ id ที่ไม่มีจริงทุกอย่าง: รหัส 404 และเนื้อคำตอบเดียวกัน
 * เหตุผล: ถ้าข้อความต่างกัน (เช่น 403 หรือ "ไม่มีสิทธิ์") ผู้เรียกจะรู้ว่า id นั้นมีอยู่จริง
 * nonexistent ต้องเป็นคำขอเดียวกันทุกอย่าง ยกเว้น id ที่เปลี่ยนเป็น NONEXISTENT_ID
 * 404 ที่ NestJS ตอบเมื่อไม่มีเส้นทางนี้ (ข้อความ "Cannot POST /api/v1/...") ไม่นับ เพราะเส้นทางที่ส่ง id ในเนื้อคำขอ
 *   (POST /agent/deal-offers, /agent/tenants, /agent/contracts) ยิงทั้ง 2 คำขอไปที่ URL เดียวกัน ข้อความจึงเหมือนกันแม้เส้นทางถูกลบหรือเปลี่ยนชื่อ
 */
export async function expectSameAsNonexistent(foreign: APIResponse, nonexistent: APIResponse, what: string): Promise<void> {
  const foreignText = await foreign.text();
  const nonexistentText = await nonexistent.text();
  expect(foreign.status(), `${what}: ${foreign.url()} ตอบว่า ${foreignText.slice(0, 300)}`).toBe(404);
  expect(nonexistent.status(), `${what} (id ที่ไม่มีจริง): ${nonexistentText.slice(0, 300)}`).toBe(404);
  const body = JSON.parse(foreignText) as { message?: unknown };
  expect(String(body.message ?? ''), `${what}: 404 นี้มาจากเส้นทางที่ไม่มีอยู่ ไม่ใช่การตรวจเจ้าของ`).not.toMatch(/^Cannot [A-Z]+ \//);
  expect(body, `${what}: ข้อความต้องเหมือน id ที่ไม่มีจริง`).toEqual(JSON.parse(nonexistentText));
}
