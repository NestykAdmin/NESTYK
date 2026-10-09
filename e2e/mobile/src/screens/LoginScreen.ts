/**
 * หน้า login (Page Object)
 *
 * รวมวิธีหาและวิธีสั่งงานชิ้นส่วนของหน้า login ไว้ที่นี่ที่เดียว ไฟล์เทสเรียกผ่านคลาสนี้
 * คลาสนี้ไม่ตรวจผล (ไม่มี expect) การตรวจอยู่ในไฟล์เทส เพื่อให้อ่านไฟล์เทสแล้วรู้ว่าแต่ละข้อคาดอะไร
 * คลาสนี้หาชิ้นส่วนได้ไม่ว่าแอปจะแสดงภาษาไหนในภาษาที่ชุดเทสรู้จัก เทสที่ต้องการรู้ว่าแอปแสดงภาษาอะไร ให้อ่านข้อความแล้วเทียบเอง
 * ที่มาของหน้าจอ: apps/consumer-app/app/login.tsx (อ่านที่ commit 0b7682c และปรับเลขบรรทัดตาม a6b3b1e)
 */
import { inEveryLanguage, type SocialProvider, socialLoginLabel } from '../labels/index';
import { reportKeyboardForMissingCharacters } from '../support/keyboard';
import { readUntil } from '../support/wait';
import { type ElementSpec, isShown, tap, waitUntilShown, waitUntilSteady } from './locators';

/** ชนิดของชิ้นส่วนบน iOS ที่หน้านี้ใช้แยกชิ้นส่วนที่ชื่อซ้ำกัน */
const TEXT_FIELD = 'XCUIElementTypeTextField';
const SECURE_TEXT_FIELD = 'XCUIElementTypeSecureTextField';
const BUTTON = 'XCUIElementTypeButton';

/** ปุ่ม go บนแป้นพิมพ์ของช่องรหัสผ่าน (login.tsx บรรทัด 278 ถึง 279: returnKeyType="go" เรียก onSubmit) */
const KEYBOARD_GO = '\n';

/**
 * เวลารอให้จำนวนตัวอักษรในช่องรหัสผ่านเท่ากับที่พิมพ์ ก่อนถือว่าได้ไม่ครบ (มิลลิวินาที) ใช้ใน typePassword
 * ช่องของแอปรับค่ากลับจากโค้ด JavaScript ค่าในช่องจึงอาจเปลี่ยนช้ากว่าการพิมพ์เล็กน้อย ค่าเดียวกับไฟล์ทดลองของขั้นที่ 27 ถึง 30
 */
const TYPED_SETTLE_MS = 3000;

/** testID ของช่องรหัสผ่าน ส่งออกให้ตัวเก็บหลักฐาน (src/support/artifacts.ts) ใช้ซ่อนค่าของช่องนี้ */
export const PASSWORD_FIELD_TEST_ID = 'login.password';

export class LoginScreen {
  // ---------- ชิ้นส่วนของหน้า (testId คือชื่อที่เสนอให้ทีมเพิ่มในแอป) ----------

  private readonly loginButton: ElementSpec = {
    description: 'ปุ่มเข้าสู่ระบบ',
    testId: 'login.submit',
    labels: inEveryLanguage((labels) => labels.auth.loginButton),
    types: [BUTTON],
  };

  private readonly emailField: ElementSpec = {
    description: 'ช่องอีเมล',
    testId: 'login.email',
    labels: inEveryLanguage((labels) => labels.auth.email),
    // คำว่า "อีเมล" เป็นทั้งป้ายเหนือช่องและชื่อของช่องกรอก จึงต้องระบุชนิด
    types: [TEXT_FIELD],
  };

  private readonly passwordField: ElementSpec = {
    description: 'ช่องรหัสผ่าน',
    testId: PASSWORD_FIELD_TEST_ID,
    labels: inEveryLanguage((labels) => labels.auth.password),
    // ช่องรหัสผ่านเป็นชนิด SecureTextField ตอนซ่อนตัวอักษร และเป็น TextField ตอนแสดงตัวอักษร
    types: [SECURE_TEXT_FIELD, TEXT_FIELD],
  };

