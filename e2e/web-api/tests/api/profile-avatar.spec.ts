import type { MultipartForm } from '../../src/api/auth.api';
import type { AuthUser } from '../../src/api/types';
import { qaAgent2 } from '../../src/config/qa-accounts';
import { expect, test } from '../../src/fixtures/api.fixture';
import { expectErrorQuiet, expectJsonQuiet } from '../../src/support/http';
import { AVIF_TINY, GIF_TINY, MAX_AVATAR_BYTES, TEXT_AS_PNG } from '../../src/support/test-images';

/**
 * POST /auth/profile/avatar/upload และ DELETE /auth/profile/avatar (เพิ่มใน develop accb616): คำขอที่ API ต้องปฏิเสธ
 *
 * ที่มา (develop accb616): auth.controller.ts:75-91 (AuthGuard อย่างเดียว ทุกบทบาทเรียกได้ ช่องไฟล์ชื่อ file
 *   ไม่เกิน 5 MB ห้ามมีช่องข้อความ) และ profile-avatar-storage.service.ts:45-60 (ตรวจภาพด้วย sharp ก่อนแตะ Storage)
 * ไฟล์นี้อ่านอย่างเดียว: ทุกคำขอถูกปฏิเสธก่อนแตะ Storage และก่อนเขียน users.avatar_url
 *   - ไม่มีบัตรผ่าน: AuthGuard ตอบ 401 ; บัตรผ่านของคนที่ไม่มีบัญชี: AuthGuard ปล่อยผ่านโดยไม่มีผู้ใช้ (auth.guard.ts บรรทัด 52-57)
 *     แล้ว requireUser ใน controller ตอบ 401 (auth.controller.ts บรรทัด 119-123) ก่อนเรียก service ใช้กับทั้ง upload และ DELETE
 *   - qa-agent2 ส่งไฟล์ที่ผิด: multer ปฏิเสธ (400, 413) หรือการตรวจภาพปฏิเสธ (400) ก่อน ensureBucket
 *     ข้อที่ทดสอบ multer ส่งไฟล์ข้อความ ไม่ใช่ภาพ ถ้า multer เลิกปฏิเสธ คำขอจะไปตกที่การตรวจภาพ (ข้อความต่าง เทสจึงจับได้) และไม่มีอะไรถูกเก็บ
 *     ข้อยกเว้น: ข้อไฟล์ข้อความและข้อ GIF ทดสอบการตรวจภาพเอง ถ้าการตรวจภาพหาย 2 ข้อนี้จะทำให้ API สร้าง bucket profile-avatars
 *     แบบสาธารณะ (ถ้ายังไม่มี) อัปไฟล์ และตั้งรูปให้ qa-agent2 จริง (ลองในห้องทดลองด้วยตัวกลายพันธุ์ที่รับ GIF) ให้แจ้งทีมถ้าข้อนี้ไม่ผ่าน
 *     ข้อนี้ไม่เรียก DELETE ด้วยบัญชีจริง เพราะ DELETE บันทึกแถว users เสมอ (การล้างรูปอยู่ใน tests/write/profile-avatar.write.spec.ts)
 *   ใช้ qa-agent2 ซึ่งเป็นบัญชีของ QA เอง ไม่แตะรูปของบัญชีที่ทีมใช้ร่วม และตรวจซ้ำว่ารูปของ qa-agent2 ไม่เปลี่ยน
 * สิ่งที่ต้องมีก่อน: ข้อที่ใช้ qa-agent2 ต้องตั้ง E2E_QA_AGENT2_UUID ไม่อย่างนั้นข้าม
 */

/** บัตรผ่านแบบนักพัฒนาของคนที่ไม่มีในฐานข้อมูล (แบบเดียวกับ auth.spec.ts) AuthGuard อ่านอย่างเดียวและไม่สร้างผู้ใช้ */
const NEVER_REGISTERED = 'Bearer dev|11111111-1111-4111-8111-111111111111|e2e-nobody@example.invalid';

test.describe('profile photo routes reject callers without an account', () => {
  test('upload and delete answer 401 when no token is sent', async ({ anonymous }) => {
    // ขั้นที่ 1: ไม่ส่งหัวข้อ Authorization   ขั้นที่ 2: AuthGuard ต้องตอบ 401 Missing Bearer token (auth.guard.ts บรรทัด 39-63)
    expect(await expectErrorQuiet(await anonymous.auth.uploadAvatar({ file: TEXT_AS_PNG() }), 401, 'upload ไม่มีบัตรผ่าน')).toBe('Missing Bearer token');
    expect(await expectErrorQuiet(await anonymous.auth.clearAvatar(), 401, 'DELETE ไม่มีบัตรผ่าน')).toBe('Missing Bearer token');
  });

  test('upload and delete answer 401 for a dev token of a user that was never registered', async ({ apiAs }) => {
    // ขั้นที่ 1: บัตรผ่านรูปแบบถูกแต่ไม่มีแถวใน users   ขั้นที่ 2: requireUser ใน controller ตอบ 401 (auth.controller.ts บรรทัด 119-123)
    const nobody = await apiAs(NEVER_REGISTERED);
    expect(await expectErrorQuiet(await nobody.auth.uploadAvatar({ file: TEXT_AS_PNG() }), 401, 'upload ของคนที่ไม่มีบัญชี')).toBe('Call POST /auth/sync first');
    expect(await expectErrorQuiet(await nobody.auth.clearAvatar(), 401, 'DELETE ของคนที่ไม่มีบัญชี')).toBe('Call POST /auth/sync first');
  });
});

