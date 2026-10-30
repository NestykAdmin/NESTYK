import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * ลิงก์แชร์ห้อง: agent/listings/:id/share-links (ต้องล็อกอิน บทบาท agent) และหน้าสาธารณะ public/room-shares/:token (ไม่ต้องล็อกอิน)
 * ที่มา (เลขบรรทัดที่ develop bc77a8b): apps/api/src/agent/listings/room-share-links.controller.ts และ room-share-links.service.ts
 *
 * POST สร้างลิงก์จริงเมื่อห้องเป็นของนายหน้าและเนื้อคำขอผ่าน (รวมเนื้อคำขอว่าง) และ DELETE ยกเลิกลิงก์จริง
 *   ชุดเทส tests/api ส่งไปเฉพาะห้องที่ไม่มีจริง หรือค่า expiresInDays / contactId / linkId ที่ API ต้องปฏิเสธก่อนบันทึก
 *   ลำดับในโค้ด: หาห้อง (service 105) แล้วตรวจ expiresInDays (110) แล้ว contactId (112-131) แล้วจึงบันทึก (135)
 */
export class RoomShareLinksApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /agent/listings/:id/share-links : อ่านอย่างเดียว ไม่คืน token หรือ url */
  list(roomId: number | string): Promise<APIResponse> {
    return this.client.get(`agent/listings/${roomId}/share-links`);
  }

  /** POST /agent/listings/:id/share-links (ใช้กับคำขอที่ต้องถูกปฏิเสธเท่านั้น) */
  create(roomId: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`agent/listings/${roomId}/share-links`, body);
  }

  /** DELETE /agent/listings/:id/share-links/:linkId (ใช้กับห้องหรือลิงก์ที่ไม่มีจริงเท่านั้น) */
  revoke(roomId: number | string, linkId: number | string): Promise<APIResponse> {
    return this.client.delete(`agent/listings/${roomId}/share-links/${linkId}`);
  }

  /** GET /public/room-shares/:token : หน้าสาธารณะ ไม่เขียนข้อมูลและไม่นับครั้งที่เปิด (service publicResolve 203-232) */
  publicView(token: string): Promise<APIResponse> {
    return this.client.get(`public/room-shares/${encodeURIComponent(token)}`);
  }
}
