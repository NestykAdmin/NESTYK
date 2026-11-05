import type { Locator, Page } from '@playwright/test';
import { EN } from '../labels';

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

  /** ช่องติ๊กยินยอม role=checkbox aria-label = mobile.auth.acceptTerms (:236-238) ข้อความที่เห็นเป็นอีกประโยค */
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

  /** testID register.footer (:319) */
  get footer(): Locator {
    return this.page.getByTestId('register.footer');
  }
}
