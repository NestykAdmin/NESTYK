import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * เส้นทางที่เขียนข้อมูลของวงจรเช่าห้องครบวงจร (เทส tests/write/rental-lifecycle.write.spec.ts)
 *
 * ใช้เฉพาะใน src/write/write.fixture.ts หลังตรวจตัวกัน (src/write/write-guard.ts) เหมือน leads-write.api.ts
 * ทุกเมธอดคืนคำตอบดิบ การตรวจอยู่ในไฟล์เทส ที่มา (เลขบรรทัดที่ develop bc77a8b):
 *   agent/contracts/agent-contracts.controller.ts (ย่อ AC), party-contracts.controller.ts (PC), deal-offers.controller.ts (DO),
 *   agreement-attachments.controller.ts (AT), agent/tenants/agent-tenants.controller.ts (TN),
 *   billing/tenant-bills.controller.ts (TB), billing/agent-bills.controller.ts (AB), billing/owner-bills.controller.ts (OB)
 *   agent/leads/lead-viewings.controller.ts
 * รหัส 201 = @Post ที่ไม่มี @HttpCode (ค่าเริ่มต้นของ NestJS) ; 200 = มี @HttpCode(HttpStatus.OK) หรือเป็น GET/PUT/PATCH
 */

/** ไฟล์ที่ส่งแบบ multipart */
export interface UploadPart {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** ผู้เรียกฝั่งนายหน้า (qa-agent) */
export class LifecycleAgentApi {
  constructor(private readonly client: ApiClient) {}

  // ---- ข้อมูลอ้างอิง (GET อ่านอย่างเดียว) ----
  contractTypes = (): Promise<APIResponse> => this.client.get('agent/rooms/contract-types');
  roomTypes = (): Promise<APIResponse> => this.client.get('agent/rooms/room-types');
  propertyTypes = (): Promise<APIResponse> => this.client.get('agent/rooms/property-types');

  // ---- ห้อง ลีด นัด ข้อเสนอ ผู้เช่า ----
  /** POST /agent/rooms : ห้อง scout (owner_id ว่างเสมอ) 201 */
  createRoom = (body: unknown): Promise<APIResponse> => this.client.post('agent/rooms', body);
  /** POST /agent/leads 201 */
  createLead = (body: unknown): Promise<APIResponse> => this.client.post('agent/leads', body);
  /** POST /agent/leads/:id/viewings 201 */
  createViewing = (leadId: number, body: unknown): Promise<APIResponse> => this.client.post(`agent/leads/${leadId}/viewings`, body);
  /** GET /agent/leads/:id/viewings (lead-viewings.controller.ts 16) */
  viewings = (leadId: number): Promise<APIResponse> => this.client.get(`agent/leads/${leadId}/viewings`);
  /** PATCH /agent/viewings/:id 200 */
  updateViewing = (id: number, body: unknown): Promise<APIResponse> => this.client.patch(`agent/viewings/${id}`, body);
  /** GET /agent/leads/:leadId/deal-offers (DO 16) */
  offers = (leadId: number): Promise<APIResponse> => this.client.get(`agent/leads/${leadId}/deal-offers`);
  /** POST /agent/deal-offers (DO 21) 201 */
  createOffer = (body: unknown): Promise<APIResponse> => this.client.post('agent/deal-offers', body);
  /** POST /agent/deal-offers/:id/send (DO 38-39) 200 */
  sendOffer = (id: number, body: unknown): Promise<APIResponse> => this.client.post(`agent/deal-offers/${id}/send`, body);
  /** POST /agent/deal-offers/:id/confirm (DO 45-46) 200 : นายหน้าบันทึกว่าเจ้าของยืนยันแล้ว */
  confirmOffer = (id: number, body: unknown): Promise<APIResponse> => this.client.post(`agent/deal-offers/${id}/confirm`, body);
  /** POST /agent/tenants (TN 58) 201 : จองห้อง ลีดเป็น booked */
  createTenant = (body: unknown): Promise<APIResponse> => this.client.post('agent/tenants', body);
  /** GET /agent/leads/:id */
  lead = (id: number): Promise<APIResponse> => this.client.get(`agent/leads/${id}`);

