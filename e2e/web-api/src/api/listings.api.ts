import type { APIResponse } from '@playwright/test';
import type { ApiClient, QueryParams } from './api-client';

/** ตัวกรองและการแบ่งหน้าของ GET /agent/listings (ทุกค่าไม่บังคับ) */
export interface ListingsQuery extends QueryParams {
  page?: number | string;
  limit?: number | string;
  /** คำค้น: ชื่อโครงการ ชื่อประกาศ ชื่อหรือเบอร์ของผู้ติดต่อ */
  q?: string;
  visibility?: string;
  roomStatus?: string;
  listingSource?: string;
  sort?: string;
  bedrooms?: string;
  minPrice?: string;
  maxPrice?: string;
}

/** เส้นทางกลุ่ม /agent/listings : ห้องที่นายหน้าคนที่ล็อกอินเป็นคนลงไว้ */
export class ListingsApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /agent/listings */
  list(query: ListingsQuery = {}): Promise<APIResponse> {
    return this.client.get('agent/listings', query);
  }

  /** GET /agent/listings/:id  (รับ id เป็นข้อความได้ด้วย เพื่อใช้ทดสอบ id ที่ผิดรูปแบบ) */
  getById(id: number | string): Promise<APIResponse> {
    return this.client.get(`agent/listings/${id}`);
  }
}
