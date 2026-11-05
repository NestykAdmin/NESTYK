/**
 * เทสการตรวจค่าก่อนส่งของหน้ารีเซ็ตรหัสผ่านและหน้าสมัครสมาชิก: ส่งฟอร์มที่ยังไม่กรอก แล้วแอปต้องบอกให้กรอกโดยไม่ไปขั้นถัดไป
 *
 * สิ่งที่ต้องมีก่อนรัน: เหมือนหัวไฟล์ tests/login-form.spec.ts (iPhone จำลอง แอป build โหมดนักพัฒนาที่บทบาทตั้งต้นต้องล็อกอิน ไม่ต่อ Supabase จริง)
 *   - ไม่ใช้ API และไม่เรียกเครือข่าย: ทั้ง 2 หน้าตรวจค่าในแอปแล้วจบ ก่อนส่งคำขอใด ๆ (ที่มาอยู่ในแต่ละเทส) ควรรันตอนที่ API ปิดอยู่
 *     ด้วยเหตุผลเดียวกับ login-form.spec.ts: เทสแตะปุ่มบนหน้า login ที่มีบัญชีนักพัฒนาเติมไว้ ถ้าแตะพลาดไปโดนปุ่มเข้าสู่ระบบ แอปจะล็อกอินจริง
 *   - build มี site key ของ hCaptcha ก็ยังได้ผลเดียวกัน เพราะด่าน captcha อยู่หลังด่านที่เทสนี้ตรวจ
 *     (reset-password.tsx บรรทัด 73 ก่อน 77 และ register.tsx บรรทัด 82 ก่อน 102 ที่ efab8d0)
 * ไฟล์นี้ไม่สร้างหรือแก้ข้อมูลในระบบ ไม่ขออีเมลรีเซ็ตรหัสผ่าน และไม่สมัครบัญชี เทสทุกข้อล้างข้อมูลที่แอปเก็บไว้ในเครื่องจำลองก่อนเปิดแอป
 */
import { env } from '../src/config/env';
import { openLoginScreen } from '../src/flows/open-login';
import { labelsFor } from '../src/labels/index';
import { RegisterScreen } from '../src/screens/RegisterScreen';
import { ResetPasswordScreen } from '../src/screens/ResetPasswordScreen';

