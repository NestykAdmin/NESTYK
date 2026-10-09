/**
 * เทสฟอร์มของหน้า login: ค่าตั้งต้นของช่องกรอก การตรวจค่าก่อนส่ง ข้อความเมื่อล็อกอินไม่ได้ และปุ่มต่าง ๆ บนหน้า
 *
 * สิ่งที่ต้องมีก่อนรัน
 *   - iPhone จำลองเปิดอยู่ และมีแอป NESTYK ลงอยู่ (build ที่บทบาทตั้งต้นต้องล็อกอิน)
 *   - ไม่ใช้ API: ทุกเทสในไฟล์นี้จบที่การตรวจฝั่งแอป ไม่มีข้อไหนตั้งใจล็อกอินให้สำเร็จ ควรรันตอนที่ API ปิดอยู่ (ดูข้อควรระวังข้างล่าง)
 *   - แอปไม่ได้ต่อ Supabase จริง (ค่า EXPO_PUBLIC_SUPABASE_URL ยังเป็นค่าตัวอย่าง) แอปจึงตัดสินอีเมลกับรหัสผ่านเองโดยไม่เรียกเครือข่าย
 *     ที่มา: apps/consumer-app/lib/auth/AuthContext.tsx บรรทัด 121 ถึง 178 และ lib/auth/supabase.ts บรรทัด 7 ถึง 9
 * ไฟล์นี้ไม่ตั้งใจสร้างหรือแก้ข้อมูลในระบบ เทสทุกข้อล้างข้อมูลที่แอปเก็บไว้ในเครื่องจำลองก่อนเปิดแอป
 *
 * ข้อควรระวังของไฟล์นี้: ใน build โหมดนักพัฒนา แอปเติมบัญชีนักพัฒนาไว้ใน 2 ช่องให้เอง
 *   - เทสที่ส่งฟอร์ม ยืนยันค่าใน 2 ช่องก่อนส่งทุกครั้ง เพื่อไม่ให้บัญชีที่เติมไว้ถูกส่งไปล็อกอินจริง
 *   - เทสที่แตะปุ่มอื่น (ลืมรหัสผ่าน สมัครสมาชิก บัญชีภายนอก) ไม่ได้ลบค่าใน 2 ช่องก่อน เพราะการลบเปิดแป้นพิมพ์
 *     และหน้านี้ปิดแป้นพิมพ์ได้ทางเดียวคือส่งฟอร์ม แป้นพิมพ์ที่ค้างอยู่จะบังปุ่มส่วนล่างของหน้า
 *     ถ้าการแตะพลาดไปโดนปุ่มเข้าสู่ระบบ และ API เปิดอยู่ แอปจะล็อกอินด้วยบัญชีนักพัฒนา (เรียก POST /auth/sync และอาจขอบทบาท admin
 *     ที่ /auth/dev/roles: AuthContext.tsx บรรทัด 46 ถึง 58 กับ 155 ถึง 172) เทสข้อนั้นจะแดงที่การตรวจว่ายังอยู่หน้า login
 *     ชุดเทสลดโอกาสนี้ด้วยการรอให้ปุ่มหยุดเคลื่อนที่ก่อนแตะ และถ้าปิด API ไว้ การล็อกอินนั้นจะไม่สำเร็จ
 */
import { env } from '../src/config/env';
import { openLoginScreen } from '../src/flows/open-login';
import { labelsFor, SOCIAL_PROVIDERS } from '../src/labels/index';
import type { LoginScreen } from '../src/screens/LoginScreen';
import { readUntil } from '../src/support/wait';

/**
 * อีเมลที่ไม่มีในระบบ ใช้โดเมน example.com ซึ่งสงวนไว้สำหรับตัวอย่าง จึงไม่ใช่บัญชีของใคร
 * ใช้คู่กับรหัสผ่านข้างล่าง เพื่อให้ไม่มีทางล็อกอินสำเร็จแม้ API จะเปิดอยู่
 */
const UNKNOWN_EMAIL = 'e2e-unknown-user@example.com';

