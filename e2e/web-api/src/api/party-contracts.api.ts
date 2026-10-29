import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * เส้นทางกลุ่ม /contracts/mine : สัญญาที่ส่งถึงผู้เช่าหรือเจ้าของห้องคนที่ล็อกอิน (ผู้เรียกต้องมีบทบาท tenant หรือ landlord
 * ตาม @Roles ระดับ class ของ party-contracts.controller.ts ตั้งแต่ develop 84087e2 ก่อนหน้านั้น landlord ชื่อ owner)
 * ยกเว้นเส้นทางที่มี @Roles('landlord') ระดับ method: GET mine/deal-offers กับ POST mine/deal-offers/:id/confirm
 * (ตั้งแต่ develop f845ac6) และ GET mine/reminders (ตั้งแต่ develop 8a62e39) RolesGuard ใช้ค่าระดับ method แทนระดับ class
 * (getAllAndOverride ใน apps/api/src/auth/guards/roles.guard.ts) บัญชีที่มีแค่ tenant จึงเรียก 3 เส้นทางนี้ไม่ได้
 *
 * ข้อควรระวังของเส้นทาง POST: ถ้าสัญญามีอยู่จริงและผู้เรียกเป็นคู่สัญญา ระบบจะบันทึกทันที
 * (สร้างไฟล์สัญญา ลงนาม รับสลิป หรือรับเอกสารแนบ) เทสที่มีตอนนี้จึงใช้กับสัญญาที่ไม่มีอยู่จริงเท่านั้น
 */