  // ---- สัญญา ----
  /** GET /agent/contracts/{reservation|broker-appointment|lease}-defaults/:leadId (AC 348-365) */
  defaults = (kind: 'reservation' | 'broker-appointment' | 'lease', leadId: number): Promise<APIResponse> =>
    this.client.get(`agent/contracts/${kind}-defaults/${leadId}`);
  /** POST /agent/contracts (AC 431) 201 */
  createContract = (body: unknown): Promise<APIResponse> => this.client.post('agent/contracts', body);
  /** GET /agent/contracts/:id (AC 425) */
  contract = (id: number): Promise<APIResponse> => this.client.get(`agent/contracts/${id}`);
  /** POST /agent/contracts/:id/{reservation|broker-appointment|lease}-preview (AC 479, 495, 527) 200 */
  preview = (id: number, kind: 'reservation' | 'broker-appointment' | 'lease'): Promise<APIResponse> =>
    this.client.post(`agent/contracts/${id}/${kind}-preview`, {});
  /** POST /agent/contracts/:id/generate-{reservation|broker-appointment|lease} (AC 487, 503, 535) 200 */
  generate = (id: number, kind: 'reservation' | 'broker-appointment' | 'lease'): Promise<APIResponse> =>
    this.client.post(`agent/contracts/${id}/generate-${kind}`, {});
  /** POST /agent/contracts/:id/sign (AC 543-544) 200 : นายหน้าลงนาม (หรือลงนามแทนฝ่ายที่อยู่หน้างาน) */
  sign = (id: number, body: unknown): Promise<APIResponse> => this.client.post(`agent/contracts/${id}/sign`, body);
  /** POST /agent/contracts/:id/witness-sign (AC 91) 201 */
  witnessSign = (id: number, body: unknown): Promise<APIResponse> => this.client.post(`agent/contracts/${id}/witness-sign`, body);
  /** POST /agent/contracts/:id/deliveries (AC 552-553) 200 : ส่งเอกสารเข้าบัญชีของคู่สัญญา */
  deliver = (id: number, party: 'tenant' | 'owner'): Promise<APIResponse> => this.client.post(`agent/contracts/${id}/deliveries`, { party });
  /** POST /agent/contracts/:id/attachments (AT 41) 201 */
  attach = (id: number, file: UploadPart, documentTypeCode: string, subject: string): Promise<APIResponse> =>
    this.client.postMultipart(`agent/contracts/${id}/attachments`, { file, documentTypeCode, subject });
  /** POST /agent/contracts/:id/financial-documents/:kind (AC 565-566) 200 : ใบเสร็จเงินจอง */
  financialDocument = (id: number, kind: string, body: unknown): Promise<APIResponse> =>
    this.client.post(`agent/contracts/${id}/financial-documents/${kind}`, body);
  /** POST /agent/contracts/invoices/:invoiceId/receipt (AC 405-406) 200 : ใบเสร็จมัดจำ ส่ง payload เป็น JSON ในฟอร์ม */
  invoiceReceipt = (invoiceId: number, payload: unknown): Promise<APIResponse> =>
    this.client.postMultipart(`agent/contracts/invoices/${invoiceId}/receipt`, { payload: JSON.stringify(payload) });

  // ---- ส่งมอบห้อง ----
  /** GET /agent/contracts/:id/handover[/move-out] (AC 204, 238) */
  handover = (id: number, moveOut = false): Promise<APIResponse> => this.client.get(`agent/contracts/${id}/handover${moveOut ? '/move-out' : ''}`);
  /** PUT /agent/contracts/:id/handover[/move-out] (AC 210, 244) 200 */
  saveHandover = (id: number, body: unknown, moveOut = false): Promise<APIResponse> =>
    this.client.put(`agent/contracts/${id}/handover${moveOut ? '/move-out' : ''}`, body);
  /** POST /agent/contracts/:id/handover[/move-out]/photos (AC 217, 251) 201 */
  handoverPhoto = (id: number, file: UploadPart, moveOut = false): Promise<APIResponse> =>
    this.client.postMultipart(`agent/contracts/${id}/handover${moveOut ? '/move-out' : ''}/photos`, { file });

  // ---- บิล ----
  /** POST /bills/agent/:id/confirm (AB 33-34) 200 : ยืนยันสลิปค่าเช่า */
  confirmBill = (billId: number): Promise<APIResponse> => this.client.post(`bills/agent/${billId}/confirm`, {});

