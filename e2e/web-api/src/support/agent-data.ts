import { expect } from '@playwright/test';
import type { ApiSession } from '../fixtures/api.fixture';
import type { LeadDetail, LeadList, ListingSummary, Paginated } from '../api/types';
import { expectJson } from './http';
import { MAX_PAGE_SIZE } from './pagination';

/**
 * อ่านข้อมูลของ qa-agent (อ่านอย่างเดียว) เพื่อเลือกห้องหรือลีดจริงที่เทสใช้ส่งคำขอที่ต้องถูกปฏิเสธ
 * ไม่ผูกกับ id ตายตัว เพราะข้อมูลในฐานข้อมูลของทีมเปลี่ยนได้
 */

/** หน้าสูงสุดที่อ่าน (50 x 20 = 1,000 รายการ) เกินนี้ให้เทสข้ามแทนการอ่านนาน */
const MAX_PAGES = 20;

/** id ของห้องหนึ่งห้องของ qa-agent (ห้องที่ GET /agent/listings คืนเป็นรายการแรก) */
export async function anyRoomId(agent: ApiSession): Promise<number> {
  const body = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit: 1 }), 200);
  expect(body.total, 'qa-agent ต้องมีห้องอย่างน้อย 1 ห้อง ถ้าเป็น 0 ให้แจ้งทีม (ห้ามสร้างข้อมูลเองในฐานข้อมูลของทีม)').toBeGreaterThan(0);
  return body.items[0]!.id;
}

/** ลีดทุกรายของ qa-agent (อ่านทุกหน้า เรียงตามเวลาสร้าง) คืน null ถ้ามีเกิน 1,000 ราย */
export async function allLeads(agent: ApiSession): Promise<LeadDetail[] | null> {
  const leads: LeadDetail[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const body = await expectJson<LeadList>(await agent.leads.list({ page, limit: MAX_PAGE_SIZE, sort: 'created_asc' }), 200);
    leads.push(...(body.items as LeadDetail[]));
    if (page * MAX_PAGE_SIZE >= body.total || body.items.length === 0) return leads;
  }
  return null;
}
