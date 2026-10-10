/**
 * หน้าของผู้เยี่ยมชม (Page Object) แอปพามาที่นี่หลังออกจากระบบ
 *
 * คลาสนี้ไม่ตรวจผล การตรวจอยู่ในไฟล์เทส
 * ที่มา: apps/consumer-app/app/index.tsx บรรทัด 1279 ถึง 1280 ที่ commit feefcf2
 *   หลังออกจากระบบ แอปตั้งบทบาทเป็น guest และเปิดแท็บแรกของ guest คือ home
 * บนเครื่องจริง (ขั้นที่ 34): แถบแท็บ หน้าแรก ค้นหา บริการ เมนู เป็นชนิด Other ที่ y=784 แท็บหน้าแรกมี traits="Selected"
 *   และมีข้อความ "หน้าแรก" ชนิด StaticText เป็นหัวของหน้าอีกชิ้น (y=110) แท็บจึงหาด้วยชนิด Other
 */
import { env } from '../config/env';
import { sessionInEveryLanguage } from '../labels/session';
import { isSelected, readScreen } from '../support/page-source';
import { type ElementSpec, shownInSource } from './locators';

const HOME_TAB: ElementSpec = {
  description: 'แท็บหน้าแรกของผู้เยี่ยมชม',
  testId: 'tab.home',
  labels: sessionInEveryLanguage((labels) => labels.guestHomeTab),
  types: ['XCUIElementTypeOther'],
};

export class GuestHomeScreen {
  /** รอจนผู้ใช้เห็นแท็บหน้าแรกของผู้เยี่ยมชม */
  async waitUntilShown(timeoutMs: number = env.waitMs): Promise<void> {
    await browser.waitUntil(async () => shownInSource(await readScreen(), HOME_TAB).length > 0, {
      timeout: timeoutMs,
      interval: 250,
      timeoutMsg: `ไม่เห็นแท็บ "${HOME_TAB.labels.join('" หรือ "')}" ของผู้เยี่ยมชม ภายใน ${timeoutMs / 1000} วินาที`,
    });
  }

  /** แท็บหน้าแรกของผู้เยี่ยมชมถูกเลือกอยู่หรือไม่ (ต้องมองเห็นชิ้นเดียว และ traits บอกว่าถูกเลือก) */
  async isHomeTabSelected(): Promise<boolean> {
    const tabs = shownInSource(await readScreen(), HOME_TAB);
    return tabs.length === 1 && isSelected(tabs[0]);
  }
}