/**
 * รหัสผ่านที่เทสพิมพ์เอง ไม่ใช่รหัสผ่านของบัญชีไหน ใช้แค่ตัวเลขกับขีด
 * เหตุผล: บน iPhone จำลองที่ใช้เทส ช่องรหัสผ่านแบบซ่อนตัวอักษรรับเฉพาะตัวอักษรที่มีปุ่มบนแป้นพิมพ์ที่เครื่องจำลองใช้อยู่
 *   ตัวอื่นหายไปโดยไม่มีข้อความแจ้ง (ขั้นที่ 29 กับ 30 เมื่อ 8 ต.ค. 2026: แป้นพิมพ์ไทยทิ้งตัวอักษรอังกฤษ แป้นพิมพ์อังกฤษทิ้งตัวอักษรไทย)
 *   ตัวเลขกับขีดเข้าช่องได้ครบทั้งกับแป้นพิมพ์ไทยและอังกฤษ (ขั้นที่ 28 กับ 31) เทสในไฟล์นี้จึงผ่านได้ไม่ว่าเครื่องจำลองจะใช้แป้นพิมพ์ไหน
 *   เทสในไฟล์นี้ตรวจกฎของฟอร์ม ไม่ได้ตรวจว่ารหัสผ่านมีตัวอักษรอะไร จึงใช้ค่านี้ได้โดยไม่เสียความหมายของเทส
 *   รายละเอียดอยู่ใน README หัวข้อ "ข้อควรรู้ของเครื่องจำลองที่ใช้เทส"
 */
const TEST_PASSWORD = '2026-1008-4242';

