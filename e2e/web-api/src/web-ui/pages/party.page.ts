import type { Locator, Page } from '@playwright/test';
import { FLOW, PARTY_COPY } from '../labels';

/**
 * หน้าของผู้เช่าและผู้ให้เช่าบนจอกว้าง (โครงหน้า AgentWorkspace เดียวกับนายหน้า) ไม่มี testid ใช้ role และข้อความ
 *   /tenant, /tenant/home, /tenant/contracts, /tenant/bills ; /landlord, /landlord/contracts, /landlord/tenants, /landlord/income
 *   (apps/consumer-app/lib/app-routes.ts:200-213 ที่ 648dd28)
 */
export class PartyPage {
  constructor(private readonly page: Page) {}

  /** ข้อความผิดพลาดที่มี role=alert (PartyContractsScreen.tsx:103, TenantBillsScreen.tsx:174) */
  get alerts(): Locator {
    return this.page.getByRole('alert');
  }

  /** ปุ่ม "Payment history" บนหัวหน้าบิลของผู้เช่า (app/index.tsx:1878-1887 ปุ่ม action ของ AgentSectionHeader.web.tsx:64-77) */
  get paymentHistory(): Locator {
    return this.page.locator('.aw-page-heading').getByRole('button', { name: PARTY_COPY.paymentHistory, exact: true });
  }

  /** การ์ด "Confirmed rent" บนหน้าแรกของผู้ให้เช่า (OwnerConfirmedRent.tsx:71-74) */
  get confirmedRentTitle(): Locator {
    return this.page.getByText(FLOW.ownerConfirmedTitle, { exact: true });
  }

  text(value: string): Locator {
    return this.page.getByText(value, { exact: true });
  }
}
