import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/** ฟอร์ม multipart: ชื่อช่อง -> ข้อความ หรือไฟล์ */
export type MultipartForm = Record<string, string | { name: string; mimeType: string; buffer: Buffer }>;

/** เส้นทางกลุ่ม /auth */
export class AuthApi {
  constructor(private readonly client: ApiClient) {}

  /**
   * POST /auth/sync : ให้ API จับคู่บัตรผ่านกับผู้ใช้ในฐานข้อมูล แล้วตอบข้อมูลผู้ใช้กับบทบาท
   *
   * ข้อควรระวัง: ถ้าบัตรผ่านเป็นของคนที่ยังไม่มีในฐานข้อมูล เส้นทางนี้จะสร้างผู้ใช้ใหม่ทันที
   * เทสแบบอ่านอย่างเดียวจึงเรียกเส้นทางนี้ด้วยบัญชี QA ที่ global-setup ยืนยันแล้วว่ามีอยู่เท่านั้น
   */
  sync(): Promise<APIResponse> {
    return this.client.post('auth/sync');
  }

  /**
   * POST /auth/dev/roles : ขอบทบาทให้บัญชีที่ล็อกอินอยู่ (เครื่องมือของนักพัฒนา ใช้ได้เมื่อ API ตั้ง ALLOW_DEV_ROLE_GRANT=true)
   * ที่มา: apps/api/src/auth/auth.controller.ts:64-75 และ grantDevRole ใน auth.service.ts:166-189 ที่ develop 84087e2
   *
   * ข้อควรระวัง: ถ้าชื่อบทบาทอยู่ในรายการที่ขอได้ (DEV_GRANTABLE ใน auth.service.ts:27) มีแถวในตาราง master_roles
   * และบัญชียังไม่มีบทบาทนั้น API จะบันทึกบทบาทลงตาราง user_roles ทันที (auth.service.ts:173-186)
   * เทสจึงส่งได้เฉพาะชื่อบทบาทที่ API ต้องปฏิเสธก่อนอ่านตารางบทบาท
   */
  grantDevRole(role: string): Promise<APIResponse> {
    return this.client.post('auth/dev/roles', { role });
  }

  /**
   * POST /auth/dev/register : สร้างบัญชีทดสอบใน Supabase Auth (ไม่ต้องล็อกอิน) ที่มา develop accb616:
   *   auth.controller.ts:25-29, ตัวกัน guards/dev-registration.guard.ts:3-39 และ registerForTesting ใน auth.service.ts:53-93
   * เปิดเฉพาะเมื่อ API ตั้ง NODE_ENV=development และ ALLOW_DEV_REGISTRATION=true และคำขอมาตรงจากเครื่องเดียวกัน ไม่อย่างนั้น 404
   *
   * ข้อควรระวัง: ถ้าเส้นทางเปิดและเนื้อคำขอถูกทุกช่องด้วยอีเมลใหม่ API จะสร้างบัญชีที่ยืนยันอีเมลแล้วใน Supabase Auth
   * ซึ่ง API ไม่มีเส้นทางลบ ชุดเทสจึงส่งได้เฉพาะเนื้อคำขอที่ผิด หรืออีเมลของบัญชีที่มีอยู่แล้ว (ได้ 409)
   * headers ใช้ส่งหัวข้อเพิ่ม เช่น X-Forwarded-For เพื่อทดสอบตัวกัน
   */
  devRegister(body: unknown, headers: Record<string, string> = {}): Promise<APIResponse> {
    return this.client.postWithHeaders('auth/dev/register', body, headers);
  }

