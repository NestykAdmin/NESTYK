import type { Page } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { RoomsPage, ROOMS_VIEW_KEY } from '../../src/web-ui/pages/rooms.page';
import { enNumber } from '../../src/web-ui/pages/leads.page';
import { FLOW, fill } from '../../src/web-ui/labels';
import { ApiLog, apiPathOf, okJson, waitForApi } from '../../src/web-ui/support/api';
import { watchForRequest } from '../../src/web-ui/support/wait';

/**
 * หน้าห้องของนายหน้าบนจอกว้าง (แผน claude/nestyk-web-flows-readonly-plan-2026-11-06.md ข้อ R1-R5)
 * โค้ด: apps/consumer-app/components/agent-web/AgentRoomsPage.web.tsx, AgentRoomDetailModal.web.tsx
 *   และ lib/agent-room-filters.ts ที่ qa/e2e d6370ee (แอปเท่ากับ 648dd28)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web และเรียก API ของ staging, ตั้ง E2E_QA_AGENT_PASSWORD
 * ทุกข้ออ่านอย่างเดียว: ไม่กดปุ่มแก้ไข แชร์ หรือเพิ่มห้องในหน้าต่างรายละเอียด
 * มุมมอง Table/Cards เก็บใน localStorage ของเบราว์เซอร์เทสเท่านั้น
 */

/** เฉพาะส่วนของคำตอบ GET /agent/listings ที่เทสใช้ (lib/agent-listings-api.ts:5-51) */
interface RoomsResult {
  items: { id: number; roomStatusCode: string | null; prices: { price: number }[] }[];
  total: number;
}

const PAGE_SIZE = 24; // AgentRoomsPage.web.tsx:41

/**
 * ค่าเช่าที่แสดงในแต่ละแถวตามลำดับบนหน้า อ่านจากเซลล์ .awr-price (AgentRoomsPage.web.tsx:240-249 แสดง "—" เป็น .awr-none ถ้าไม่มีราคา)
 * null = แถวนั้นแสดง "—" ตัวเลขอ่านจากข้อความ เช่น "฿12,000" เป็น 12000
 */
async function shownPrices(rooms: RoomsPage): Promise<(number | null)[]> {
  const texts = await rooms.rows.evaluateAll((rows) => rows.map((row) => row.querySelector('.awr-price')?.textContent ?? null));
  return texts.map((text) => (text === null ? null : Number(text.replace(/[^\d.]/g, ''))));
}

async function shownRowIds(rooms: RoomsPage): Promise<string[]> {
  return rooms.rows.evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid') ?? ''));
}

/** ตารางต้องแสดงแถวตรงกับคำตอบ ทั้งจำนวนและลำดับ และตัวนับต้องเท่ากับ total */
async function expectTableMatches(rooms: RoomsPage, result: RoomsResult): Promise<void> {
  await expect(rooms.count).toHaveText(fill(FLOW.roomsCount, { count: enNumber(result.total) }));
  await expect(rooms.rows).toHaveCount(result.items.length);
  // รอจนหน้าวาดตามคำตอบนี้ (คำตอบถึง Playwright ก่อนที่แอปจะ setState: AgentRoomsPage.web.tsx:124-136)
  await expect
    .poll(() => shownRowIds(rooms), { message: 'ลำดับแถวบนหน้าต้องตรงกับลำดับในคำตอบของ API' })
    .toEqual(result.items.map((room) => `rooms.table.row.${room.id}`));
}

async function openRooms(page: Page, loginAs: (role: 'agent', options?: { next?: string }) => Promise<void>): Promise<{ result: RoomsResult; query: URLSearchParams }> {
  // มุมมองเริ่มต้นเป็นตาราง เว้นแต่ localStorage จำ grid ไว้ (:45-51) แต่ละข้อเริ่มจาก context ใหม่ จึงเป็นตารางเสมอ
  const first = waitForApi(page, 'GET', '/agent/listings');
  await loginAs('agent', { next: '/agent/rooms' });
  const response = await first;
  return { result: await okJson<RoomsResult>(response), query: new URL(response.url()).searchParams };
}

