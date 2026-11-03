import { expect, type APIResponse } from '@playwright/test';
import type { ApiErrorBody } from '../api/types';

/**
 * ตรวจรหัสตอบกลับ แล้วคืนเนื้อคำตอบที่แปลงจาก JSON
 * ถ้ารหัสไม่ตรง ข้อความที่เทสแสดงจะมีที่อยู่ที่เรียกและเนื้อคำตอบของ API ติดมาด้วย จะได้รู้สาเหตุโดยไม่ต้องรันซ้ำ
 * ทำไมสร้างข้อความเฉพาะตอนรหัสไม่ตรง: Playwright บันทึกข้อความของทุกการตรวจเป็นขั้นในรายงาน HTML แม้การตรวจจะผ่าน
 *   ถ้าใส่ข้อความทุกครั้ง รายงานจะมีที่อยู่ (รวมคำค้น) และเนื้อคำตอบ 500 ตัวอักษรของทุกคำขอ
 *   (ห้องทดลอง 3 พ.ย. 2026: รายงานของ npm test 1 รอบมีขั้นแบบนี้ 692 ขั้น)
 *   ตอนรหัสตรง การตรวจด้านล่างไม่มีข้อความ ขั้นในรายงานจึงไม่มีที่อยู่และเนื้อคำตอบ (นับในห้องทดลองหลังแก้ได้ 0 ขั้นในข้อที่ผ่าน)
 */
export async function expectJson<T>(response: APIResponse, status: number): Promise<T> {
  const text = await response.text();
  if (response.status() !== status) {
    expect(response.status(), `${response.url()} ตอบว่า: ${text.slice(0, 500)}`).toBe(status);
  }
  expect(response.status()).toBe(status);
  return JSON.parse(text) as T;
}

/**
 * ตรวจรหัสตอบกลับโดยไม่ใส่ที่อยู่หรือเนื้อคำตอบในข้อความ แล้วคืนเนื้อคำตอบที่แปลงจาก JSON
 * ใช้แทน expectJson เมื่อที่อยู่หรือคำตอบมีค่าที่ไม่ควรอยู่ในผลรัน เช่น URL ของ Storage ของทีม (มีที่อยู่ของ SUPABASE_URL)
 * what = ชื่อคำขอที่จะพิมพ์แทน
 */
export async function expectJsonQuiet<T>(response: APIResponse, status: number, what: string): Promise<T> {
  expect(response.status(), `${what} ต้องตอบ ${status} (ไม่พิมพ์ที่อยู่และเนื้อคำตอบ)`).toBe(status);
  return (await response.json()) as T;
}

/**
 * แบบเดียวกับ expectError แต่ไม่ใส่ที่อยู่หรือเนื้อคำตอบในข้อความถ้ารหัสไม่ตรง (เช่น API รับไฟล์ไปแล้วตอบข้อมูลผู้ใช้ที่มี URL ของ Storage)
 * คืนข้อความ (message) ของ API
 */
export async function expectErrorQuiet(response: APIResponse, status: number, what: string): Promise<string> {
  const body = await expectJsonQuiet<ApiErrorBody>(response, status, what);
  expect(body.statusCode).toBe(status);
  return Array.isArray(body.message) ? body.message.join('; ') : body.message;
}

/**
 * ตรวจว่า API ปฏิเสธคำขอด้วยรหัสที่คาดไว้ และเนื้อคำตอบเป็นรูปแบบมาตรฐาน { statusCode, message, error }
 * คืนข้อความ (message) ของ API เผื่อเทสอยากตรวจต่อ
 */
export async function expectError(response: APIResponse, status: number): Promise<string> {
  const body = await expectJson<ApiErrorBody>(response, status);
  expect(body.statusCode).toBe(status);
  return Array.isArray(body.message) ? body.message.join('; ') : body.message;
}

/**
 * ตรวจคำตอบ error ที่ API ส่งเป็น object ของตัวเอง { code, message, ... } เช่น 409 LEAD_CLOSED หรือ 422 LEAD_NOT_READY
 * คำตอบแบบนี้ไม่มีช่อง statusCode (NestJS ส่ง object ที่ส่งเข้า exception เป็นเนื้อคำตอบตรง ๆ ;
 * ยืนยันในห้องทดลองกับ API ที่ develop bc77a8b 30 ต.ค. 2026) จึงใช้ expectError ไม่ได้
 * ตรวจรหัสตอบกลับกับ code แล้วคืน message
 */
export async function expectCodedError(response: APIResponse, status: number, code: string): Promise<string> {
  const body = await expectJson<{ code?: unknown; message?: unknown }>(response, status);
  expect(body.code).toBe(code);
  expect(typeof body.message).toBe('string');
  return body.message as string;
}
