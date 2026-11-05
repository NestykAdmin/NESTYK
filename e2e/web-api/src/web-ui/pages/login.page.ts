import type { Locator, Page } from '@playwright/test';
import { EN } from '../labels';
import { setInputValueHidden } from '../support/inputs';

/**
 * หน้า /login (apps/consumer-app/app/login.tsx) ช่องกรอกยังไม่มี testID จึงหาด้วย aria-label
 * (accessibilityLabel ของ MobileInput ที่ :231-232, :282-292 react-native-web แปลงเป็น aria-label)
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(next?: string): Promise<void> {
    await this.page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`, { timeout: 60_000 });
  }

  get email(): Locator {
    return this.page.getByLabel(EN.email, { exact: true });
  }

  /** exact: ไม่ให้ชนกับปุ่ม "Show password" (:318-325) */
  get password(): Locator {
    return this.page.getByLabel(EN.password, { exact: true });
  }

  get submit(): Locator {
    return this.page.getByRole('button', { name: EN.loginButton, exact: true });
  }

  /** ข้อความผิดพลาดและข้อความหมดเวลาอยู่ใน role=alert ที่เดียวกัน (:91, :349-358) */
  get alert(): Locator {
    return this.page.getByRole('alert');
  }

  get expiredNotice(): Locator {
    return this.alert.filter({ hasText: EN.sessionExpired });
  }

  /** testID login.footer (:487 ผ่าน AuthLegalFooter.web.tsx:14) */
  get footer(): Locator {
    return this.page.getByTestId('login.footer');
  }

  get footerPrivacyLink(): Locator {
    return this.page.getByTestId('login.footer.privacy');
  }

  /** ใส่รหัสผ่านโดยไม่ให้ค่าอยู่ในรายงาน (support/inputs.ts) */
  async setPasswordHidden(value: string): Promise<void> {
    await setInputValueHidden(this.password, value);
  }
}
