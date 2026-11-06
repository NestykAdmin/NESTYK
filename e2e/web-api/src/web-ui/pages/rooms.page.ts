import type { Locator, Page } from '@playwright/test';
import { FLOW, fill } from '../labels';

/** ค่าที่ localStorage จำมุมมองของหน้าห้อง (AgentRoomsPage.web.tsx:42 'table' หรือ 'grid') */
export const ROOMS_VIEW_KEY = 'nestyk.agentRooms.view';

/**
 * หน้าห้องของนายหน้าบนจอกว้าง /agent/rooms (apps/consumer-app/components/agent-web/AgentRoomsPage.web.tsx ที่ 648dd28)
 * API: GET /agent/listings?page=&limit=24[&q][&roomStatus][&sort]... (lib/agent-listings-api.ts:79-88)
 */
export class RoomsPage {
  constructor(private readonly page: Page) {}

  /** รากของหน้า (:380 testid rooms.page) */
  get root(): Locator {
    return this.page.getByTestId('rooms.page');
  }

  /** ช่องค้น (:384-391 testid rooms.search) ค้นหลังหยุดพิมพ์ 250ms (:98-104) */
  get search(): Locator {
    return this.page.getByTestId('rooms.search');
  }

  /** ตัวเลือกสถานะห้อง (<select> :394-406 testid rooms.status ค่า '' = ทุกสถานะ) */
  get availability(): Locator {
    return this.page.getByTestId('rooms.status');
  }

  /** ตัวนับ "{count} rooms" (:432-434) */
  get count(): Locator {
    return this.root.locator('.awr-count');
  }

  /** ตาราง (มุมมอง Table: WebTable testid rooms.table :464-482) */
  get table(): Locator {
    return this.page.getByTestId('rooms.table');
  }

  /** แถวของตาราง (WebTable.tsx:169 testid rooms.table.row.<id>) */
  get rows(): Locator {
    return this.page.locator('[data-testid^="rooms.table.row."]');
  }

  row(id: number): Locator {
    return this.page.getByTestId(`rooms.table.row.${id}`);
  }

  /** ปุ่มเรียงตามค่าเช่าบนหัวคอลัมน์ (WebTable.tsx:224-234 aria-label "Sort by Rent / month" คลิกครั้งแรกเรียงขึ้น: nextSort :59-62) */
  get sortByPrice(): Locator {
    return this.table.getByRole('button', { name: fill(FLOW.sortBy, { column: FLOW.colPrice }), exact: true });
  }

  /** ปุ่มสลับมุมมอง (:435-438 ในกลุ่ม .awr-view aria-pressed บอกมุมมองที่เลือก) */
  viewButton(view: 'table' | 'cards'): Locator {
    return this.root
      .locator('.awr-view')
      .getByRole('button', { name: view === 'table' ? FLOW.roomsViewTable : FLOW.roomsViewCards, exact: true });
  }

  /** รายการการ์ด (มุมมอง Cards: <ul aria-label="Room listings"> :345) */
  get grid(): Locator {
    return this.page.getByRole('list', { name: FLOW.roomsTableLabel, exact: true });
  }

  /** ตัวแบ่งหน้า (:490 nav aria-label agent.listings.web.pages) */
  get pager(): Locator {
    return this.page.getByRole('navigation', { name: FLOW.pagerNav, exact: true });
  }

  state(kind: 'empty' | 'filtered' | 'error' | 'loading'): Locator {
    return this.page.getByTestId(`state.${kind}`);
  }

  /** หน้าต่างรายละเอียดห้อง (AgentRoomDetailModal.web.tsx:120-121 <section class="aw-shell ard-dialog">) ไม่มี URL ของตัวเอง */
  get detail(): Locator {
    return this.page.locator('section.ard-dialog');
  }

  /** หัวเรื่องของหน้าต่าง (<h1> :174-180 "Room details" เมื่อไม่ได้แก้ไข) */
  get detailTitle(): Locator {
    return this.detail.locator('.ard-header h1');
  }

  /** ปุ่มกลับของหน้าต่าง (:161-166 aria-label agent.createRoom.back) Esc ทำงานเมื่อโฟกัสอยู่ในหน้าต่าง (:133-143 onKeyUpCapture) */
  get detailBack(): Locator {
    return this.detail.locator('.ard-header').getByRole('button', { name: FLOW.back, exact: true });
  }
}
