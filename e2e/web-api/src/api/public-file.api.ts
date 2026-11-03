/** ผลของการเปิดไฟล์สาธารณะ (ไม่เก็บ URL ไว้ในผล เพื่อไม่ให้ URL ของ Storage ของทีมถูกพิมพ์ในผลรัน) */
export interface PublicFileResult {
  ok: boolean;
  status: number;
  /** เนื้อไฟล์ (ว่างถ้าเปิดไม่ได้) */
  body: Buffer;
}

/**
 * เปิดไฟล์จาก URL สาธารณะโดยไม่ส่งบัตรผ่าน แบบเดียวกับที่แอปเปิดรูปโปรไฟล์
 * ต่างจากตัวเรียกอื่นใน src/api โดยตั้งใจ 2 จุด
 *   - คืนผลที่แปลงแล้ว (ok, status, body) ไม่ใช่ APIResponse ดิบ เพราะ APIResponse เก็บ URL ไว้
 *     ถ้าเทสส่งคำตอบดิบเข้าตัวตรวจ URL ของ Storage ของทีมอาจถูกพิมพ์ในผลรัน
 *   - ใช้ fetch ของ Node ไม่ใช้ตัวส่งคำขอของ Playwright เพราะ Playwright บันทึกทุกคำขอเป็นขั้นในรายงาน HTML พร้อมที่อยู่เต็ม
 *     (ห้องทดลอง 3 พ.ย. 2026: รายงานของเทสรูปโปรไฟล์มี URL ของ Storage 4 ที่) fetch ไม่ถูกบันทึก
 * ต่อ query string ที่ไม่ซ้ำทุกครั้ง และขอแบบไม่ใช้แคช เพราะไฟล์ถูกอัปด้วย cacheControl 3600
 *   (profile-avatar-storage.service.ts บรรทัด 66 ที่ develop accb616) CDN อาจส่งไฟล์ที่ลบแล้วกลับมาถ้าเปิด URL เดิมซ้ำ (อนุมาน)
 */
export class PublicFileApi {
  async open(url: string): Promise<PublicFileResult> {
    const fresh = `${url}${url.includes('?') ? '&' : '?'}e2e=${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // หมดเวลาใน 10 วินาที เพื่อให้ข้อความบอกว่าค้างที่การเปิดไฟล์ ไม่ใช่หมดเวลาของทั้งเทส (30 วินาที: playwright.write.config.ts)
    const response = await fetch(fresh, { headers: { 'Cache-Control': 'no-cache' }, redirect: 'follow', signal: AbortSignal.timeout(10_000) });
    const body = response.ok ? Buffer.from(await response.arrayBuffer()) : Buffer.alloc(0);
    if (!response.ok) await response.body?.cancel();
    return { ok: response.ok, status: response.status, body };
  }
}
