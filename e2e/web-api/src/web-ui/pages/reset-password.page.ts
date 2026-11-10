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

  /** ปุ่มส่งของขั้นอีเมล resetSend "Send link" (บั๊กข้อ 6 แก้แล้วที่ 648dd28) */
  sendButton(label: string = EN.resetSend): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  get password(): Locator {
    return this.page.getByLabel(EN.password, { exact: true });
  }

  get confirmPassword(): Locator {
    return this.page.getByLabel(EN.confirmPassword, { exact: true });
  }

  /** resetNewTitle เป็นทั้งหัวเรื่องและข้อความบนปุ่มบันทึก (:73, :183 ที่ 648dd28) จึงหาด้วย role button */
  get save(): Locator {
    return this.page.getByRole('button', { name: EN.resetNewTitle, exact: true });
  }

  /** ข้อความผิดพลาด (role=alert) ข้อความกฎรหัสผ่านเป็น helperText ใต้ช่องด้วย (:170) จึงต้องหาใน alert */
  get alert(): Locator {
    return this.page.getByRole('alert');
  }

  /** ข้อความเมื่อ Supabase ไม่รับลิงก์ ขึ้นตอนกดบันทึก (ฟอร์มยังอยู่) อยู่ใน role=alert ตัวเดียวกับข้อความผิดพลาดอื่น (reset-password.tsx:181) */
  get linkInvalid(): Locator {
    return this.alert.filter({ hasText: EN.resetLinkInvalid });
  }

  /** ข้อความเมื่อเปิดลิงก์ที่ไม่มี token หรือ ?code= ที่ใช้ไม่ได้ ขึ้นบนขั้นอีเมล (role=alert :181) */
  get linkBroken(): Locator {
    return this.alert.filter({ hasText: EN.resetLinkBroken });
  }

  /** ข้อความที่ระบุที่ใดก็ได้บนหน้า (ใช้ตรวจว่าไม่มีข้อความดิบจาก Supabase) */
  text(value: string): Locator {
    return this.page.getByText(value);
  }

  /** ข้อความที่ตรงตัวที่ใดก็ได้บนหน้า (ใช้ตรวจว่าข้อความ error แบบอื่นต้องไม่ขึ้น) */
  textAnywhere(value: string): Locator {
    return this.page.getByText(value, { exact: true });
  }

  /** ทั้งหน้า (ใช้ตรวจว่าข้อความดิบของ Supabase ไม่อยู่ที่ใดบนหน้า) */
  get body(): Locator {
    return this.page.locator('body');
  }

  /** testID resetPassword.footer (:190) */
  get footer(): Locator {
    return this.page.getByTestId('resetPassword.footer');
  }
}