  private readonly passwordToggle: ElementSpec = {
    description: 'ปุ่มแสดงหรือซ่อนรหัสผ่าน',
    testId: 'login.togglePassword',
    // ชื่อกำกับของปุ่มนี้เปลี่ยนตามสถานะ (login.tsx บรรทัด 307 ถึง 309)
    labels: [
      ...inEveryLanguage((labels) => labels.auth.showPassword),
      ...inEveryLanguage((labels) => labels.auth.hidePassword),
    ],
  };

  private readonly forgotPasswordButton: ElementSpec = {
    description: 'ปุ่มลืมรหัสผ่าน',
    testId: 'login.forgot',
    labels: inEveryLanguage((labels) => labels.auth.forgotPassword),
  };

  private readonly signUpButton: ElementSpec = {
    description: 'ปุ่มสมัครสมาชิก',
    testId: 'login.signup',
    labels: inEveryLanguage((labels) => labels.auth.signUp),
  };

  private readonly languageButton: ElementSpec = {
    description: 'ปุ่มภาษา',
    testId: 'login.language',
    labels: inEveryLanguage((labels) => labels.settings.language),
    // หัวข้อของแผ่นเลือกภาษาใช้คำเดียวกัน ("ภาษา") แต่เป็นข้อความ ไม่ใช่ปุ่ม
    types: [BUTTON],
  };

  private socialButton(provider: SocialProvider): ElementSpec {
    return {
      description: `ปุ่มเข้าสู่ระบบด้วย ${provider}`,
      testId: `login.${provider.toLowerCase()}`,
      labels: inEveryLanguage((labels) => socialLoginLabel(labels, provider)),
    };
  }

  private message(kind: 'error' | 'notice', texts: readonly string[]): ElementSpec {
    return {
      description: kind === 'error' ? 'ข้อความแจ้งข้อผิดพลาด' : 'ข้อความแจ้งเตือน',
      testId: `login.${kind}`,
      labels: texts,
    };
  }

  // ---------- สถานะของหน้า ----------

  /** รอจนผู้ใช้เห็นหน้า login (ใช้ปุ่มเข้าสู่ระบบเป็นตัวบอก) */
  async waitUntilShown(): Promise<void> {
    await waitUntilShown(this.loginButton);
  }

  /** ตอนนี้ผู้ใช้เห็นหน้า login อยู่หรือไม่ */
  async isShown(): Promise<boolean> {
    return isShown(this.loginButton);
  }

  /** ข้อความบนปุ่มเข้าสู่ระบบ ใช้ดูว่าหน้านี้กำลังแสดงเป็นภาษาอะไร */
  async loginButtonText(): Promise<string> {
    return this.labelOf(this.loginButton);
  }

  /** ข้อความที่อยู่ในช่องอีเมล (ช่องว่างได้ค่าว่าง) */
  async emailText(): Promise<string> {
    return this.fieldText(this.emailField);
  }

  /** ช่องรหัสผ่านกำลังซ่อนหรือแสดงตัวอักษร ดูจากชนิดของช่อง จึงไม่ขึ้นกับภาษา */
  async passwordDisplay(): Promise<'hidden' | 'visible'> {
    const field = await waitUntilShown(this.passwordField);
    return (await field.getTagName()) === SECURE_TEXT_FIELD ? 'hidden' : 'visible';
  }

  /**
   * จำนวนตัวอักษรในช่องรหัสผ่าน (0 = ว่าง)
   * ตอนซ่อนตัวอักษร iOS ให้ค่าเป็นจุดแทนตัวอักษร จึงนับได้โดยไม่ต้องรู้รหัสผ่าน
   */
  async passwordLength(): Promise<number> {
    return (await this.fieldText(this.passwordField)).length;
  }

  /**
   * ตัวอักษรที่เห็นในช่องรหัสผ่าน ใช้ได้เฉพาะตอนช่องแสดงตัวอักษร
   * ห้ามเรียกกับรหัสผ่านที่แอปเติมให้เอง ให้พิมพ์ค่าของเทสลงไปก่อน เพื่อไม่ให้รหัสผ่านจริงไปอยู่ในผลเทสหรือ log
   */
  async visiblePasswordText(): Promise<string> {
    if ((await this.passwordDisplay()) !== 'visible') {
      throw new Error('ช่องรหัสผ่านกำลังซ่อนตัวอักษรอยู่ จึงอ่านตัวอักษรไม่ได้');
    }
    return this.fieldText(this.passwordField);
  }

