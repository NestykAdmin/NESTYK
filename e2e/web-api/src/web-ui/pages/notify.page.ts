import type { Locator, Page } from '@playwright/test';

/**
 * toast บนเว็บที่แอปใช้แทน Alert.alert (apps/consumer-app/components/web-notify/WebNotifier.web.tsx:25-38, :66-71 ตั้งแต่ commit 27a6e05)
 *   <div data-testid="notify.toast.<tone>"> tone ตามชื่อ key ของข้อความ (lib/web-notify.ts:52-56, :82-88)
 *   success กับ info ปิดเองใน 4 วินาที error ค้างจนกดปิด (web-notify.ts:39-40)
 */
export class Notify {
  constructor(private readonly page: Page) {}

  toast(tone: 'success' | 'error' | 'info', text: string): Locator {
    return this.page.getByTestId(`notify.toast.${tone}`).filter({ hasText: text });
  }

  /**
   * หน้าต่างให้เลือกที่แอปใช้แทน Alert.alert เมื่อมีปุ่ม 2 ปุ่มขึ้นไป หรือมีปุ่มที่ทำงานเมื่อกด (lib/web-notify.ts:44-48 ที่ 5dff89e)
   *   <WebDialog testID="notify.dialog"> (WebNotifier.web.tsx:106-112, agent-web/ui/WebDialog.tsx:38 ส่งออกเป็น data-testid)
   */
  get dialog(): Locator {
    return this.page.getByTestId('notify.dialog');
  }

  /**
   * ปุ่มในหน้าต่าง: data-testid "notify.dialog.<style ของปุ่ม หรือ default>" (WebNotifier.web.tsx:114-123)
   * กด Esc หรือพื้นหลังเท่ากับกดปุ่ม cancel (:100-105) จึงห้ามปิดหน้าต่างด้วยวิธีนั้นถ้าไม่ต้องการให้ปุ่ม cancel ทำงาน
   */
  dialogButton(style: 'cancel' | 'default' | 'destructive'): Locator {
    return this.page.getByTestId(`notify.dialog.${style}`);
  }
}
