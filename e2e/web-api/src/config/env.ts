/**
 * ค่าตั้งของชุดเทส
 *
 * ทุกค่ามีค่าเริ่มต้นสำหรับระบบที่รันในเครื่อง ตามไฟล์ .env.example และ .env.api.example ของ repo
 * ถ้าจะชี้ไปที่ระบบอื่น ให้ตั้งตัวแปรแวดล้อม (environment variable) ตอนสั่งรัน ไม่ต้องแก้ไฟล์นี้ เช่น
 *   E2E_API_BASE_URL=http://localhost:4000/api/v1 npx playwright test
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

  /**
   * บัญชีตัวอย่างของทีมสำหรับล็อกอินแบบนักพัฒนา (สร้างโดย docs/new-project/docker/seed-dev-user.sql)
   * ใช้ได้เฉพาะกับ API ที่ตั้ง ALLOW_DEV_AUTH=true ใน .env.api และไม่ต้องใช้รหัสผ่าน
   */
  devUser: {
    uuid: fromEnv('E2E_DEV_USER_UUID', '00000000-0000-4000-8000-000000000001'),
    email: fromEnv('E2E_DEV_USER_EMAIL', 'admin@jitsamrit.com'),
  },
} as const;

/**
 * สร้างบัตรผ่านแบบนักพัฒนา (dev token) ที่ API รับในรูปแบบ  dev|<uuid>|<email>
 * API จะใช้ uuid หาผู้ใช้ในตาราง users (คอลัมน์ supabase_user_id)
 */
export function devToken(user: { uuid: string; email: string } = env.devUser): string {
  return `dev|${user.uuid}|${user.email}`;
}
