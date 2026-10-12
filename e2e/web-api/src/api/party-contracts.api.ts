import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * เส้นทางกลุ่ม /contracts/mine : สัญญาที่ส่งถึงผู้เช่าหรือเจ้าของห้องคนที่ล็อกอิน (ผู้เรียกต้องมีบทบาท tenant หรือ owner)
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
}

/** เส้นทางกลุ่ม /public/contract-sign : ลิงก์ลงนามที่คู่สัญญาเปิดได้โดยไม่ต้องล็อกอิน */
export class PublicContractSignApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /public/contract-sign/:token : ข้อมูลสัญญาของลิงก์นี้ */
  preview(token: string): Promise<APIResponse> {
    return this.client.get(`public/contract-sign/${encodeURIComponent(token)}`);
  }

  /** POST /public/contract-sign/:token : ลงนามผ่านลิงก์ (ใช้กับลิงก์ที่ไม่เคยถูกออกเท่านั้น) */
  sign(token: string, body: unknown): Promise<APIResponse> {
    return this.client.post(`public/contract-sign/${encodeURIComponent(token)}`, body);
  }
}
