import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/** ชนิดของข้อมูลตั้งต้นสำหรับสัญญาใหม่ ตามชื่อเส้นทาง /agent/contracts/<ชนิด>-defaults/:leadId */
export type AgreementDefaultsKind = 'reservation' | 'broker-appointment' | 'lease';

/**
 * เส้นทางกลุ่ม /agent/contracts : สัญญาและเอกสารการเงินของนายหน้าคนที่ล็อกอิน
 *
 * ตัวเรียกนี้มีเฉพาะเส้นทางที่อ่านข้อมูล เส้นทาง POST ของกลุ่มนี้ (สร้างสัญญา ออกเอกสาร ลงนาม) ยังไม่มีตัวเรียก
 * เพราะเขียนข้อมูลที่ย้อนไม่ได้ และการสร้างสัญญายังสร้างบัญชีผู้ใช้ให้คู่สัญญาด้วย
 * (saveDraft ใน apps/api/src/agent/contracts/agent-contracts.service.ts เรียก ensurePartyLogin ตอนบันทึกหนังสือจอง)
 */
export class ContractsApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /agent/contracts/types : ประเภทสัญญาที่เลือกได้ */
  types(): Promise<APIResponse> {
    return this.client.get('agent/contracts/types');
  }

  /** GET /agent/contracts/types/:code/templates : แม่แบบที่ใช้งานอยู่ของประเภทนั้น */
  templates(code: string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/types/${encodeURIComponent(code)}/templates`);
  }

  /** GET /agent/contracts */
  list(): Promise<APIResponse> {
    return this.client.get('agent/contracts');
  }

  /** GET /agent/contracts/candidates : ลีดที่เป็นผู้เช่าแล้วและพร้อมทำสัญญา */
  candidates(): Promise<APIResponse> {
    return this.client.get('agent/contracts/candidates');
  }

  /** GET /agent/contracts/invoices : ใบแจ้งหนี้ที่ออกแยกจากสัญญา */
  invoices(): Promise<APIResponse> {
    return this.client.get('agent/contracts/invoices');
  }

  /** GET /agent/contracts/invoices/next-number : เลขที่ใบแจ้งหนี้ใบถัดไป (ดูเลขอย่างเดียว ไม่จองเลข) */
  nextInvoiceNumber(): Promise<APIResponse> {
    return this.client.get('agent/contracts/invoices/next-number');
  }

  /** GET /agent/contracts/invoices/:invoiceId/receipt-defaults : ข้อมูลตั้งต้นของใบเสร็จ */
  receiptDefaults(invoiceId: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/invoices/${invoiceId}/receipt-defaults`);
  }

  /** GET /agent/contracts/commission-confirmations : หนังสือยืนยันค่าคอมมิชชั่น */
  commissionConfirmations(): Promise<APIResponse> {
    return this.client.get('agent/contracts/commission-confirmations');
  }

  /** GET /agent/contracts/commission-confirmations/next-number : เลขที่หนังสือยืนยันค่าคอมมิชชั่นใบถัดไป (ดูเลขอย่างเดียว) */
  nextCommissionConfirmationNumber(): Promise<APIResponse> {
    return this.client.get('agent/contracts/commission-confirmations/next-number');
  }

  /** GET /agent/contracts/<ชนิด>-defaults/:leadId : ข้อมูลตั้งต้นของสัญญาใหม่ ดึงจากผู้เช่าของลีดนั้น */
  defaults(kind: AgreementDefaultsKind, leadId: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${kind}-defaults/${leadId}`);
  }

  /**
   * GET /agent/contracts/owner-users?q= : ค้นบัญชีที่มีบทบาทเจ้าของห้อง (ใช้ในฟอร์มสัญญา)
   * ข้อควรระวัง: คำตอบมีข้อมูลส่วนตัว เทสควรตรวจแค่จำนวนกับ id และไม่ควรเทียบทั้งรายการ
   * เพราะถ้าเทสไม่ผ่าน Playwright จะพิมพ์ค่าที่เทียบออกมาในผลรัน
   */
  ownerUsers(q?: string): Promise<APIResponse> {
    return this.client.get('agent/contracts/owner-users', { q });
  }

  /** GET /agent/contracts/:id  (รับ id เป็นข้อความได้ด้วย เพื่อใช้ทดสอบ id ที่ผิดรูปแบบ) */
  getById(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}`);
  }

  /** GET /agent/contracts/:id/history : สัญญาฉบับนี้กับฉบับต่ออายุ */
  history(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/history`);
  }

  /** GET /agent/contracts/:id/draft-template : แม่แบบของร่างสัญญา */
  draftTemplate(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/draft-template`);
  }

  /** GET /agent/contracts/:id/financial-documents/:kind : ข้อมูลตั้งต้นของใบแจ้งหนี้หรือใบเสร็จของหนังสือจอง */
  financialDocumentDefaults(id: number | string, kind: string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/financial-documents/${encodeURIComponent(kind)}`);
  }

  /** GET /agent/contracts/:id/attachments : รายการเอกสารแนบของสัญญา */
  attachments(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/attachments`);
  }

  /** GET /agent/contracts/:id/attachments/:documentId/url : ที่อยู่สำหรับเปิดเอกสารแนบ 1 ฉบับ */
  attachmentUrl(id: number | string, documentId: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/attachments/${documentId}/url`);
  }

  /** GET /agent/contracts/:id/attachments/broker-appointment/defaults : ข้อมูลตั้งต้นของสัญญาแต่งตั้งนายหน้าที่แนบกับหนังสือจอง */
  brokerAppointmentAttachmentDefaults(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/attachments/broker-appointment/defaults`);
  }
}
