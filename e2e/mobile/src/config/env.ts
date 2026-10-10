/**
 * ค่าตั้งของชุดเทสมือถือ
 *
 * ทุกค่าเปลี่ยนได้ด้วยตัวแปรแวดล้อม (environment variable) ถ้าไม่ตั้ง จะใช้ค่าเริ่มต้นสำหรับเทสบนเครื่องตัวเอง
 * เหตุผลที่รวมไว้ไฟล์เดียว: ไฟล์เทสกับไฟล์หน้าจอจะไม่มีค่าของเครื่องฝังอยู่ ย้ายไปรันเครื่องอื่นจึงแก้ที่นี่ที่เดียว
 */
import { execFileSync } from 'node:child_process';

/** ภาษาของแอปที่ชุดเทสรู้จัก (แอปมี 4 ภาษา ชุดเทสชุดแรกใช้ 2 ภาษานี้) */
export type AppLanguage = 'th' | 'en';

function readChoice<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  throw new Error(`ตัวแปร ${name} ต้องเป็นค่าใดค่าหนึ่งใน: ${allowed.join(', ')} (ค่าที่ได้: ${raw})`);
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`ตัวแปร ${name} ต้องเป็นตัวเลขที่มากกว่า 0 (ค่าที่ได้: ${raw})`);
  }
  return value;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`ตัวแปร ${name} ต้องเป็น true หรือ false (ค่าที่ได้: ${raw})`);
}

export const env = {
  /** รหัสประจำแอปของ NESTYK บน iOS ที่มา: apps/consumer-app/app.config.js */
  bundleId: process.env.E2E_IOS_BUNDLE_ID?.trim() || 'com.nestyk.consumer',

  /** ภาษาที่ชุดเทสสั่งให้แอปใช้ตอนเปิด (ผลจึงไม่ขึ้นกับภาษาของเครื่องจำลอง) และเป็นภาษาของข้อความที่เทสคาด */
  appLanguage: readChoice<AppLanguage>('E2E_APP_LANGUAGE', ['th', 'en'], 'th'),

  /**
   * แอปที่ใช้เทสเป็น build โหมดนักพัฒนาหรือไม่ (ตอน build ตั้ง EXPO_PUBLIC_USE_DEV_AUTH=true หรือ EXPO_PUBLIC_APP_ENV=development)
   * โหมดนี้แอปเติมบัญชีนักพัฒนาในช่องอีเมลกับรหัสผ่านให้เอง
   * ที่มา: apps/consumer-app/lib/auth/dev-auth.ts บรรทัด 6 ถึง 8 และ app/login.tsx บรรทัด 71 ถึง 76
   */
  expectDevAuth: readBoolean('E2E_EXPECT_DEV_AUTH', true),

  /** อีเมลของบัญชีนักพัฒนาที่แอปเติมให้ ที่มา: ค่าเริ่มต้นใน apps/consumer-app/lib/auth/dev-auth.ts */
  devLoginEmail: process.env.E2E_DEV_LOGIN_EMAIL?.trim() || 'admin@jitsamrit.com',

  /**
   * ที่อยู่ของ API ที่แอปที่ใช้เทสเรียก (ไม่มี / ปิดท้าย) ชุด session ใช้ตรวจว่า API เปิดอยู่ก่อนเริ่ม (src/support/api-health.ts)
   * ต้องตรงกับ EXPO_PUBLIC_API_URL ตอน build แอป ค่าเริ่มต้นเท่ากับค่าใน .env.example บรรทัด 13 ของ repo
   */
  apiUrl: (process.env.E2E_API_URL?.trim() || 'http://localhost:4000/api/v1').replace(/\/+$/, ''),

  /** พอร์ตของ Appium ในเครื่องนี้ */
  appiumPort: readNumber('E2E_APPIUM_PORT', 4723),

  /**
   * เวลาสูงสุด (มิลลิวินาที) ที่รอให้ชิ้นส่วนบนหน้าจอเปลี่ยนตามที่คาด
   * การเปลี่ยนหน้าจอที่เทสรอ ปกติจบในราว 1 วินาที (ขั้นที่ 24: หน้าต้อนรับหายไปหลังแตะประมาณ 1.2 วินาที) ค่านี้เผื่อไว้สำหรับเครื่องที่ช้า
   */
  waitMs: readNumber('E2E_WAIT_MS', 15_000),

  /**
   * เวลาสูงสุด (มิลลิวินาที) ที่รอให้แอปเปิดจนหน้าต้อนรับพร้อมให้แตะ
   * นานกว่าค่าข้างบนเพราะแอปต้องโหลดฟอนต์และตรวจการล็อกอินก่อน
   * (ขั้นที่ 24: หน้าต้อนรับพร้อมให้แตะหลังเปิด session ประมาณ 1.3 วินาที บนเครื่องที่ใช้เทส ค่านี้เผื่อไว้สำหรับเครื่องที่ช้า)
   */
  appReadyWaitMs: readNumber('E2E_APP_READY_WAIT_MS', 40_000),

  /** true = ตอนเริ่มรอบ ให้ลองวิธีหาชิ้นส่วนหลายแบบแล้วพิมพ์ผล (ใช้ตรวจเครื่องใหม่ ไม่ใช่เทสของแอป) */
  deviceCheck: readBoolean('E2E_DEVICE_CHECK', false),
} as const;

