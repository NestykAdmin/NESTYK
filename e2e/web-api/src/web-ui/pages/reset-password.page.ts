import type { Locator, Page } from '@playwright/test';
import { EN } from '../labels';

/** หน้า /reset-password (apps/consumer-app/app/reset-password.tsx) ช่องกรอกหาด้วย aria-label */
export class ResetPasswordPage {
  constructor(private readonly page: Page) {}

  async goto(query = ''): Promise<void> {
    await this.page.goto(`/reset-password${query}`, { timeout: 60_000 });
  }

  /** ช่องอีเมลของขั้นแรก (aria-label = mobile.auth.email ของภาษาที่แสดง) */
  email(label: string = EN.email): Locator {
    return this.page.getByLabel(label, { exact: true });
  }

  /** ปุ่มส่งของขั้นอีเมล ตอนนี้เขียนว่า resetSend "Send code" (บั๊กข้อ 6) */
  sendButton(label: string = EN.resetSend): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  get password(): Locator {
    return this.page.getByLabel(EN.password, { exact: true });
  }

  get confirmPassword(): Locator {
    return this.page.getByLabel(EN.confirmPassword, { exact: true });
  }

  /** resetNewTitle เป็นทั้งหัวเรื่องและข้อความบนปุ่มบันทึก (:68, :162) จึงหาด้วย role button */
  get save(): Locator {
    return this.page.getByRole('button', { name: EN.resetNewTitle, exact: true });
  }

  /** ข้อความผิดพลาด (role=alert) ข้อความกฎรหัสผ่านเป็น helperText ใต้ช่องด้วย (:149) จึงต้องหาใน alert */
  get alert(): Locator {
    return this.page.getByRole('alert');
  }

  get linkInvalid(): Locator {
    return this.page.getByText(EN.resetLinkInvalid);
  }

  /** ข้อความที่ระบุที่ใดก็ได้บนหน้า (ใช้ตรวจว่าไม่มีข้อความดิบจาก Supabase) */
  text(value: string): Locator {
    return this.page.getByText(value);
  }

  /** testID resetPassword.footer (:169) */
  get footer(): Locator {
    return this.page.getByTestId('resetPassword.footer');
  }
}