  // ---- เลิกสัญญาและมัดจำ ----
  /** POST /agent/contracts/:id/early-end (AC 116-117) 200 */
  earlyEnd = (id: number, body: unknown): Promise<APIResponse> => this.client.post(`agent/contracts/${id}/early-end`, body);
  /** POST /agent/contracts/:id/deposit-settlement (AC 277-278) 200 : เปิดบัญชีมัดจำ */
  openSettlement = (id: number): Promise<APIResponse> => this.client.post(`agent/contracts/${id}/deposit-settlement`, {});
  /** POST /agent/contracts/:id/deposit-settlement/items (AC 285) 201 */
  addDeduction = (id: number, file: UploadPart, deductionType: string, description: string, amount: string): Promise<APIResponse> =>
    this.client.postMultipart(`agent/contracts/${id}/deposit-settlement/items`, { file, deductionType, description, amount });
  /** POST /agent/contracts/:id/deposit-settlement/approve (AC 302-303) 200 */
  approveSettlement = (id: number, body: unknown): Promise<APIResponse> => this.client.post(`agent/contracts/${id}/deposit-settlement/approve`, body);
  /** POST /agent/contracts/:id/deposit-settlement/refund (AC 311-312) 200 : หลักฐานรับคืนกับหลักฐานโอน */
  refundSettlement = (id: number, received: UploadPart, transfer: UploadPart): Promise<APIResponse> =>
    this.client.postMultipart(`agent/contracts/${id}/deposit-settlement/refund`, { received, transfer });
}

/** ผู้เรียกฝั่งคู่สัญญา (qa-tenant หรือ qa-landlord) ผ่าน /contracts/mine และ /bills */
export class LifecyclePartyApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /contracts/mine (PC 127) */
  contracts = (): Promise<APIResponse> => this.client.get('contracts/mine');
  /** POST /contracts/mine/:id/sign (PC 255-256) 200 */
  sign = (id: number, party: 'tenant' | 'owner', signaturePng: string): Promise<APIResponse> =>
    this.client.post(`contracts/mine/${id}/sign`, { party, signaturePng });
  /** POST /contracts/mine/:id/payment-slip (PC 205-206) 200 : สลิปเงินจอง */
  reservationSlip = (id: number, file: UploadPart): Promise<APIResponse> => this.client.postMultipart(`contracts/mine/${id}/payment-slip`, { file });
  /** POST /contracts/mine/:id/deposit-payment-slip (PC 219-220) 200 */
  depositSlip = (id: number, file: UploadPart): Promise<APIResponse> => this.client.postMultipart(`contracts/mine/${id}/deposit-payment-slip`, { file });
  /** POST /contracts/mine/:id/handover[/move-out]/sign (PC 86-87, 76-77) 200 */
  signHandover = (id: number, party: 'tenant' | 'owner', signaturePng: string, revision: number, moveOut = false): Promise<APIResponse> =>
    this.client.post(`contracts/mine/${id}/handover${moveOut ? '/move-out' : ''}/sign`, { party, signaturePng, revision });
  /** GET /contracts/mine/:id/deposit-settlement (PC 59) */
  settlement = (id: number): Promise<APIResponse> => this.client.get(`contracts/mine/${id}/deposit-settlement`);

  /** GET /bills/mine (TB 30) : เส้นทาง GET นี้สร้างบิลที่ถึงรอบก่อนตอบ */
  myBills = (): Promise<APIResponse> => this.client.get('bills/mine');
  /** POST /bills/mine/:id/payment-slip (TB 48-49) 200 */
  billSlip = (billId: number, file: UploadPart): Promise<APIResponse> => this.client.postMultipart(`bills/mine/${billId}/payment-slip`, { file });
  /** POST /bills/mine/:id/confirm (TB 61) : ผู้เช่ายืนยันส่งสลิปให้นายหน้าตรวจ */
  confirmBillSlip = (billId: number): Promise<APIResponse> => this.client.post(`bills/mine/${billId}/confirm`, {});
  /** GET /bills/received (OB 18) : เจ้าของห้องดูบิลที่ได้รับ เส้นทาง GET นี้สร้างบิลที่ถึงรอบก่อนตอบ */
  receivedBills = (): Promise<APIResponse> => this.client.get('bills/received');
}