  /**
   * POST /auth/profile/avatar/upload : อัปโหลดรูปโปรไฟล์ของผู้ล็อกอิน (ช่องไฟล์ชื่อ file, ไม่เกิน 5 MB, ห้ามมีช่องข้อความ)
   * ที่มา develop accb616: auth.controller.ts:75-84, uploadAvatar ใน auth.service.ts:219-223, profile-avatar-storage.service.ts:45-73
   *
   * ข้อควรระวัง: ไฟล์ภาพที่ถูกต้องจะถูกเก็บใน Storage (bucket profile-avatars ซึ่ง API สร้างแบบสาธารณะเองถ้ายังไม่มี)
   * และเขียน users.avatar_url ของผู้ล็อกอิน เทสใน tests/api จึงส่งได้เฉพาะคำขอที่ API ปฏิเสธก่อนแตะ Storage
   * multipart = undefined หมายถึงไม่ส่งเนื้อคำขอเลย
   */
  uploadAvatar(multipart?: MultipartForm): Promise<APIResponse> {
    return multipart === undefined ? this.client.post('auth/profile/avatar/upload') : this.client.postMultipart('auth/profile/avatar/upload', multipart);
  }

  /**
   * DELETE /auth/profile/avatar : ล้างรูปโปรไฟล์ของผู้ล็อกอิน (ตั้ง avatar_url เป็น null แล้วลบไฟล์เดิมถ้าเป็นไฟล์ของระบบ)
   * ที่มา develop accb616: auth.controller.ts:86-91, clearAvatar/storeAvatar ใน auth.service.ts:225-240
   * ข้อควรระวัง: เมื่อผู้ล็อกอินมีบัญชี เส้นทางนี้บันทึกแถว users เสมอ เทสใน tests/api จึงเรียกได้เฉพาะแบบที่ถูกปฏิเสธก่อนเรียก service
   *   (ไม่มีบัตรผ่าน: AuthGuard ตอบ 401 ; บัตรผ่านของคนที่ไม่มีบัญชี: requireUser ใน controller ตอบ 401)
   */
  clearAvatar(): Promise<APIResponse> {
    return this.client.delete('auth/profile/avatar');
  }

  // ---- ลบบัญชี (ที่มา: auth.controller.ts บรรทัด 96-115 และ auth.service.ts บรรทัด 280-307, 347-352 ที่ qa/e2e 01d0523) ----
  //   ไม่มีเมธอดของ DELETE /auth/account/deletion (ยกเลิกนัด: เขียนแถว users ทุกครั้ง บรรทัด 309-312)
  //   และ POST /auth/password-changed (ส่งอีเมลจริง) โดยตั้งใจ ชุดเทสห้ามเรียก 2 เส้นทางนี้ (Aof 4 พ.ย. 2026)

  /** GET /auth/account/deletion : ดูว่าลบบัญชีได้ไหม อ่านอย่างเดียว (deletionPreview ใช้ SELECT 3 คำสั่งกับ findOne บรรทัด 280-295, 401-452) */
  deletionPreview(): Promise<APIResponse> {
    return this.client.get('auth/account/deletion');
  }

  /**
   * DELETE /auth/account : ลบบัญชีทันที (Supabase Auth, ตาราง users, Storage และส่งอีเมล: deleteAccount บรรทัด 354-398)
   * ข้อควรระวัง: ใช้ได้เฉพาะคำขอที่ RecentAuthGuard ต้องปฏิเสธ (dev token ไม่มี amr จึงได้ 401 REAUTH_REQUIRED: guards/recent-auth.guard.ts)
   */
  deleteAccountNow(): Promise<APIResponse> {
    return this.client.delete('auth/account');
  }

  /**
   * POST /auth/account/deletion : นัดลบบัญชีอีก 30 วัน (เขียน users.deletion_* แล้วส่งอีเมล: scheduleAccountDeletion บรรทัด 297-307)
   * ข้อควรระวัง: ใช้ได้เฉพาะคำขอที่ RecentAuthGuard ต้องปฏิเสธ แบบเดียวกับ deleteAccountNow
   */
  scheduleDeletion(): Promise<APIResponse> {
    return this.client.post('auth/account/deletion');
  }
}
