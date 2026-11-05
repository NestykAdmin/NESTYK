/**
 * หน้าสมัครสมาชิก (Page Object) แอปเปิดหน้านี้เมื่อแตะ "สมัครสมาชิก" บนหน้า login
 *
 * คลาสนี้ไม่ตรวจผล การตรวจอยู่ในไฟล์เทส และครอบคลุมการเปิดหน้า การกลับหน้า login และการแตะสร้างบัญชีโดยไม่กรอกฟอร์ม (ไม่กรอกฟอร์ม ไม่สมัครจริง)
 * ที่มา: apps/consumer-app/app/register.tsx (เลขบรรทัดในไฟล์นี้เป็นของ efab8d0)
 *   หัวข้อเป็น Text ที่มี accessibilityRole="header" แสดง mobile.auth.registrationTitle ก่อนส่งฟอร์ม (บรรทัด 190 ถึง 193)
 *   ปุ่มกลับเป็น MobileButton ที่เรียก router.replace('/login') อยู่ท้ายการ์ด ใต้ฟอร์มยาว (บรรทัด 315 ถึง 317)
 *   MobileButton ตั้ง accessibilityRole="button" (packages/ui/src/components/MobileButton.tsx บรรทัด 61) จึงจำกัดชนิดเป็น Button
 * ยังไม่เคยรันบนเครื่องจริง: ชนิดบน iOS ของหัวข้อยังไม่ได้ยืนยัน จึงไม่จำกัดชนิดของหัวข้อ
 *   ปุ่มกลับอยู่นอกจอ (อยู่ใต้ฟอร์มสมัครทั้งชุด) จึงเลื่อนหาก่อนแตะ หลังเลื่อน หัวข้ออาจเลื่อนพ้นจอไปแล้ว
 *   ไม่ใช้ scrollIntoView ใน locators.ts: รอบ 4 พ.ย. 2026 mobile: scroll แบบ toVisible กับปุ่มนี้ได้ error ของ WebDriverAgent
 *     "Failed to perform scroll with visible cell due to max scroll count reached" และจอไม่เลื่อนเลย (logs/wdio-appium.log)
 *     หน้านี้จึงปัดจอขึ้นเอง (mobile: swipe) ทีละครั้งจนเห็นปุ่ม (swipeUntilShown ใช้กับทั้งปุ่มกลับและปุ่มสร้างบัญชี)
 *   ปุ่มสร้างบัญชีอยู่เหนือปุ่ม Google กับ Facebook และปุ่มกลับ (register.tsx บรรทัด 254, 260 ถึง 295 และ 315)
 *     คาดว่าการปัดจอไม่ทำให้ปุ่มนี้พ้นขอบบนไปก่อนที่เทสจะเห็น (คำนวณจากรอบ 4 พ.ย. 2026 ยังไม่เคยรันกับปุ่มนี้บนเครื่องจริง):
 *     ปุ่มกลับอยู่ที่ y=1124 ก่อนปัด เนื้อหาจึงยาวราว 1300 จุด จอสูง 874 จึงเลื่อนได้มากสุดราว 430 จุด
 *     ปุ่มสร้างบัญชีอยู่เหนือปุ่มกลับราว 215 จุด (y ราว 909) หลังเลื่อนสุดจึงอยู่ราว y=480 ยังอยู่ในจอ
 *     ถ้าหมดเวลาที่การแตะ ให้ดูภาพหน้าจอใน test-results/ ว่าปุ่มอยู่ตรงไหน
 *   การตรวจว่าออกจากหน้านี้แล้วจึงดูว่าหัวข้อหายจากโครงสร้างหน้าจอ (isTitlePresent) ไม่ใช่ดูว่ามองไม่เห็น
 *   ความเสี่ยง: ปุ่ม Facebook อยู่เหนือปุ่มกลับ (register.tsx บรรทัด 278 ถึง 295) และปุ่มสมัครด้วย Google/Facebook ของหน้านี้เรียก OAuth ตรง
 *     ไม่ขึ้นกับ EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN (บรรทัด 260 ถึง 295) ถ้าแตะพลาด เทสจะแดง (หัวข้อยังอยู่) แต่หน้าต่างเข้าสู่ระบบอาจค้างอยู่
 *     tap ในคลาสนี้กดที่ชิ้นส่วนที่หาเจอหลังรอให้นิ่ง (locators.ts) ไม่ได้กดตามพิกัด จึงลดโอกาสนี้
 *   แอปที่ efab8d0 ยังไม่มี testID ในหน้านี้ ทุกชิ้นจึงหาด้วยข้อความกำกับ
 */
import { inEveryLanguage } from '../labels/index';
import { type ElementSpec, isPresent, isShown, tap, waitUntilShown } from './locators';

const BUTTON = 'XCUIElementTypeButton';