  /** ชื่อกำกับปัจจุบันของปุ่มแสดงหรือซ่อนรหัสผ่าน (สิ่งที่โปรแกรมอ่านหน้าจออ่านให้ผู้ใช้ฟัง) */
  async passwordToggleLabel(): Promise<string> {
    return this.labelOf(this.passwordToggle);
  }

  // ---------- การสั่งงาน ----------

  // ทุกคำสั่งในส่วนนี้รอให้ชิ้นส่วนหยุดเคลื่อนที่ก่อน (waitUntilSteady หรือ tap ใน locators.ts)
  // เพราะฟอร์มขยับขึ้นลงเมื่อแป้นพิมพ์เปิดหรือปิด (login.tsx บรรทัด 81 กับ 153 ถึง 176)

  /** ลบข้อความในช่องอีเมล (แป้นพิมพ์จะเปิดขึ้น เพราะตัวขับต้องแตะช่องก่อนลบ) */
  async clearEmail(): Promise<void> {
    await (await waitUntilSteady(this.emailField)).clearValue();
  }

  /** ลบของเดิมแล้วพิมพ์ข้อความลงช่องอีเมล */
  async typeEmail(text: string): Promise<void> {
    await (await waitUntilSteady(this.emailField)).setValue(text);
  }

  /** ลบข้อความในช่องรหัสผ่าน */
  async clearPassword(): Promise<void> {
    await (await waitUntilSteady(this.passwordField)).clearValue();
  }

  /**
   * ลบของเดิมแล้วพิมพ์ข้อความลงช่องรหัสผ่าน
   * ถ้าช่องกำลังซ่อนตัวอักษรและได้ตัวอักษรน้อยกว่าที่พิมพ์ จะพิมพ์บรรทัด [แป้นพิมพ์] บอกแป้นพิมพ์ที่ขึ้นอยู่ (src/support/keyboard.ts)
   * เพราะช่องแบบนี้บนเครื่องจำลองที่ใช้เทสรับเฉพาะตัวอักษรที่มีปุ่มบนแป้นพิมพ์ที่ใช้อยู่ (README หัวข้อ "ข้อควรรู้ของเครื่องจำลองที่ใช้เทส")
   * ส่วนนี้ไม่ตรวจผล การตรวจว่าได้ครบไหมยังอยู่ที่ expect ในไฟล์เทส
   */
  async typePassword(text: string): Promise<void> {
    await (await waitUntilSteady(this.passwordField)).setValue(text);
    await this.explainMissingCharacters(text);
  }

  /**
   * ส่งฟอร์มด้วยปุ่ม go บนแป้นพิมพ์ของช่องรหัสผ่าน
   * แอปเรียกฟังก์ชันเดียวกับตอนกดปุ่มเข้าสู่ระบบ (login.tsx บรรทัด 279 กับ 344)
   */
  async submitFromKeyboard(): Promise<void> {
    await (await waitUntilSteady(this.passwordField)).addValue(KEYBOARD_GO);
  }

  /**
   * แตะปุ่มเข้าสู่ระบบ
   * ใช้ได้แม้แป้นพิมพ์เปิดอยู่: หน้านี้ย่อส่วนหัวเมื่อช่องกรอกถูกเลือก เพื่อให้ฟอร์มกับปุ่มนี้อยู่เหนือแป้นพิมพ์ (login.tsx บรรทัด 81 กับ 153 ถึง 176)
   */
  async tapLogin(): Promise<void> {
    await tap(this.loginButton);
  }

  /** แตะปุ่มรูปตาเพื่อสลับระหว่างแสดงกับซ่อนรหัสผ่าน */
  async togglePasswordVisibility(): Promise<void> {
    await tap(this.passwordToggle);
  }

  async tapForgotPassword(): Promise<void> {
    await tap(this.forgotPasswordButton);
  }

  async tapSignUp(): Promise<void> {
    await tap(this.signUpButton);
  }

  async tapSocial(provider: SocialProvider): Promise<void> {
    await tap(this.socialButton(provider));
  }

  /** แตะปุ่มภาษาเพื่อเปิดแผ่นเลือกภาษา (ดู LanguageSheet) */
  async openLanguageSheet(): Promise<void> {
    await tap(this.languageButton);
  }

  // ---------- ข้อความที่แอปแจ้งผู้ใช้ ----------

