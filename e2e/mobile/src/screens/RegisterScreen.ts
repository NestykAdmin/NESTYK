/**
 * หน้าสมัครสมาชิก (Page Object) แอปเปิดหน้านี้เมื่อแตะ "สมัครสมาชิก" บนหน้า login
 *
 * คลาสนี้ไม่ตรวจผล การตรวจอยู่ในไฟล์เทส และครอบคลุมเฉพาะการเปิดหน้ากับการกลับหน้า login (ไม่กรอกฟอร์ม ไม่สมัครจริง)
 * ที่มา: apps/consumer-app/app/register.tsx ที่ pre/dev/review 0f99388
 *   หัวข้อเป็น Text ที่มี accessibilityRole="header" แสดง mobile.auth.registrationTitle ก่อนส่งฟอร์ม (บรรทัด 188 ถึง 191)
 *   ปุ่มกลับเป็น MobileButton ที่เรียก router.replace('/login') อยู่ท้ายการ์ด ใต้ฟอร์มยาว (บรรทัด 313 ถึง 315)
 *   MobileButton ตั้ง accessibilityRole="button" (packages/ui/src/components/MobileButton.tsx บรรทัด 61) จึงจำกัดชนิดเป็น Button
 * ยังไม่เคยรันบนเครื่องจริง: ชนิดบน iOS ของหัวข้อยังไม่ได้ยืนยัน จึงไม่จำกัดชนิดของหัวข้อ
 *   ปุ่มกลับอยู่นอกจอ (อยู่ใต้ฟอร์มสมัครทั้งชุด) จึงเลื่อนหาก่อนแตะ หลังเลื่อน หัวข้ออาจเลื่อนพ้นจอไปแล้ว
 *   ไม่ใช้ scrollIntoView ใน locators.ts: รอบ 4 พ.ย. 2026 mobile: scroll แบบ toVisible กับปุ่มนี้ได้ error ของ WebDriverAgent
 *     "Failed to perform scroll with visible cell due to max scroll count reached" และจอไม่เลื่อนเลย (logs/wdio-appium.log)
 *     หน้านี้จึงปัดจอขึ้นเอง (mobile: swipe) ทีละครั้งจนเห็นปุ่ม
 *   การตรวจว่าออกจากหน้านี้แล้วจึงดูว่าหัวข้อหายจากโครงสร้างหน้าจอ (isTitlePresent) ไม่ใช่ดูว่ามองไม่เห็น
 *   ความเสี่ยง: ปุ่ม Facebook อยู่เหนือปุ่มกลับ (register.tsx บรรทัด 276 ถึง 293) และปุ่มสมัครด้วย Google/Facebook ของหน้านี้เรียก OAuth ตรง
 *     ไม่ขึ้นกับ EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN (บรรทัด 263 ถึง 287) ถ้าแตะพลาด เทสจะแดง (หัวข้อยังอยู่) แต่หน้าต่างเข้าสู่ระบบอาจค้างอยู่
 *   แอปที่ 0f99388 ยังไม่มี testID ในหน้านี้ ทุกชิ้นจึงหาด้วยข้อความกำกับ
 */
import { inEveryLanguage } from '../labels/index';
import { type ElementSpec, isPresent, isShown, tap, waitUntilShown } from './locators';

const BUTTON = 'XCUIElementTypeButton';

/**
 * จำนวนครั้งสูงสุดที่ปัดจอขึ้นเพื่อหาปุ่มกลับ
 * หน้าสมัครยาว 2 หน้าจอ (ขั้นรันเมื่อ 4 พ.ย. 2026: แถบเลื่อนบอก "2 pages" ปุ่มกลับอยู่ที่ y=1124 จอสูง 874) ปัด 1 ถึง 2 ครั้งน่าจะพอ
 * เผื่อไว้ 4 ครั้ง ถ้าครบแล้วยังไม่เห็น การแตะใน tapBackToLogin จะหมดเวลาพร้อมข้อความว่าหาปุ่มไม่เจอ
 */
const MAX_SWIPES = 4;

export class RegisterScreen {
  private readonly title: ElementSpec = {
    description: 'หัวข้อของหน้าสมัครสมาชิก',
    testId: 'register.title',
    labels: inEveryLanguage((labels) => labels.auth.registrationTitle),
  };

  private readonly backButton: ElementSpec = {
    description: 'ปุ่มกลับไปเข้าสู่ระบบของหน้าสมัครสมาชิก',
    testId: 'register.back',
    labels: inEveryLanguage((labels) => labels.auth.backToLogin),
    types: [BUTTON],
  };

  /** รอจนผู้ใช้เห็นหัวข้อของหน้า แล้วคืนข้อความของหัวข้อ ใช้ดูว่าหน้าแสดงภาษาอะไร */
  async titleText(): Promise<string> {
    const element = await waitUntilShown(this.title);
    return (await element.getAttribute('label')) ?? '';
  }

  /** หัวข้อของหน้านี้ยังอยู่ในโครงสร้างหน้าจอหรือไม่ (ไม่รอ แม้เลื่อนพ้นจอก็นับว่าอยู่) ใช้หลัง tapBackToLogin เพื่อตรวจว่าออกจากหน้านี้แล้ว */
  async isTitlePresent(): Promise<boolean> {
    return isPresent(this.title);
  }

  /** ปัดจอขึ้นจนเห็นปุ่มกลับไปเข้าสู่ระบบ (ไม่เกิน MAX_SWIPES ครั้ง) แล้วแตะ */
  async tapBackToLogin(): Promise<void> {
    for (let swipe = 0; swipe < MAX_SWIPES && !(await isShown(this.backButton)); swipe += 1) {
      // mobile: swipe ทิศขึ้น = เลื่อนเนื้อหาขึ้น เพื่อดูส่วนล่างของหน้า (เป็นการปัด ไม่ใช่การแตะ จึงไม่กดชิ้นส่วนใด)
      await browser.execute('mobile: swipe', { direction: 'up' });
    }
    // tap รอให้ปุ่มหยุดเคลื่อนที่ก่อนแตะ (จอยังไหลอยู่ช่วงหนึ่งหลังปัด)
    await tap(this.backButton);
  }
}
