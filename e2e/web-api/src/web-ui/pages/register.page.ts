import type { Locator, Page } from '@playwright/test';
import { EN } from '../labels';
import { AGENT_WEB } from '../labels.agent-web';

/** หน้า /register (apps/consumer-app/app/register.tsx:196-260) ช่องกรอกหาด้วย aria-label */
export class RegisterPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/register', { timeout: 60_000 });
  }

  get firstName(): Locator {
    return this.page.getByLabel(EN.firstName, { exact: true });
  }

  get lastName(): Locator {
    return this.page.getByLabel(EN.lastName, { exact: true });
  }

  /** PhoneField.tsx:74 accessibilityLabel = mobile.account.phone ประเทศเริ่มต้นคือ TH */
  get phone(): Locator {
    return this.page.getByLabel(EN.phone, { exact: true });
  }

  get email(): Locator {
    return this.page.getByLabel(EN.email, { exact: true });
  }

  get password(): Locator {
    return this.page.getByLabel(EN.password, { exact: true });
  }

  get confirmPassword(): Locator {
    return this.page.getByLabel(EN.confirmPassword, { exact: true });
  }

  /** ช่องติ๊กยินยอม role=checkbox aria-label = mobile.auth.acceptTerms (:239-245) ข้อความที่เห็นเป็นอีกประโยค */
  get consent(): Locator {
    return this.page.getByRole('checkbox', { name: EN.acceptTerms, exact: true });
  }

  /** ลิงก์ Terms ในข้อความยินยอม (ConsentLabel.web.tsx:23-33) */
  get consentTermsLink(): Locator {
    return this.page.getByTestId('register.consent.terms');
  }

  get submit(): Locator {
    return this.page.getByRole('button', { name: EN.registerButton, exact: true });
  }

  get alert(): Locator {
    return this.page.getByRole('alert');
  }

  /** ช่องรหัส 6 หลักของขั้นยืนยันอีเมล (register.tsx:316 aria-label = mobile.auth.otpCode) */
  get codeInput(): Locator {
    return this.page.getByRole('textbox', { name: EN.otpCode, exact: true });
  }

  /** ปุ่มยืนยันรหัส ใช้ข้อความ otpCode เดียวกับช่องรหัส (:321) จึงหาด้วย role button */
  get verifyButton(): Locator {
    return this.page.getByRole('button', { name: EN.otpCode, exact: true });
  }

  /** ปุ่มส่งรหัสใหม่ ขึ้นข้อความนี้เมื่อนับถอยหลัง 60 วินาทีจบแล้ว (:322-324, ตั้ง 60 ที่ :118) */
  get resendButton(): Locator {
    return this.page.getByRole('button', { name: EN.resendCode, exact: true });
  }

  /** ข้อความที่ตรงตัวที่ใดก็ได้บนหน้า (ใช้ตรวจว่าข้อความ error แบบอื่นต้องไม่ขึ้น) */
  textAnywhere(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  /** ทั้งหน้า (ใช้ตรวจว่าข้อความดิบของ Supabase หรือ API ไม่อยู่ที่ใดบนหน้า) */
  get body(): Locator {
    return this.page.locator('body');
  }

  /**
   * กรอกฟอร์มสมัครให้ผ่านการตรวจของหน้าเองทุกข้อ (register.tsx:85-107) แล้วติ๊กยอมรับเงื่อนไข ค่าเป็นค่าปลอม ใช้กับเทสที่ดักคำขอสมัครไว้แล้วเท่านั้น
   * กดใกล้ขอบซ้ายของแถว (12px) ซึ่งเป็นไอคอนช่องติ๊ก ไม่กดกลางแถว เพราะลิงก์ Terms ท้ายประโยคหยุดเหตุการณ์ไม่ให้ติ๊ก (วิธีเดียวกับ cookie-consent.spec.ts)
   */
  async fillValidForm(email: string): Promise<void> {
    await this.firstName.fill('QA');
    await this.lastName.fill('WebUi');
    await this.phone.fill('0812345678');
    await this.email.fill(email);
    await this.password.fill('QaWebUi2026a');
    await this.confirmPassword.fill('QaWebUi2026a');
    const box = await this.consent.boundingBox();
    await this.consent.click({ position: { x: 12, y: (box?.height ?? 44) / 2 } });
  }

  /** testID register.footer (:334) */
  get footer(): Locator {
    return this.page.getByTestId('register.footer');
  }

  /** ปุ่ม "Sign up with Apple" (aria-label: register.tsx:274 ที่ pre/dev/review 7a9bf48) ป้าย Coming soon อยู่ในปุ่ม (:301) */
  get appleButton(): Locator {
    return this.page.getByRole('button', { name: AGENT_WEB.registerWithApple, exact: true });
  }

  /** ข้อความอธิบายเมื่อกดปุ่ม social ที่ยังไม่เปิด (mobile.auth.unavailable: register.tsx:281-284, :305-306) */
  get socialUnavailable(): Locator {
    return this.page.getByText(AGENT_WEB.socialUnavailable, { exact: true });
  }
}
