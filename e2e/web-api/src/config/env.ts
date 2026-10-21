/**
 * ค่าตั้งของชุดเทส
 *
 * ทุกค่ามีค่าเริ่มต้นสำหรับระบบที่รันในเครื่อง ตามไฟล์ .env.example และ .env.api.example ของ repo
 * ถ้าจะชี้ไปที่ระบบอื่น ให้ตั้งตัวแปรแวดล้อม (environment variable) ตอนสั่งรัน ไม่ต้องแก้ไฟล์นี้ เช่น
 *   E2E_API_BASE_URL=http://localhost:4000/api/v1 npx playwright test
 *
 * บัญชีที่เทสใช้ล็อกอินอยู่ใน src/config/qa-accounts.ts
 *   ชุดเทสเลิกใช้บัญชีตัวอย่าง admin@jitsamrit.com (seed-dev-user.sql) ตั้งแต่ 21 ต.ค. 2026
 *   เพราะบัญชีนั้นในฐานข้อมูลของทีมไม่มีลีดและห้องแล้ว
 *   (20 ต.ค. 2026 เทสที่ใช้ลีดหรือห้องไม่ผ่าน 22 ข้อ และนับเมื่อ 21 ต.ค. 2026 ได้ลีด 0 ห้อง 0)
 */

/** อ่านตัวแปรแวดล้อม ถ้าไม่ได้ตั้งหรือเป็นค่าว่าง ให้ใช้ค่าเริ่มต้น */
function fromEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

/** ตัด / ที่ปิดท้ายออก เพื่อให้ต่อ path ได้แบบเดียวกันทุกที่ */
function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export const env = {
  /** ที่อยู่ของ API รวม prefix /api/v1 */
  apiBaseUrl: withoutTrailingSlash(fromEnv('E2E_API_BASE_URL', 'http://localhost:4000/api/v1')),

  /** ที่อยู่ของเว็บ (apps/web) ยังไม่ถูกใช้ในเทส API จะใช้เมื่อเพิ่มเทสหน้าเว็บ */
  webBaseUrl: withoutTrailingSlash(fromEnv('E2E_WEB_BASE_URL', 'http://localhost:3000')),
} as const;