  /**
   * รอข้อความแจ้งข้อผิดพลาดใต้ช่องรหัสผ่าน แล้วคืนข้อความที่แสดง
   * ส่งข้อความที่เป็นไปได้มากกว่า 1 แบบได้ เมื่อเทสต้องการรู้ว่าแอปแสดงแบบไหน
   */
  async waitForError(possibleTexts: readonly string[]): Promise<string> {
    return this.labelOf(this.message('error', possibleTexts));
  }

  /** รอข้อความแจ้งเตือนในกล่องเหนือปุ่มสมัครสมาชิก แล้วคืนข้อความที่แสดง */
  async waitForNotice(possibleTexts: readonly string[]): Promise<string> {
    return this.labelOf(this.message('notice', possibleTexts));
  }

  // ---------- ตัวช่วยภายใน ----------

  /**
   * หลัง typePassword: ถ้าช่องกำลังซ่อนตัวอักษรและได้ตัวอักษรน้อยกว่าที่พิมพ์ ให้พิมพ์บรรทัด [แป้นพิมพ์]
   * นับจากจุดในช่องแบบเดียวกับ passwordLength จึงไม่อ่านว่าเป็นตัวอักษรอะไร และไม่อ่านช่องที่กำลังแสดงตัวอักษร
   * นับความยาวแบบเดียวกับ expect ในไฟล์เทส (TEST_PASSWORD.length) เพื่อให้บรรทัดนี้ขึ้นในกรณีเดียวกับที่ expect เรื่องจำนวนแดง
   * แต่ละการรอในส่วนนี้ไม่เกิน TYPED_SETTLE_MS (ไม่ใช้ passwordDisplay กับ passwordLength ซึ่งรอช่องได้ถึง E2E_WAIT_MS)
   *   รวมทั้งส่วนจึงไม่เกินราว 12 วินาทีแม้ทุกการรอจะรอจนหมดเวลา ถ้าช่องหายไปจากจอ ส่วนนี้จะจบแล้วให้ expect ในไฟล์เทสรายงานเอง
   * ไม่เปลี่ยนผลเทส: ถ้าตรวจไม่ได้ จะพิมพ์ว่าตรวจไม่ได้แล้วไปต่อ ให้ expect ในไฟล์เทสเป็นตัวตัดสิน
   */
  private async explainMissingCharacters(text: string): Promise<void> {
    try {
      const field = await waitUntilShown(this.passwordField, TYPED_SETTLE_MS);
      if ((await field.getTagName()) !== SECURE_TEXT_FIELD) return;
      const typed = text.length;
      const got = await readUntil(
        async () => (await this.fieldText(this.passwordField, TYPED_SETTLE_MS)).length,
        typed,
        TYPED_SETTLE_MS,
      );
      if (got < typed) await reportKeyboardForMissingCharacters('ช่องรหัสผ่านแบบซ่อนตัวอักษร', got);
    } catch (error) {
      const reason = (error instanceof Error ? error.message : String(error)).split('\n')[0].slice(0, 160);
      console.log(`[แป้นพิมพ์] นับตัวอักษรในช่องรหัสผ่านหลังพิมพ์ไม่ได้ จึงไม่ได้ดูแป้นพิมพ์ (${reason})`);
    }
  }

  /** รอจนเห็นชิ้นส่วน แล้วคืนข้อความกำกับ (label) ของมัน อ่านได้เหมือนกันไม่ว่าจะหาเจอด้วย testID หรือด้วยข้อความ */
  private async labelOf(spec: ElementSpec): Promise<string> {
    const element = await waitUntilShown(spec);
    return (await element.getAttribute('label')) ?? '';
  }

  /**
   * ข้อความในช่องกรอก โดยถือว่าช่องว่างเมื่อค่าที่ iOS ให้มาเท่ากับข้อความตัวอย่างของช่อง (placeholder)
   * เหตุผล: iOS รายงานค่าของช่องที่ว่างเป็นข้อความตัวอย่าง ถ้าไม่เทียบ เทสจะเข้าใจว่าช่องมีข้อความอยู่
   * @param timeoutMs เวลารอให้เห็นช่องสูงสุด ไม่ใส่ = ค่าตั้งของชุดเทส (E2E_WAIT_MS)
   */
  private async fieldText(spec: ElementSpec, timeoutMs?: number): Promise<string> {
    const field = await waitUntilShown(spec, timeoutMs);
    const value = (await field.getAttribute('value')) ?? '';
    const placeholder = (await field.getAttribute('placeholderValue')) ?? '';
    return value === placeholder ? '' : value;
  }
}
