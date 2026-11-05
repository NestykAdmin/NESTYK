/// <reference lib="dom" />  // โค้ดใน evaluate ทำงานในเบราว์เซอร์ (tsconfig ของชุดนี้ใช้ lib ES2022 อย่างเดียว)
import type { Page } from '@playwright/test';

/**
 * ตัวช่วยเทสการหมดเวลาของเว็บ โดยไม่ต้องรอ 8 ชั่วโมงจริง
 * ค่าคงที่ตาม apps/consumer-app/lib/auth/idle-rules.ts (qa/e2e efab8d0)
 */
export const ACTIVITY_KEY = 'nestyk.web.lastActivity'; // idle-rules.ts:12
export const IDLE_LIMIT_MS = 8 * 60 * 60 * 1000; // idle-rules.ts:6
export const IDLE_WARN_MS = 2 * 60 * 1000; // idle-rules.ts:7 (เตือนเมื่อเหลือไม่เกิน 2 นาที)
export const ACTIVITY_WRITE_MS = 15_000; // idle-rules.ts:9 (การใช้งานที่ห่างจากครั้งก่อนน้อยกว่านี้ไม่ถูกนับ)
export const AUTH_SESSION_KEY = 'nestyk.auth.session.v1'; // lib/auth/cross-tab-rules.ts:10

/**
 * ตั้งเวลาใช้งานล่าสุดให้ย้อนหลังไป msAgo มิลลิวินาที (เวลาของเบราว์เซอร์)
 * notify = true: สั่งให้ตัวตรวจของแท็บนี้ทำงานทันที ด้วย visibilitychange บน document
 *   (IdleSignOutGate.web.tsx:97-99, 105 ถ้าไม่สั่ง ตัวตรวจทำงานเองทุก 15 วินาที: setInterval :103)
 * notify = false: ไม่สั่ง ใช้เมื่อเทสจะโหลดหน้าใหม่เอง (ตัวตรวจทำงานตอนหน้าเริ่ม :91)
 *   ถ้าสั่ง แท็บนี้จะออกจากระบบก่อนโหลดใหม่ แล้วผลหลังโหลดจะขึ้นกับว่าการออกจากระบบเสร็จก่อนหรือหลัง (ข้อสังเกตของ test-reviewer)
 * แท็บอื่นของเบราว์เซอร์เดียวกันได้ storage event ของค่านี้ทุกครั้ง แล้วตรวจเวลาเอง (:100-102)
 */
export async function setLastActivityAgo(page: Page, msAgo: number, options: { notify?: boolean } = {}): Promise<void> {
  await page.evaluate(
    ([key, ago, notify]) => {
      window.localStorage.setItem(key, String(Date.now() - ago));
      if (notify) document.dispatchEvent(new Event('visibilitychange'));
    },
    [ACTIVITY_KEY, msAgo, options.notify ?? true] as const,
  );
}

/** ช่วงเวลาที่กล่องเตือนขึ้น: เหลือ 1 นาทีก่อนหมดเวลา */
export const IN_WARNING_WINDOW = IDLE_LIMIT_MS - 60_000;
/** เลยเวลาหมดไปแล้ว 1 ชั่วโมง (ตรงกับที่เทสด้วยมือใช้ ย้อน 9 ชม.) */
export const PAST_LIMIT = IDLE_LIMIT_MS + 60 * 60 * 1000;

/** session ที่เว็บเก็บไว้ยังอยู่หรือไม่ (ไม่อ่านค่า เพราะมี token) */
export async function hasStoredSession(page: Page): Promise<boolean> {
  return page.evaluate((key) => window.localStorage.getItem(key) !== null, AUTH_SESSION_KEY);
}

/**
 * บทบาทของบัญชีที่ล็อกอินอยู่ ตามที่เว็บเก็บไว้หลัง POST /auth/sync (lib/auth/session-storage.ts:5-15 ฟิลด์ roles)
 * อ่านแค่ roles ไม่คืน token ใช้ตรวจขั้นเตรียมก่อน test.fail: ถ้าบัญชีมีบทบาทที่เทสสมมติว่าไม่มี ผลของ known-bug จะผิดความหมาย
 */
export async function storedRoles(page: Page): Promise<string[]> {
  return page.evaluate((key) => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null') as { roles?: unknown } | null;
      return Array.isArray(parsed?.roles) ? parsed.roles.filter((role): role is string => typeof role === 'string') : [];
    } catch {
      return [];
    }
  }, AUTH_SESSION_KEY);
}
