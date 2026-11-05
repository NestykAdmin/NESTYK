import type { Locator, Page } from '@playwright/test';
import { UNMATCHED_ROUTE } from '../labels';

/** หน้ากฎหมาย /privacy และ /terms (apps/consumer-app/components/legal/LegalPage.web.tsx) */
export class LegalPage {
  constructor(
    private readonly page: Page,
    readonly doc: 'privacy' | 'terms',
  ) {}

  async goto(): Promise<void> {
    await this.page.goto(`/${this.doc}`, { timeout: 60_000 });
  }

  /** testid legal.privacy / legal.terms (:29) */
  get root(): Locator {
    return this.page.getByTestId(`legal.${this.doc}`);
  }

  get draftBanner(): Locator {
    return this.page.getByTestId('legal.draft');
  }

  get title(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** หัวข้อแต่ละส่วนเป็น <h2> ใน <section> (:85-92) */
  get sectionHeadings(): Locator {
    return this.page.locator('main section h2');
  }

  /** <select data-testid="legal.language"> ค่า th, en, zh, ja (:34-47) */
  get language(): Locator {
    return this.page.getByTestId('legal.language');
  }

  /** footer ของหน้ากฎหมายคือ PublicFooter (:103-118, packages/ui/src/shells/PublicFooter.tsx:94) */
  get footer(): Locator {
    return this.page.getByTestId('public.footer');
  }

  get footerPrivacyLink(): Locator {
    return this.footer.getByTestId('public.footer.privacy');
  }
}

/** หน้าแรกของผู้เยี่ยมชม "/" (footer: GuestPublicFooter.web.tsx:15 ครอบ PublicFooter) */
export class GuestHome {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/', { timeout: 60_000 });
  }

  get footer(): Locator {
    return this.page.getByTestId('guest.footer');
  }

  /** PublicFooter.tsx:137 legalInNewTab ค่าเริ่มต้น true (:90-92) */
  get footerTermsLink(): Locator {
    return this.footer.getByTestId('public.footer.terms');
  }
}

/** หน้าไม่พบของ expo-router (CatchAllRoute.web.tsx:7 แสดง <Unmatched />) */
export function notFoundMessage(page: Page): Locator {
  return page.getByText(UNMATCHED_ROUTE);
}
