import type { APIResponse } from '@playwright/test';
import type { Paginated } from '../api/types';
import { expectJson } from './http';

/** ค่าเริ่มต้นและเพดานของการแบ่งหน้า ตามที่ API กำหนด (ใช้เหมือนกันทั้งรายการห้องและรายการลีด) */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/**
 * กรณีขอบของค่า page และ limit ที่รายการแบบแบ่งหน้าทุกเส้นทางต้องรับได้โดยไม่ล้ม
 * ที่มาของตัวเลข: โค้ดของ API ปรับค่าที่ใช้ไม่ได้ให้เป็นค่าที่ปลอดภัยแทนการตอบ error
 * (หน้าต่ำสุด 1, ขนาดหน้าต่ำสุด 1, สูงสุด 50, ค่าเริ่มต้น 20)
 */
export const pagingFallbackCases = [
  { title: 'limit=0 falls back to the default page size', query: { limit: '0' }, expected: { page: 1, limit: DEFAULT_PAGE_SIZE } },
  { title: 'a negative limit becomes the minimum page size of 1', query: { limit: '-5' }, expected: { page: 1, limit: 1 } },
  { title: 'a non-numeric limit falls back to the default page size', query: { limit: 'abc' }, expected: { page: 1, limit: DEFAULT_PAGE_SIZE } },
  { title: 'a limit above the maximum is capped', query: { limit: '1000' }, expected: { page: 1, limit: MAX_PAGE_SIZE } },
  { title: 'page=0 falls back to the first page', query: { page: '0' }, expected: { page: 1, limit: DEFAULT_PAGE_SIZE } },
  { title: 'a negative page falls back to the first page', query: { page: '-1' }, expected: { page: 1, limit: DEFAULT_PAGE_SIZE } },
  { title: 'a non-numeric page falls back to the first page', query: { page: 'abc' }, expected: { page: 1, limit: DEFAULT_PAGE_SIZE } },
] as const;

/** ผลจากการเดินอ่านทุกหน้า */
export interface PageWalk {
  /** id ของทุกรายการ ตามลำดับที่ API ส่งมา */
  ids: number[];
  /** จำนวนรายการของแต่ละหน้า */
  pageSizes: number[];
  /** ค่า total ที่หน้าแรกรายงาน */
  total: number;
}

/**
 * เดินอ่านรายการตั้งแต่หน้าแรกจนถึงหน้าสุดท้าย ด้วยขนาดหน้าที่กำหนด
 * จำนวนหน้าคำนวณจาก total ของหน้าแรก: จำนวนหน้า = ปัดขึ้น(total / limit)
 */
export async function walkAllPages(
  list: (query: { page: number; limit: number }) => Promise<APIResponse>,
  limit: number,
): Promise<PageWalk> {
  const first = await expectJson<Paginated<{ id: number }>>(await list({ page: 1, limit }), 200);
  const pageCount = Math.ceil(first.total / limit);
  const ids = first.items.map((item) => item.id);
  const pageSizes = [first.items.length];
  for (let page = 2; page <= pageCount; page += 1) {
    const body = await expectJson<Paginated<{ id: number }>>(await list({ page, limit }), 200);
    ids.push(...body.items.map((item) => item.id));
    pageSizes.push(body.items.length);
  }
  return { ids, pageSizes, total: first.total };
}

/** จริงเมื่อค่าเรียงจากน้อยไปมาก (ค่าเท่ากันอยู่ติดกันได้) */
export function isAscending(values: number[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]! <= value);
}

/** จริงเมื่อค่าเรียงจากมากไปน้อย (ค่าเท่ากันอยู่ติดกันได้) */
export function isDescending(values: number[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]! >= value);
}
