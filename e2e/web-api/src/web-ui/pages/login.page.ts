import type { Locator, Page } from '@playwright/test';
import { EN } from '../labels';
import { AGENT_WEB, fill } from '../labels.agent-web';
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

  /** ปุ่ม social "Continue with <provider>" (aria-label: login.tsx:421-424 ที่ pre/dev/review 7a9bf48) */
  socialButton(provider: 'Google' | 'Facebook' | 'Apple'): Locator {
    return this.page.getByRole('button', { name: fill(AGENT_WEB.socialLogin, { provider }), exact: true });
  }

  /** ป้าย Coming soon ใต้ปุ่ม social อยู่ใน View ของปุ่มนั้น (:391, :438-442) จึงหาจากตัวแม่ของปุ่ม */
  socialComingSoon(provider: 'Google' | 'Facebook' | 'Apple'): Locator {
    return this.socialButton(provider).locator('xpath=..').getByText(AGENT_WEB.socialComingSoon, { exact: true });
  }

  /** ข้อความอธิบายเมื่อกดปุ่ม social ที่ยังไม่เปิด (mobile.auth.unavailable: :448-461) */
  get socialUnavailable(): Locator {
    return this.page.getByText(AGENT_WEB.socialUnavailable, { exact: true });
  }
}
