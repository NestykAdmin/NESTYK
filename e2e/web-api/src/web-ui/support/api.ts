import type { Page, Request, Response } from '@playwright/test';
import { webUiEnv } from '../web-ui-env';

/**
 * ตัวช่วยดูคำขอที่หน้าเว็บส่งไป API (E2E_WEB_API_ORIGIN) ใช้ตรวจว่าหน้าส่งค่าค้น กรอง เรียง เปลี่ยนหน้า ไป API ตรงกับที่ผู้ใช้เลือก
 *
 * จดเฉพาะ method, path ต่อจาก /api/v1 และ query ในหน่วยความจำของเทส ไม่จดเนื้อคำขอและ header (มี token)
 * query ของหน้าลีดมีคำค้นที่เทสพิมพ์เอง ห้ามพิมพ์ค่าที่จดออกรายงาน เพราะคำค้นมาจากชื่อลูกค้าจริงในฐานข้อมูลของทีม
 * คำขอที่ตัวกัน (guard.ts) ตัด ยังขึ้นเป็นเหตุการณ์ request ก่อนถูกตัด จึงถูกจดด้วย แต่ไม่มีคำตอบ
 */

export interface ApiCall {
  method: string;
  /** path ต่อจาก /api/v1 ไม่มี / ท้าย เช่น /agent/leads */
  path: string;
  query: URLSearchParams;
}

/** path ของคำขอต่อจาก /api/v<เลข> (null = ไม่ได้ไป API ที่กำหนด) */
export function apiPathOf(rawUrl: string): string | null {
  const url = new URL(rawUrl);
  if (url.origin !== webUiEnv.apiOrigin) return null;
  const match = url.pathname.match(/^\/api\/v\d+(\/.*)$/);
  return match ? match[1].replace(/\/+$/, '') || '/' : null;
}

function matches(request: Request, method: string, path: string | RegExp): boolean {
  if (request.method() !== method) return false;
  const apiPath = apiPathOf(request.url());
  if (apiPath === null) return false;
  return typeof path === 'string' ? apiPath === path : path.test(apiPath);
}

/**
 * รอคำตอบของคำขอที่ตรง method และ path (string = ตรงทั้ง path, RegExp = ทดสอบกับ path) และ query ถ้าระบุ
 * ต้องเรียกก่อนสั่งการที่ทำให้เกิดคำขอ แล้ว await ทีหลัง
 * ถ้าเทสข้ามหรือล้มก่อน await promise นี้จะไม่ทำให้เกิด unhandled rejection (ผูก catch ว่างไว้แล้ว การ await ยังได้ error ตามปกติ)
 */
export function waitForApi(
  page: Page,
  method: string,
  path: string | RegExp,
  options: { query?: (query: URLSearchParams) => boolean; timeout?: number } = {},
): Promise<Response> {
  const pending = page.waitForResponse(
    (response) => matches(response.request(), method, path) && (options.query?.(new URL(response.url()).searchParams) ?? true),
    { timeout: options.timeout ?? 30_000 },
  );
  pending.catch(() => undefined);
  return pending;
}

/** อ่านเนื้อคำตอบ JSON ของคำตอบที่ต้องสำเร็จ (ถ้าไม่สำเร็จ โยน error พร้อม method path และเลขสถานะ ไม่พิมพ์เนื้อคำตอบ) */
export async function okJson<T>(response: Response): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.request().method()} ${apiPathOf(response.url())} ตอบ ${response.status()} (คาด 2xx)`);
  }
  return (await response.json()) as T;
}

/** จดทุกคำขอไป API ของแท็บนี้ตั้งแต่สร้าง (ใช้ตรวจว่า "ไม่มีคำขอเพิ่ม" หลังสั่งการที่ควรทำฝั่งหน้าเว็บอย่างเดียว) */
export class ApiLog {
  readonly calls: ApiCall[] = [];

  constructor(page: Page) {
    page.on('request', (request) => {
      const path = apiPathOf(request.url());
      if (path !== null) this.calls.push({ method: request.method(), path, query: new URL(request.url()).searchParams });
    });
  }

  /** จำนวนคำขอที่ตรง method และ path */
  count(method: string, path: string | RegExp): number {
    return this.calls.filter((call) => call.method === method && (typeof path === 'string' ? call.path === path : path.test(call.path))).length;
  }
}
