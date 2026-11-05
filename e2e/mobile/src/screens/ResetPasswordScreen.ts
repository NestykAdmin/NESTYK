/**
 * หน้ารีเซ็ตรหัสผ่าน (Page Object) แอปเปิดหน้านี้เมื่อแตะ "ลืมรหัสผ่าน?" บนหน้า login
 *
 * คลาสนี้ไม่ตรวจผล การตรวจอยู่ในไฟล์เทส และครอบคลุมเฉพาะขั้นแรกของหน้า (ขั้น 'email')
 * การแตะปุ่มส่งมีทางเดียวคือ tapSendWithEmptyEmail ซึ่งยอมแตะเฉพาะเมื่อช่องอีเมลว่าง (เหตุผลอยู่ที่เมธอดนั้น)
 * ที่มา: apps/consumer-app/app/reset-password.tsx (ไฟล์ใหม่ที่ pre/dev/review 0f99388 เลขบรรทัดในไฟล์นี้เป็นของ efab8d0)
 *   เปิดแอปใหม่แล้วเริ่มที่ขั้น 'email' และช่องอีเมลว่าง (บรรทัด 25 ถึง 26) หัวข้อมาจาก mobile.auth.resetTitle (บรรทัด 68)
 *   หัวข้อเป็น Text ที่มี accessibilityRole="header" (บรรทัด 129 ถึง 132) ช่องอีเมลมี accessibilityLabel เป็น mobile.auth.email (บรรทัด 139 ถึง 141)
 *   ปุ่มส่ง (บรรทัด 161) และปุ่มกลับที่เรียก router.replace('/login') (บรรทัด 163 ถึง 167) เป็น MobileButton
 *   ซึ่งตั้ง accessibilityRole="button" (packages/ui/src/components/MobileButton.tsx บรรทัด 61) จึงจำกัดชนิดเป็น Button แบบเดียวกับปุ่มเข้าสู่ระบบใน LoginScreen
 * ยังไม่เคยรันบนเครื่องจริง: ชนิดบน iOS ของหัวข้อ (Text ที่เป็น header) ยังไม่ได้ยืนยัน จึงไม่จำกัดชนิดของหัวข้อ
 *   คำว่า "อีเมล" เป็นทั้งป้ายและชื่อของช่อง จึงจำกัดชนิดของช่อง
 *   แอปที่ efab8d0 ยังไม่มี testID ในหน้านี้ ทุกชิ้นจึงหาด้วยข้อความกำกับ
 */
import { inEveryLanguage } from '../labels/index';
import { env } from '../config/env';
import { readScreen } from '../support/page-source';
import { type ElementSpec, isPresent, isShown, nodesInSource, tap, waitUntilShown } from './locators';

const TEXT_FIELD = 'XCUIElementTypeTextField';
const BUTTON = 'XCUIElementTypeButton';

export class ResetPasswordScreen {
  private readonly title: ElementSpec = {
    description: 'หัวข้อของหน้ารีเซ็ตรหัสผ่าน',
    testId: 'resetPassword.title',
    labels: inEveryLanguage((labels) => labels.auth.resetTitle),
  };

  private readonly emailField: ElementSpec = {
    description: 'ช่องอีเมลของหน้ารีเซ็ตรหัสผ่าน',
    testId: 'resetPassword.email',
    labels: inEveryLanguage((labels) => labels.auth.email),
    types: [TEXT_FIELD],
  };

  private readonly sendButton: ElementSpec = {
    description: 'ปุ่มส่งของหน้ารีเซ็ตรหัสผ่าน',
    testId: 'resetPassword.send',
    labels: inEveryLanguage((labels) => labels.auth.resetSend),
    types: [BUTTON],
  };

  private readonly backButton: ElementSpec = {
    description: 'ปุ่มกลับไปเข้าสู่ระบบ',
    testId: 'resetPassword.back',
    labels: inEveryLanguage((labels) => labels.auth.backToLogin),
    types: [BUTTON],
  };

