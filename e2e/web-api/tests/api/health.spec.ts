import { expect, test } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';

/**
 * เส้นทางตรวจสถานะของ API
 * สิ่งที่ต้องมีก่อน: API เปิดอยู่ (ไม่ต้องล็อกอิน และไม่ต้องมีข้อมูลในฐานข้อมูล)
 */
test.describe('GET /health', () => {
  test('reports that the API is up without requiring a login', { tag: '@smoke' }, async ({ anonymous }) => {
    // ขั้นที่ 1: เรียกเส้นทางตรวจสถานะโดยไม่ส่งบัตรผ่าน
    const response = await anonymous.health.check();

    // ขั้นที่ 2: ต้องได้รหัส 200 และสถานะ ok
    const body = await expectJson<{ status: string; service: string; timestamp: string }>(response, 200);
    expect(body.status).toBe('ok');
    expect(body.service).toEqual(expect.any(String));

    // ขั้นที่ 3: เวลาที่ API รายงานต้องเป็นเวลาปัจจุบัน
    // ยอมให้ต่างจากนาฬิกาของเครื่องที่รันเทสได้ 5 นาที เผื่อวันหนึ่ง API กับเทสอยู่คนละเครื่อง
    const driftMs = Math.abs(Date.now() - Date.parse(body.timestamp));
    expect(driftMs).toBeLessThan(5 * 60 * 1000);
  });
});

test.describe('routes that do not exist', () => {
  test('answer 404 in the standard error format', async ({ anonymous }) => {
    // ขั้นที่ 1: เรียกเส้นทางที่ไม่มีอยู่จริง
    const response = await anonymous.client.get('e2e-no-such-route');

    // ขั้นที่ 2: ต้องได้ 404 พร้อมเนื้อคำตอบรูปแบบมาตรฐาน { statusCode, message, error } ไม่ใช่หน้า HTML
    const message = await expectError(response, 404);
    expect(message).toContain('e2e-no-such-route');
  });
});
