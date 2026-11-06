import type { Locator, Page } from '@playwright/test';
import { EN, RAW_ERRORS, RETIRED_ADMIN } from '../labels';

/**
 * หน้าแรกของแอดมิน /admin (การ์ดหน้าแรกของบทบาท: apps/consumer-app/app/index.tsx:1135-1166 ที่ qa/e2e 648dd28)
 * admin ไม่มีโครงหน้าเดสก์ท็อป (index.tsx:757-760) และหน้านี้ไม่มี testid จึงหาด้วยข้อความจาก i18n
 */
export class AdminHome {
  constructor(private readonly page: Page) {}

  /** หัวข้อการ์ด "Admin home" (t.mobile.roleHome.adminTitle: index.tsx:1141) */
  get title(): Locator {
    return this.page.getByText(EN.adminHomeTitle, { exact: true });
  }

  /**
   * การ์ดหน้าแรกที่มีหัวข้อ "Admin home" (index.tsx:1147-1166 ไม่มี testid)
   * กรอง div ที่มีหัวข้อนี้และข้อความ "Coming soon" แล้วเลือกตัวสุดท้ายตามลำดับในหน้า ซึ่งเป็นตัวในสุดของชั้นที่ซ้อนกัน
   */
  get card(): Locator {
    return this.page.locator('div').filter({ has: this.title }).filter({ hasText: EN.roleHomeComingSoon }).last();
  }

  /** หัวข้อและตัวเลขสมมติของการ์ดเดิมก่อนแก้บั๊กข้อ 8 ต้องไม่มีบนหน้า */
  get retiredText(): Locator {
    return this.page.getByText(RETIRED_ADMIN.title).or(this.page.getByText(RETIRED_ADMIN.summary));
  }
}

/** ข้อความดิบจาก API ที่อาจขึ้นที่ใดก็ได้บนหน้า (บั๊กข้อ 7) */
export class RawApiErrors {
  constructor(private readonly page: Page) {}

  /** 403 ของ RolesGuard เมื่อบัญชีไม่มีบทบาท landlord */
  get requiredRoleLandlord(): Locator {
    return this.page.getByText(RAW_ERRORS.requiredRoleLandlord);
  }
}
