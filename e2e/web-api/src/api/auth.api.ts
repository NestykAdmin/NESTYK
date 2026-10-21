import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/** เส้นทางกลุ่ม /auth */
export class AuthApi {
  constructor(private readonly client: ApiClient) {}

  /**
   * POST /auth/sync : ให้ API จับคู่บัตรผ่านกับผู้ใช้ในฐานข้อมูล แล้วตอบข้อมูลผู้ใช้กับบทบาท
   *
   * ข้อควรระวัง: ถ้าบัตรผ่านเป็นของคนที่ยังไม่มีในฐานข้อมูล เส้นทางนี้จะสร้างผู้ใช้ใหม่ทันที
   * เทสแบบอ่านอย่างเดียวจึงเรียกเส้นทางนี้ด้วยบัญชีตัวอย่างที่มีอยู่แล้ว และบัญชี QA ที่ global-setup ยืนยันแล้วว่ามีอยู่เท่านั้น
   */
  sync(): Promise<APIResponse> {
    return this.client.post('auth/sync');
  }

  /**
   * POST /auth/dev/roles : ขอบทบาทให้บัญชีที่ล็อกอินอยู่ (เครื่องมือของนักพัฒนา ใช้ได้เมื่อ API ตั้ง ALLOW_DEV_ROLE_GRANT=true)
   * ที่มา: apps/api/src/auth/auth.controller.ts:64-75 และ grantDevRole ใน auth.service.ts:166-189 ที่ develop 84087e2
   *
   * ข้อควรระวัง: ถ้าชื่อบทบาทอยู่ในรายการที่ขอได้ (DEV_GRANTABLE ใน auth.service.ts:27) มีแถวในตาราง master_roles
   * และบัญชียังไม่มีบทบาทนั้น API จะบันทึกบทบาทลงตาราง user_roles ทันที (auth.service.ts:173-186)
   * เทสจึงส่งได้เฉพาะชื่อบทบาทที่ API ต้องปฏิเสธก่อนอ่านตารางบทบาท
   */
  grantDevRole(role: string): Promise<APIResponse> {
    return this.client.post('auth/dev/roles', { role });
  }
}
