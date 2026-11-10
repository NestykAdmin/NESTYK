import type { Locator, Page } from '@playwright/test';
import { FLOW, UI_LOCALE_TAG } from '../labels';

/** ใช้ข้อความเป็นส่วนหนึ่งของ RegExp โดยไม่ให้อักขระพิเศษมีความหมาย */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** ตัวเลขแบบที่หน้าเว็บแสดงในภาษาที่รัน (toLocaleString(localeTag): 1,234) ชื่อเดิม en คงไว้เพื่อไม่ต้องแก้ไฟล์เทส */
export function enNumber(value: number): string {
  return value.toLocaleString(UI_LOCALE_TAG);
}

/**
 * ตัวเลือก CSS ของส่วนที่แสดงรายการลีด (รากของหน้า :268 testid leads.page และแถวของตาราง WebTable.tsx:169 testid leads.table.row.<id>)
 * ใช้ในโค้ดที่รันในหน้า (page.evaluate / addInitScript) ซึ่งรับ Locator ไม่ได้ ต้องตรงกับ root กับ rows ของ LeadsPage
 */
export const LEAD_LIST_SELECTOR = '[data-testid="leads.page"], [data-testid^="leads.table.row."]';

/**
 * หน้าลีดของนายหน้าบนจอกว้าง /agent/leads (apps/consumer-app/components/agent-web/AgentLeadsPage.web.tsx ที่ 648dd28)
 * API: GET /agent/leads?q=&page=&limit=20[&sort][&status][&province][&locations] (lib/agent-leads-api.ts:20-29)
 * ตารางแสดงชื่อและเบอร์ของลูกค้าจริง ห้ามพิมพ์ข้อความของแถวออกรายงาน (ตรวจด้วยจำนวนหรือ testid แทน)
 */
export class LeadsPage {
  constructor(private readonly page: Page) {}

  /** รากของหน้า (:268 testid leads.page) */
  get root(): Locator {
    return this.page.getByTestId('leads.page');
  }

  /** ช่องค้น (:280-288 testid leads.search) ค้นหลังหยุดพิมพ์ 250ms และเริ่มจากหน้า 1 (:70-79) */
  get search(): Locator {
    return this.page.getByTestId('leads.search');
  }

  /** ตัวเลือกการเรียง (<select> :303-318 testid leads.sort) */
  get sort(): Locator {
    return this.page.getByTestId('leads.sort');
  }

  /** ตัวนับ "{count} leads" (:320-322 แสดงเมื่อโหลดเสร็จ) */
  get count(): Locator {
    return this.root.locator('.awr-count');
  }

  /** แถวของตาราง (WebTable.tsx:169 testid leads.table.row.<id>) */
  get rows(): Locator {
    return this.page.locator('[data-testid^="leads.table.row."]');
  }

  row(id: number): Locator {
    return this.page.getByTestId(`leads.table.row.${id}`);
  }

  /** ป้ายสถานะของแถว (คอลัมน์ status :243-259 LeadStatusBadge ตามด้วยป้าย New ถ้าเป็นลีดใหม่) */
  statusBadges(row: Locator): Locator {
    return row.locator('.awl-badges');
  }

  /** กลุ่มชิปสถานะ (:325 role=group aria-label agent.leads.statusFilter) */
  get statusGroup(): Locator {
    return this.page.getByRole('group', { name: FLOW.leadsStatusGroup, exact: true });
  }

  /**
   * ชิปสถานะตามชื่อ ชื่อที่อ่านได้คือ "<ชื่อ> <จำนวน>" หรือ "<ชื่อ>" ก่อนโหลดเสร็จ (MobileFilterChip.tsx:59)
   * ชิป All แสดงผลรวมของจำนวนทุกสถานะจาก statusCounts (:328)
   */
  chip(label: string): Locator {
    return this.statusGroup.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}( \\d+)?$`) });
  }

  /** ตัวแบ่งหน้า (:395 nav aria-label agent.listings.web.pages แสดงเมื่อมีแถว) */
  get pager(): Locator {
    return this.page.getByRole('navigation', { name: FLOW.pagerNav, exact: true });
  }

  /** ข้อความช่วง "{from}–{to} of {total}" (:396-401) */
  get pageRange(): Locator {
    return this.pager.locator('.awr-pager-range');
  }

  get nextPage(): Locator {
    return this.pager.getByRole('button', { name: FLOW.nextPage, exact: true });
  }

  /** สถานะว่าง ไม่พบตามตัวกรอง โหลดไม่ได้ (WebState.tsx:63 testid state.<ชนิด>) */
  state(kind: 'empty' | 'filtered' | 'error' | 'loading'): Locator {
    return this.page.getByTestId(`state.${kind}`);
  }

  /** รายละเอียดลีด (LeadDetailColumns.web.tsx:12 testid lead.detail) ไม่มี URL ของตัวเอง */
  get detail(): Locator {
    return this.page.getByTestId('lead.detail');
  }

  /** ปุ่มกลับบนหัวหน้ารายละเอียด (AgentSectionHeader.web.tsx:27-40 aria-label agent.createRoom.back) */
  get back(): Locator {
    return this.page.locator('.aw-page-heading').getByRole('button', { name: FLOW.back, exact: true });
  }
}
