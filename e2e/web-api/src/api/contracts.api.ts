import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/** ชนิดของข้อมูลตั้งต้นสำหรับสัญญาใหม่ ตามชื่อเส้นทาง /agent/contracts/<ชนิด>-defaults/:leadId */
export type AgreementDefaultsKind = 'reservation' | 'broker-appointment' | 'lease';

/**
 * เส้นทางกลุ่ม /agent/contracts : สัญญาและเอกสารการเงินของนายหน้าคนที่ล็อกอิน
 *
 * ตัวเรียกส่วนใหญ่เป็นเส้นทางที่อ่านข้อมูล เส้นทาง POST ของกลุ่มนี้ (สร้างสัญญา ออกเอกสาร ลงนาม) เขียนข้อมูลที่ย้อนไม่ได้
 * และการสร้างสัญญายังสร้างบัญชีผู้ใช้ให้คู่สัญญาด้วย
 * (saveDraft ใน apps/api/src/agent/contracts/agent-contracts.service.ts เรียก ensurePartyLogin ตอนบันทึกหนังสือจอง)
 * ตัวเรียกของเส้นทางที่บันทึกข้อมูล (POST depositInvoice, witnessSign และ POST, PUT, DELETE ของเส้นทางใหม่ใน develop 9644dd9
 * ท้ายไฟล์) มีไว้ส่งไปที่สัญญาที่ไม่มีอยู่จริงเท่านั้น ถ้าส่งไปที่สัญญาที่มีอยู่จริงของผู้เรียก ระบบจะบันทึกทันที
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

  /** GET /agent/contracts/:id/signatures : ใครลงนามสัญญานี้แล้ว ผ่านช่องทางไหน (อ่านอย่างเดียว) */
  signatures(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/signatures`);
  }

  /**
   * POST /agent/contracts/:id/deposit-invoice : ออกใบแจ้งหนี้เงินประกันของสัญญาเช่าอีกครั้ง (ไม่มีเนื้อคำขอ)
   * ถ้าสัญญามีอยู่จริงและเป็นสัญญาเช่าที่สร้างเอกสารแล้ว ระบบจะสร้างใบแจ้งหนี้และไฟล์ PDF (ดูข้อควรระวังที่หัวไฟล์)
   */
  depositInvoice(id: number | string): Promise<APIResponse> {
    return this.client.post(`agent/contracts/${id}/deposit-invoice`);
  }

  /**
   * POST /agent/contracts/:id/witness-sign : พยานของสัญญาเช่าลงนามบนเครื่องของนายหน้า
   * เนื้อคำขอ: asAgent (นายหน้าเป็นพยานเอง) หรือ signerName (ชื่อพยาน) และ signaturePng (ภาพลายเซ็น PNG แบบ base64)
   * ถ้าสัญญามีอยู่จริง ระบบจะเก็บไฟล์ลายเซ็นและบันทึกการลงนาม (ดูข้อควรระวังที่หัวไฟล์)
   */
  witnessSign(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`agent/contracts/${id}/witness-sign`, body);
  }

  /**
   * GET /agent/contracts/:id/handover : บันทึกการส่งมอบห้องของสัญญาเช่า (ตั้งแต่ develop f845ac6)
   * อ่านอย่างเดียวที่ 9644dd9: handover.service.ts agentView (บรรทัด 304-306) เรียก contractForAgent
   * (agent-contracts.service.ts:608-612) กับ view() (handover.service.ts:167-221) ซึ่งไม่มีคำสั่งเขียน
   */
  handover(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/handover`);
  }

  /**
   * GET /agent/contracts/:id/cancellation-preview : ผลของการยกเลิกดีลก่อนยืนยัน (ตั้งแต่ develop 8a62e39)
   * อ่านอย่างเดียว (เลขบรรทัดที่ 9644dd9): deal-cancellation.ts dealCancellationPreview (บรรทัด 188-204
   * เรียกผ่าน agent-contracts.service.ts:3445-3447)
   * ไม่มีคำสั่งเขียน และเรียกตัวช่วยด้วย lock = false (บรรทัด 183 ใน findOwn, 190, 192, 201) คำสั่งเขียนอยู่ใน cancelDeal (บรรทัด 210 เป็นต้นไป)
   */
  cancellationPreview(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/cancellation-preview`);
  }

  // ---------- เส้นทางใหม่ใน develop 9644dd9 (เลขบรรทัดของ apps/api/src ที่ 9644dd9) ----------
  // ทุกเส้นทางมี @Roles("agent") ระดับ class (agent-contracts.controller.ts:54) และรับ :id กับ id ย่อยผ่าน DatabaseIdPipe
  // หาสัญญาด้วย id และนายหน้าที่สร้างสัญญา ไม่พบตอบ 404 "ไม่พบสัญญา" (contractForAgent ใน agent-contracts.service.ts:608-612
  // หรือ findOne/findOneBy แบบเดียวกันในแต่ละฟังก์ชัน) ตัวเรียกของเส้นทางที่บันทึกข้อมูลใช้กับสัญญาที่ไม่มีอยู่จริงเท่านั้น

  /**
   * POST /agent/contracts/:id/early-end : เลิกสัญญาเช่าก่อนกำหนด เนื้อคำขอ { date, reason } (controller บรรทัด 116)
   * setEarlyEnd (agent-contracts.service.ts:2179) ตรวจเนื้อคำขอก่อนหาสัญญา: date ต้องเป็น YYYY-MM-DD ที่ไม่ก่อนวันนี้ตามเวลากรุงเทพ
   * และ reason ไม่ว่างไม่เกิน 1,000 ตัวอักษร (บรรทัด 2183-2186) แล้วจึงหาสัญญา (บรรทัด 2193)
   * id ที่ไม่มีจริงจึงได้ 404 เฉพาะเมื่อส่งเนื้อคำขอที่ผ่าน ถ้าสัญญามีอยู่จริง ระบบจะบันทึกวันเลิกสัญญาและปล่อยการจองห้อง
   */
  earlyEnd(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`agent/contracts/${id}/early-end`, body);
  }

  /**
   * POST /agent/contracts/:id/early-end/money : ยอดที่ต้องคืนหรือเก็บหลังเลิกสัญญาก่อนกำหนด (controller บรรทัด 126)
   * recordEarlyEndMoney (service:2216) หาสัญญาก่อน (บรรทัด 2221) แล้วจึงตรวจเนื้อคำขอ (บรรทัด 2226)
   * ถ้าสัญญามีอยู่จริงและบันทึกวันเลิกไว้แล้ว ระบบจะบันทึกยอด และออกใบแจ้งหนี้ PDF เมื่อเป็นยอดที่ต้องเก็บ
   */
  earlyEndMoney(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`agent/contracts/${id}/early-end/money`, body);
  }

  /**
   * GET /agent/contracts/:id/early-end/:kind : ที่อยู่สำหรับเปิดเอกสารของการเลิกสัญญาก่อนกำหนด (controller บรรทัด 135)
   * kind ที่มีเอกสาร: invoice, slip, proof ไม่มี pipe ตรวจ kind ค่าอื่นได้ 404 "ไม่พบเอกสาร" หลังหาสัญญาแล้ว
   * อ่านอย่างเดียว: earlyEndFileUrl (service:2258) หาสัญญา (บรรทัด 2262) แล้วขอลิงก์ของไฟล์
   */
  earlyEndFile(id: number | string, kind: string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/early-end/${encodeURIComponent(kind)}`);
  }

  /**
   * POST /agent/contracts/:id/early-end/refund-proof โดยไม่แนบไฟล์ (controller บรรทัด 143 รับ multipart ช่อง file)
   * uploadEarlyEndProof (service:2297) หาสัญญาก่อน (บรรทัด 2300) แล้วจึงอ่านไฟล์ ตัวเรียกนี้จึงใช้ได้กับเคสที่ต้องถูกปฏิเสธก่อนอ่านไฟล์
   */
  uploadEarlyEndRefundProofWithoutFile(id: number | string): Promise<APIResponse> {
    return this.client.post(`agent/contracts/${id}/early-end/refund-proof`);
  }

  /**
   * POST /agent/contracts/:id/not-renewing : บันทึกว่าไม่ต่อสัญญา หรือยกเลิกการบันทึกนั้น เนื้อคำขอ { notRenewing } (controller บรรทัด 154)
   * controller บรรทัด 161 ส่ง body?.notRenewing !== false ต่อ เนื้อคำขอที่ไม่ใช่ { notRenewing: false } ทุกแบบ (รวม {} กับ "false")
   * จึงหมายถึง "ไม่ต่อสัญญา" ; setNotRenewing (service:2321) หาสัญญาก่อน (บรรทัด 2328) ถ้าสัญญามีอยู่จริง ระบบจะบันทึก
   * การถือเนื้อคำขอแบบนี้อยู่ในรายการที่จะถามทีมว่าตั้งใจหรือไม่ (ยังไม่ได้แจ้ง) เทสต้องไม่พึ่งพฤติกรรมนี้
   */
  notRenewing(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`agent/contracts/${id}/not-renewing`, body);
  }

  /**
   * GET /agent/contracts/:id/handover/move-out : บันทึกการส่งมอบห้องตอนย้ายออก (controller บรรทัด 218)
   * อ่านอย่างเดียว: handover.service.ts agentView (บรรทัด 304) เรียก contractForAgent แล้ว view()
   */
  moveOutHandover(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/handover/move-out`);
  }

  /**
   * PUT /agent/contracts/:id/handover/move-out : บันทึกฟอร์มส่งมอบห้องตอนย้ายออก (controller บรรทัด 224)
   * save (handover.service.ts:308) ตรวจเนื้อคำขอก่อนหาสัญญา: validateHandover (บรรทัด 309 ต้องมี handoverDate และ items ที่เป็นอาร์เรย์)
   * และ handoverRevision (บรรทัด 310 revision เป็นจำนวนเต็มตั้งแต่ 0) แล้วจึงหาสัญญา (บรรทัด 311)
   * id ที่ไม่มีจริงจึงได้ 404 เฉพาะเมื่อส่งเนื้อคำขอที่ผ่าน ถ้าสัญญามีอยู่จริง ระบบจะบันทึกฟอร์ม
   */
  saveMoveOutHandover(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.put(`agent/contracts/${id}/handover/move-out`, body);
  }

  /**
   * POST /agent/contracts/:id/handover/move-out/photos โดยไม่แนบไฟล์ (controller บรรทัด 231 รับ multipart ช่อง file กับ caption)
   * addPhoto (handover.service.ts:344) ตรวจความยาว caption (บรรทัด 346) แล้วหาสัญญา (บรรทัด 347) ก่อนอ่านไฟล์
   */
  uploadMoveOutPhotoWithoutFile(id: number | string): Promise<APIResponse> {
    return this.client.post(`agent/contracts/${id}/handover/move-out/photos`);
  }

  /**
   * DELETE /agent/contracts/:id/handover/move-out/photos/:photoId : ลบรูปของบันทึกย้ายออก (controller บรรทัด 243)
   * removePhoto (handover.service.ts:375) หาสัญญาก่อน (บรรทัด 376) ถ้าสัญญามีอยู่จริงและมีรูปนั้น ระบบจะลบรูป
   */
  removeMoveOutPhoto(id: number | string, photoId: number | string): Promise<APIResponse> {
    return this.client.delete(`agent/contracts/${id}/handover/move-out/photos/${photoId}`);
  }

  /**
   * GET /agent/contracts/:id/deposit-settlement : รายการหักเงินประกันและการคืนเงินประกัน (controller บรรทัด 251)
   * อ่านอย่างเดียว: deposit-settlement.ts agentView (บรรทัด 107) เรียก contractForAgent แล้ว present()
   */
  depositSettlement(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/contracts/${id}/deposit-settlement`);
  }

  /**
   * POST /agent/contracts/:id/deposit-settlement : เปิดรายการหักเงินประกัน ไม่มีเนื้อคำขอ (controller บรรทัด 257)
   * open (deposit-settlement.ts:116) หาสัญญาก่อน (บรรทัด 117) ถ้าสัญญามีอยู่จริงและผ่านเงื่อนไข ระบบจะสร้างรายการ
   */
  openDepositSettlement(id: number | string): Promise<APIResponse> {
    return this.client.post(`agent/contracts/${id}/deposit-settlement`);
  }

  /**
   * POST /agent/contracts/:id/deposit-settlement/items โดยไม่แนบไฟล์ (controller บรรทัด 265 รับ multipart ช่อง file กับช่องข้อความ)
   * ตัวเรียกนี้ส่งเนื้อคำขอเป็น JSON { deductionType, description, amount }
   * addItem (deposit-settlement.ts:143) ตรวจเนื้อคำขอก่อนหาสัญญา: parseDeduction (บรรทัด 144) แล้วจึงหาสัญญา (บรรทัด 145)
   * id ที่ไม่มีจริงจึงได้ 404 เฉพาะเมื่อส่งเนื้อคำขอที่ผ่าน ถ้าสัญญามีอยู่จริง ระบบจะอ่านไฟล์และบันทึกรายการหัก
   */
  addDepositDeductionWithoutFile(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`agent/contracts/${id}/deposit-settlement/items`, body);
  }

  /**
   * DELETE /agent/contracts/:id/deposit-settlement/items/:itemId : ลบรายการหัก (controller บรรทัด 275)
   * removeItem (deposit-settlement.ts:165) หาสัญญาก่อน (บรรทัด 166) ถ้าสัญญามีอยู่จริงและมีรายการนั้น ระบบจะลบรายการ
   */
  removeDepositDeduction(id: number | string, itemId: number | string): Promise<APIResponse> {
    return this.client.delete(`agent/contracts/${id}/deposit-settlement/items/${itemId}`);
  }

  /**
   * POST /agent/contracts/:id/deposit-settlement/approve : อนุมัติยอดหักและยอดคืน เนื้อคำขอ { note, refundAmount } (controller บรรทัด 282)
   * approve (deposit-settlement.ts:182) ตรวจเนื้อคำขอก่อนหาสัญญา: note ไม่ว่างไม่เกิน 1,000 ตัวอักษร (บรรทัด 183-184) และยอดคืน (บรรทัด 185)
   * แล้วจึงหาสัญญา (บรรทัด 186) id ที่ไม่มีจริงจึงได้ 404 เฉพาะเมื่อส่งเนื้อคำขอที่ผ่าน ถ้าสัญญามีอยู่จริง ระบบจะบันทึกการอนุมัติ
   */
  approveDepositSettlement(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`agent/contracts/${id}/deposit-settlement/approve`, body);
  }

  /**
   * POST /agent/contracts/:id/deposit-settlement/refund โดยไม่แนบไฟล์ (controller บรรทัด 291 รับ multipart ช่อง received และ transfer)
   * complete (deposit-settlement.ts:211) หาสัญญาก่อน (บรรทัด 212) แล้วจึงอ่านไฟล์
   */
  completeDepositRefundWithoutFiles(id: number | string): Promise<APIResponse> {
    return this.client.post(`agent/contracts/${id}/deposit-settlement/refund`);
  }
}
