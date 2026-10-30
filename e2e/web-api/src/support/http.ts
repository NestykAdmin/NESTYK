import { expect, type APIResponse } from '@playwright/test';
import type { ApiErrorBody } from '../api/types';

/**
 * ตรวจรหัสตอบกลับ แล้วคืนเนื้อคำตอบที่แปลงจาก JSON
 * ถ้ารหัสไม่ตรง ข้อความที่เทสแสดงจะมีที่อยู่ที่เรียกและเนื้อคำตอบของ API ติดมาด้วย จะได้รู้สาเหตุโดยไม่ต้องรันซ้ำ
 */
export async function expectJson<T>(response: APIResponse, status: number): Promise<T> {
  const text = await response.text();
  expect(response.status(), `${response.url()} ตอบว่า: ${text.slice(0, 500)}`).toBe(status);
  return JSON.parse(text) as T;
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
