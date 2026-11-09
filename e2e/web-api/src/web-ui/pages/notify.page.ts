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
}