describe('Reset password and sign-up forms', () => {
  /** ข้อความที่คาด ในภาษาที่ชุดเทสสั่งให้แอปใช้ (E2E_APP_LANGUAGE) */
  const labels = labelsFor(env.appLanguage);

  it('asks for a valid email when the reset form is sent with the email empty', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login แล้วแตะ ลืมรหัสผ่าน? หน้ารีเซ็ตต้องเปิดขึ้นที่ขั้นกรอกอีเมล
    //   เปิดแอปใหม่แล้วหน้านี้เริ่มที่ขั้น 'email' และช่องอีเมลว่าง (reset-password.tsx บรรทัด 25 ถึง 26 ที่ efab8d0)
    const login = await openLoginScreen();
    await login.tapForgotPassword();
    const reset = new ResetPasswordScreen();
    expect(await reset.titleText()).toBe(labels.auth.resetTitle);

    // ขั้นที่ 2: ยืนยันว่าช่องอีเมลของหน้านี้ว่างจริง และยังไม่มีข้อความผิดพลาด
    //   emailLength รอจนนับช่องอีเมลในโครงสร้างหน้าจอได้ 1 ช่องก่อนอ่าน จึงไม่อ่านได้ช่องของหน้า login ที่มีบัญชีนักพัฒนาเติมไว้
    //   และคืนแค่จำนวนตัวอักษร ถ้าไม่ผ่าน ผลเทสจึงไม่มีอีเมลที่ติดมา
    //   ตรวจว่ายังไม่มีข้อความก่อนแตะ เพื่อให้รู้ว่าข้อความในขั้นที่ 4 ขึ้นเพราะการแตะ ไม่ได้ขึ้นอยู่ก่อน
    expect(await reset.emailLength()).toBe(0);
    expect(await reset.isErrorPresent([labels.auth.invalidEmail])).toBe(false);

    // ขั้นที่ 3: แตะปุ่มส่ง (tapSendWithEmptyEmail อ่านช่องอีกครั้ง และไม่ยอมแตะถ้าช่องไม่ว่าง)
    await reset.tapSendWithEmptyEmail();

    // ขั้นที่ 4: แอปต้องบอกให้กรอกอีเมลให้ถูกต้อง เป็นภาษาเดียวกับแอป
    //   กฎอยู่ที่ reset-password.tsx บรรทัด 73 ถึง 75 (ที่ efab8d0): ตัดช่องว่างหัวท้าย แล้วเทียบรูปแบบ ชื่อ@โดเมน.นามสกุล ถ้าไม่ตรงแสดง mobile.auth.invalidEmail แล้วจบ
    //   ด่านนี้อยู่ก่อนการขออีเมลรีเซ็ต (บรรทัด 86) จึงไม่มีการเรียกเครือข่าย
    expect(await reset.waitForError([labels.auth.invalidEmail])).toBe(labels.auth.invalidEmail);

    // ขั้นที่ 5: หน้ายังอยู่ที่ขั้นกรอกอีเมล ตัวที่ยืนยันเรื่องนี้คือปุ่มส่ง
    //   ปุ่มส่งมีเฉพาะขั้น 'email' (บรรทัด 161) ถ้าแอปส่งคำขอสำเร็จ หน้าจะไปขั้น 'sent' (บรรทัด 88) ซึ่งไม่มีปุ่มนี้
    //   ระหว่างกำลังส่ง ปุ่มแสดงตัวหมุนแทนข้อความ (packages/ui/src/components/MobileButton.tsx บรรทัด 68 ถึง 69) จึงหาด้วยข้อความไม่เจอเช่นกัน
    //   หัวข้อของขั้น 'sent' เป็นข้อความเดียวกับขั้น 'email' (บรรทัด 68) จึงตรวจหัวข้ออย่างเดียวไม่พอ
    //   ส่วนช่องอีเมล (บรรทัด 136) ตรวจเพิ่มให้เห็นว่าฟอร์มยังอยู่ แต่ isEmailFieldShown ไม่ได้นับช่อง จึงไม่ใช้เป็นตัวตัดสินว่าอยู่ขั้นไหน
    expect(await reset.isSendButtonShown()).toBe(true);
    expect(await reset.isEmailFieldShown()).toBe(true);
  });

  it('asks to fill in every field when the sign-up form is sent empty', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login แล้วแตะ สมัครสมาชิก หน้าสมัครต้องเปิดขึ้น
    //   ทุกช่องของฟอร์มเริ่มว่าง และยังไม่ได้ติ๊กยอมรับเงื่อนไข (register.tsx บรรทัด 39 ถึง 45 ที่ efab8d0)
    const login = await openLoginScreen();
    await login.tapSignUp();
    const register = new RegisterScreen();
    expect(await register.titleText()).toBe(labels.auth.registrationTitle);

    // ขั้นที่ 2: ยืนยันว่ายังไม่มีข้อความผิดพลาด แล้วปัดลงไปหาปุ่มสร้างบัญชี และแตะ โดยไม่กรอกช่องใดเลย
    //   ตรวจว่ายังไม่มีข้อความก่อนแตะ เพื่อให้รู้ว่าข้อความในขั้นที่ 3 ขึ้นเพราะการแตะ ไม่ได้ขึ้นอยู่ก่อน
    //   ตรวจว่าไม่อยู่ในโครงสร้างหน้าจอ ไม่ใช่ว่ามองไม่เห็น เพราะข้อความอยู่เหนือปุ่มสร้างบัญชี ซึ่งก่อนปัดยังอยู่นอกจอ
    //   การตรวจ "ไม่มี" แบบนี้เชื่อได้ เพราะขั้นที่ 3 พิสูจน์ว่าข้อความนี้หาเจอจริงเมื่อแสดง
    expect(await register.isErrorPresent([labels.auth.registrationRequiredFields])).toBe(false);
    await register.tapCreateAccount();

    // ขั้นที่ 3: แอปต้องบอกให้กรอกให้ครบ เป็นภาษาเดียวกับแอป
    //   กฎอยู่ที่ register.tsx บรรทัด 82 ถึง 85 (ที่ efab8d0): ถ้าชื่อ นามสกุล เบอร์โทร อีเมล รหัสผ่าน หรือยืนยันรหัสผ่าน ช่องใดว่าง
    //   แสดง mobile.auth.registrationRequiredFields แล้วจบ เป็นด่านแรก ก่อนด่านยอมรับเงื่อนไข (บรรทัด 86) และก่อนเรียก signUp (บรรทัด 109)
    //   ถ้าได้ข้อความยอมรับเงื่อนไขแทน แปลว่าแอปไม่ได้ตรวจช่องที่ต้องกรอกก่อน หรือมีช่องถูกเติมไว้
    expect(await register.waitForError([labels.auth.registrationRequiredFields])).toBe(labels.auth.registrationRequiredFields);

    // ขั้นที่ 4: ยังอยู่ที่ฟอร์มสมัคร: ปุ่มสร้างบัญชียังอยู่ และหัวข้อยังเป็นหัวข้อของฟอร์ม
    //   ถ้าสมัครสำเร็จ แอปจะไปหน้าอื่น หรือเปลี่ยนเป็นขั้นกรอกรหัสยืนยันอีเมล ซึ่งไม่มีปุ่มนี้ (บรรทัด 197)
    //   และหัวข้อเปลี่ยนเป็น emailConfirmationTitle (บรรทัด 193 และ 109 ถึง 119)
    //   ทั้ง 2 อย่างตรวจว่ายังอยู่ในโครงสร้างหน้าจอ ไม่ใช่ว่ามองเห็น เพราะหลังปัด หัวข้ออาจพ้นขอบบน และข้อความผิดพลาดดันปุ่มลงจนอาจพ้นขอบล่าง
    expect(await register.isCreateAccountPresent()).toBe(true);
    expect(await register.isTitlePresent()).toBe(true);
  });
});
