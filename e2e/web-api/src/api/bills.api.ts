import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * เส้นทางกลุ่ม /bills : บิลค่าเช่ารายเดือนและสลิปการชำระ
 * ที่มา: apps/api/src/billing/ (tenant-bills, owner-bills, agent-bills controller) ตรวจซ้ำที่ develop 9644dd9
 *
 * แบ่ง 3 กลุ่มตามบทบาทที่ต้องมี
 *   - mine     ผู้เช่า (tenant): บิลของตัวเอง อัปสลิป และยืนยันส่งสลิปให้นายหน้า
 *   - received เจ้าของห้อง (landlord ชื่อเดิม owner): บิลที่ได้รับ และสลิปของบิลที่นายหน้ายืนยันแล้ว
 *   - agent    นายหน้า (agent): สลิปที่ผู้เช่าส่งมา ยืนยันการชำระ หรือตีกลับ
 *
 * ข้อควรระวัง
 *   - GET mine, GET mine/next, GET received และ GET agent/tenants/:tenantId สร้างบิลเองก่อนตอบ
 *     ถ้าผู้ใช้มีสัญญาเช่าที่ active และถึงรอบออกบิลแล้ว (ensureForUser, ensureForOwner, insertBills ใน tenant-billing.service.ts)
 *     และเปลี่ยนสถานะการเข้าพัก (room_tenancies) จาก prospect เป็น active เมื่อถึงวันเข้าอยู่ด้วย
 *     ตั้งแต่ 9644dd9 ยังเปลี่ยนหนังสือต่อสัญญาที่ลงนามแล้วเป็น active เมื่อถึงวันมีผล (insertBills บรรทัด 250-259
 *     กับ renewalActiveOn ใน rent-schedule.ts:92-95) เพราะ activeLeases (บรรทัด 228-237) เลือกหนังสือต่อสัญญาที่ออกเอกสารแล้ว
 *     และรอลงนามหรือรอนายหน้าตรวจด้วย การเก็บกวาดจึงต้องคืนทั้งบิล สถานะการเข้าพัก และสถานะของหนังสือต่อสัญญา
 *     เทสที่ไม่ต้องการสร้างข้อมูลจึงไม่ควรเรียก 4 เส้นทางนี้ด้วยบัญชีที่มีบทบาทที่เส้นทางรับ
 *     (ข้อยกเว้น: roles.spec.ts เรียก mine, mine/next และ received ด้วยบัญชี QA ที่ไม่มีบทบาทนั้นเท่านั้น
 *      RolesGuard ปฏิเสธด้วย 403 ก่อนถึง handler ความปลอดภัยของข้อนี้จึงขึ้นกับ guard ดู roles.spec.ts)
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

  // ---------- ค่าปรับของบิล ใหม่ใน develop 9644dd9 (เลขบรรทัดของ apps/api/src/billing ที่ 9644dd9) ----------
  // kind ที่มีเอกสาร: invoice, receipt, payment-slip ไม่มี pipe ตรวจ kind ค่าอื่นได้ 404 "ไม่พบเอกสาร" หลังหาบิลและใบค่าปรับแล้ว
  // (lateFeeDocument ใน tenant-billing.service.ts:748-758) ตัวเรียกของเส้นทาง POST ใช้กับบิลที่ไม่มีอยู่จริงเท่านั้น (ดูข้อควรระวังด้านบน)

  /**
   * GET /bills/agent/:id/late-fee/:kind : นายหน้าเปิดใบแจ้งหนี้ค่าปรับ ใบเสร็จ หรือสลิป (agent-bills.controller.ts:53)
   * อ่านอย่างเดียว: lateFeeUrlForAgent (tenant-billing.service.ts:761) หาบิลของดีลก่อน (ownedDealBill บรรทัด 653-658)
   */
  agentLateFeeDocument(id: number | string, kind: string): Promise<APIResponse> {
    return this.client.get(`bills/agent/${id}/late-fee/${encodeURIComponent(kind)}`);
  }

  /**
   * POST /bills/agent/:id/late-fee : นายหน้าออกใบแจ้งหนี้ค่าปรับของบิล เนื้อคำขอ { amount, dueDate? } (agent-bills.controller.ts:63)
   * createLateFee (tenant-billing.service.ts:664) ตรวจเนื้อคำขอก่อนหาบิล: lateFeeInput (บรรทัด 666 amount เป็นยอดบวก
   * ทศนิยมไม่เกิน 2 ตำแหน่ง, dueDate ถ้าส่งต้องเป็น YYYY-MM-DD) แล้วจึงหาบิล (บรรทัด 667)
   * id ที่ไม่มีจริงจึงได้ 404 เฉพาะเมื่อส่งเนื้อคำขอที่ผ่าน ถ้าบิลมีอยู่จริงและเลยวันผ่อนผันแล้ว ระบบจะสร้างไฟล์ PDF และบันทึกใบค่าปรับ
   */
  agentCreateLateFee(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`bills/agent/${id}/late-fee`, body);
  }

  /**
   * POST /bills/agent/:id/late-fee/return : นายหน้าตีกลับสลิปค่าปรับ เนื้อคำขอ { submittedAt, reason } (agent-bills.controller.ts:73)
   * returnLateFeeSlip (tenant-billing.service.ts:727) หาบิลก่อน (บรรทัด 728) แล้วจึงตรวจเนื้อคำขอ
   */
  agentReturnLateFeeSlip(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`bills/agent/${id}/late-fee/return`, body);
  }

  /**
   * POST /bills/received/:id/late-fee : เส้นทางเดิมที่เจ้าของห้องออกใบแจ้งหนี้ค่าปรับ ถูกลบตั้งแต่ develop 1b16d32
   * (ลบจาก owner-bills.controller.ts และลบ createLateFeeForLandlord) ตอนนี้ NestJS ตอบ 404 "Cannot POST ..."
   * เก็บตัวเรียกไว้ให้ bills.spec.ts ตรวจว่าเส้นทางยังไม่ถูกเปิดกลับเท่านั้น ห้ามใช้เป็นเส้นทางที่ใช้งานอยู่
   * (อนุมาน: ถ้าเส้นทางกลับมาและบิลมีอยู่จริง อาจบันทึกใบค่าปรับเหมือนโค้ดเดิม โค้ดของเส้นทางที่จะกลับมายังไม่มีให้ดู)
   */
  retiredReceivedCreateLateFee(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`bills/received/${id}/late-fee`, body);
  }

  /**
   * GET /bills/received/:id/late-fee/:kind : เจ้าของห้องเปิดใบแจ้งหนี้ค่าปรับ ใบเสร็จ หรือสลิป (owner-bills.controller.ts:43)
   * อ่านอย่างเดียว: lateFeeUrlForOwner (tenant-billing.service.ts:781) หาบิลของเจ้าของห้องก่อน (owned บรรทัด 466-473)
   */
  receivedLateFeeDocument(id: number | string, kind: string): Promise<APIResponse> {
    return this.client.get(`bills/received/${id}/late-fee/${encodeURIComponent(kind)}`);
  }

  /**
   * GET /bills/mine/:id/late-fee/:kind : ผู้เช่าเปิดใบแจ้งหนี้ค่าปรับ ใบเสร็จ หรือสลิปของบิลตัวเอง (tenant-bills.controller.ts:71)
   * อ่านอย่างเดียว: lateFeeUrlForTenant (tenant-billing.service.ts:771) หาบิลของผู้เช่าก่อน (mine บรรทัด 484-491)
   */
  mineLateFeeDocument(id: number | string, kind: string): Promise<APIResponse> {
    return this.client.get(`bills/mine/${id}/late-fee/${encodeURIComponent(kind)}`);
  }

  /**
   * POST /bills/mine/:id/late-fee/payment-slip โดยไม่แนบไฟล์ (tenant-bills.controller.ts:80 รับ multipart ช่อง file)
   * uploadLateFeeSlip (tenant-billing.service.ts:791) หาบิลก่อน (บรรทัด 792) แล้วจึงอ่านไฟล์
   * ใช้ได้เฉพาะเคสที่ API ต้องปฏิเสธก่อนอ่านไฟล์ เหมือน uploadMinePaymentSlipWithoutFile
   */
  uploadMineLateFeeSlipWithoutFile(id: number | string): Promise<APIResponse> {
    return this.client.post(`bills/mine/${id}/late-fee/payment-slip`);
  }
}