/**
 * จำนวนครั้งสูงสุดที่ปัดจอขึ้นเพื่อหาปุ่มกลับหรือปุ่มสร้างบัญชี
 * หน้าสมัครยาว 2 หน้าจอ (ขั้นรันเมื่อ 4 พ.ย. 2026: แถบเลื่อนบอก "2 pages" ปุ่มกลับอยู่ที่ y=1124 จอสูง 874) ปัด 1 ถึง 2 ครั้งน่าจะพอ
 * เผื่อไว้ 4 ครั้ง ถ้าครบแล้วยังไม่เห็น การแตะใน tapBackToLogin หรือ tapCreateAccount จะหมดเวลาพร้อมข้อความว่าหาปุ่มไม่เจอ
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

  private readonly createAccountButton: ElementSpec = {
    description: 'ปุ่มสร้างบัญชีของหน้าสมัครสมาชิก',
    testId: 'register.submit',
    labels: inEveryLanguage((labels) => labels.auth.registerButton),
    types: [BUTTON],
  };

  /** ข้อความแจ้งข้อผิดพลาดของฟอร์มสมัคร (Text ที่มี accessibilityRole="alert" เหนือปุ่มสร้างบัญชี: register.tsx บรรทัด 253) */
  private message(texts: readonly string[]): ElementSpec {
    return {
      description: 'ข้อความแจ้งข้อผิดพลาดของหน้าสมัครสมาชิก',
      testId: 'register.error',
      labels: texts,
    };
  }

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
    await this.swipeUntilShown(this.backButton);
    // tap รอให้ปุ่มหยุดเคลื่อนที่ก่อนแตะ (จอยังไหลอยู่ช่วงหนึ่งหลังปัด)
    await tap(this.backButton);
  }

  /**
   * ปัดจอขึ้นจนเห็นปุ่มสร้างบัญชี (ไม่เกิน MAX_SWIPES ครั้ง) แล้วแตะ ใช้กับฟอร์มที่ยังไม่ได้กรอกเท่านั้น
   * ทำไมไม่สมัครจริง: ด่านแรกของการส่งฟอร์มคือช่องที่ต้องกรอก 6 ช่อง (register.tsx บรรทัด 82 ถึง 85)
   *   ถ้าช่องใดว่าง แอปแสดงข้อความแล้วจบ ก่อนด่านยอมรับเงื่อนไข (บรรทัด 86) และก่อนเรียก signUp (บรรทัด 109)
   *   ทุกช่องเริ่มว่างเมื่อเปิดหน้า (บรรทัด 39 ถึง 45) และคลาสนี้ไม่มีเมธอดกรอกช่องใดเลย
   */
  async tapCreateAccount(): Promise<void> {
    await this.swipeUntilShown(this.createAccountButton);
    await tap(this.createAccountButton);
  }

  /**
   * ปุ่มสร้างบัญชียังอยู่ในโครงสร้างหน้าจอหรือไม่ (ไม่รอ แม้เลื่อนพ้นจอก็นับว่าอยู่) ใช้หลังแตะสร้างบัญชี เพื่อยืนยันว่ายังอยู่ที่ฟอร์มสมัคร
   * ใช้ "อยู่ในโครงสร้างหน้าจอ" ไม่ใช่ "มองเห็น" เพราะข้อความผิดพลาดถูกแทรกเหนือปุ่ม (บรรทัด 253 ถึง 254) ปุ่มจึงถูกดันลงและอาจพ้นขอบล่าง
   * ยังแยกถูกผิดได้: ปุ่มนี้หายจากโครงสร้างหน้าจอเมื่อแอปไปขั้นกรอกรหัสยืนยันอีเมล (บรรทัด 197) หรือเปลี่ยนหน้า
   */
  async isCreateAccountPresent(): Promise<boolean> {
    return isPresent(this.createAccountButton);
  }

  /**
   * ข้อความแจ้งข้อผิดพลาดที่ตรงกับข้อความใดข้อความหนึ่งที่ให้มา อยู่ในโครงสร้างหน้าจอหรือไม่ (ไม่รอ ไม่สนว่ามองเห็นหรือไม่)
   * ใช้ยืนยันว่ายังไม่มีข้อความก่อนแตะปุ่มสร้างบัญชี ต้องใช้ "อยู่ในโครงสร้างหน้าจอ" ไม่ใช่ "มองเห็น"
   *   เพราะข้อความมีที่เดียวคือเหนือปุ่มสร้างบัญชี (register.tsx บรรทัด 253 ถึง 254) ซึ่งก่อนปัดยังอยู่นอกจอ การตรวจ "มองไม่เห็น" ตรงนั้นจึงจริงเสมอ
   */
  async isErrorPresent(possibleTexts: readonly string[]): Promise<boolean> {
    return isPresent(this.message(possibleTexts));
  }

  /** รอข้อความแจ้งข้อผิดพลาดที่ตรงกับข้อความใดข้อความหนึ่งที่ให้มา แล้วคืนข้อความที่แสดง */
  async waitForError(possibleTexts: readonly string[]): Promise<string> {
    const element = await waitUntilShown(this.message(possibleTexts));
    return (await element.getAttribute('label')) ?? '';
  }

  /** ปัดจอขึ้นทีละครั้งจนเห็นชิ้นส่วน (ไม่เกิน MAX_SWIPES ครั้ง) ถ้าครบแล้วยังไม่เห็น การแตะที่ตามมาจะหมดเวลาพร้อมข้อความว่าหาไม่เจอ */
  private async swipeUntilShown(spec: ElementSpec): Promise<void> {
    for (let swipe = 0; swipe < MAX_SWIPES && !(await isShown(spec)); swipe += 1) {
      // mobile: swipe ทิศขึ้น = เลื่อนเนื้อหาขึ้น เพื่อดูส่วนล่างของหน้า (เป็นการปัด ไม่ใช่การแตะ จึงไม่กดชิ้นส่วนใด)
      await browser.execute('mobile: swipe', { direction: 'up' });
    }
  }
}
