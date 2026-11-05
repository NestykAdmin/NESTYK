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
export type WebUiRole = Extract<QaRole, 'tenant' | 'agent' | 'admin'>;

export const PASSWORD_VARIABLES: Record<WebUiRole, string> = {
  tenant: 'E2E_QA_TENANT_PASSWORD',
  agent: 'E2E_QA_AGENT_PASSWORD',
  admin: 'E2E_QA_ADMIN_PASSWORD',
};

/** รหัสผ่านของบัญชี (null = ไม่ได้ตั้ง เทสที่ต้องใช้บัญชีนั้นจะข้าม) ไม่ export ค่าออกไปพิมพ์ */
export function passwordOf(role: WebUiRole): string | null {
  return process.env[PASSWORD_VARIABLES[role]] || null;
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
   */
  apiOrigin: new URL(fromEnv('E2E_WEB_API_ORIGIN', 'https://nestyk-dev.up.railway.app')).origin,
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
 */
export function unsafeApiOriginReason(origin: string): string | null {
  const url = new URL(origin);
  if (url.protocol !== 'https:') return `ต้องเป็น https (ได้ ${url.protocol})`;
  if (LOCAL_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) return `${url.hostname} เป็นเครื่องนี้หรือเครื่องในวง LAN`;
  if (!ALLOWED_API_HOSTS.includes(url.hostname.toLowerCase())) return `${url.hostname} ไม่อยู่ใน ALLOWED_API_HOSTS (web-ui-env.ts)`;
  return null;
}