test('the first page shows the rooms and the total from the API', async ({ page, loginAs }) => {
  // ขั้นที่ 1: คำขอแรกเป็นหน้า 1 ขนาด 24 เรียงตามที่แก้ล่าสุด (:84, :110-124)
  const { result, query } = await openRooms(page, loginAs);
  expect(Object.fromEntries(query)).toMatchObject({ page: '1', limit: String(PAGE_SIZE), sort: 'updated_desc' });
  expect(query.has('roomStatus'), 'คำขอแรกต้องไม่กรองสถานะห้อง').toBe(false);

  // ขั้นที่ 2: ตารางตรงกับคำตอบ ไม่มีห้อง ต้องขึ้นสถานะว่าง
  const rooms = new RoomsPage(page);
  await expect(rooms.table).toBeVisible();
  await expectTableMatches(rooms, result);
  if (result.total === 0) await expect(rooms.state('empty')).toBeVisible();
});

test('choosing Available asks for roomStatus=available and every row says Available', async ({ page, loginAs }) => {
  const { result } = await openRooms(page, loginAs);
  const rooms = new RoomsPage(page);
  await expectTableMatches(rooms, result);

  // ขั้นที่ 1: เลือกสถานะ available (:394-406) หน้าเว็บขอใหม่ที่หน้า 1
  const filtered = waitForApi(page, 'GET', '/agent/listings', { query: (query) => query.get('roomStatus') === 'available' });
  await rooms.availability.selectOption('available');
  const response = await filtered;
  expect(new URL(response.url()).searchParams.get('page')).toBe('1');
  const next = await okJson<RoomsResult>(response);

  // ขั้นที่ 2: API ต้องส่งเฉพาะห้องสถานะ available และป้ายของทุกแถวต้องเป็น "Available" (roomStatusText: lib/agent-room-filters.ts:141-142)
  expect(next.items.filter((room) => room.roomStatusCode !== 'available').map((room) => room.id), 'id ของห้องที่สถานะไม่ใช่ available').toEqual([]);
  await expectTableMatches(rooms, next);
  for (const room of next.items) {
    await expect(rooms.row(room.id), `ป้ายสถานะของห้อง id ${room.id}`).toContainText(FLOW.roomAvailable);
  }
  if (next.items.length === 0) await expect(rooms.state('filtered')).toBeVisible();
});

test('searching sends q with page 1', async ({ page, loginAs }) => {
  // คำค้นไม่มีที่มาจากข้อมูล (ห้องไม่มีข้อมูลส่วนตัว แต่ชื่อห้องเปลี่ยนได้) ตรวจเฉพาะว่าหน้าเว็บส่งคำค้นและแสดงตามคำตอบ
  const { result } = await openRooms(page, loginAs);
  const rooms = new RoomsPage(page);
  await expectTableMatches(rooms, result);
  const searched = waitForApi(page, 'GET', '/agent/listings', { query: (query) => query.get('q') === 'e2e-no-such-room' });
  await rooms.search.fill('e2e-no-such-room');
  const response = await searched;
  expect(new URL(response.url()).searchParams.get('page')).toBe('1');
  const next = await okJson<RoomsResult>(response);
  await expectTableMatches(rooms, next);
  if (next.items.length === 0) await expect(rooms.state('filtered')).toBeVisible();
});

