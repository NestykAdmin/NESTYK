/**
 * ค่าตั้งของเทส UI เว็บ consumer-app (tests/web-ui)
 *
 * เว็บของชุดนี้คือ apps/consumer-app ที่เปิดด้วย npm run web (Metro พอร์ต 8081)
 * ไม่ใช่ apps/web ที่พอร์ต 3000 (env.webBaseUrl ใน src/config/env.ts)
 *
 * ชุดนี้ล็อกอินผ่านหน้าเว็บด้วยรหัสผ่านจริงของบัญชี QA (เว็บล็อกอินผ่าน Supabase ไม่รับบัตรผ่านแบบนักพัฒนา)
 * รหัสผ่านอ่านจากตัวแปรแวดล้อมเท่านั้น ห้ามเขียนลงไฟล์ ให้ตั้งในหน้าต่าง Terminal ด้วย read -s (ดู README)
 * ชุดเทสไม่อ่านไฟล์ .env ใด ๆ
 */
import { qaAccounts, type QaRole } from '../config/qa-accounts';

function fromEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** บทบาทที่ชุดเทส UI ล็อกอินได้ (ต้องมีรหัสผ่านในตัวแปรแวดล้อม) */
export type WebUiRole = Extract<QaRole, 'tenant' | 'landlord' | 'agent' | 'admin'>;

export const PASSWORD_VARIABLES: Record<WebUiRole, string> = {
  tenant: 'E2E_QA_TENANT_PASSWORD',
  // qa-landlord ใช้กับหน้าผู้ให้เช่า (tests/web-ui/party-pages.spec.ts) เพิ่ม 6 พ.ย. 2026
  landlord: 'E2E_QA_LANDLORD_PASSWORD',
  agent: 'E2E_QA_AGENT_PASSWORD',
  admin: 'E2E_QA_ADMIN_PASSWORD',
};

/** รหัสผ่านของบัญชี (null = ไม่ได้ตั้ง เทสที่ต้องใช้บัญชีนั้นจะข้าม) ไม่ export ค่าออกไปพิมพ์ */
export function passwordOf(role: WebUiRole): string | null {
  return process.env[PASSWORD_VARIABLES[role]] || null;
}

/**
 * สวิตช์ให้เทส UI ใช้ API บนเครื่อง Aof แทน staging (เพิ่ม 9 พ.ย. 2026 หลังทีมแจ้งว่า Railway ใช้ไม่ได้)
 *   ตั้ง E2E_WEB_LOCAL_API=yes แล้ว API ต้องเป็น LOCAL_API_ORIGIN เท่านั้น (ค่าอื่นเช่น 127.0.0.1, IP ในวง LAN หรือพอร์ตอื่นหยุดทั้งชุด)
 *   ไม่ตั้ง หรือค่าอื่น = บังคับ staging เหมือนเดิม
 *   API บนเครื่องต่อฐานข้อมูลของทีม global-setup จึงตรวจก่อนเริ่มทั้งชุดว่า API นี้ปิดการขอบทบาทแบบนักพัฒนาแล้ว
 *   (assertLocalDevRoleGrantOff ใน web-ui-global-setup.ts) ถ้ายังเปิดอยู่ หยุดทั้งชุดก่อนเปิดเว็บ
 */
export const LOCAL_API_SWITCH = 'E2E_WEB_LOCAL_API';
export const LOCAL_API_ORIGIN = 'http://localhost:4000';

/** true = Aof ตั้ง E2E_WEB_LOCAL_API=yes */
export function localApiMode(): boolean {
  return process.env[LOCAL_API_SWITCH]?.trim() === 'yes';
}

