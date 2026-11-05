import type { Locator, Page } from '@playwright/test';
import { EN } from '../labels';

/** หน้าแดชบอร์ดแอดมิน /admin (ข้อความเขียนไว้ในโค้ด ไม่ผ่าน i18n: apps/consumer-app/app/index.tsx:1092) */
export class AdminHome {
  constructor(private readonly page: Page) {}

  get title(): Locator {
    return this.page.getByText(EN.adminDashboardTitle);
  }

  get hardcodedSummary(): Locator {
    return this.page.getByText(EN.adminHardcodedSummary);
  }
}

/** หน้าบิลในโครงหน้าของผู้ให้เช่า/ผู้เช่า (components/TenantBillsScreen.tsx:172-174 แสดงข้อผิดพลาดใน role=alert) */
export class BillsScreen {
  constructor(private readonly page: Page) {}

  get alert(): Locator {
    return this.page.getByRole('alert');
  }
}