  /** ข้อความแจ้งข้อผิดพลาดของหน้า (Text ที่มี accessibilityRole="alert" ใต้ช่องอีเมล: reset-password.tsx บรรทัด 160) */
  private message(texts: readonly string[]): ElementSpec {
    return {
      description: 'ข้อความแจ้งข้อผิดพลาดของหน้ารีเซ็ตรหัสผ่าน',
      testId: 'resetPassword.error',
      labels: texts,
    };
  }

  /** รอจนผู้ใช้เห็นหัวข้อของหน้า แล้วคืนข้อความของหัวข้อ ใช้ดูว่าหน้าแสดงภาษาอะไร */
  async titleText(): Promise<string> {
    const element = await waitUntilShown(this.title);
    return (await element.getAttribute('label')) ?? '';
  }

  /** ผู้ใช้เห็นหัวข้อของหน้านี้อยู่หรือไม่ (ไม่รอ) ใช้ตรวจว่าออกจากหน้านี้แล้ว */
  async isTitleShown(): Promise<boolean> {
    return isShown(this.title);
  }

  /** ผู้ใช้เห็นช่องอีเมลอยู่หรือไม่ (ไม่รอ เรียกหลัง titleText) */
  async isEmailFieldShown(): Promise<boolean> {
    return isShown(this.emailField);
  }

  /**
   * ผู้ใช้เห็นปุ่มส่งอยู่หรือไม่ (ไม่รอ เรียกหลัง titleText)
   * ปุ่มนี้มีเฉพาะขั้น 'email' (reset-password.tsx บรรทัด 161) จึงใช้ยืนยันได้ว่าหน้ายังไม่ไปขั้น 'sent'
   */
  async isSendButtonShown(): Promise<boolean> {
    return isShown(this.sendButton);
  }

  /**
   * จำนวนตัวอักษรในช่องอีเมลของหน้านี้ (0 = ว่าง) คืนแค่จำนวน ไม่คืนตัวข้อความ
   *   เหตุผล: ถ้าช่องมีบัญชีนักพัฒนาติดมา (login.tsx บรรทัด 78 ถึง 83) แล้วการตรวจไม่ผ่าน expect จะพิมพ์ค่าที่ได้ลงผลเทส
   *   การคืนแค่จำนวนทำให้ผลเทสไม่มีอีเมลนั้น
   * ก่อนอ่าน รอจนนับช่องอีเมลในโครงสร้างหน้าจอได้ 1 ช่อง แล้วจึงหยิบช่อง ถ้าไม่ถึง 1 ช่องภายใน E2E_WAIT_MS โยน error
   *   เหตุผล: ช่องหาด้วยคำว่า "อีเมล" ชิ้นแรกที่เจอ ถ้าหน้า login ที่อยู่ข้างใต้ยังอยู่ในโครงสร้างหน้าจอ อาจอ่านได้ช่องของหน้า login
   *   หน้า login เปิดหน้านี้ด้วย router.push (login.tsx บรรทัด 338) ระหว่างที่หน้ากำลังเลื่อนเข้า อาจนับได้ 2 ช่อง จึงรอแทนการนับครั้งเดียว
   *   หมดความจำเป็นเมื่อแอปมี testID resetPassword.email
   * iOS รายงานค่าของช่องที่ว่างเป็นข้อความตัวอย่าง (placeholder) จึงถือว่าว่างเมื่อค่าเท่ากับข้อความตัวอย่าง (วิธีเดียวกับ LoginScreen)
   */
  async emailLength(): Promise<number> {
    let count = 0;
    try {
      await browser.waitUntil(
        async () => {
          count = nodesInSource(await readScreen(), this.emailField).length;
          return count === 1;
        },
        // 250 มิลลิวินาที = ค่าเดียวกับ POLL_INTERVAL_MS ใน src/screens/locators.ts (เหตุผลอยู่ที่นั่น)
        { timeout: env.waitMs, interval: 250 },
      );
    } catch (error) {
      // สร้างข้อความหลังรอจบ เพื่อให้ได้จำนวนที่นับครั้งล่าสุดจริง ส่วนสาเหตุเดิม (เช่น หมดเวลา หรือต่อ Appium ไม่ได้) เก็บไว้ใน cause
      // และต่อบรรทัดแรกของสาเหตุไว้ท้ายข้อความ เผื่อตัวรายงานไม่พิมพ์ cause (ถ้าอ่านหน้าจอไม่ได้เลย จำนวนจะค้างที่ 0 ซึ่งชวนเข้าใจผิด)
      const reason = (error instanceof Error ? error.message : String(error)).split('\n')[0].slice(0, 160);
      throw new Error(
        `ช่องอีเมลในโครงสร้างหน้าจอไม่เหลือ 1 ช่องภายใน ${env.waitMs / 1000} วินาที (นับครั้งล่าสุดได้ ${count} ช่อง) จึงบอกไม่ได้ว่าช่องที่อ่านเป็นของหน้ารีเซ็ตรหัสผ่าน ดู XML ใน test-results/ (สาเหตุ: ${reason})`,
        { cause: error },
      );
    }
    const field = await waitUntilShown(this.emailField);
    const value = (await field.getAttribute('value')) ?? '';
    const placeholder = (await field.getAttribute('placeholderValue')) ?? '';
    return value === placeholder ? 0 : value.length;
  }

