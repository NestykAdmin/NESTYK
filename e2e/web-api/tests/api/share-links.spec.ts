import type { ListingSummary, Paginated, ShareLinkSummary } from '../../src/api/types';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { anyRoomId } from '../../src/support/agent-data';
import { expectError, expectJson } from '../../src/support/http';

/**
 * ลิงก์แชร์ห้อง: GET/POST/DELETE /agent/listings/:id/share-links และหน้าสาธารณะ GET /public/room-shares/:token
 * ที่มาของค่าที่คาด: apps/api/src/agent/listings/room-share-links.controller.ts และ room-share-links.service.ts
 *   ที่ develop bc77a8b (qa/e2e ecc39f6) และผลยิงจริงในห้องทดลอง 30 ต.ค. 2026
 *
 * สิ่งที่ต้องมีก่อน
 *   - ล็อกอินแบบนักพัฒนาได้ ผู้เรียกคือ fixture agent = qa-agent ซึ่งต้องมีห้องอย่างน้อย 1 ห้อง
 *
 * เทสไฟล์นี้ไม่สร้างและไม่ยกเลิกลิงก์
 *   - POST กับห้องจริงของ qa-agent สร้างลิงก์จริงทุกครั้งที่ค่าผ่าน รวมเนื้อคำขอว่าง หรือ expiresInDays เป็น "" หรือ null
 *     เทสจึงส่งแค่ค่าที่ API ปฏิเสธ ลำดับในโค้ด: หาห้อง (service 105) ตรวจ expiresInDays (110) ตรวจ contactId (113-119) แล้วจึงบันทึก (135)
 *     เคส expiresInDays แนบ contactId 2147483647 ด้วย ถ้าตัวตรวจวันถูกผ่อน คำขอยังถูกกันที่ contactId (service 119 ; 400 ก่อนบันทึก)
 *     ส่วนเคส contactId 0 และ 'abc' มีด่านเดียว (service 116) ถ้าทีมเปลี่ยนเป็นตรวจแบบ truthy คำขอจะสร้างลิงก์ 7 วัน (ความเสี่ยงที่เหลือ)
 *     ทุกเคสนับลิงก์ของห้องก่อนและหลัง และตรวจจำนวนก่อนตรวจรหัสตอบกลับ ถ้าจำนวนเพิ่ม เทสไม่ผ่านพร้อมข้อความให้แจ้งทีม
 *     (ลิงก์ที่สร้างแล้วยกเลิกได้ด้วย DELETE เท่านั้น) ; ไม่พิมพ์เนื้อคำตอบเมื่อรหัสผิด เพราะคำตอบของการสร้างมี url ที่มี token จริง (service 147-154)
 *   - DELETE ส่งเฉพาะห้องหรือลิงก์ที่ไม่มีจริง ซึ่งตอบ 404 ก่อนบันทึก (service 182-191 ; บันทึก revoked_at ที่ 192-195)
 *     ลิงก์ที่ไม่มีจริงในห้องจริงมีด่านเดียว (การหาลิงก์ 184-191 ; ความเสี่ยงที่เหลือ) จึงอ่านสถานะลิงก์ของห้องก่อนกับหลังและแจ้งทีมถ้าต่าง
 *   - หน้าสาธารณะไม่เขียนข้อมูลและไม่นับจำนวนครั้งที่เปิด (service 203-232) เทสส่งเฉพาะ token ปลอม
 *     ชุดเทสอ่านอย่างเดียวหา token จริงไม่ได้ (GET รายการลิงก์ไม่คืน token) จึงยังไม่ได้ตรวจคำตอบของลิงก์ที่ใช้ได้ 410 หรือการซ่อนข้อมูลตาม shareSections
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id เก็บได้ = 2^31 - 1 ใช้เป็น id ที่ไม่มีอยู่จริง */
const NO_SUCH_ID = 2_147_483_647;

/** สถานะของลิงก์ (service 99-101: ยกเลิกก่อน แล้วหมดอายุ) */
const STATUSES = ['active', 'expired', 'revoked'];

/** ข้อความของ DatabaseIdPipe (apps/api/src/common/database-id.pipe.ts:12) เมื่อ id อยู่นอกช่วง 1 ถึง 2147483647 */
const ID_OUT_OF_RANGE = 'ID must be an integer between 1 and 2147483647';

