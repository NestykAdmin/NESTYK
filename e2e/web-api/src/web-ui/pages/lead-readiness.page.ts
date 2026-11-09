import type { Locator, Page } from '@playwright/test';

export type ReadinessKey = 'firstName' | 'phone' | 'budgetMax' | 'pins';

/**
 * แผงความพร้อมข้างฟอร์มเพิ่ม/แก้ลีดบนเว็บจอกว้าง (data-testid leadForm.readiness)
 *   โค้ด: apps/consumer-app/components/agent-web/AgentLeadFormPage.web.tsx ที่ pre/dev/review 7a9bf48
 *   ที่ 1280px ขึ้นไปแผงเปิดตลอด ต่ำกว่านั้นพับและต้องกดปุ่ม leadForm.readiness.toggle (agent-lead-form.css:56-61)
 */
export class LeadReadinessPanel {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId('leadForm.readiness');
  }

  /** ข้อในแผง (leadForm.readiness.<key> :78, data-done :77, aria-label "<ชื่อข้อ>: done|missing" :75) กดแล้วฟอร์มเปิดแท็บของข้อนั้น (:76) */
  item(key: ReadinessKey): Locator {
    return this.page.getByTestId(`leadForm.readiness.${key}`);
  }

  /** หมายเหตุใต้รายการ (<p class="awlf-note"> :89) noteNeedContact / noteSaveFirst / noteReady ตามสถานะ (:32) */
  get note(): Locator {
    return this.root.locator('p.awlf-note');
  }
}
