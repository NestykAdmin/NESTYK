/**
 * เทสหน้าต้อนรับ: หน้าที่บังแอปทุกครั้งที่เปิดใหม่ ผู้ใช้ต้องแตะก่อนจึงเข้าแอปได้
 *
 * สิ่งที่ต้องมีก่อนรัน
 *   - iPhone จำลองเปิดอยู่ และมีแอป NESTYK ลงอยู่
 *   - แอปเป็น build ที่บทบาทตั้งต้นต้องล็อกอิน (EXPO_PUBLIC_DEFAULT_ROLE ไม่ใช่ guest) หลังหน้าต้อนรับจึงเป็นหน้า login
 *     ที่มา: apps/consumer-app/app/index.tsx บรรทัด 507 ถึง 528
 *   - ไม่ต้องเปิด API
 * ไฟล์นี้ไม่สร้างหรือแก้ข้อมูลในระบบ เทสล้างข้อมูลที่แอปเก็บไว้ในเครื่องจำลองก่อนเปิดแอป (ภาษาที่เลือก และการล็อกอิน)
 */
import { env } from '../src/config/env';
import { labelsFor } from '../src/labels/index';
import { LoginScreen } from '../src/screens/LoginScreen';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { startApp } from '../src/support/app';

describe('Welcome screen', () => {
  /** ข้อความที่คาด ในภาษาที่ชุดเทสสั่งให้แอปใช้ (E2E_APP_LANGUAGE) */
  const labels = labelsFor(env.appLanguage);
  const welcome = new WelcomeScreen();
  const login = new LoginScreen();

  it('covers the app on a cold start and opens the login screen after a tap @smoke', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่โดยไม่มีข้อมูลค้าง (เหตุผลอยู่ใน src/support/app.ts)
    await startApp({ clearData: true });

    // ขั้นที่ 2: หน้าต้อนรับพร้อมให้แตะ และชวนให้แตะเป็นภาษาที่สั่ง
    //   ที่มาของข้อความ: MobilePreloadScreen.tsx บรรทัด 334 ใช้คำแปล mobile.preload.tapToEnter
    expect(await welcome.enterButtonText()).toBe(labels.preload.tapToEnter);

    // ขั้นที่ 3: ระหว่างที่หน้าต้อนรับบังอยู่ ผู้ใช้ต้องยังไม่เห็นหน้า login
    //   (หน้า login ถูกวาดรออยู่ข้างใต้แล้ว จึงต้องตรวจว่า "มองไม่เห็น" ไม่ใช่ "ไม่มี")
    //   ข้อจำกัด: ค่า "มองเห็น" ที่ Appium ให้มา มาจากข้อมูลช่วยการเข้าถึงของ iOS ไม่ได้มาจากภาพบนจอ
    //   (ที่มา: WebDriverAgent 16.13.6 ไฟล์ XCUIElement+FBIsVisible.m)
    //   ข้อนี้จึงยืนยันว่าหน้าต้อนรับกันหน้าข้างใต้ไว้จากโปรแกรมอ่านหน้าจอ แต่ไม่ได้พิสูจน์ว่าภาพของหน้าต้อนรับทึบ
    expect(await login.isShown()).toBe(false);

    // ขั้นที่ 4: แตะเพื่อเข้าแอป
    await welcome.enter();

    // ขั้นที่ 5: ผู้ใช้เห็นหน้า login และหน้าต้อนรับไม่อยู่แล้ว
    await login.waitUntilShown();
    expect(await welcome.isShown()).toBe(false);
  });
});