/** token รูปแบบถูก (ตัวอักษร base64url 20-128 ตัว ตามตัวตรวจ share-link-token.ts:13-15 ; token จริงยาว 43 ตัว) แต่ไม่มีลิงก์นี้ */
const FAKE_TOKEN = 'E2E-no-such-share-link-token-AAAAAAAAAAAAAA';

async function linkCount(agent: ApiSession, roomId: number): Promise<number> {
  return (await expectJson<{ items: ShareLinkSummary[] }>(await agent.shareLinks.list(roomId), 200)).items.length;
}

/**
 * [id, เวลายกเลิก] ของลิงก์ทุกอันในห้อง (ไม่มี token: GET รายการไม่คืน token)
 * ไม่เทียบ status เพราะ API คำนวณจากเวลาทุกครั้งที่อ่าน (service 98-101) ลิงก์อาจหมดอายุเองระหว่างอ่าน 2 ครั้ง
 * revoke เขียนแค่ revoked_at (service 192-195)
 */
async function linkStates(agent: ApiSession, roomId: number) {
  const body = await expectJson<{ items: ShareLinkSummary[] }>(await agent.shareLinks.list(roomId), 200);
  return body.items.map((link) => [link.id, link.revokedAt]);
}

test.describe('GET /agent/listings/:id/share-links', () => {
  test('lists the links of the rooms of qa-agent without the token or the url', async ({ agent }) => {
    // ขั้นที่ 1: อ่านลิงก์ของทุกห้องในหน้าแรกของรายการห้อง qa-agent (อ่านอย่างเดียว ไม่เกิน 50 ห้อง)
    // อ่านทุกห้อง ไม่หยุดที่ห้องแรกที่มีลิงก์ จะได้เจอลิงก์ทุกสถานะที่มี
    const rooms = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit: 50 }), 200);
    expect(rooms.total, 'qa-agent ต้องมีห้องอย่างน้อย 1 ห้อง ถ้าเป็น 0 ให้แจ้งทีม').toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const room of rooms.items) {
      const body = await expectJson<{ items: ShareLinkSummary[] }>(await agent.shareLinks.list(room.id), 200);
      expect(Array.isArray(body.items), `ห้อง id ${room.id}`).toBe(true);

      // ขั้นที่ 2: ทุกลิงก์ไม่มี token หรือ url (เก็บแค่ hash: share-link-token.ts:8) และสถานะตรงกับเวลา (service 98-101)
      // ลิงก์ที่หมดอายุห่างจากเวลาของเครื่องเทสไม่เกิน 1 วินาทีไม่เทียบสถานะ (API คำนวณสถานะก่อนเครื่องเทสอ่านเวลา ผลจึงแกว่งได้)
      const now = Date.now();
      for (const link of body.items) {
        const label = `ห้อง id ${room.id} ลิงก์ id ${link.id}`;
        expect(Object.keys(link), label).not.toContain('token');
        expect(Object.keys(link), label).not.toContain('url');
        expect(STATUSES, label).toContain(link.status);
        if (link.revokedAt === null && Math.abs(Date.parse(link.expiresAt) - now) <= 1000) continue;
        const expected = link.revokedAt !== null ? 'revoked' : Date.parse(link.expiresAt) <= now ? 'expired' : 'active';
        expect(link.status, label).toBe(expected);
        seen.add(expected);
      }

      // ขั้นที่ 3: เรียง id จากมากไปน้อย (service 166)
      const ids = body.items.map((link) => link.id);
      expect(ids, `ห้อง id ${room.id}`).toEqual([...ids].sort((a, b) => b - a));
    }

    // ขั้นที่ 4: บอกว่าสถานะไหนไม่ได้ตรวจ เพราะไม่มีลิงก์สถานะนั้นในห้องหน้าแรก
    const missing = STATUSES.filter((status) => !seen.has(status));
    if (missing.length > 0) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: `ห้องในหน้าแรกของ qa-agent ไม่มีลิงก์สถานะ ${missing.join(', ')}` });
    }
  });

  test('answers 404 for a room that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: อ่านรายการลิงก์ของห้อง 2147483647
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: assertOwnedScoutRoom (service 82)
    expect(await expectError(await agent.shareLinks.list(NO_SUCH_ID), 404)).toBe('Room not found');
  });

  test('answers 400 for a room id out of range', async ({ agent }) => {
    // ขั้นที่ 1: อ่านรายการลิงก์ของห้อง id 2147483648   ขั้นที่ 2: DatabaseIdPipe ปฏิเสธก่อนเรียก service
    expect(await expectError(await agent.shareLinks.list('2147483648'), 400)).toBe(ID_OUT_OF_RANGE);
  });

  test('answers 401 without login', async ({ anonymous }) => {
    // ขั้นที่ 1: อ่านรายการลิงก์โดยไม่ส่งหัวข้อ Authorization
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: AuthGuard ไม่มี Bearer token (auth/guards/auth.guard.ts:39,44)
    expect(await expectError(await anonymous.shareLinks.list(NO_SUCH_ID), 401)).toBe('Missing Bearer token');
  });
});