export const webUiEnv = {
  /** ที่อยู่ของเว็บ consumer-app ที่เปิดด้วย npm run web */
  webUrl: withoutTrailingSlash(fromEnv('E2E_CONSUMER_WEB_URL', 'http://localhost:8081')),

  /**
   * origin ของ API ที่เว็บต้องเรียก (ค่า EXPO_PUBLIC_API_URL ใน .env ของ Aof ชี้ staging ตามบันทึก 4 พ.ย. 2026)
   * staging ปิด ALLOW_DEV_ROLE_GRANT ไว้ (ตอบ 403 "Dev role grant is disabled" เมื่อเทสด้วยมือ 4 พ.ย. 2026)
   * คำขอ /api/... ที่ไปที่อื่นจะถูกตัด (ตัวกันชั้นที่ 2 ใน guard.ts)
   * ห้ามตั้งค่านี้เป็น API บนเครื่อง (localhost:4000 หรือ localhost:8081) เพราะ API บนเครื่องของ Aof
   * ตั้ง ALLOW_DEV_ROLE_GRANT=true และต่อฐานข้อมูลของทีม global-setup ตรวจด้วย unsafeApiOriginReason ก่อนเริ่มทั้งชุด
   * ยกเว้นเมื่อตั้ง E2E_WEB_LOCAL_API=yes: ค่าเริ่มต้นเป็น LOCAL_API_ORIGIN และต้องเป็นค่านั้นเท่านั้น
   */
  apiOrigin: new URL(fromEnv('E2E_WEB_API_ORIGIN', localApiMode() ? LOCAL_API_ORIGIN : 'https://nestyk-dev.up.railway.app')).origin,

  /**
   * ปลายทางหลังกด Sign Out ที่เว็บถูก build มา (ต้องตั้งให้ตรงกับ EXPO_PUBLIC_WEB_SIGN_OUT_TO ใน .env ของเว็บ ชุดเทสไม่อ่าน .env)
   *   'login' = Aof ตั้ง E2E_WEB_SIGN_OUT_TO=login: แท็บที่กด Sign Out ต้องไป /login (lib/route-access.ts afterSignOutHref,
   *             app/index.tsx holdGuestHomeForSignOut ที่ pre/dev/review 7a9bf48)
   *   'default' = ไม่ตั้ง หรือค่าอื่น: เว็บใช้ค่าเริ่มต้น (portal all ไป "/") ข้อในชุดเทสที่คาด /login ยังเป็น known-bug
   */
  signOutTo: (process.env.E2E_WEB_SIGN_OUT_TO?.trim().toLowerCase() === 'login' ? 'login' : 'default') as 'login' | 'default',

  /**
   * portal ที่เว็บถูก build มา (ต้องตรงกับ EXPO_PUBLIC_WEB_PORTAL ของเว็บ ชุดเทสไม่อ่าน .env)
   *   'agent' = Aof ตั้ง E2E_WEB_PORTAL=agent: ใช้กับชุด tests/web-ui-portal-agent เท่านั้น (build ด้วย npm run build:web)
   *   'all' = ไม่ตั้ง หรือค่าอื่น: ชุด web-ui อื่นทั้งหมดคาดเว็บ portal all (dev build ที่ไม่ตั้ง EXPO_PUBLIC_WEB_PORTAL)
   *   ที่มา: portalFrom ใน apps/consumer-app/lib/route-access.ts (ค่าที่ไม่รู้จักเป็น all) ที่ pre/dev/review 163e354
   */
  portal: (process.env.E2E_WEB_PORTAL?.trim().toLowerCase() === 'agent' ? 'agent' : 'all') as 'agent' | 'all',
} as const;

/** อีเมลของบัญชี QA ตามบทบาท (ใช้ค่าเดียวกับชุด API ใน qa-accounts.ts) */
export function emailOf(role: WebUiRole): string {
  return qaAccounts[role].email;
}

/** ชื่อเครื่องที่ชี้มาที่เครื่องนี้หรือวง LAN (รวม IP ของ Mac ในวง LAN ซึ่ง API บนเครื่องรับได้) */
const LOCAL_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^\[?::1?\]?$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
];

/**
 * ชื่อเครื่องของ API ที่ยอมให้เทส UI ใช้ (staging ที่ปิด ALLOW_DEV_ROLE_GRANT: ตอบ 403 "Dev role grant is disabled" เมื่อเทสด้วยมือ 4 พ.ย. 2026)
 * รายการห้ามด้านบนจับ tunnel ที่ชี้กลับมาเครื่องนี้ไม่ได้ (เช่น ngrok, cloudflared, *.nip.io) จึงต้องอยู่ในรายการนี้ด้วย
 * ถ้าทีมย้าย staging ให้เพิ่มชื่อใหม่ที่นี่ หลังยืนยันกับทีมว่า API นั้นไม่ได้ตั้ง ALLOW_DEV_ROLE_GRANT=true
 */
const ALLOWED_API_HOSTS: readonly string[] = ['nestyk-dev.up.railway.app'];

/**
 * เหตุผลที่ห้ามใช้ origin นี้เป็น API ของเทส UI (null = ใช้ได้)
 * ต้องเป็น https ชื่อเครื่องต้องไม่ใช่เครื่องนี้หรือเครื่องในวง LAN และต้องอยู่ใน ALLOWED_API_HOSTS
 * เมื่อ local = true (E2E_WEB_LOCAL_API=yes) ต้องเป็น LOCAL_API_ORIGIN ตรงตัวเท่านั้น
 */
export function unsafeApiOriginReason(origin: string, local: boolean = localApiMode()): string | null {
  const url = new URL(origin);
  if (local) {
    return url.origin === LOCAL_API_ORIGIN ? null : `ตั้ง ${LOCAL_API_SWITCH}=yes แล้ว API ต้องเป็น ${LOCAL_API_ORIGIN} เท่านั้น (ได้ ${url.origin})`;
  }
  if (url.protocol !== 'https:') return `ต้องเป็น https (ได้ ${url.protocol})`;
  if (LOCAL_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) return `${url.hostname} เป็นเครื่องนี้หรือเครื่องในวง LAN`;
  if (!ALLOWED_API_HOSTS.includes(url.hostname.toLowerCase())) return `${url.hostname} ไม่อยู่ใน ALLOWED_API_HOSTS (web-ui-env.ts)`;
  return null;
}
