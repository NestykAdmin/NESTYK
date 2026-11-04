/**
 * รูปแบบข้อมูลที่ API ตอบ เฉพาะส่วนที่เทสใช้ตรวจ
 *
 * เขียนแยกจาก type ของโค้ดหลัก (packages/types) โดยตั้งใจ
 * เพราะเทสควรตรวจสิ่งที่ผู้เรียก API เห็นจริง ถ้าใช้ type ชุดเดียวกับโค้ดหลัก
 * เมื่อโค้ดหลักเปลี่ยนรูปแบบข้อมูล เทสจะเปลี่ยนตามไปเองโดยไม่มีใครสังเกต
 */

/** รายการแบบแบ่งหน้า ใช้กับทุกเส้นทางที่ตอบเป็นรายการ */
export interface Paginated<T> {
  items: T[];
  /** จำนวนทั้งหมดที่ตรงเงื่อนไข (ไม่ใช่จำนวนในหน้านี้) */
  total: number;
  page: number;
  limit: number;
}

/** เนื้อคำตอบเมื่อ API ปฏิเสธคำขอ (รูปแบบมาตรฐานของ NestJS) */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/** คำตอบของ POST /auth/sync */
export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  profileCompleted: boolean;
  /** true เมื่อคำขอนี้ทำให้ระบบสร้างผู้ใช้ใหม่ */
  provisioned: boolean;
  roles: string[];
}

export interface ListingPrice {
  contractTypeCode: string;
  termMonths: number | null;
  price: number;
  advanceRentMonths: number;
  depositMonths: number;
}

/** ห้อง 1 รายการใน GET /agent/listings */
export interface ListingSummary {
  id: number;
  listingTitle: string | null;
  visibility: string;
  isScoutRoom: boolean;
  listingSourceCode: string | null;
  roomStatusCode: string | null;
  property: { id: number; name: string; district: string | null; province: string | null } | null;
  prices: ListingPrice[];
  coverMediaUrl: string | null;
  updatedAt: string | null;
}

/** คำตอบของ GET /agent/listings/:id */
export interface ListingDetail {
  id: number;
  listingTitle: string | null;
  visibility: string;
  prices: ListingPrice[];
  medias: { id: number; mediaUrl: string; mediaType: string; isCover: boolean }[];
}

export type LeadStatus = 'new' | 'inprogress' | 'booked' | 'lost';

/**
 * สถานะที่แอปแสดง และที่ตัวกรอง status ของ GET /agent/leads รับ
 * คือ 4 สถานะที่เก็บในฐานข้อมูล กับ viewing ซึ่ง API คำนวณเอง ไม่ได้เก็บ:
 * ลีดสถานะ new หรือ inprogress ที่มีนัดดูห้องสถานะ scheduled ซึ่งยังไม่ถึงเวลา
 */
export type LeadDisplayStatus = LeadStatus | 'viewing';

/** ลีด (ผู้สนใจเช่า) 1 ราย ใน GET /agent/leads และ GET /agent/leads/:id */
export interface Lead {
  id: number;
  name: string;
  phone: string;
  status: LeadStatus;
  province: string | null;
  locations: string[];
  pins: { rank: number; name: string; latitude: number; longitude: number }[];
  budgetMin: number | null;
  budgetMax: number | null;
  createdAt: string;
  /** เวลานัดดูห้องครั้งถัดไป (รูปแบบ ISO) หรือ null ถ้าไม่มีนัดที่ยังไม่ถึงเวลา */
  nextViewingAt: string | null;
  /** ผลจับคู่ห้องครั้งล่าสุด (null = ยังไม่เคยจับคู่) มีเฉพาะในรายการ ส่วน GET /agent/leads/:id ไม่ส่งช่องนี้ */
  lastMatch?: unknown;
  /** ผู้เช่าที่สร้างจากลีดนี้ (POST /agent/tenants) หรือ null ถ้ายังไม่เป็นผู้เช่า */
  tenantId: number | null;
}

