/**
 * หน้ารีเซ็ตรหัสผ่าน (Page Object) แอปเปิดหน้านี้เมื่อแตะ "ลืมรหัสผ่าน?" บนหน้า login
 *
 * คลาสนี้ไม่ตรวจผล การตรวจอยู่ในไฟล์เทส และครอบคลุมเฉพาะขั้นแรกของหน้า (ขั้น 'email')
 * ที่มา: apps/consumer-app/app/reset-password.tsx (ไฟล์ใหม่ที่ pre/dev/review 0f99388)
 *   เปิดแอปใหม่แล้วเริ่มที่ขั้น 'email' และช่องอีเมลว่าง (บรรทัด 24 ถึง 25) หัวข้อมาจาก mobile.auth.resetTitle (บรรทัด 51)
 *   หัวข้อเป็น Text ที่มี accessibilityRole="header" (บรรทัด 130 ถึง 133) ช่องอีเมลมี accessibilityLabel เป็น mobile.auth.email (บรรทัด 137 ถึง 144)
 *   ปุ่มส่ง (บรรทัด 169) และปุ่มกลับที่เรียก router.replace('/login') (บรรทัด 177 ถึง 181) เป็น MobileButton
 *   ซึ่งตั้ง accessibilityRole="button" (packages/ui/src/components/MobileButton.tsx บรรทัด 61) จึงจำกัดชนิดเป็น Button แบบเดียวกับปุ่มเข้าสู่ระบบใน LoginScreen
 * ยังไม่เคยรันบนเครื่องจริง: ชนิดบน iOS ของหัวข้อ (Text ที่เป็น header) ยังไม่ได้ยืนยัน จึงไม่จำกัดชนิดของหัวข้อ
 *   คำว่า "อีเมล" เป็นทั้งป้ายและชื่อของช่อง จึงจำกัดชนิดของช่อง
 *   แอปที่ 0f99388 ยังไม่มี testID ในหน้านี้ ทุกชิ้นจึงหาด้วยข้อความกำกับ
 */
import { inEveryLanguage } from '../labels/index';
import { type ElementSpec, isShown, tap, waitUntilShown } from './locators';

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

  /** ผู้ใช้เห็นปุ่มส่งอยู่หรือไม่ (ไม่รอ เรียกหลัง titleText) ไม่มีเมธอดแตะปุ่มนี้ เพราะการแตะจะขออีเมลรีเซ็ตรหัสผ่าน */
  async isSendButtonShown(): Promise<boolean> {
    return isShown(this.sendButton);
  }

  /** แตะปุ่มกลับไปเข้าสู่ระบบ */
  async tapBackToLogin(): Promise<void> {
    await tap(this.backButton);
  }
}
