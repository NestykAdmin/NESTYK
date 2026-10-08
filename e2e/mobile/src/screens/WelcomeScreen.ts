/**
 * หน้าต้อนรับ (Page Object)
 *
 * หน้านี้บังหน้าอื่นทุกครั้งที่เปิดแอปใหม่ ทั้งจอเป็นปุ่มเดียว ตอนแอปกำลังโหลดปุ่มนี้ยังกดไม่ได้
 * เมื่อแอปพร้อม ชื่อกำกับของปุ่มจะเปลี่ยนเป็นคำชวนให้แตะ (ภาษาไทยคือ "แตะเพื่อเข้าใช้งาน") และกดได้
 * ที่มา: packages/ui/src/components/MobilePreloadScreen.tsx บรรทัด 329 ถึง 337 และ apps/consumer-app/app/_layout.tsx บรรทัด 35 ถึง 56
 */
import { env } from '../config/env';
import { inEveryLanguage } from '../labels/index';
import { type ElementSpec, isShown, tap, waitUntilEnabled, waitUntilGone } from './locators';

export class WelcomeScreen {
  private readonly enterButton: ElementSpec = {
    description: 'ปุ่มของหน้าต้อนรับ',
    testId: 'preload.enter',
    labels: inEveryLanguage((labels) => labels.preload.tapToEnter),
  };

  /** ตอนนี้ผู้ใช้เห็นหน้าต้อนรับอยู่หรือไม่ */
  async isShown(): Promise<boolean> {
    return isShown(this.enterButton);
  }

  /**
   * รอจนหน้าต้อนรับพร้อมให้แตะ: ปุ่มแสดงอยู่และกดได้ (ระหว่างโหลด แอปตั้งปุ่มนี้เป็น disabled)
   * ใช้เวลารอของการเปิดแอป (appReadyWaitMs) เพราะแอปต้องโหลดฟอนต์และตรวจการล็อกอินให้เสร็จก่อน
   */
  async waitUntilReady(): Promise<void> {
    await this.readyButton();
  }

  /** ข้อความที่ปุ่มของหน้าต้อนรับบอกผู้ใช้เมื่อพร้อมให้แตะ (รอจนพร้อมก่อนอ่าน) */
  async enterButtonText(): Promise<string> {
    const button = await this.readyButton();
    // label = ข้อความกำกับของชิ้นส่วน อ่านได้เหมือนกันไม่ว่าจะหาเจอด้วย testID หรือด้วยข้อความ
    return (await button.getAttribute('label')) ?? '';
  }

  /** แตะเพื่อเข้าแอป แล้วรอจนหน้าต้อนรับหายไป (แอปใช้ภาพจางออกราว 0.3 วินาทีก่อนถอดหน้านี้) */
  async enter(): Promise<void> {
    await this.readyButton();
    await tap(this.enterButton);
    await waitUntilGone(this.enterButton);
  }

  private async readyButton(): Promise<WebdriverIO.Element> {
    return waitUntilEnabled(this.enterButton, env.appReadyWaitMs);
  }
}
