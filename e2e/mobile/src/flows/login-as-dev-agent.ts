/**
 * ขั้นเตรียมของชุด session: เปิดแอปใหม่โดยล้างข้อมูล แล้วล็อกอินด้วยบัญชีนักพัฒนาที่แอปเติมไว้ จบเมื่อผู้ใช้เห็นหน้าของนายหน้า
 *
 * เทสเรียกฟังก์ชันนี้เป็นขั้นแรกของตัวเอง (เหตุผลที่ไม่ใช้ beforeEach อยู่ในหัวไฟล์ src/flows/open-login.ts)
 *
 * ทำไมต้องยืนยันช่องกรอกก่อนแตะเข้าสู่ระบบ: ปุ่มนี้ล็อกอินจริงผ่าน API
 *   ถ้าแอปเติมบัญชีอื่นไว้ API จะสร้างผู้ใช้ใหม่ให้บัญชีที่ยังไม่มีในฐานข้อมูลทันที (apps/api/src/auth/auth.service.ts บรรทัด 90 ถึง 114)
 *   ขั้นนี้จึงหยุดก่อนแตะ ถ้าอีเมลไม่ตรงกับ E2E_DEV_LOGIN_EMAIL หรือช่องรหัสผ่านว่าง
 *   ข้อความเมื่อหยุดบอกแค่ว่าไม่ตรงกับตัวแปรไหน ไม่บอกค่าที่เห็น
 * ไม่อ่านรหัสผ่าน: นับได้แค่ว่าช่องมีตัวอักษร (LoginScreen.passwordLength นับจุดที่ iOS แสดงแทนตัวอักษร)
 * เทสข้อแรกของ tests-session/agent-session.spec.ts ตรวจขั้นเดียวกันนี้ด้วย expect ทีละขั้น ส่วนฟังก์ชันนี้ใช้เป็นขั้นเตรียมของข้ออื่น
 */
import { env } from '../config/env';
import { AgentHomeScreen } from '../screens/AgentHomeScreen';
import { openLoginScreen } from './open-login';

/**
 * เวลารอหน้าของนายหน้าหลังแตะเข้าสู่ระบบ: รอ POST /auth/sync บวกเวลาเปลี่ยนหน้า
 * ขั้นที่ 34 วัดได้ 2.1 วินาที ค่านี้เผื่อไว้สำหรับเครื่องที่ช้าหรือ API ที่เพิ่งเปิด
 */
export const LOGIN_WAIT_MS = env.waitMs + 15_000;

export async function loginAsDevAgent(): Promise<AgentHomeScreen> {
  const login = await openLoginScreen();
  if ((await login.emailText()) !== env.devLoginEmail) {
    throw new Error('ช่องอีเมลของหน้า login ไม่ตรงกับ E2E_DEV_LOGIN_EMAIL จึงไม่แตะเข้าสู่ระบบ (กันการล็อกอินด้วยบัญชีอื่น)');
  }
  if ((await login.passwordDisplay()) !== 'hidden' || (await login.passwordLength()) === 0) {
    throw new Error('ช่องรหัสผ่านว่าง หรือไม่ได้ซ่อนตัวอักษร จึงไม่แตะเข้าสู่ระบบ (build ที่ใช้ต้องเป็นโหมดนักพัฒนา ดู E2E_EXPECT_DEV_AUTH)');
  }
  await login.tapLogin();
  const home = new AgentHomeScreen();
  await home.waitUntilShown(LOGIN_WAIT_MS);
  return home;
}
