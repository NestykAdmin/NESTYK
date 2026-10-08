/**
 * เทสการเปลี่ยนภาษาจากหน้า login: เลือกภาษาแล้วหน้าจอต้องเปลี่ยนทันที และแอปต้องจำภาษาที่เลือกไว้
 *
 * สิ่งที่ต้องมีก่อนรัน
 *   - iPhone จำลองเปิดอยู่ และมีแอป NESTYK ลงอยู่ (build ที่บทบาทตั้งต้นต้องล็อกอิน)
 *   - ไม่ต้องเปิด API
 * ไฟล์นี้เปลี่ยนข้อมูลที่แอปเก็บไว้ในเครื่องจำลอง 1 อย่าง คือภาษาที่ผู้ใช้เลือก (AsyncStorage ชื่อ @nestyk/preferred_locale)
 *   เก็บกวาดโดยล้างข้อมูลของแอปก่อนทุกเทส และอีกครั้งหลังเทสสุดท้ายของไฟล์ ไม่สร้างหรือแก้ข้อมูลในระบบ
 *
 * ไฟล์นี้กำหนดภาษาเองทุกจุด (เริ่มที่ไทย แล้วเปลี่ยนเป็นอังกฤษ) จึงไม่ใช้ค่า E2E_APP_LANGUAGE
 * วิธีดูว่าหน้า login แสดงภาษาอะไร: อ่านข้อความบนปุ่มเข้าสู่ระบบ แล้วเทียบกับคำแปลของภาษานั้น
 */
import { openLoginScreen } from '../src/flows/open-login';
import { labelsFor, LANGUAGE_OPTIONS } from '../src/labels/index';
import { LanguageSheet } from '../src/screens/LanguageSheet';
import type { LoginScreen } from '../src/screens/LoginScreen';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { startApp } from '../src/support/app';
import { readUntil } from '../src/support/wait';

describe('Login screen language', () => {
  const thai = labelsFor('th');
  const english = labelsFor('en');
  const welcome = new WelcomeScreen();
  const languageSheet = new LanguageSheet();

  after(async () => {
    // ล้างภาษาที่เทสเลือกไว้ ไม่ให้ค้างในเครื่องจำลองหลังไฟล์นี้จบ (ทำแม้เทสจะไม่ผ่าน)
    await startApp({ clearData: true });
  });

  /**
   * ขั้นเตรียมของไฟล์นี้: หน้า login ที่แสดงเป็นภาษาไทย
   * ล้างภาษาที่เคยเลือก แล้วเปิดแอปโดยให้เครื่องเป็นภาษาไทย และยืนยันว่าหน้าจอเป็นภาษาไทยจริง
   * ถ้าจุดเริ่มต้นไม่ใช่ภาษาไทย การ "เปลี่ยนเป็นอังกฤษ" ในเทสจะพิสูจน์อะไรไม่ได้
   */
  async function openLoginScreenInThai(): Promise<LoginScreen> {
    const login = await openLoginScreen({ deviceLanguage: 'th' });
    expect(await login.loginButtonText()).toBe(thai.auth.loginButton);
    return login;
  }

  it('switches the login screen to English from the language sheet', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login ภาษาไทย แล้วแตะปุ่มภาษา
    const login = await openLoginScreenInThai();
    await login.openLanguageSheet();

    // ขั้นที่ 2: แผ่นเลือกภาษาแสดงตัวเลือกครบ 4 ภาษา (อ่านซ้ำได้ เพราะแผ่นใช้เวลาเลื่อนขึ้น)
    //   ที่มา: packages/ui/src/components/MobileLanguagePickerBody.tsx บรรทัด 9
    const allOptions = [...LANGUAGE_OPTIONS];
    expect(await readUntil(() => languageSheet.shownOptions(), allOptions)).toEqual(allOptions);

    // ขั้นที่ 3: เลือก English แผ่นต้องปิดเอง (login.tsx บรรทัด 464)
    await languageSheet.choose('en');

    // ขั้นที่ 4: หน้า login เปลี่ยนเป็นภาษาอังกฤษโดยไม่ต้องเปิดแอปใหม่
    expect(await readUntil(() => login.loginButtonText(), english.auth.loginButton)).toBe(english.auth.loginButton);
  });

  it('keeps the chosen language after the app restarts', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login ภาษาไทย เลือก English แล้วรอจนหน้า login เป็นภาษาอังกฤษ
    const login = await openLoginScreenInThai();
    await login.openLanguageSheet();
    await languageSheet.choose('en');
    expect(await readUntil(() => login.loginButtonText(), english.auth.loginButton)).toBe(english.auth.loginButton);

    // ขั้นที่ 2: ปิดแล้วเปิดแอปใหม่ โดยไม่ล้างข้อมูล และเครื่องยังเป็นภาษาไทยเหมือนเดิม
    //   แอปสั่งบันทึกภาษาโดยไม่รอผล (void savePreferredLocale ใน _layout.tsx บรรทัด 83 ถึง 85) และเทสมองไม่เห็นว่าบันทึกเสร็จเมื่อไร
    //   การบันทึกเริ่มพร้อมกับที่จอเปลี่ยนภาษา ซึ่งเทสรอจนเห็นแล้วในขั้นที่ 1 ถ้าข้อนี้แดงเป็นบางรอบ ให้สงสัยจังหวะนี้ก่อน
    await startApp({ clearData: false, deviceLanguage: 'th' });
    await welcome.enter();
    await login.waitUntilShown();

    // ขั้นที่ 3: แอปต้องเปิดเป็นภาษาอังกฤษ เพราะภาษาที่ผู้ใช้เลือกต้องมาก่อนภาษาของเครื่อง
    //   ที่มา: apps/consumer-app/app/_layout.tsx บรรทัด 73 ถึง 81
    expect(await readUntil(() => login.loginButtonText(), english.auth.loginButton)).toBe(english.auth.loginButton);
  });
});
