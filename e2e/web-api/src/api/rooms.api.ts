import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/** ไฟล์สำหรับส่งไปเส้นทางอัปโหลด (ชื่อ ชนิด และเนื้อไฟล์) */
export interface UploadFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * เส้นทางกลุ่ม /agent/rooms : ข้อมูลประกอบฟอร์มห้อง และการสร้างหรือแก้ห้องของนายหน้า
 * ที่มา (เลขบรรทัดที่ develop bc77a8b): apps/api/src/agent/rooms/agent-rooms.controller.ts และ agent-rooms.service.ts
 *
 * GET ทั้ง 7 เส้นทางอ่านอย่างเดียว ไม่รับ query หรือ param
 * POST, PATCH, media/* และ generate-listing-promo บันทึกข้อมูล เขียนไฟล์ลง Storage หรือเรียกบริการ AI ที่มีค่าใช้จ่าย
 *   ชุดเทส tests/api ส่งไปเฉพาะคำขอที่ API ต้องปฏิเสธก่อนถึงขั้นนั้น (เหตุผลของแต่ละคำขออยู่ในไฟล์เทส agent-rooms.spec.ts)
 */
export class AgentRoomsApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /agent/rooms/properties : โครงการที่ห้องของนายหน้าใช้ (ถ้านายหน้ายังไม่มีห้อง ได้โครงการทั้งหมดไม่เกิน 100 แถว: service 54-70) */
  properties(): Promise<APIResponse> {
    return this.client.get('agent/rooms/properties');
  }

  /** GET /agent/rooms/property-types */
  propertyTypes(): Promise<APIResponse> {
    return this.client.get('agent/rooms/property-types');
  }

  /** GET /agent/rooms/contract-types */
  contractTypes(): Promise<APIResponse> {
    return this.client.get('agent/rooms/contract-types');
  }

  /** GET /agent/rooms/room-types */
  roomTypes(): Promise<APIResponse> {
    return this.client.get('agent/rooms/room-types');
  }

  /** GET /agent/rooms/facilities */
  facilities(): Promise<APIResponse> {
    return this.client.get('agent/rooms/facilities');
  }

  /** GET /agent/rooms/contacts : ผู้ติดต่อที่นายหน้าสร้าง (ข้อมูลส่วนตัว) */
  contacts(): Promise<APIResponse> {
    return this.client.get('agent/rooms/contacts');
  }

  /** GET /agent/rooms/property-owners : เจ้าของห้องที่นายหน้าสร้าง (ข้อมูลส่วนตัว) */
  propertyOwners(): Promise<APIResponse> {
    return this.client.get('agent/rooms/property-owners');
  }

  /**
   * POST /agent/rooms (body undefined = ไม่ส่งเนื้อคำขอ)
   * ตรวจเนื้อคำขอทั้งหมดก่อนเปิด transaction (validateCreateBody service 415-588) ใช้ส่งเนื้อคำขอที่ผิดเท่านั้น
   */
  create(body?: unknown): Promise<APIResponse> {
    return this.client.post('agent/rooms', body);
  }

  /**
   * PATCH /agent/rooms/:id : แทนที่ทั้งห้อง ตรวจเนื้อคำขอก่อน แล้วหาห้องของนายหน้า (404 Room not found: service 203-208) ก่อนบันทึก
   * ใช้กับเนื้อคำขอที่ผิด หรือ id ที่ไม่มีจริงเท่านั้น
   */
  update(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.patch(`agent/rooms/${id}`, body);
  }

  /** POST /agent/rooms/media/upload แบบ JSON ไม่แนบไฟล์ (normalizeJpeg ปฏิเสธก่อนเขียน Storage: room-photo-storage.service.ts:44-58) */
  uploadWithoutFile(): Promise<APIResponse> {
    return this.client.post('agent/rooms/media/upload', {});
  }

  /** POST /agent/rooms/media/upload แบบ multipart (fields ใส่ช่องข้อความเพิ่ม: controller ตั้ง limits fields 0 ที่ agent-rooms.controller.ts:74) */
  uploadMultipart(form: Record<string, string | UploadFile>): Promise<APIResponse> {
    return this.client.postMultipart('agent/rooms/media/upload', form);
  }

  /** POST /agent/rooms/media/enhance แบบ JSON ไม่แนบไฟล์ (ตรวจไฟล์ก่อนเรียก Claid: service บรรทัด 80) */
  enhanceWithoutFile(): Promise<APIResponse> {
    return this.client.post('agent/rooms/media/enhance', {});
  }

  /** POST /agent/rooms/media/enhance แบบ multipart */
  enhanceMultipart(form: Record<string, string | UploadFile>): Promise<APIResponse> {
    return this.client.postMultipart('agent/rooms/media/enhance', form);
  }

  /**
   * POST /agent/rooms/generate-listing-promo : ถ้า listing เป็น object จะเรียก Gemini (มีค่าใช้จ่าย: listing-promo.service.ts:193-228)
   * ใช้ส่งเฉพาะเนื้อคำขอที่ listing ไม่ใช่ object (ตรวจที่ listing-promo.service.ts:197-199 ก่อนเรียก Gemini)
   */
  generatePromo(body: unknown): Promise<APIResponse> {
    return this.client.post('agent/rooms/generate-listing-promo', body);
  }
}
