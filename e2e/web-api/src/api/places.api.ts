import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * เส้นทางกลุ่ม /agent/places : ค้นสถานที่สำหรับฟอร์มลีดและห้อง (รับเฉพาะบทบาท agent: agent-places.controller.ts:8-11 ที่ develop a09e6d2)
 *
 * ข้อควรระวัง: เมื่อผู้เรียกมีบทบาท agent เส้นทางนี้เรียกบริการของ Google ต่อ (ใช้โควตาและอาจมีค่าใช้จ่าย)
 * ชุดเทสจึงเรียกด้วยบัญชีที่ไม่มีบทบาท agent เท่านั้น เพื่อตรวจว่าถูกปฏิเสธ (403) ก่อนถึงบริการภายนอก
 */
export class PlacesApi {
  constructor(private readonly client: ApiClient) {}

  /**
   * GET /agent/places/autocomplete?q= : คำแนะนำสถานที่จากข้อความที่พิมพ์ (ชื่อพารามิเตอร์: agent-places.controller.ts:17)
   * คำค้นที่สั้นกว่า 2 ตัวอักษรคืนรายการว่างโดยไม่เรียก Google (agent-places.service.ts:273-275)
   */
  autocomplete(q: string): Promise<APIResponse> {
    return this.client.get('agent/places/autocomplete', { q });
  }
}
