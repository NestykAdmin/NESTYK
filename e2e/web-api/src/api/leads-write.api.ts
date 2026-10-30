import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * เส้นทางกลุ่ม /agent/leads ที่เขียนข้อมูล
 *
 * แยกจาก LeadsApi (leads.api.ts) โดยตั้งใจ: fixture ของ tests/api ไม่สร้าง class นี้
 * ตามข้อตกลง มีแค่ src/write/write.fixture.ts ที่สร้าง class นี้ หลังตรวจตัวกัน (src/write/write-guard.ts)
 * โค้ดไม่ได้บังคับ: เทสใน tests/api ยังสร้าง class นี้เอง หรือเรียก client.post ตรง ๆ ได้ ผู้ตรวจเทสต้องดูเอง
 *
 * ที่มา (เลขบรรทัดที่ qa/e2e a7eb77c): apps/api/src/agent/leads/agent-leads.controller.ts บรรทัด 17-21
 *   และ agent-leads.service.ts ตามที่ระบุในแต่ละเมธอด ลีดไม่มีเส้นทางลบ ลีดที่สร้างแล้วจึงค้างในฐานข้อมูลถาวร
 *   เส้นทาง POST ทั้ง 3 ตัวตอบ 201 เมื่อสำเร็จ (ค่าเริ่มต้นของ @Post ใน NestJS ; controller ไม่มี @HttpCode) ส่วน PATCH ตอบ 200
 */
export class LeadsWriteApi {
  constructor(private readonly client: ApiClient) {}

  /** POST /agent/leads : สร้างลีดสถานะ new (service create บรรทัด 205-218 ; ช่องบังคับคือ firstName กับ phone) */
  create(body: unknown): Promise<APIResponse> {
    return this.client.post('agent/leads', body);
  }

  /**
   * PATCH /agent/leads/:id : แก้ลีด (service update บรรทัด 230-247)
   * API รวมค่าที่ส่งกับค่าเดิมแล้วตรวจใหม่ทั้งก้อน ช่อง status ที่ส่งมาไม่ถูกบันทึก (leadColumns บรรทัด 342-354 ไม่มี status)
   * และลบแล้วใส่หมุดทำเล (ตาราง lead_locations) ของลีดนั้นใหม่ทุกครั้ง (replacePins บรรทัด 244, 356-364)
   */
  update(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.patch(`agent/leads/${id}`, body);
  }

  /** POST /agent/leads/:id/mark-lost : เปลี่ยนเป็น lost พร้อมเหตุผล { lostReason } (service markLost บรรทัด 320-328 ; ลีด booked ได้ 409) */
  markLost(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`agent/leads/${id}/mark-lost`, body);
  }

  /** POST /agent/leads/:id/mark-inprogress : เปลี่ยนเป็น inprogress และล้างเหตุผล (service markInProgress บรรทัด 310-318 ; ลีด booked ได้ 409) */
  markInProgress(id: number | string): Promise<APIResponse> {
    return this.client.post(`agent/leads/${id}/mark-inprogress`);
  }
}
