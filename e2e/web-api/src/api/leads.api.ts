import type { APIResponse } from '@playwright/test';
import type { ApiClient, QueryParams } from './api-client';

/** ตัวกรองและการแบ่งหน้าของ GET /agent/leads (ทุกค่าไม่บังคับ) */
export interface LeadsQuery extends QueryParams {
  page?: number | string;
  limit?: number | string;
  /** คำค้น: ชื่อ เบอร์โทร ทำเลที่สนใจ */
  q?: string;
  province?: string;
  /** รายชื่อเขตหรืออำเภอ ในรูปแบบ JSON เช่น '["วัฒนา","คลองเตย"]' */
  locations?: string;
  includeUnspecified?: string;
  sort?: string;
  /** สถานะที่แอปแสดง: new, inprogress, viewing, booked, lost */
  status?: string;
}

/** เส้นทางกลุ่ม /agent/leads : ลีด (ผู้สนใจเช่า) ของนายหน้าคนที่ล็อกอิน */
export class LeadsApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /agent/leads */
  list(query: LeadsQuery = {}): Promise<APIResponse> {
    return this.client.get('agent/leads', query);
  }

  /** GET /agent/leads/:id  (รับ id เป็นข้อความได้ด้วย เพื่อใช้ทดสอบ id ที่ผิดรูปแบบ) */
  getById(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/leads/${id}`);
  }

  /** GET /agent/leads/visa-types : รายการประเภทวีซ่าที่เลือกได้ */
  visaTypes(): Promise<APIResponse> {
    return this.client.get('agent/leads/visa-types');
  }

  /** GET /agent/leads/locations : จังหวัดทั้งหมด พร้อมเขตหรืออำเภอที่มีข้อมูล */
  locations(): Promise<APIResponse> {
    return this.client.get('agent/leads/locations');
  }

  /**
   * GET /agent/leads/:leadId/deal-offers : ข้อเสนอราคาของลีด (deal-offers.controller.ts บรรทัด 16 ที่ develop 9644dd9)
   * เส้นทางนี้อยู่คนละ controller กับ /agent/leads แต่ใช้ @Roles('agent') ระดับ class เหมือนกัน
   * อ่านอย่างเดียว (เลขบรรทัดที่ 9644dd9): apps/api/src/agent/contracts/deal-offers.service.ts listForLead (บรรทัด 347-354)
   * กับ view() (บรรทัด 320-344) ไม่มีคำสั่งเขียน
   */
  dealOffers(leadId: number | string): Promise<APIResponse> {
    return this.client.get(`agent/leads/${leadId}/deal-offers`);
  }
}
