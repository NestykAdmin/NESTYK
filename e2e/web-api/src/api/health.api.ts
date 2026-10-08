import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/** เส้นทางตรวจสถานะของ API (ไม่ต้องล็อกอิน) */
export class HealthApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /health */
  check(): Promise<APIResponse> {
    return this.client.get('health');
  }
}
