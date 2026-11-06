import type { Locator, Page } from '@playwright/test';
import { FLOW } from '../labels';
import { escapeRegExp } from './leads.page';

/**
 * ผู้เช่าของนายหน้าบนจอกว้าง /agent/clients (apps/consumer-app/components/AgentTenantsScreen.tsx
 *   ตาราง agent-web/TenantWorkTable.web.tsx และ TenantDirectoryTable.web.tsx ที่ 648dd28)
 * API ตอนเปิด: GET /agent/tenants และ GET /bills/agent (AgentTenantsScreen.tsx reload) ค้นและกรองทำในหน้าเว็บ ไม่ขอ API เพิ่ม
 * ตารางแสดงชื่อและเบอร์ของผู้เช่าจริง ห้ามพิมพ์ข้อความของแถวออกรายงาน
 * ห้ามกดปุ่มในคอลัมน์ action ของตารางงาน (TenantWorkTable.web.tsx:129-144) เพราะพาไปหน้ายืนยันสลิปหรือสัญญา
 */
export class AgentTenantsPage {
  constructor(private readonly page: Page) {}

  /** แท็บ "To do" / "All tenants" (MobileSegmentedTabs role=tab ชื่อ "<ชื่อ> <จำนวน>": AgentTenantsScreen.tsx:808-815) */
  tab(view: 'work' | 'all'): Locator {
    const label = view === 'work' ? FLOW.tenantsTabWork : FLOW.tenantsTabAll;
    return this.page.getByRole('tab', { name: new RegExp(`^${escapeRegExp(label)}( \\S+)?$`) });
  }

  /** มุมมองงาน (TenantWorkTable.web.tsx:149 testid tenants.work) */
  get work(): Locator {
    return this.page.getByTestId('tenants.work');
  }

  /** มุมมองทั้งหมด (TenantDirectoryTable.web.tsx:123 testid tenants.all) */
  get all(): Locator {
    return this.page.getByTestId('tenants.all');
  }

  /** ช่องค้นของมุมมองทั้งหมด (:133 testid tenants.search) */
  get search(): Locator {
    return this.page.getByTestId('tenants.search');
  }

  /** ตัวนับ "Showing {shown} of {total}" (:147-149) */
  get count(): Locator {
    return this.all.locator('.awr-count');
  }

  /** แถวของมุมมองทั้งหมด แยกกลุ่มตามโครงการ ทุกกลุ่มใช้ testid tenants.table (:171-196) */
  get rows(): Locator {
    return this.page.locator('[data-testid^="tenants.table.row."]');
  }

  /** รายละเอียดผู้เช่า (TenantDetailFrame.web.tsx:29 testid tenant.detail) ไม่มี URL ของตัวเอง */
  get detail(): Locator {
    return this.page.getByTestId('tenant.detail');
  }

  /** ข้อความผิดพลาดของหน้า (AgentTenantsScreen.tsx role=alert: หน้ารายการ :818 หน้ารายละเอียด :538-545) */
  alert(text: string): Locator {
    return this.page.getByRole('alert').filter({ hasText: text });
  }
}
