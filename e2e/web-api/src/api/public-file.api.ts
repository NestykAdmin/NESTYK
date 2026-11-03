import type { APIRequestContext } from '@playwright/test';

/** ผลของการเปิดไฟล์สาธารณะ (ไม่เก็บ URL ไว้ในผล เพื่อไม่ให้ URL ของ Storage ของทีมถูกพิมพ์ในผลรัน) */
export interface PublicFileResult {
  ok: boolean;
  status: number;
  /** เนื้อไฟล์ (ว่างถ้าเปิดไม่ได้) */
  body: Buffer;
}

/**
 * เปิดไฟล์จาก URL สาธารณะโดยไม่ส่งบัตรผ่าน แบบเดียวกับที่แอปเปิดรูปโปรไฟล์
 * request ต้องเป็นตัวส่งคำขอที่ไม่มีบัตรผ่าน (สร้างด้วย playwright.request.newContext())
 * ต่างจากตัวเรียกอื่นใน src/api โดยตั้งใจ: คืนผลที่แปลงแล้ว (ok, status, body) ไม่ใช่ APIResponse ดิบ เพราะ APIResponse เก็บ URL ไว้
 *   ถ้าเทสส่งคำตอบดิบเข้าตัวตรวจ URL ของ Storage ของทีมอาจถูกพิมพ์ในผลรัน
 * ต่อ query string ที่ไม่ซ้ำทุกครั้ง และขอแบบไม่ใช้แคช เพราะไฟล์ถูกอัปด้วย cacheControl 3600
 *   (profile-avatar-storage.service.ts บรรทัด 66 ที่ develop accb616) CDN อาจส่งไฟล์ที่ลบแล้วกลับมาถ้าเปิด URL เดิมซ้ำ (อนุมาน)
 */
export class PublicFileApi {
  constructor(private readonly request: APIRequestContext) {}

  async open(url: string): Promise<PublicFileResult> {
    const fresh = `${url}${url.includes('?') ? '&' : '?'}e2e=${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await this.request.get(fresh, { headers: { 'Cache-Control': 'no-cache' } });
    return { ok: response.ok(), status: response.status(), body: response.ok() ? await response.body() : Buffer.alloc(0) };
  }
}