describe('Login form', () => {
  /** ข้อความที่คาด ในภาษาที่ชุดเทสสั่งให้แอปใช้ (E2E_APP_LANGUAGE) */
  const labels = labelsFor(env.appLanguage);

  /**
   * แทนรหัสผ่านที่แอปเติมให้ด้วยรหัสผ่านของเทส โดยยืนยันก่อนว่าของเดิมถูกลบหมดแล้วจริง
   * ทำ 2 จังหวะ (ลบ ยืนยันว่าว่าง แล้วพิมพ์) เพราะเทสอ่านรหัสผ่านที่ซ่อนอยู่ไม่ได้ นับได้แค่จำนวนตัวอักษร
   * ถ้าพิมพ์ทับเลยแล้วดูแค่ความยาว จะแยกไม่ออกเมื่อรหัสผ่านเดิมบังเอิญยาวเท่ากับของเทส
   */
  async function replacePrefilledPassword(login: LoginScreen): Promise<void> {
    await login.clearPassword();
    expect(await login.passwordLength()).toBe(0);
    await login.typePassword(TEST_PASSWORD);
  }

  it('prefills the developer account on a dev-auth build and leaves the fields empty otherwise', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login
    const login = await openLoginScreen();

    // ขั้นที่ 2: อ่านค่าตั้งต้นของ 2 ช่อง (นับเฉพาะจำนวนตัวอักษรของรหัสผ่าน ไม่อ่านตัวรหัส)
    const email = await login.emailText();
    const passwordLength = await login.passwordLength();

    // ขั้นที่ 3: เทียบกับโหมดของ build ที่ใช้เทส (ตั้งด้วย E2E_EXPECT_DEV_AUTH)
    //   ที่มาของพฤติกรรม: login.tsx บรรทัด 71 ถึง 76
    if (env.expectDevAuth) {
      expect(email).toBe(env.devLoginEmail);
      expect(passwordLength).toBeGreaterThan(0);
    } else {
      expect(email).toBe('');
      expect(passwordLength).toBe(0);
    }

    // ขั้นที่ 4: ไม่ว่าโหมดไหน ช่องรหัสผ่านต้องเริ่มแบบซ่อนตัวอักษร (login.tsx บรรทัด 62 กับ 272)
    expect(await login.passwordDisplay()).toBe('hidden');
  });

  it('asks for email and password when the login button is tapped with both fields empty', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login แล้วลบค่าใน 2 ช่อง
    const login = await openLoginScreen();
    await login.clearEmail();
    await login.clearPassword();

    // ขั้นที่ 2: ยืนยันว่าช่องว่างจริงก่อนส่ง
    //   ถ้าลบไม่สำเร็จแล้วส่งต่อ แอปจะล็อกอินด้วยบัญชีที่เติมไว้ เทสจะได้ผลผิดความหมาย
    expect(await login.emailText()).toBe('');
    expect(await login.passwordLength()).toBe(0);

    // ขั้นที่ 3: แตะปุ่มเข้าสู่ระบบ
    await login.tapLogin();

    // ขั้นที่ 4: แอปบอกให้กรอก และผู้ใช้ยังอยู่ที่หน้า login (กฎอยู่ที่ login.tsx บรรทัด 98 ถึง 101)
    expect(await login.waitForError([labels.auth.requiredFields])).toBe(labels.auth.requiredFields);
    expect(await login.isShown()).toBe(true);
  });

  it('asks for email and password when only the password is empty', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login แล้วพิมพ์อีเมลของเทส และลบรหัสผ่าน
    //   กฎของแอปตรวจ 2 ช่องแยกกัน (login.tsx บรรทัด 98: !email.trim() || !password) ข้อนี้ตรวจฝั่งรหัสผ่าน
    const login = await openLoginScreen();
    await login.typeEmail(UNKNOWN_EMAIL);
    await login.clearPassword();

    // ขั้นที่ 2: ยืนยันว่าช่องอีเมลมีค่าที่พิมพ์ และช่องรหัสผ่านว่างจริง
    expect(await login.emailText()).toBe(UNKNOWN_EMAIL);
    expect(await login.passwordLength()).toBe(0);

    // ขั้นที่ 3: ส่งฟอร์มด้วยปุ่ม go บนแป้นพิมพ์ แล้วแอปต้องบอกให้กรอก และผู้ใช้ยังอยู่ที่หน้า login
    await login.submitFromKeyboard();
    expect(await login.waitForError([labels.auth.requiredFields])).toBe(labels.auth.requiredFields);
    expect(await login.isShown()).toBe(true);
  });

  it('treats an email made of a single space as empty', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login แล้วใส่ช่องว่าง 1 ตัวในช่องอีเมล และใส่รหัสผ่านของเทส
    //   แอปตัดช่องว่างหัวท้ายของอีเมลก่อนตรวจ (login.tsx บรรทัด 98: !email.trim())
    const login = await openLoginScreen();
    await login.typeEmail(' ');
    await replacePrefilledPassword(login);

    // ขั้นที่ 2: ยืนยันว่าทั้ง 2 ช่องมีค่าตามที่พิมพ์
    expect(await login.emailText()).toBe(' ');
    expect(await login.passwordLength()).toBe(TEST_PASSWORD.length);

    // ขั้นที่ 3: ส่งฟอร์มด้วยปุ่ม go บนแป้นพิมพ์ แล้วแอปต้องบอกให้กรอก เหมือนกรณีช่องว่าง
    await login.submitFromKeyboard();
    expect(await login.waitForError([labels.auth.requiredFields])).toBe(labels.auth.requiredFields);
    expect(await login.isShown()).toBe(true);
  });

  it('rejects an unknown account and keeps the user on the login screen', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login แล้วพิมพ์อีเมลที่ไม่มีในระบบ กับรหัสผ่านของเทส
    const login = await openLoginScreen();
    await login.typeEmail(UNKNOWN_EMAIL);
    await replacePrefilledPassword(login);

    // ขั้นที่ 2: ยืนยันว่าค่าที่จะส่งคือค่าที่เทสพิมพ์ ไม่ใช่บัญชีที่แอปเติมให้
    expect(await login.emailText()).toBe(UNKNOWN_EMAIL);
    expect(await login.passwordLength()).toBe(TEST_PASSWORD.length);

    // ขั้นที่ 3: ส่งฟอร์มด้วยปุ่ม go บนแป้นพิมพ์
    await login.submitFromKeyboard();

    // ขั้นที่ 4: แอปต้องแจ้งว่าอีเมลหรือรหัสผ่านไม่ถูกต้องเป็นภาษาเดียวกับแอป (คำแปล mobile.auth.invalidCredentials) และผู้ใช้ยังอยู่ที่หน้า login
    //   ข้อนี้เคยเป็นบั๊ก MOB-001: แอปแสดงข้อความอังกฤษ "Invalid email or password" จาก AuthContext.tsx บรรทัด 175 แม้แอปตั้งเป็นภาษาไทย
    //   ทีมแก้ใน commit f9b9bea: login.tsx บรรทัด 107 ใช้ localizedError (packages/i18n/src/error-message.ts บรรทัด 26 ถึง 29)
    //   ซึ่งแสดงข้อความของข้อผิดพลาดเฉพาะเมื่อเขียนด้วยอักษรของภาษาที่แอปใช้ ไม่อย่างนั้นแสดงคำแปลนี้แทน 2 ภาษาที่ชุดเทสรันได้จึงตรวจคนละเรื่อง
    //   - ภาษาไทย (ค่าตั้งต้น): จับ MOB-001 ได้ แต่ข้อผิดพลาดทุกแบบที่ไม่มีตัวอักษรไทยจะออกมาเป็นคำแปลเดียวกัน จึงแยกไม่ออกว่าแอปปฏิเสธเพราะอะไร
    //   - ภาษาอังกฤษ: คำแปลตรงกับข้อความของบั๊ก จึงจับ MOB-001 ไม่ได้ แต่เห็นข้อความจริงของข้อผิดพลาด
    //   ถ้าขั้นนี้หมดเวลา ให้ดูในไฟล์ XML ของ test-results ว่าแอปแสดงข้อความอะไร
    //   - "Invalid email or password" ขณะรันภาษาไทย: บั๊ก MOB-001 กลับมา
    //   - ข้อความของ Supabase ขณะรันภาษาอังกฤษ: build ต่อ Supabase จริง (AuthContext.tsx บรรทัด 127 ถึง 141) ซึ่งไม่ตรงกับสิ่งที่ต้องมีก่อนรัน ไม่ใช่แอปพัง
    expect(await login.waitForError([labels.auth.invalidCredentials])).toBe(labels.auth.invalidCredentials);
    expect(await login.isShown()).toBe(true);
  });

  it('shows and hides the password with the eye button', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login แล้วแทนรหัสผ่านที่แอปเติมให้ด้วยรหัสผ่านของเทส
    //   ต้องทำก่อนกดปุ่มตา เพื่อไม่ให้รหัสผ่านที่แอปเติมให้ถูกแสดงบนจอหรือในผลเทส
    const login = await openLoginScreen();
    await replacePrefilledPassword(login);

    // ขั้นที่ 2: ช่องมีรหัสผ่านของเทส เริ่มแบบซ่อนตัวอักษร และปุ่มตาบอกว่ากดแล้วจะ "แสดง"
    expect(await login.passwordLength()).toBe(TEST_PASSWORD.length);
    expect(await login.passwordDisplay()).toBe('hidden');
    expect(await login.passwordToggleLabel()).toBe(labels.auth.showPassword);

    // ขั้นที่ 3: แตะปุ่มตา แล้วช่องแสดงตัวอักษรที่พิมพ์ และปุ่มบอกว่ากดแล้วจะ "ซ่อน" (login.tsx บรรทัด 272 กับ 307 ถึง 309)
    await login.togglePasswordVisibility();
    expect(await readUntil(() => login.passwordDisplay(), 'visible')).toBe('visible');
    expect(await login.visiblePasswordText()).toBe(TEST_PASSWORD);
    expect(await login.passwordToggleLabel()).toBe(labels.auth.hidePassword);

    // ขั้นที่ 4: แตะอีกครั้ง แล้วช่องกลับไปซ่อนตัวอักษร
    await login.togglePasswordVisibility();
    expect(await readUntil(() => login.passwordDisplay(), 'hidden')).toBe('hidden');
    expect(await login.passwordToggleLabel()).toBe(labels.auth.showPassword);
  });

  it('tells the user that password recovery is not available yet', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login แล้วแตะ ลืมรหัสผ่าน?
    const login = await openLoginScreen();
    await login.tapForgotPassword();

    // ขั้นที่ 2: แอปแจ้งว่ายังไม่เปิดใช้ และไม่พาไปหน้าอื่น (login.tsx บรรทัด 323)
    expect(await login.waitForNotice([labels.auth.resetUnavailable])).toBe(labels.auth.resetUnavailable);
    expect(await login.isShown()).toBe(true);
  });

  it('tells the user that sign-up is not available yet', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login แล้วแตะ สมัครสมาชิก
    const login = await openLoginScreen();
    await login.tapSignUp();

    // ขั้นที่ 2: แอปแจ้งว่ายังไม่เปิดใช้ และไม่พาไปหน้าอื่น (login.tsx บรรทัด 421)
    expect(await login.waitForNotice([labels.auth.signupUnavailable])).toBe(labels.auth.signupUnavailable);
    expect(await login.isShown()).toBe(true);
  });

  // ปุ่มบัญชีภายนอกมี 3 ปุ่ม ใช้โค้ดเดียวกัน (login.tsx บรรทัด 370 ถึง 400) เทสแยกปุ่มละข้อ เพื่อให้รู้ว่าปุ่มไหนเสีย
  for (const provider of SOCIAL_PROVIDERS) {
    it(`tells the user that ${provider} sign-in is not available yet`, async () => {
      // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login แล้วแตะปุ่มของผู้ให้บริการ
      const login = await openLoginScreen();
      await login.tapSocial(provider);

      // ขั้นที่ 2: แอปแจ้งว่ายังไม่เปิดใช้ และไม่พาไปหน้าอื่น (login.tsx บรรทัด 381)
      expect(await login.waitForNotice([labels.auth.unavailable])).toBe(labels.auth.unavailable);
      expect(await login.isShown()).toBe(true);
    });
  }
});
