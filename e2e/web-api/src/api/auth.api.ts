import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/** เส้นทางกลุ่ม /auth */
export class AuthApi {
  constructor(private readonly client: ApiClient) {}

  /**
   * POST /auth/sync : ให้ API จับคู่บัตรผ่านกับผู้ใช้ในฐานข้อมูล แล้วตอบข้อมูลผู้ใช้กับบทบาท
   *
   * ข้อควรระวัง: ถ้าบัตรผ่านเป็นของคนที่ยังไม่มีในฐานข้อมูล เส้นทางนี้จะสร้างผู้ใช้ใหม่ทันที
   * เทสแบบอ่านอย่างเดียวจึงเรียกเส้นทางนี้ด้วยบัญชีตัวอย่างที่มีอยู่แล้วเท่านั้น
   */
  sync(): Promise<APIResponse> {
    return this.client.post('auth/sync');
  }
}
