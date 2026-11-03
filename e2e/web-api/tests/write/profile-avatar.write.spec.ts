import { PublicFileApi } from '../../src/api/public-file.api';
import type { AuthUser } from '../../src/api/types';
import { qaAgent2 } from '../../src/config/qa-accounts';
import { expectJsonQuiet } from '../../src/support/http';
import { PNG_BLUE, PNG_ORANGE } from '../../src/support/test-images';
import { expect, test } from '../../src/write/write.fixture';

/**
 * รูปโปรไฟล์ของ qa-agent2: อัปโหลด อัปโหลดซ้ำ แล้วล้าง (เขียน Storage และ users.avatar_url จริง)
 *
 * ที่มา (develop accb616): uploadAvatar/clearAvatar/storeAvatar ใน auth.service.ts:219-240 และ profile-avatar-storage.service.ts
 *   - upload: ตรวจภาพ (sharp) -> ensureBucket (สร้าง bucket แบบสาธารณะถ้ายังไม่มี บรรทัด 15-35) -> อัปไฟล์ที่ `<users.id>/<uuid>.jpg`
 *     แปลงเป็น JPEG 512x512 (บรรทัด 56) -> บันทึก avatar_url เป็น URL สาธารณะ -> ลบไฟล์เดิมของผู้ใช้นี้ (removeOwned บรรทัด 80-107)
 *   - DELETE: ตั้ง avatar_url เป็น null แล้วลบไฟล์ปัจจุบันเท่านั้น (ไฟล์ก่อนหน้าที่ลบไม่สำเร็จจะไม่ถูกลบซ้ำ)
 * ทำไมต้องตั้ง E2E_ALLOW_AVATAR_WRITES=yes เพิ่ม: เทสนี้อัปไฟล์ลง bucket สาธารณะทุกรอบ ผู้รันจึงต้องตั้งใจรันเอง
 *   ทีมยืนยัน 3 พ.ย. 2026 ว่า Storage ของ dev มี bucket profile-avatars แล้ว (รันบน dev ผ่านครั้งแรกวันเดียวกัน รหัสรอบ 20261103-140410)
 *   ถ้าใช้กับ Storage อื่นที่ยังไม่มี bucket นี้ รอบแรกจะสร้าง bucket สาธารณะขึ้นมาเอง
 * ข้อมูลที่เขียน: ไฟล์ภาพสีพื้นขนาดเล็ก 2 ไฟล์ (src/support/test-images.ts ไม่มีข้อมูลของใคร) ซึ่งถูกลบในข้อเดียวกัน
 *   และ users.avatar_url ของ qa-agent2 ซึ่งจบที่ null เท่ากับตอนเริ่ม
 *   ถ้าเทสไม่ผ่านกลางทาง afterAll ล้างรูปปัจจุบันให้ แต่ทำไม่ได้ 2 กรณี: process ถูกปิดกลางทาง (afterAll ไม่รัน)
 *   และไฟล์ก่อนหน้าที่ API ลบไม่สำเร็จ (API แค่บันทึก log บรรทัด 88) ไฟล์ที่ API ตอบ 201 และรูปที่ค้างตอนเก็บกวาดจึงถูกบันทึก path ไว้ใน annotation "ไฟล์ที่อัป" ให้ส่งทีมลบ
 * หยุดก่อนเขียนถ้ารูปของ qa-agent2 ไม่ว่างตั้งแต่ต้น เพื่อไม่ทับรูปที่คนอื่นตั้งไว้
 * ข้อความของการตรวจไม่พิมพ์ URL ของรูป (มีที่อยู่ของ SUPABASE_URL) ตรวจเป็นจริง/เท็จ และบันทึกเฉพาะส่วนหลัง /object/public/
 */

test.skip(qaAgent2.uuid === null, `ยังไม่ได้ตั้ง ${qaAgent2.uuidVariable} (uuid ของ ${qaAgent2.email})`);
test.skip(
  process.env.E2E_ALLOW_AVATAR_WRITES !== 'yes',
  'ตั้ง E2E_ALLOW_AVATAR_WRITES=yes เมื่อตั้งใจรันเทสนี้ (อัปไฟล์ลง bucket profile-avatars แบบสาธารณะ แล้วลบในข้อเดียวกัน)',
);

/** ส่วนของ URL หลัง /object/public/ (bucket/<users.id>/<uuid>.jpg) ใช้บันทึกในรายงานแทน URL เต็ม */
const objectPath = (url: string) => url.split('/object/public/')[1] ?? '(ไม่ใช่ URL สาธารณะของ Storage)';

/**
 * รหัสที่หมายถึง "ไม่มีไฟล์นี้แล้ว" ใน URL สาธารณะของ Storage: Supabase Storage ตอบ 400 พร้อมเนื้อคำตอบที่บอก statusCode "404" (ตัวจำลองในห้องทดลองตอบแบบนี้)
 *   หรือ 404 ถ้าเป็น Storage รุ่นใหม่ (อนุมาน ยังไม่ได้บันทึกรหัสจริงบน dev) ไม่ใช้ .ok === false เพราะ 403, 429 หรือ 503 ชั่วคราวจะนับว่าลบแล้วทั้งที่ไฟล์ยังอยู่
 */
const GONE = [400, 404];

/** true เมื่อเทสอาจตั้งรูปให้ qa-agent2 แล้ว (afterAll ล้างเฉพาะกรณีนี้ และเฉพาะเมื่อรูปไม่ว่าง) */
let photoMayBeSet = false;