/**
 * ลีด 1 ราย พร้อมช่องที่เทสเขียนข้อมูล (tests/write) ตรวจ
 * ทุกเส้นทางของลีดตอบรูปแบบเดียวกัน (toLead ใน apps/api/src/agent/leads/agent-leads.service.ts บรรทัด 454-476 ที่ qa/e2e a7eb77c)
 */
export interface LeadDetail extends Lead {
  firstName: string;
  lastName: string;
  notes: string | null;
  /** เหตุผลที่ลีดหลุด มีค่าเฉพาะสถานะ lost (mark-inprogress ล้างเป็น null) */
  lostReason: string | null;
  /** รัศมีรอบหมุด (กม.) ที่ใช้จับคู่ห้อง null = ยังไม่ได้ตั้ง */
  radiusKm: number | null;
}

/** คำตอบของ GET /agent/leads : รายการแบบแบ่งหน้า พร้อมจำนวนลีดของแต่ละสถานะที่แอปแสดง */
export interface LeadList extends Paginated<Lead> {
  /** นับจากลีดที่ตรงคำค้นและตัวกรองทำเล ก่อนใช้ตัวกรอง status */
  statusCounts: Record<LeadDisplayStatus, number>;
}

/** ประเภทวีซ่า 1 รายการใน GET /agent/leads/visa-types */
export interface VisaType {
  id: number;
  code: string;
}

/** จังหวัด 1 รายการใน GET /agent/leads/locations */
export interface LeadProvince {
  name: string;
  nameEn: string;
  locations: string[];
}

/** ผู้เช่า 1 ราย ใน GET /agent/tenants และ GET /agent/tenants/:id */
export interface AgentTenant {
  id: number;
  /** ลีดที่ถูกสร้างเป็นผู้เช่ารายนี้ */
  leadId: number;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  createdAt: string;
  /** ชื่อโครงการของห้องที่เช่า หรือข้อความแทนเมื่อยังไม่ระบุห้อง */
  property: string;
  room: string | null;
  contracts: unknown[];
}

/** ลีด 1 ราย ใน GET /agent/tenants/leads (ตัวเลือกของฟอร์มสร้างผู้เช่า) */
export interface TenantLeadOption {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  nationality: string | null;
}

/** ห้อง 1 ห้อง ใน GET /agent/tenants/rooms (ตัวเลือกของฟอร์มสร้างผู้เช่า) */
export interface TenantRoomOption {
  id: number;
  /** ชื่อโครงการ ถ้าไม่มีใช้ชื่อประกาศ ถ้าไม่มีทั้งคู่เป็นข้อความแทน */
  property: string;
  /** เลขห้อง */
  room: string | null;
  /** true เมื่อลีดที่ส่งมาใน leadId มีนัดดูห้องนี้ที่ยังไม่ยกเลิก */
  viewed: boolean;
  /** ชื่อลีดของนายหน้าที่จองห้องนี้ไว้แล้ว หรือ null ถ้ายังว่าง */
  bookedBy: string | null;
}

/** ประเภทสัญญา 1 รายการใน GET /agent/contracts/types */
export interface AgreementType {
  code: string;
  nameTh: string;
  nameEn: string;
  icon: string;
  /** แบบฟอร์มที่ประเภทนี้ใช้: reservation, broker_appointment, lease หรือ renewal */
  formKind: string;
}

/** แม่แบบสัญญา 1 รายการใน GET /agent/contracts/types/:code/templates */
export interface AgreementTemplate {
  id: number;
  agreementTypeCode: string;
  version: number;
  name: string;
  formKind: string;
  /** กติกาของข้อมูลในสัญญา (JSON Schema) */
  dataSchema: unknown;
}

/** คำตอบของเส้นทาง next-number: เลขที่เอกสารใบถัดไป */
export interface NextDocumentNumber {
  documentNo: string;
}

