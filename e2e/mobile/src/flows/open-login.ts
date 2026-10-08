/**
 * ขั้นเตรียมที่เทสหลายข้อใช้ร่วมกัน: พาแอปไปที่หน้า login จากสภาพเริ่มต้นที่รู้แน่นอน
 *
 * เทสเรียกฟังก์ชันนี้เป็นขั้นแรกของตัวเอง ไม่ใส่ไว้ใน beforeEach
 * เหตุผล: ถ้าขั้นเตรียมใน beforeEach พัง Mocha จะข้ามเทสที่เหลือทั้งไฟล์ และรายงานแค่ว่า "before each" พัง
 *   เมื่อขั้นเตรียมอยู่ในตัวเทส เทสแต่ละข้อจะผ่านหรือไม่ผ่านด้วยตัวเอง และข้อถัดไปยังได้รัน
 */
import type { AppLanguage } from '../config/env';
import { LoginScreen } from '../screens/LoginScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { startApp } from '../support/app';

export interface OpenLoginOptions {
  /** ภาษาของเครื่องที่แอปจะเห็นตอนเปิด ถ้าไม่ระบุใช้ค่า E2E_APP_LANGUAGE */
  deviceLanguage?: AppLanguage;
}

/**
 * เปิดแอปใหม่โดยล้างข้อมูลที่แอปเก็บไว้ในเครื่องก่อน แล้วแตะผ่านหน้าต้อนรับ จบเมื่อผู้ใช้เห็นหน้า login
 * ต้องใช้กับ build ที่บทบาทตั้งต้นต้องล็อกอิน (EXPO_PUBLIC_DEFAULT_ROLE ไม่ใช่ guest) หลังหน้าต้อนรับจึงเป็นหน้า login
 */
export async function openLoginScreen(options: OpenLoginOptions = {}): Promise<LoginScreen> {
  await startApp({ clearData: true, deviceLanguage: options.deviceLanguage });
  await new WelcomeScreen().enter();
  const login = new LoginScreen();
  await login.waitUntilShown();
  return login;
}