/** ค่า locale ของ iOS ที่คู่กับภาษาของแอป */
export const IOS_LOCALE: Record<AppLanguage, string> = {
  th: 'th_TH',
  en: 'en_US',
};

interface SimctlDevice {
  udid: string;
  name: string;
  state: string;
}

/**
 * หารหัสประจำเครื่อง (UDID) ของ iPhone จำลองที่จะใช้เทส
 *
 * ถ้าตั้ง E2E_IOS_UDID จะใช้ค่านั้น ถ้าไม่ตั้ง จะถาม Xcode ว่ามี iPhone จำลองเครื่องไหนเปิดอยู่
 * ต้องมีเครื่องที่เปิดอยู่ 1 เครื่องพอดี เพราะถ้าเดาเครื่องผิด เทสจะไปรันกับเครื่องที่ไม่มีแอปของเรา
 */
export function resolveSimulatorUdid(): string {
  const fromEnv = process.env.E2E_IOS_UDID?.trim();
  if (fromEnv) return fromEnv;

  let raw: string;
  try {
    // xcrun simctl list devices booted -j = ขอรายชื่อเครื่องจำลองที่เปิดอยู่ ในรูปแบบ JSON
    raw = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'], {
      encoding: 'utf8',
      timeout: 20_000,
    });
  } catch (error) {
    throw new Error(
      `ถาม Xcode เรื่องเครื่องจำลองไม่ได้ (คำสั่ง xcrun simctl) ให้ตั้ง E2E_IOS_UDID เอง: ${(error as Error).message}`,
    );
  }
  const parsed = JSON.parse(raw) as { devices?: Record<string, SimctlDevice[]> };
  const booted = Object.values(parsed.devices ?? {})
    .flat()
    .filter((device) => device.state === 'Booted' && device.name.startsWith('iPhone'));
  if (booted.length === 0) {
    throw new Error('ยังไม่มี iPhone จำลองที่เปิดอยู่ ให้เปิดเครื่องจำลองก่อน หรือตั้ง E2E_IOS_UDID');
  }
  if (booted.length > 1) {
    const names = booted.map((device) => `${device.name} (${device.udid})`).join(', ');
    throw new Error(`มี iPhone จำลองเปิดอยู่มากกว่า 1 เครื่อง: ${names} ให้ตั้ง E2E_IOS_UDID เพื่อเลือกเครื่อง`);
  }
  return booted[0].udid;
}