test.describe('profile photo upload rejects files that are not a usable photo', () => {
  test.skip(qaAgent2.uuid === null, `ยังไม่ได้ตั้ง ${qaAgent2.uuidVariable} (uuid ของ ${qaAgent2.email})`);

  /** รูปโปรไฟล์ของ qa-agent2 ก่อนเทส ใช้ยืนยันว่าคำขอที่ถูกปฏิเสธไม่เปลี่ยนรูป */
  let avatarBefore: string | null;

  test.beforeEach(async ({ agent2 }) => {
    avatarBefore = (await expectJsonQuiet<AuthUser>(await agent2.auth.sync(), 201, 'POST /auth/sync')).avatarUrl;
  });

  test.afterEach(async ({ agent2 }) => {
    // คำขอที่ถูกปฏิเสธต้องไม่เปลี่ยน users.avatar_url ของ qa-agent2
    // เทียบเป็นจริง/เท็จ เพราะ URL ของรูปมีที่อยู่ของ Storage ของทีม ถ้าไม่ผ่าน ให้ล้างรูปของ qa-agent2 ก่อนรันรอบถัดไป
    const after = (await expectJsonQuiet<AuthUser>(await agent2.auth.sync(), 201, 'POST /auth/sync')).avatarUrl;
    expect(after === avatarBefore, 'รูปโปรไฟล์ของ qa-agent2 ต้องเท่าเดิม (ถ้าไม่ผ่าน API รับไฟล์ไปแล้ว)').toBe(true);
  });

  // [คำอธิบาย, ฟอร์มที่ส่ง (undefined = ไม่ส่งเนื้อคำขอ), รหัส, ข้อความของ API]
  //   ข้อความ "Choose an image file" กับ "Use a valid ..." มาจาก profile-avatar-storage.service.ts บรรทัด 47 และ 59 (develop accb616)
  //   ส่วน "Unexpected field - photo", "Too many fields", "File too large" กับรหัส 413 มาจาก multer ผ่าน FileInterceptor
  //   (ห้องทดลอง 3 พ.ย. 2026: @nestjs/platform-express 11.2.3 กับ multer 2.2.0 ; ถ้าทีมเปลี่ยนรุ่น ข้อความอาจเปลี่ยน)
  const rejected: [string, MultipartForm | undefined, number, string][] = [
    ['no request body', undefined, 400, 'Choose an image file'],
    ['a form without a file', {}, 400, 'Choose an image file'],
    ['a text file named .png', { file: TEXT_AS_PNG() }, 400, 'Use a valid JPEG, PNG or WebP image'],
    ['a GIF image', { file: GIF_TINY() }, 400, 'Use a valid JPEG, PNG or WebP image'],
    ['an AVIF image', { file: AVIF_TINY() }, 400, 'Use a valid JPEG, PNG or WebP image'],
    ['a file in a field that is not named file', { photo: TEXT_AS_PNG() }, 400, 'Unexpected field - photo'],
    ['a file with an extra text field', { note: 'e2e', file: TEXT_AS_PNG() }, 400, 'Too many fields'],
    [
      'a file of 5 MB + 1 byte',
      { file: { name: 'e2e-too-big.png', mimeType: 'image/png', buffer: Buffer.alloc(MAX_AVATAR_BYTES + 1) } },
      413,
      'File too large',
    ],
  ];

  for (const [label, form, status, message] of rejected) {
    test(`answers ${status} for ${label}`, async ({ agent2 }) => {
      // ขั้นที่ 1: qa-agent2 ส่งฟอร์มนี้   ขั้นที่ 2: ต้องถูกปฏิเสธด้วยรหัสและข้อความนี้ (afterEach ตรวจว่ารูปไม่เปลี่ยน)
      // ไม่พิมพ์เนื้อคำตอบถ้ารหัสไม่ตรง: ถ้า API รับไฟล์ไป คำตอบคือข้อมูลของ qa-agent2 ที่มี URL ของ Storage
      expect(await expectErrorQuiet(await agent2.auth.uploadAvatar(form), status, `upload ${label}`)).toBe(message);
    });
  }
});

test.describe('profile photo routes with a dev token whose user id is not a uuid', () => {
  // บั๊กเดียวกับ auth.spec.ts (พบ 20 ต.ค. 2026 ร่างถึงทีมฉบับที่ 6): AuthGuard ส่ง uuid ที่ผิดรูปแบบไปค้นฐานข้อมูล ได้ 500 แทน 401
  //   คำขอนี้ไม่บันทึกอะไร: error เกิดตอนค้นผู้ใช้ ก่อนถึงเส้นทาง

  test('DELETE /auth/profile/avatar is rejected when the user id is not a uuid', async ({ apiAs }) => {
    // เทสคู่กับข้อ known-bug ด้านล่าง: ตรวจขั้นต่ำที่ต้องจริงเสมอ คือคำขอถูกปฏิเสธ (ไม่ใช่ 2xx)
    const session = await apiAs('Bearer dev|e2e-not-a-uuid|e2e-nobody@example.invalid');
    expect((await session.auth.clearAvatar()).status()).toBeGreaterThanOrEqual(400);
  });

  test('DELETE /auth/profile/avatar answers 401 when the user id is not a uuid', { tag: '@known-bug' }, async ({ apiAs }) => {
    test.fail(true, 'API-001: API ตอบ 500 เพราะไม่ตรวจรูปแบบ uuid ใน dev token ก่อนค้นฐานข้อมูล');
    const session = await apiAs('Bearer dev|e2e-not-a-uuid|e2e-nobody@example.invalid');
    await expectErrorQuiet(await session.auth.clearAvatar(), 401, 'DELETE ด้วย uuid ผิดรูปแบบ');
  });
});
