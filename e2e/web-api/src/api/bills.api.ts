import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * เส้นทางกลุ่ม /bills : บิลค่าเช่ารายเดือนและสลิปการชำระ
 * ที่มา: apps/api/src/billing/ (tenant-bills, owner-bills, agent-bills controller) ที่ DEV/main f7d52ed
 *
 * แบ่ง 3 กลุ่มตามบทบาทที่ต้องมี
 *   - mine     ผู้เช่า (tenant): บิลของตัวเอง อัปสลิป และยืนยันส่งสลิปให้นายหน้า
 *   - received เจ้าของห้อง (owner): บิลที่ได้รับ และสลิปของบิลที่นายหน้ายืนยันแล้ว
 *   - agent    นายหน้า (agent): สลิปที่ผู้เช่าส่งมา ยืนยันการชำระ หรือตีกลับ
 *
 * ข้อควรระวัง
 *   - GET mine, GET mine/next, GET received และ GET agent/tenants/:tenantId สร้างบิลเองก่อนตอบ
 *     ถ้าผู้ใช้มีสัญญาเช่าที่ active และถึงรอบออกบิลแล้ว (ensureForUser, ensureForOwner, insertBills ใน tenant-billing.service.ts)
 *     และเปลี่ยนสถานะการเข้าพัก (room_tenancies) จาก prospect เป็น active เมื่อถึงวันเข้าอยู่ด้วย
 *     การเก็บกวาดจึงต้องคืนทั้งบิลและสถานะการเข้าพัก
 *     เทสที่ไม่ต้องการสร้างข้อมูลจึงไม่ควรเรียก 4 เส้นทางนี้
 *   - เส้นทาง POST บันทึกข้อมูลทันทีถ้าบิลมีอยู่จริงและอยู่ในสถานะที่ทำได้ เทสที่มีตอนนี้ใช้เฉพาะ id ที่ไม่มีอยู่จริง
 *   - id รับเป็นข้อความได้ด้วย เพื่อใช้ทดสอบ id ที่ผิดรูปแบบ
 */
export class BillsApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /bills/mine : บิลของผู้เช่าที่ล็อกอิน (สร้างบิลเองก่อนตอบ ดูข้อควรระวัง) */
  mine(): Promise<APIResponse> {
    return this.client.get('bills/mine');
  }

  /** GET /bills/mine/next : รอบค่าเช่าถัดไปของผู้เช่า (สร้างบิลเองก่อนตอบ ดูข้อควรระวัง) */
  mineNext(): Promise<APIResponse> {
    return this.client.get('bills/mine/next');
  }

  /** GET /bills/mine/:id/payment-slip : ลิงก์เปิดสลิปของบิลตัวเอง */
  minePaymentSlip(id: number | string): Promise<APIResponse> {
    return this.client.get(`bills/mine/${id}/payment-slip`);
  }

  /**
   * POST /bills/mine/:id/payment-slip โดยไม่แนบไฟล์
   * API รับไฟล์แบบ multipart ช่อง file แต่ตัวส่งคำขอของชุดเทสยังไม่รองรับ multipart
   * จึงใช้ได้เฉพาะเคสที่ API ต้องปฏิเสธก่อนอ่านไฟล์ (ยังไม่ล็อกอิน, id ผิดรูปแบบ, ไม่พบบิล)
   */
  uploadMinePaymentSlipWithoutFile(id: number | string): Promise<APIResponse> {
    return this.client.post(`bills/mine/${id}/payment-slip`);
  }

  /** POST /bills/mine/:id/confirm : ผู้เช่ายืนยันส่งสลิปให้นายหน้า */
  confirmMine(id: number | string): Promise<APIResponse> {
    return this.client.post(`bills/mine/${id}/confirm`, {});
  }

  /** GET /bills/received : บิลที่เจ้าของห้องได้รับ (สร้างบิลเองก่อนตอบ ดูข้อควรระวัง) */
  received(): Promise<APIResponse> {
    return this.client.get('bills/received');
  }

  /** GET /bills/received/:id/payment-slip : ลิงก์เปิดสลิปของบิลที่นายหน้ายืนยันแล้ว */
  receivedPaymentSlip(id: number | string): Promise<APIResponse> {
    return this.client.get(`bills/received/${id}/payment-slip`);
  }

  /** GET /bills/agent : สลิปที่ผู้เช่าส่งมาและรอนายหน้าตรวจ (ไม่สร้างบิล) */
  agentPending(): Promise<APIResponse> {
    return this.client.get('bills/agent');
  }

  /** GET /bills/agent/tenants/:tenantId : บิลและการชำระของผู้เช่า 1 ราย (สร้างบิลเองก่อนตอบ ดูข้อควรระวัง) */
  agentTenantBilling(tenantId: number | string): Promise<APIResponse> {
    return this.client.get(`bills/agent/tenants/${tenantId}`);
  }

  /** GET /bills/agent/:id/payment-slip : ลิงก์เปิดสลิปที่ผู้เช่าส่งมา */
  agentPaymentSlip(id: number | string): Promise<APIResponse> {
    return this.client.get(`bills/agent/${id}/payment-slip`);
  }

  /** POST /bills/agent/:id/confirm : นายหน้ายืนยันการชำระ */
  agentConfirm(id: number | string): Promise<APIResponse> {
    return this.client.post(`bills/agent/${id}/confirm`, {});
  }

  /** POST /bills/agent/:id/return : นายหน้าตีกลับสลิป พร้อมเหตุผล (body ปกติคือ { reason }) */
  agentReturn(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`bills/agent/${id}/return`, body);
  }
}