test.describe('creating or revoking a link is refused before anything is saved', () => {
  test('POST answers 404 for a room that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง POST สร้างลิงก์ไปห้อง 2147483647
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: หาห้องก่อนอ่านเนื้อคำขอ (service 105) จึงได้ 404 ; ส่ง expiresInDays 0 ซึ่งผิด ถ้าการหาห้องหายไป คำขอยังถูกกันที่ service 110 (400)
    expect(await expectError(await agent.shareLinks.create(NO_SUCH_ID, { expiresInDays: 0 }), 404)).toBe('Room not found');
  });

  test('DELETE answers 404 for a room that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง DELETE ลิงก์ 2147483647 ของห้อง 2147483647
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: หาห้องไม่เจอ (service 183) ก่อนหาลิงก์
    expect(await expectError(await agent.shareLinks.revoke(NO_SUCH_ID, NO_SUCH_ID), 404)).toBe('Room not found');
  });

  test('DELETE answers 404 for a link that does not exist on a room of qa-agent and revokes nothing', async ({ agent }) => {
    // ขั้นที่ 1: เลือกห้องจริงของ qa-agent และอ่าน [id, เวลายกเลิก] ของลิงก์ก่อนส่ง
    // ด่านเดียวคือการหาลิงก์ (service 184-191) ถ้าเงื่อนไขผิด API จะยกเลิกลิงก์จริงของห้อง (192-195) ซึ่งย้อนไม่ได้
    const roomId = await anyRoomId(agent);
    const before = await linkStates(agent, roomId);
    if (before.length === 0) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: `ห้อง id ${roomId} ไม่มีลิงก์ จึงตรวจได้แค่รหัส 404 ไม่ได้ตรวจว่าไม่มีลิงก์ถูกยกเลิก` });
    }
    // ขั้นที่ 2: ส่งคำขอ แล้วอ่านซ้ำก่อนตรวจรหัส ถ้าต่าง แปลว่าลิงก์ของห้องถูกแก้ (ยกเลิก หรือมีลิงก์ใหม่จากข้ออื่นที่รันพร้อมกัน) ต้องแจ้งทีม
    const response = await agent.shareLinks.revoke(roomId, NO_SUCH_ID);
    expect(await linkStates(agent, roomId), `ห้อง id ${roomId}: ลิงก์ของห้องเปลี่ยน (รหัสตอบกลับ ${response.status()}) ให้แจ้งทีม`).toEqual(before);
    // ขั้นที่ 3: หาลิงก์ 2147483647 ของห้องนั้นไม่เจอ (service 191) ต้องได้ 404
    expect(await expectError(response, 404)).toBe('Share link not found');
  });

  const refused: { title: string; body: Record<string, unknown>; message: string }[] = [
    // parseExpiresInDays: จำนวนเต็ม 1-30 (service 48-57) ค่าว่าง "" หรือ null ถูกใช้เป็น 7 วันและสร้างลิงก์ จึงห้ามส่ง
    // แนบ contactId ที่ไม่ใช่ผู้ติดต่อของห้องเป็นด่านที่ 2 (service 119) ข้อความที่คาดยังเป็นของตัวตรวจวัน เพราะตรวจวันก่อน (110)
    { title: 'expiresInDays 0', body: { expiresInDays: 0, contactId: NO_SUCH_ID }, message: 'expiresInDays must be an integer between 1 and 30' },
    { title: 'expiresInDays 31', body: { expiresInDays: 31, contactId: NO_SUCH_ID }, message: 'expiresInDays must be an integer between 1 and 30' },
    { title: 'expiresInDays 1.5', body: { expiresInDays: 1.5, contactId: NO_SUCH_ID }, message: 'expiresInDays must be an integer between 1 and 30' },
    { title: 'expiresInDays abc', body: { expiresInDays: 'abc', contactId: NO_SUCH_ID }, message: 'expiresInDays must be an integer between 1 and 30' },
    // contactId: จำนวนเต็ม 1..2147483647 (service 116-118) และต้องเป็นผู้ติดต่อของห้องนี้ (assertRoomContact 86-96 เรียกที่ 119)
    { title: 'contactId 0', body: { contactId: 0 }, message: 'Invalid contactId' },
    { title: 'contactId abc', body: { contactId: 'abc' }, message: 'Invalid contactId' },
    { title: 'contactId 2147483648', body: { contactId: 2_147_483_648 }, message: 'Invalid contactId' },
    { title: 'a contactId that is not a contact of the room', body: { contactId: NO_SUCH_ID }, message: 'contactId must belong to this room' },
  ];
  for (const item of refused) {
    test(`POST on a room of qa-agent answers 400 for ${item.title} and creates no link`, async ({ agent }) => {
      // ขั้นที่ 1: เลือกห้องจริงของ qa-agent และนับลิงก์ก่อนส่ง
      const roomId = await anyRoomId(agent);
      const before = await linkCount(agent, roomId);
      // ขั้นที่ 2: ส่งคำขอ แล้วนับลิงก์ซ้ำก่อนตรวจรหัส ถ้าจำนวนเพิ่ม แปลว่า API บันทึกลิงก์ในฐานข้อมูลแล้ว ต้องแจ้งทีม
      const response = await agent.shareLinks.create(roomId, item.body);
      expect(await linkCount(agent, roomId), `ห้อง id ${roomId}: มีลิงก์ถูกสร้าง (รหัสตอบกลับ ${response.status()}) ให้แจ้งทีมเพื่อยกเลิกลิงก์นั้น`).toBe(before);
      // ขั้นที่ 3: ต้องได้ 400 ตรวจรหัสโดยไม่พิมพ์เนื้อคำตอบ (ถ้าสร้างลิงก์ได้ เนื้อคำตอบมี url ที่มี token จริง) แล้วตรวจข้อความของตัวตรวจ
      expect(response.status(), `ห้อง id ${roomId}: รหัสตอบกลับไม่ใช่ 400 (ไม่พิมพ์เนื้อคำตอบ)`).toBe(400);
      expect(await expectError(response, 400)).toBe(item.message);
    });
  }
});

test.describe('GET /public/room-shares/:token', () => {
  for (const item of [
    { title: 'a token in the wrong format', token: 'abc' },
    { title: 'a token in the right format that does not exist', token: FAKE_TOKEN },
  ]) {
    test(`answers 404 without login for ${item.title}, and is not cached`, async ({ anonymous }) => {
      // ขั้นที่ 1: เปิดหน้าสาธารณะด้วย token ปลอมโดยไม่ล็อกอิน
      // ขั้นที่ 2: ต้องถูกปฏิเสธ: ไม่ต้องล็อกอิน (controller 48-58) token ผิดรูปแบบหรือไม่มีจริงได้ 404 (service 204-210)
      const response = await anonymous.shareLinks.publicView(item.token);
      expect(await expectError(response, 404)).toBe('Share link not found');
      // ขั้นที่ 3: ห้ามเก็บแคชและห้ามส่ง referrer (controller 53-54) ตั้งไว้ก่อนเรียก service จึงมีในคำตอบ 404 ด้วย (ยืนยันในห้องทดลอง)
      expect(response.headers()['cache-control']).toBe('no-store');
      expect(response.headers()['referrer-policy']).toBe('no-referrer');
    });
  }
});