test('sorting by rent asks for price_asc and the rents shown in the rows go up', async ({ page, loginAs }) => {
  const { result } = await openRooms(page, loginAs);
  test.skip(result.total < 2, 'มีห้องไม่ถึง 2 ห้อง เรียงไม่ได้');
  const rooms = new RoomsPage(page);
  await expectTableMatches(rooms, result);

  // ขั้นที่ 1: กดหัวคอลัมน์ "Rent / month" ครั้งแรกเรียงขึ้น (WebTable.tsx:59-62) หน้าเว็บส่ง sort=price_asc (:475-478 toApiSort)
  const sorted = waitForApi(page, 'GET', '/agent/listings', { query: (query) => query.get('sort') === 'price_asc' });
  await rooms.sortByPrice.click();
  const next = await okJson<RoomsResult>(await sorted);
  await expectTableMatches(rooms, next);

  // ขั้นที่ 2: ค่าเช่าที่อ่านจากเซลล์ของแต่ละแถว ต้องไม่ลดลงตามลำดับของแถว
  // API เรียงด้วย MIN(price) ของทุกแถวราคา (apps/api/src/agent/listings/agent-listings.service.ts:25) ส่วนหน้าเว็บตัดราคา 0 ทิ้ง
  // (listPrice: lib/agent-room-filters.ts:119-122) ถ้าห้องหนึ่งมีราคา 0 ปนอยู่ ลำดับที่เห็นอาจไม่เรียง (ข้อสงสัยข้อ 5 ของแผน)
  const shown = await shownPrices(rooms);
  const priced = shown.filter((price): price is number => price !== null);
  const dashes = shown.map((price, index) => (price === null ? index + 1 : null)).filter((row) => row !== null);
  test.info().annotations.push({ type: 'แถวที่แสดง "—"', description: dashes.length ? `แถวที่ ${dashes.join(', ')} จาก ${shown.length}` : 'ไม่มี' });
  expect(priced, 'ราคาที่แสดงตามลำดับแถว (เฉพาะแถวที่มีราคา)').toEqual([...priced].sort((a, b) => a - b));
});

test('Cards view stays after reloading and switching view does not ask the API again', async ({ page, loginAs }) => {
  const log = new ApiLog(page);
  const { result } = await openRooms(page, loginAs);
  const rooms = new RoomsPage(page);
  await expectTableMatches(rooms, result);

  // ขั้นที่ 1: สลับเป็น Cards การ์ดแสดง ไม่มีคำขอรายการห้องเพิ่ม (มุมมองไม่อยู่ใน dependency ของการโหลด :152)
  const listingsBefore = log.count('GET', '/agent/listings');
  const refetch = watchForRequest(page, (request) => request.method() === 'GET' && apiPathOf(request.url()) === '/agent/listings', 3_000);
  await rooms.viewButton('cards').click();
  await expect(rooms.grid).toBeVisible();
  await expect(rooms.viewButton('cards')).toHaveAttribute('aria-pressed', 'true');
  expect(await refetch, 'สลับมุมมองแล้วมีคำขอ GET /agent/listings เพิ่ม').toBe(false);
  expect(log.count('GET', '/agent/listings')).toBe(listingsBefore);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), ROOMS_VIEW_KEY)).toBe('grid');

  // ขั้นที่ 2: โหลดหน้าใหม่ ยังเป็น Cards (readView :45-51)
  const reloaded = waitForApi(page, 'GET', '/agent/listings');
  await page.reload();
  await okJson<RoomsResult>(await reloaded);
  await expect(rooms.grid.or(rooms.state('empty'))).toBeVisible();
  await expect(rooms.viewButton('cards')).toHaveAttribute('aria-pressed', 'true');
  await expect(rooms.table).toHaveCount(0);
});

test('a row opens Room details without changing the URL, and Esc closes it', async ({ page, loginAs }) => {
  const { result } = await openRooms(page, loginAs);
  test.skip(result.items.length === 0, 'ไม่มีห้องให้เปิด');
  const rooms = new RoomsPage(page);
  await expectTableMatches(rooms, result);
  const id = result.items[0].id;

  // ขั้นที่ 1: กดแถวแรก หน้าต่างรายละเอียดขอข้อมูลของห้องนั้น (fetchAgentRoom: lib/agent-listings-api.ts:183-186)
  const detail = waitForApi(page, 'GET', `/agent/listings/${id}`);
  await rooms.row(id).click();
  await okJson<unknown>(await detail);
  await expect(rooms.detailTitle).toHaveText(FLOW.roomDetails);
  await expect(page).toHaveURL((url) => url.pathname === '/agent/rooms' && url.search === '');

  // ขั้นที่ 2: ให้โฟกัสอยู่ในหน้าต่าง แล้วกด Esc หน้าต่างปิด (onKeyUpCapture :133-143) URL ไม่เปลี่ยน
  await rooms.detailBack.focus();
  await page.keyboard.press('Escape');
  await expect(rooms.detail).toHaveCount(0);
  await expect(rooms.table).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === '/agent/rooms' && url.search === '');
});