export class PartyContractsApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /contracts/mine : สัญญาที่ส่งถึงผู้ใช้คนนี้แล้ว */
  mine(): Promise<APIResponse> {
    return this.client.get('contracts/mine');
  }

  /** GET /contracts/mine/:id/attachments : รายการเอกสารแนบของสัญญา */
  attachments(id: number | string): Promise<APIResponse> {
    return this.client.get(`contracts/mine/${id}/attachments`);
  }

  /** GET /contracts/mine/:id/attachments/:documentId/url : ที่อยู่สำหรับเปิดเอกสารแนบ 1 ฉบับ */
  attachmentUrl(id: number | string, documentId: number | string): Promise<APIResponse> {
    return this.client.get(`contracts/mine/${id}/attachments/${documentId}/url`);
  }

  /** GET /contracts/mine/:id/financial-documents/:kind : ที่อยู่สำหรับเปิดใบแจ้งหนี้ ใบเสร็จ หรือสลิปค่าจอง */
  financialDocument(id: number | string, kind: string): Promise<APIResponse> {
    return this.client.get(`contracts/mine/${id}/financial-documents/${encodeURIComponent(kind)}`);
  }

  /** POST /contracts/mine/:id/document : ขอที่อยู่ไฟล์สัญญา ถ้ายังไม่มีไฟล์ ระบบจะสร้างไฟล์ตัวอย่างเก็บไว้ (ดูข้อควรระวังด้านบน) */
  document(id: number | string): Promise<APIResponse> {
    return this.client.post(`contracts/mine/${id}/document`);
  }

  /** POST /contracts/mine/:id/sign : ลงนามในฐานะคู่สัญญา (ดูข้อควรระวังด้านบน) */
  sign(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`contracts/mine/${id}/sign`, body);
  }

  /**
   * POST /contracts/mine/:id/payment-slip : ส่งสลิปค่าจอง (ดูข้อควรระวังด้านบน)
   * ตัวเรียกนี้ยังไม่แนบไฟล์ เพราะเทสตอนนี้ใช้ตรวจแค่ว่าระบบหาสัญญาก่อนอ่านไฟล์
   */
  uploadPaymentSlip(id: number | string): Promise<APIResponse> {
    return this.client.post(`contracts/mine/${id}/payment-slip`);
  }

  /**
   * POST /contracts/mine/:id/attachments : แนบเอกสาร (ดูข้อควรระวังด้านบน)
   * ตัวเรียกนี้ยังไม่แนบไฟล์ เพราะเทสตอนนี้ใช้ตรวจแค่ว่าระบบหาสัญญาก่อนอ่านไฟล์
   */
  uploadAttachment(id: number | string): Promise<APIResponse> {
    return this.client.post(`contracts/mine/${id}/attachments`);
  }

  /**
   * POST /contracts/mine/:id/deposit-payment-slip : ผู้เช่าส่งสลิปเงินประกันของสัญญาเช่า (ดูข้อควรระวังด้านบน)
   * ตัวเรียกนี้ยังไม่แนบไฟล์ เพราะเทสตอนนี้ใช้ตรวจแค่ว่าระบบหาสัญญาก่อนอ่านไฟล์
   */
  uploadDepositPaymentSlip(id: number | string): Promise<APIResponse> {
    return this.client.post(`contracts/mine/${id}/deposit-payment-slip`);
  }

  /**
   * GET /contracts/mine/:id/handover : บันทึกการส่งมอบห้องที่คู่สัญญาตรวจก่อนลงนาม (ตั้งแต่ develop f845ac6)
   * อ่านอย่างเดียว (เลขบรรทัดที่ 9644dd9): apps/api/src/agent/contracts/handover.service.ts partyView (บรรทัด 398-401)
   * เรียก contractForParty (agent-contracts.service.ts:2623-2628 ทำแค่ query, partiesFor และ NotFound) กับ view() (บรรทัด 167-221)
   */
  handover(id: number | string): Promise<APIResponse> {
    return this.client.get(`contracts/mine/${id}/handover`);
  }

  /**
   * GET /contracts/mine/deal-offers : ข้อเสนอราคาของห้องของผู้ให้เช่า (@Roles('landlord') ระดับ method)
   * อ่านอย่างเดียวที่ 9644dd9: deal-offers.service.ts listForLandlord (บรรทัด 515-523) กับ view() (บรรทัด 320-344) ไม่มีคำสั่งเขียน
   */
  landlordDealOffers(): Promise<APIResponse> {
    return this.client.get('contracts/mine/deal-offers');
  }

  /**
   * GET /contracts/mine/reminders : แจ้งเตือนค่าเช่าค้างของห้องของผู้ให้เช่า (@Roles('landlord') ระดับ method)
   * อ่านอย่างเดียวที่ 9644dd9: contract-reminders.service.ts forLandlord (บรรทัด 116-118) เรียก due() ซึ่งไม่มีคำสั่งเขียน
   */
  landlordReminders(): Promise<APIResponse> {
    return this.client.get('contracts/mine/reminders');
  }

  /**
   * POST /contracts/mine/deal-offers/:id/confirm : ผู้ให้เช่ายืนยันข้อเสนอ (@Roles('landlord') ระดับ method ที่ party-contracts.controller.ts:108-109)
   * ตัวเรียกนี้ส่งเนื้อคำขอว่าง ({}) เสมอ จึงยืนยันข้อเสนอจริงไม่ได้แม้เรียกด้วย landlord (ไม่มี revision)
   * ใช้กับบัญชีที่ต้องได้ 403 และ id ที่ไม่มีจริงเท่านั้น
   * ถ้า guard พังจนคำขอไปถึง service: confirmAsLandlord (deal-offers.service.ts:525-529 ที่ 9644dd9) ตรวจเนื้อคำขอก่อนเปิด transaction
   * เนื้อคำขอว่างไม่มี revision จึงได้ 400 จาก revisionOf (บรรทัด 113-118) โดยไม่แตะฐานข้อมูล
   */
  landlordConfirmDealOfferEmptyBody(id: number | string): Promise<APIResponse> {
    return this.client.post(`contracts/mine/deal-offers/${id}/confirm`, {});
  }

  // ---------- เส้นทางใหม่ใน develop 9644dd9 (เลขบรรทัดของ apps/api/src ที่ 9644dd9) ----------
  // ไม่มี @Roles ระดับ method จึงใช้ @Roles("tenant", "landlord") ระดับ class (party-contracts.controller.ts:34)
  // หาสัญญาด้วย contractForParty (agent-contracts.service.ts:2623) ไม่พบหรือไม่ใช่คู่สัญญาตอบ 404 "ไม่พบสัญญา"

  /**
   * GET /contracts/mine/:id/deposit-settlement : รายการหักและการคืนเงินประกันของสัญญา (controller บรรทัด 59)
   * อ่านอย่างเดียว: deposit-settlement.ts partyView (บรรทัด 111) เรียก contractForParty แล้ว present()
   */
  depositSettlement(id: number | string): Promise<APIResponse> {
    return this.client.get(`contracts/mine/${id}/deposit-settlement`);
  }

  /**
   * GET /contracts/mine/:id/handover/move-out : บันทึกการส่งมอบห้องตอนย้ายออก (controller บรรทัด 69)
   * อ่านอย่างเดียว: handover.service.ts partyView (บรรทัด 398) เรียก contractForParty แล้ว view()
   */
  moveOutHandover(id: number | string): Promise<APIResponse> {
    return this.client.get(`contracts/mine/${id}/handover/move-out`);
  }

  /**
   * POST /contracts/mine/:id/handover/move-out/sign : คู่สัญญาลงนามบันทึกย้ายออกในแอปของตัวเอง (controller บรรทัด 76)
   * partySign (handover.service.ts:404) หาสัญญาก่อน (บรรทัด 405) แล้วจึงตรวจเนื้อคำขอ (บรรทัด 406)
   * ถ้าสัญญามีอยู่จริงและผู้เรียกเป็นคู่สัญญา ระบบจะเก็บไฟล์ลายเซ็นและบันทึกการลงนาม (ดูข้อควรระวังด้านบน)
   */
  signMoveOutHandover(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`contracts/mine/${id}/handover/move-out/sign`, body);
  }

  /**
   * GET /contracts/mine/:id/early-end/:kind : ที่อยู่สำหรับเปิดใบแจ้งหนี้หรือสลิปของการเลิกสัญญาก่อนกำหนด (controller บรรทัด 233)
   * kind ที่มีเอกสาร: invoice, slip (proof ได้ 404 "ไม่พบเอกสาร" สำหรับคู่สัญญา service:2265) ค่าอื่นได้ 404 "ไม่พบเอกสาร" หลังหาสัญญาแล้ว
   * อ่านอย่างเดียว: earlyEndFileUrl (service:2258) หาสัญญาด้วย contractForParty แล้วขอลิงก์ของไฟล์
   */
  earlyEndFile(id: number | string, kind: string): Promise<APIResponse> {
    return this.client.get(`contracts/mine/${id}/early-end/${encodeURIComponent(kind)}`);
  }

  /**
   * POST /contracts/mine/:id/early-end/payment-slip โดยไม่แนบไฟล์ (controller บรรทัด 242 รับ multipart ช่อง file)
   * uploadEarlyEndSlip (service:2272) หาสัญญาก่อนอ่านไฟล์ ตัวเรียกนี้จึงใช้ได้กับเคสที่ต้องถูกปฏิเสธก่อนอ่านไฟล์ (ดูข้อควรระวังด้านบน)
   */
  uploadEarlyEndPaymentSlipWithoutFile(id: number | string): Promise<APIResponse> {
    return this.client.post(`contracts/mine/${id}/early-end/payment-slip`);
  }
}

/**
 * เส้นทางกลุ่ม /public/contract-sign ที่ทีมลบแล้ว (ลงนามผ่านลิงก์โดยไม่ต้องล็อกอิน)
 * ถูกลบใน develop ช่วง 740743e ถึง b228ee3 (ไม่มี controller นี้ใน apps/api/src/agent/agent.module.ts แล้ว)
 * ตัวเรียกนี้มีไว้ตรวจว่าเส้นทางเดิมเปิดไม่ได้แล้วเท่านั้น
 */
export class RetiredContractSignApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /public/contract-sign/:token (เส้นทางเดิม) */
  preview(token: string): Promise<APIResponse> {
    return this.client.get(`public/contract-sign/${encodeURIComponent(token)}`);
  }

  /** POST /public/contract-sign/:token (เส้นทางเดิม) */
  sign(token: string, body: unknown): Promise<APIResponse> {
    return this.client.post(`public/contract-sign/${encodeURIComponent(token)}`, body);
  }
}
