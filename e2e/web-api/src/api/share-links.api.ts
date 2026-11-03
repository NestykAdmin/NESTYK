import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * ลิงก์แชร์ห้อง: agent/listings/:id/share-links (ต้องล็อกอิน บทบาท agent) และหน้าสาธารณะ public/room-shares/:token (ไม่ต้องล็อกอิน)
 * ที่มา (เลขบรรทัดที่ develop bc77a8b): apps/api/src/agent/listings/room-share-links.controller.ts และ room-share-links.service.ts
 *
 * POST สร้างลิงก์จริงเมื่อห้องเป็นของนายหน้าและเนื้อคำขอผ่าน (รวมเนื้อคำขอว่าง) และ DELETE ยกเลิกลิงก์จริง
 *   ชุดเทส tests/api ส่งไปเฉพาะห้องที่ไม่มีจริง หรือค่า expiresInDays / contactId / linkId ที่ API ต้องปฏิเสธก่อนบันทึก
 *   ชุดเทส tests/write/share-links.write.spec.ts สร้างและยกเลิกลิงก์จริงกับห้องถาวร E2E-QA-ROOM-1 ของ qa-agent
 *   ลำดับในโค้ด: หาห้อง (service 105) แล้วตรวจ expiresInDays (110) แล้ว contactId (112-131) แล้วจึงบันทึก (135)
 */
export class RoomShareLinksApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /agent/listings/:id/share-links : อ่านอย่างเดียว ไม่คืน token หรือ url */
  list(roomId: number | string): Promise<APIResponse> {
    return this.client.get(`agent/listings/${roomId}/share-links`);
  }

  /** POST /agent/listings/:id/share-links (tests/api ใช้กับคำขอที่ต้องถูกปฏิเสธเท่านั้น ; คำตอบ 201 มี url ที่มี token อย่าพิมพ์ลงผลรัน) */
  create(roomId: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`agent/listings/${roomId}/share-links`, body);
  }

  /** DELETE /agent/listings/:id/share-links/:linkId (tests/api ใช้กับห้องหรือลิงก์ที่ไม่มีจริงเท่านั้น) */
  revoke(roomId: number | string, linkId: number | string): Promise<APIResponse> {
    return this.client.delete(`agent/listings/${roomId}/share-links/${linkId}`);
  }

  /** GET /public/room-shares/:token : หน้าสาธารณะ ไม่เขียนข้อมูลและไม่นับครั้งที่เปิด (service publicResolve 203-232) */
  publicView(token: string): Promise<APIResponse> {
    return this.client.get(`public/room-shares/${encodeURIComponent(token)}`);
  }
}

/** ผลของการเปิดหน้าแชร์สาธารณะ (ไม่เก็บ URL ไว้ในผล เพราะ URL มี token ของลิงก์) */
export interface PublicShareResult {
  status: number;
  /** หัวข้อ Cache-Control และ Referrer-Policy ของคำตอบ (controller บรรทัด 53-54) */
  cacheControl: string | undefined;
  referrerPolicy: string | undefined;
  /** เนื้อคำตอบที่แปลงจาก JSON (มี URL ของรูปใน Storage และข้อมูลผู้ติดต่อ อย่าพิมพ์ทั้งก้อนลงผลรัน) */
  body: Record<string, unknown>;
}

/**
 * เปิดหน้าแชร์สาธารณะ GET /public/room-shares/:token โดยไม่ส่งบัตรผ่าน แบบเดียวกับคนที่ได้รับลิงก์
 * ต่างจาก RoomShareLinksApi.publicView โดยตั้งใจ 2 จุด
 *   - คืนผลที่แปลงแล้ว ไม่ใช่ APIResponse ดิบ เพราะ APIResponse เก็บ URL ที่มี token ไว้ ถ้าส่งเข้าตัวตรวจ token จะถูกพิมพ์เมื่อเทสไม่ผ่าน
 *   - ใช้ fetch ของ Node ไม่ใช้ตัวส่งคำขอของ Playwright เพราะ Playwright บันทึกทุกคำขอเป็นขั้นในรายงาน HTML พร้อมที่อยู่เต็ม
 *     (ลองในห้องทดลอง 3 พ.ย. 2026: รายงาน HTML ของรอบที่ใช้ตัวส่งคำขอของ Playwright มีที่อยู่ที่มี token 9 ที่) fetch ไม่ถูกบันทึก
 */
export class PublicRoomShareApi {
  constructor(private readonly apiBaseUrl: string) {}

  async open(token: string): Promise<PublicShareResult> {
    const response = await fetch(`${this.apiBaseUrl}/public/room-shares/${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' },
      redirect: 'manual',
    });
    const text = await response.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = {};
    }
    return {
      status: response.status,
      cacheControl: response.headers.get('cache-control') ?? undefined,
      referrerPolicy: response.headers.get('referrer-policy') ?? undefined,
      body,
    };
  }
}