/**
 * เจ้าของห้อง 1 รายการใน GET /agent/contracts/owner-users (develop accb616: ค่ามาจากหนังสือจองของนายหน้าที่เรียก
 *   agent-contracts.service.ts บรรทัด 3186-3198) API ส่งเลขบัตรและสัญชาติมาด้วย แต่เทสไม่ใช้ จึงไม่ประกาศ
 * ข้อควรระวัง: ชื่อ อีเมล และเบอร์เป็นข้อมูลส่วนตัว เทสตรวจเป็นจริง/เท็จหรือจำนวน ไม่เทียบค่าตรง ๆ
 */
export interface OwnerUserOption {
  /** owner_user_id ของสัญญา: บัญชีของเจ้าของห้องถ้ามี null ถ้ายังไม่มีบัญชี */
  id: number | null;
  name: string;
  email: string;
  phone: string;
}

/** ส่วนลดค่าจองบนบิลแรกของสัญญาเช่าใหม่ (develop 9644dd9: BillReservationCredit ใน packages/types/src/contracts.ts:23-26) */
export interface BillReservationCredit {
  rent: number;
  credit: number;
}

/**
 * ใบแจ้งหนี้ค่าปรับของบิล 1 ใบ (develop 9644dd9: BillLateFee ใน packages/types/src/contracts.ts:29-41
 * สร้างโดย lateFeeSummary ใน apps/api/src/billing/tenant-billing.service.ts:202-217)
 */
export interface BillLateFee {
  invoiceId: number;
  documentNo: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'awaiting_review' | 'paid';
  slipReturnReason: string | null;
  hasPaymentSlip: boolean;
  slipSubmitted: boolean;
  slipSubmittedAt: string | null;
  receiptIssued: boolean;
}

/**
 * บิลค่าเช่า 1 รายการ ใน GET /bills/mine, /bills/received และ /bills/agent
 * ที่มา: TenantBill ใน packages/types/src/contracts.ts (บรรทัด 44-76) และ serialize ใน apps/api/src/billing/tenant-billing.service.ts
 * (บรรทัด 361) ตรวจซ้ำที่ develop 9644dd9
 * ประกาศเฉพาะช่องที่เทสใช้ กับ 4 ช่องที่ develop 9644dd9 เพิ่ม (packages/types/src/contracts.ts:59-65 ไม่ใช่ช่อง optional
 * API ส่งทุกครั้งจาก serialize ใน tenant-billing.service.ts:385-388) ยังไม่มีเทสอ่าน 4 ช่องนี้
 */
export interface TenantBill {
  id: number;
  /** วันครบกำหนด รูปแบบ YYYY-MM-DD */
  dueDate: string;
  /** overdue ไม่ได้เก็บในฐานข้อมูล API คำนวณตอนอ่านจากวันผ่อนผัน */
  status: 'pending' | 'paid' | 'overdue';
  hasPaymentSlip: boolean;
  /** ผู้เช่ากดยืนยันส่งสลิปให้นายหน้าแล้ว */
  slipSubmitted: boolean;
  /** ส่วนลดค่าจองของบิลแรกของสัญญาเช่าใหม่ ไม่มีเป็น null */
  reservationCredit: BillReservationCredit | null;
  /** จำนวนวันหลังวันผ่อนผัน นับถึงวันยืนยันการชำระหรือวันนี้ เป็น 0 จนกว่าจะเลยวันผ่อนผัน */
  lateDays: number;
  /** ค่าปรับต่อวันตามสัญญา สำหรับแสดงผล ว่างหรืออ่านไม่ได้เป็น null (นายหน้าพิมพ์ยอดค่าปรับเอง) */
  lateFeePerDay: number | null;
  /** ใบแจ้งหนี้ค่าปรับของบิลนี้เมื่อออกแล้ว ยังไม่ออกเป็น null */
  lateFee: BillLateFee | null;
}

// ---- ห้อง ลิงก์แชร์ จับคู่ห้อง และนัดดูห้อง (ที่มา: service ที่ develop bc77a8b ตามที่ระบุ) ----

