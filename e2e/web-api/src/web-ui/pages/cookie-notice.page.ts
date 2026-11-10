/// <reference lib="dom" />  // โค้ดใน evaluate ทำงานในเบราว์เซอร์ (tsconfig ของชุดนี้ใช้ lib ES2022 อย่างเดียว)
import type { Locator, Page } from '@playwright/test';

/**
 * แถบขอความยินยอมคุกกี้ของเว็บ (PDPA: pre/dev/review cba5045)
 *   แถบ: apps/consumer-app/components/legal/CookieNotice.web.tsx (วางที่ app/_layout.tsx จึงมีทุกหน้าของเว็บ consumer-app)
 *   กติกาและที่เก็บ: packages/ui/src/consent/cookieConsent.ts
 *
 * ค่าคงที่ด้านล่างคัดลอกจากโค้ดของแอป ไม่ import (ข้อตกลงเดียวกับ labels.ts: ถ้าทีมเปลี่ยน เทสต้องแดงให้เห็น)
 * ถ้าทีมเปลี่ยน COOKIE_CONSENT_VERSION ค่าที่ fixture ใส่ไว้ (web-ui.fixture.ts) จะกลายเป็นรุ่นเก่า แถบจะขึ้นทุกหน้าของทุกชุดเทส
 *   ให้ดูข้อ "the fixture's stored choice still hides the bar" ใน tests/web-ui/cookie-consent.spec.ts ก่อน ข้อนั้นบอกสาเหตุตรงที่สุด
 */

/** cookieConsent.ts:18 */
export const COOKIE_CONSENT_KEY = 'nestyk.web.cookieConsent';

/** cookieConsent.ts:15 (เปลี่ยนเมื่อหมวดหรือข้อความคุกกี้เปลี่ยน ทุกคนถูกถามใหม่) */
export const COOKIE_CONSENT_VERSION = '2026-11-13';

/** ค่าของหมวด "จำค่าที่คุณตั้ง" ที่แอปลบเมื่อหมวดนี้ปิด (cookieConsent.ts:32-37, saveCookieConsent :129-137) */
export const PREFERENCE_STORAGE_KEYS = [
  '@nestyk/preferred_locale',
  'nestyk.web.theme',
  'nestyk.web.lastRole',
  'nestyk.agentRooms.view',
] as const;

/**
 * รุ่นของเงื่อนไขและนโยบายที่บันทึกตอนสมัคร (apps/consumer-app/lib/cookie-notice.ts:12-13)
 * ข้อจำกัด: ตอนนี้ 3 รุ่น (คุกกี้ เงื่อนไข นโยบาย) เป็นวันเดียวกัน ถ้าแอปใส่รุ่นสลับช่อง เทสสมัครจะจับไม่ได้จนกว่าวันจะต่างกัน
 */
export const TERMS_VERSION = '2026-11-13';
export const PRIVACY_VERSION = '2026-11-13';

/** จำนวนแถวของตารางในหน้า /privacy#cookies (BROWSER_STORAGE_ITEMS :28-39 และ THIRD_PARTY_SERVICES :43-46) */
export const COOKIE_TABLE_ROWS = { storage: 10, services: 2 } as const;

/** ค่าที่แอปเขียนลง COOKIE_CONSENT_KEY (cookieConsentRecord :57-63) */
export interface StoredCookieConsent {
  version: string;
  at: string;
  preferences: boolean;
  maps: boolean;
}

/** ตัวหาชิ้นส่วนของแถบ ทุกตัวเป็น data-testid ของ CookieNotice.web.tsx */
export class CookieNotice {
  constructor(private readonly page: Page) {}

  /** <section role="region" data-testid="cookieNotice" data-view="choice|settings"> (:81-89) */
  get root(): Locator {
    return this.page.getByTestId('cookieNotice');
  }

  /** มีทั้งในมุมมอง choice และ settings จึงหาจากในแถบเสมอ (:149, :172) */
  get acceptAll(): Locator {
    return this.root.getByTestId('cookieNotice.acceptAll');
  }

  get necessaryOnly(): Locator {
    return this.root.getByTestId('cookieNotice.necessaryOnly');
  }

  /** ปุ่ม "ตั้งค่า" ในมุมมอง choice (:155-163) */
  get settings(): Locator {
    return this.root.getByTestId('cookieNotice.settings');
  }

  /** ปุ่ม "บันทึกตัวเลือก" ในมุมมอง settings (:169) */
  get save(): Locator {
    return this.root.getByTestId('cookieNotice.save');
  }

  /** ปุ่ม × มีเฉพาะเมื่อเคยเลือกแล้ว (:100-110) */
  get close(): Locator {
    return this.root.getByTestId('cookieNotice.close');
  }

  /** checkbox ของแต่ละหมวด necessary ติ๊กไว้และกดไม่ได้ (:114-127) */
  category(id: 'necessary' | 'preferences' | 'maps'): Locator {
    return this.root.getByTestId(`cookieNotice.${id}`);
  }
}

/** อ่านค่าที่แอปบันทึกไว้ (null = ยังไม่มี) */
export async function readStoredConsent(page: Page): Promise<StoredCookieConsent | null> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), COOKIE_CONSENT_KEY);
  return raw === null ? null : (JSON.parse(raw) as StoredCookieConsent);
}

/** ค่าใน localStorage ของ key ที่ระบุ (null = ไม่มี key นี้) */
export async function readStorage(page: Page, keys: readonly string[]): Promise<Record<string, string | null>> {
  return page.evaluate(
    (list) => Object.fromEntries(list.map((key) => [key, window.localStorage.getItem(key)])),
    [...keys],
  );
}
