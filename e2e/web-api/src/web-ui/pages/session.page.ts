import type { Locator, Page } from '@playwright/test';
import { EN } from '../labels';

/** กล่องเตือนก่อนหมดเวลา (apps/consumer-app/components/web-session/IdleSignOutGate.web.tsx:129-143 ที่ qa/e2e 648dd28) */
export class IdleWarning {
  constructor(private readonly page: Page) {}

  get dialog(): Locator {
    return this.page.getByTestId('session.idleWarning');
  }

  get title(): Locator {
    return this.dialog.getByRole('heading', { name: EN.idleTitle });
  }

  get signOut(): Locator {
    return this.dialog.getByTestId('session.idleSignOut');
  }

  /** มี autoFocus (:138) */
  get stay(): Locator {
    return this.dialog.getByTestId('session.idleStay');
  }
}