/** GET /agent/rooms/property-types (agent-rooms.service.ts:72-75) */
export interface PropertyTypeOption {
  id: number;
  code: string;
}

/** GET /agent/rooms/contract-types เฉพาะที่เปิดใช้ (agent-rooms.service.ts:77-87) */
export interface ContractTypeOption {
  id: number;
  code: string;
  termMonths: number;
}

/** GET /agent/rooms/room-types เฉพาะที่เปิดใช้ (agent-rooms.service.ts:111-121) bedroomCount เป็น null ได้ (เช่น duplex) */
export interface RoomTypeOption {
  id: number;
  code: string;
  bedroomCount: number | null;
}

/** GET /agent/rooms/facilities (agent-rooms.service.ts:89-109) */
export interface FacilityOption {
  code: string;
  groupCode: string;
  isExtraCharge: boolean;
}

/** GET /agent/rooms/contacts และ property-owners: ข้อมูลส่วนตัว เทสตรวจแค่ id, roomCount และชนิดของช่อง (agent-rooms.service.ts:123-197) */
export interface RoomPartyOption {
  id: number;
  name: string;
  phone: string | null;
  roomCount: number;
}

/** แถวของ GET /agent/rooms/properties (แถวตาราง properties: entities/property.entity.ts) */
export interface PropertyRow {
  id: number;
  name: string | null;
  district: string | null;
  province: string | null;
}

/** ลิงก์แชร์ 1 รายการใน GET /agent/listings/:id/share-links (room-share-links.service.ts:170-178) ไม่มี token หรือ url */
export interface ShareLinkSummary {
  id: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  status: 'active' | 'expired' | 'revoked';
  contactId: number | null;
  shareSections: Record<string, boolean>;
}

/** ค่าตั้งการจับคู่ห้อง (lead-matching.ts:14 ; packages/types/src/leads.ts:100-104) */
export interface MatchSettings {
  minScore: number;
  maxScore: number;
  maxResults: number;
}

/** GET /agent/leads/:id/match-settings (lead-matching.service.ts:233-236) */
export interface MatchSettingsResponse {
  saved: Partial<MatchSettings> | null;
  effective: MatchSettings;
  defaults: MatchSettings;
}

/** GET /agent/leads/:id/match-runs/latest (lead-matching.service.ts:194-213) run เป็น null เมื่อยังไม่เคยจับคู่ */
export interface MatchLatestResponse {
  run: { runId: number; resultCount: number; topScore: number | null; createdAt: string; stale: boolean } | null;
  items: { room: { id: number }; score: number }[];
}

/** นัดดูห้อง 1 รายการ (lead-viewings.service.ts:90-103) */
export interface LeadViewing {
  id: number;
  leadId: number;
  rentRoomId: number;
  scheduledAt: string;
  status: 'scheduled' | 'done' | 'cancelled';
  note: string | null;
  createdAt: string;
}

/** เหตุที่กันการลบบัญชี (ACCOUNT_DELETE_BLOCKERS ใน apps/api/src/auth/account-deletion.ts บรรทัด 2 ที่ qa/e2e 01d0523) */
export const ACCOUNT_DELETE_BLOCKERS = ['open_contract', 'open_agent_contract', 'unpaid_bill', 'bill_awaiting_review', 'unrefunded_deposit'] as const;

/** GET /auth/account/deletion (deletionPreview ใน auth.service.ts บรรทัด 280-295 ที่ 01d0523) */
export interface AccountDeletionPreview {
  blocked: boolean;
  reasons: string[];
  /** วันที่บัญชีจะถูกลบ (ISO) หรือ null ถ้าไม่ได้นัดลบ */
  scheduledFor: string | null;
  /** true เฉพาะเมื่อ API ตั้ง ALLOW_IMMEDIATE_ACCOUNT_DELETION=true (account-deletion.ts บรรทัด 23-25) */
  deleteNowAvailable: boolean;
}