  /**
   * แตะปุ่มส่ง โดยยอมแตะเฉพาะเมื่อช่องอีเมลว่าง ถ้าไม่ว่าง โยน error และไม่แตะ
   * เหตุผล: แอปตรวจรูปแบบอีเมลก่อนทำอย่างอื่น (reset-password.tsx บรรทัด 73 ถึง 75) อีเมลว่างจึงจบในแอปโดยไม่เรียกเครือข่าย
   *   แต่ถ้าในช่องมีอีเมลที่ถูกรูปแบบ การแตะจะขออีเมลรีเซ็ตรหัสผ่านจริง (requestPasswordReset บรรทัด 86) เมธอดนี้จึงกันไว้ก่อนแตะ
   */
  async tapSendWithEmptyEmail(): Promise<void> {
    const length = await this.emailLength();
    if (length !== 0) {
      throw new Error(`ช่องอีเมลไม่ว่าง (มี ${length} ตัวอักษร) จึงไม่แตะปุ่มส่ง เพราะการแตะอาจขออีเมลรีเซ็ตรหัสผ่านจริง`);
    }
    await tap(this.sendButton);
  }

  /**
   * ข้อความแจ้งข้อผิดพลาดที่ตรงกับข้อความใดข้อความหนึ่งที่ให้มา อยู่ในโครงสร้างหน้าจอหรือไม่ (ไม่รอ ไม่สนว่ามองเห็นหรือไม่)
   * ใช้ยืนยันว่ายังไม่มีข้อความก่อนแตะปุ่มส่ง ใช้ "อยู่ในโครงสร้างหน้าจอ" เพื่อไม่ให้ขึ้นกับว่าข้อความอยู่ในจอหรือไม่ (แบบเดียวกับ RegisterScreen)
   */
  async isErrorPresent(possibleTexts: readonly string[]): Promise<boolean> {
    return isPresent(this.message(possibleTexts));
  }

  /** รอข้อความแจ้งข้อผิดพลาดที่ตรงกับข้อความใดข้อความหนึ่งที่ให้มา แล้วคืนข้อความที่แสดง */
  async waitForError(possibleTexts: readonly string[]): Promise<string> {
    const element = await waitUntilShown(this.message(possibleTexts));
    return (await element.getAttribute('label')) ?? '';
  }

  /** แตะปุ่มกลับไปเข้าสู่ระบบ */
  async tapBackToLogin(): Promise<void> {
    await tap(this.backButton);
  }
}
