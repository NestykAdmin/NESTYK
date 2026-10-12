import type { APIResponse } from '@playwright/test';
import type { ApiClient, QueryParams } from './api-client';

/** ตัวกรองของ GET /agent/tenants/rooms (ทุกค่าไม่บังคับ รับเป็นข้อความได้ด้วย เพื่อใช้ทดสอบค่าที่ผิดรูปแบบ) */
export interface TenantRoomOptionsQuery extends QueryParams {
  /** คำค้น: ชื่อโครงการ เลขห้อง หรือชื่อประกาศ */
  q?: string;
  /** ลีดที่กำลังสร้างเป็นผู้เช่า: ห้องที่ลีดรายนี้นัดดูไว้จะขึ้นก่อน */
  leadId?: number | string;
  /** ห้องที่เลือกไว้แล้ว: ขึ้นก่อนห้องอื่น */
  roomId?: number | string;
}

/**
 * เส้นทางกลุ่ม /agent/tenants : ผู้เช่าของนายหน้าคนที่ล็อกอิน
 *
 * ข้อควรระวังของ create และ update: ถ้าคำขอถูกต้อง และลีด ห้อง หรือผู้เช่ามีอยู่จริง ระบบจะบันทึกทันที
 * (create สร้างผู้เช่าและเปลี่ยนลีดเป็นสถานะ booked และไม่มีเส้นทางลบ)
 * เทสที่มีตอนนี้จึงส่งเฉพาะคำขอที่ระบบต้องปฏิเสธ และใช้ id ที่ไม่มีอยู่จริงเท่านั้น
 */
export class TenantsApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /agent/tenants */
  list(): Promise<APIResponse> {
    return this.client.get('agent/tenants');
  }

  /** GET /agent/tenants/:id  (รับ id เป็นข้อความได้ด้วย เพื่อใช้ทดสอบ id ที่ผิดรูปแบบ) */
  getById(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/tenants/${id}`);
  }

  /** GET /agent/tenants/leads : ลีดที่ยังสร้างเป็นผู้เช่าได้ (ตัวเลือกของฟอร์มสร้างผู้เช่า) */
  leadOptions(q?: string): Promise<APIResponse> {
    return this.client.get('agent/tenants/leads', { q });
  }

  /** GET /agent/tenants/rooms : ห้องของนายหน้า (ตัวเลือกของฟอร์มสร้างผู้เช่า) */
  roomOptions(query: TenantRoomOptionsQuery = {}): Promise<APIResponse> {
    return this.client.get('agent/tenants/rooms', query);
  }

  /** POST /agent/tenants : สร้างผู้เช่าจากลีด (ดูข้อควรระวังด้านบน) */
  create(body: unknown): Promise<APIResponse> {
    return this.client.post('agent/tenants', body);
  }

  /** PATCH /agent/tenants/:id : แก้ข้อมูลผู้เช่า (ดูข้อควรระวังด้านบน) */
  update(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.patch(`agent/tenants/${id}`, body);
  }
}
