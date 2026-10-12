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
  /** แบบฟอร์มที่ประเภทนี้ใช้: reservation, broker_appointment หรือ lease */
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
 * บัญชีเจ้าของห้อง 1 รายการใน GET /agent/contracts/owner-users
 * API ส่งข้อมูลส่วนตัวมาด้วย (ชื่อ อีเมล เบอร์โทร เลขบัตร) แต่เทสตั้งใจใช้แค่ id จึงประกาศไว้ช่องเดียว
 */
export interface OwnerUserOption {
  id: number;
}
