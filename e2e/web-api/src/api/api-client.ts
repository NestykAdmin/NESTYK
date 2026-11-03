import type { APIRequestContext, APIResponse } from '@playwright/test';

/** ค่าที่ส่งเป็น query string ได้ ค่าที่เป็น undefined จะไม่ถูกส่งไป */
export type QueryParams = Record<string, string | number | boolean | undefined>;

/**
 * ตัวส่งคำขอพื้นฐานของชุดเทส
 *
 * ทำหน้าที่เดียวคือส่งคำขอ HTTP ไปที่ API แล้วคืนคำตอบดิบ (APIResponse) กลับมา
 * ไม่ตรวจผลในนี้ การตรวจเป็นหน้าที่ของไฟล์เทส เทสจึงตรวจได้ทั้งกรณีสำเร็จและกรณีที่ API ต้องปฏิเสธ
 *
 * ที่อยู่ของ API และบัตรผ่าน (ถ้ามี) ถูกตั้งไว้ใน APIRequestContext ตอนสร้าง (ดู src/fixtures/api.fixture.ts)
 */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  get(path: string, query: QueryParams = {}): Promise<APIResponse> {
    return this.request.get(relativePath(path), { params: definedOnly(query) });
  }

  post(path: string, body?: unknown): Promise<APIResponse> {
    return this.request.post(relativePath(path), body === undefined ? {} : { data: body });
  }

  patch(path: string, body?: unknown): Promise<APIResponse> {
    return this.request.patch(relativePath(path), body === undefined ? {} : { data: body });
  }

  put(path: string, body?: unknown): Promise<APIResponse> {
    return this.request.put(relativePath(path), body === undefined ? {} : { data: body });
  }

  /**
   * POST พร้อมหัวข้อเพิ่มเฉพาะคำขอนี้ (เช่น X-Forwarded-For, Origin) ใช้ทดสอบตัวกันที่ดูหัวข้อของคำขอ
   * หัวข้อที่ส่งที่นี่ทับหัวข้อตั้งต้นของตัวส่งคำขอที่ชื่อเดียวกัน
   */
  postWithHeaders(path: string, body: unknown, headers: Record<string, string>): Promise<APIResponse> {
    return this.request.post(relativePath(path), { data: body, headers });
  }

  delete(path: string): Promise<APIResponse> {
    return this.request.delete(relativePath(path));
  }

  /** ส่งแบบ multipart/form-data (ฟอร์มที่มีไฟล์) ใช้กับเส้นทางอัปโหลด */
  postMultipart(path: string, multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>): Promise<APIResponse> {
    return this.request.post(relativePath(path), { multipart });
  }
}

/**
 * ตัด / นำหน้าออก
 * เหตุผล: Playwright ต่อ path เข้ากับ baseURL ตามกติกาของ URL ถ้า path ขึ้นต้นด้วย /
 * ส่วน /api/v1 ของ baseURL จะถูกแทนที่ทั้งหมด คำขอจะไปผิดที่
 */
function relativePath(path: string): string {
  return path.replace(/^\/+/, '');
}

/** เก็บเฉพาะค่าที่ไม่ใช่ undefined และแปลงเป็นข้อความ */
function definedOnly(query: QueryParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) result[key] = String(value);
  }
  return result;
}