test.afterAll(async ({ agent2Auth }) => {
  if (!photoMayBeSet) return;
  const user = await expectJsonQuiet<AuthUser>(await agent2Auth.sync(), 201, 'POST /auth/sync');
  if (user.avatarUrl === null) return;
  // บันทึก path ของรูปที่ค้างก่อนล้าง เผื่อ API บันทึกรูปแล้วแต่ตอบรหัสอื่น (ไฟล์นั้นจะไม่อยู่ใน annotation ของเทส) หรือการลบล้ม
  test.info().annotations.push({ type: 'ไฟล์ที่อัป', description: `${objectPath(user.avatarUrl)} (พบตอนเก็บกวาด)` });
  await expectJsonQuiet<AuthUser>(await agent2Auth.clearAvatar(), 200, 'DELETE /auth/profile/avatar');
});


test('qa-agent2 uploads a photo, replaces it, then clears it, and old files are removed', async ({ agent2Auth }) => {
  const files = new PublicFileApi();
  const uploaded = (url: string) => test.info().annotations.push({ type: 'ไฟล์ที่อัป', description: objectPath(url) });
  // ขั้นที่ 1: รูปของ qa-agent2 ต้องว่างก่อนเริ่ม (ไม่อย่างนั้นหยุด เพื่อไม่ทับรูปที่มีอยู่)
  const before = await expectJsonQuiet<AuthUser>(await agent2Auth.sync(), 201, 'POST /auth/sync');
  expect(before.avatarUrl === null, 'qa-agent2 มีรูปโปรไฟล์อยู่แล้ว เทสหยุดก่อนเขียน (ล้างรูปเองในแอป หรือแจ้งทีมถ้าไม่ได้ตั้งเอง)').toBe(true);

  // ขั้นที่ 2: อัปโหลด PNG สีน้ำเงิน ต้องได้ 201 และ avatarUrl เป็นไฟล์ JPEG ในโฟลเดอร์ของ qa-agent2 (`<users.id>/<uuid>.jpg` บรรทัด 62)
  //   ตั้ง photoMayBeSet ก่อนส่งคำขอ: ถ้า API บันทึกรูปแล้วแต่ตอบรหัสอื่นหรือหมดเวลา afterAll ยังล้างให้ (afterAll ดูรูปจริงก่อนล้าง)
  const shape = new RegExp(`/storage/v1/object/public/[^/]+/${before.id}/[0-9a-f-]{36}\\.jpg$`);
  photoMayBeSet = true;
  const first = await expectJsonQuiet<AuthUser>(await agent2Auth.uploadAvatar({ file: PNG_BLUE() }), 201, 'อัปโหลดรูปแรก');
  const firstUrl = first.avatarUrl ?? '';
  uploaded(firstUrl);
  expect(shape.test(firstUrl), 'avatarUrl ต้องเป็น URL สาธารณะของไฟล์ JPEG ในโฟลเดอร์ของ qa-agent2').toBe(true);

  // ขั้นที่ 3: เปิด URL โดยไม่ล็อกอินต้องได้ไฟล์ JPEG (API แปลงทุกรูปเป็น JPEG บรรทัด 56 ; ไบต์แรก FF D8 FF)
  const firstFile = await files.open(firstUrl);
  expect(firstFile.status, 'เปิด URL ของรูปแรก').toBe(200);
  expect([...firstFile.body.subarray(0, 3)], 'ไฟล์ต้องเป็น JPEG').toEqual([0xff, 0xd8, 0xff]);

  // ขั้นที่ 4: อัปโหลดรูปที่ 2 ต้องได้ URL ใหม่ (uuid ใหม่ทุกครั้ง) และไฟล์รูปแรกต้องถูกลบ (storeAvatar ลบไฟล์เดิมหลังบันทึก)
  const second = await expectJsonQuiet<AuthUser>(await agent2Auth.uploadAvatar({ file: PNG_ORANGE() }), 201, 'อัปโหลดรูปที่ 2');
  const secondUrl = second.avatarUrl ?? '';
  uploaded(secondUrl);
  expect(shape.test(secondUrl), 'avatarUrl ของรูปที่ 2 ต้องเป็นไฟล์ในโฟลเดอร์ของ qa-agent2').toBe(true);
  expect(secondUrl !== firstUrl, 'รูปที่ 2 ต้องได้ URL ใหม่').toBe(true);
  expect((await files.open(secondUrl)).status, 'เปิด URL ของรูปที่ 2').toBe(200);
  expect(GONE, 'ไฟล์รูปแรกต้องถูกลบออกจาก bucket แล้ว (รหัส 400 หรือ 404)').toContain((await files.open(firstUrl)).status);

  // ขั้นที่ 5: ล้างรูป ต้องได้ 200 avatarUrl = null และ POST /auth/sync ก็ต้องได้ null
  const cleared = await expectJsonQuiet<AuthUser>(await agent2Auth.clearAvatar(), 200, 'DELETE /auth/profile/avatar');
  expect(cleared.avatarUrl === null, 'DELETE ต้องตอบ avatarUrl = null').toBe(true);
  expect((await expectJsonQuiet<AuthUser>(await agent2Auth.sync(), 201, 'POST /auth/sync')).avatarUrl === null, 'หลังล้าง sync ต้องได้ avatarUrl = null').toBe(true);

  // ขั้นที่ 6: ไฟล์รูปที่ 2 ต้องถูกลบด้วย
  expect(GONE, 'ไฟล์รูปที่ 2 ต้องถูกลบออกจาก bucket แล้ว (รหัส 400 หรือ 404)').toContain((await files.open(secondUrl)).status);
});
