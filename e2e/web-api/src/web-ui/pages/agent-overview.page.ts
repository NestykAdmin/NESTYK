import type { Locator, Page } from '@playwright/test';
import { FLOW } from '../labels';

/**
 * แดชบอร์ดของนายหน้าบนจอกว้าง /agent (apps/consumer-app/components/agent-web/AgentOverview.web.tsx ที่ 648dd28)
 * ตัวเลขมาจาก GET /agent/dashboard (lib/agent-dashboard.ts:48) ส่วน "Viewings today" นับจากตารางนัดของวันนี้ในคำตอบเดียวกัน
 */
export class AgentOverview {
  constructor(private readonly page: Page) {}

  /** รากของแดชบอร์ด (:283 testid agent-desktop-overview) */
  get root(): Locator {
    return this.page.getByTestId('agent-desktop-overview');
  }

  /** การ์ดตัวเลขทั้งหมด (:440-489 ใน <section class="aov-kpis"> การ์ดที่มีปลายทางเป็นปุ่ม) */
  get kpis(): Locator {
    return this.root.locator('section.aov-kpis .aov-kpi');
  }

  /** การ์ดตามชื่อ (ชื่ออยู่ใน .aov-kpi-top :444-446) */
  kpi(label: string): Locator {
    return this.kpis.filter({ has: this.page.locator('.aov-kpi-top span', { hasText: label }) });
  }

  /** ตัวเลขของการ์ด (:454 เมื่อโหลดเสร็จ หรือ "—" :465 เมื่อโหลดไม่ได้) */
  kpiValue(label: string): Locator {
    return this.kpi(label).locator('.aov-kpi-value');
  }

  /** ชื่อการ์ดทั้ง 4 ใบตามลำดับในโค้ด (:233-268) */
  static readonly KPI_LABELS = [FLOW.kpiAvailableListings, FLOW.kpiOpenLeads, FLOW.kpiCurrentTenants, FLOW.kpiViewingsToday] as const;
}
