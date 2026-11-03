import type { PublicShareResult } from '../../src/api/share-links.api';
import type { ShareLinkSummary } from '../../src/api/types';
import { expectJsonQuiet } from '../../src/support/http';
import { findOrCreateQaRoom, QA_ROOM_CONTACTS, QA_ROOM_EXTRAS, QA_ROOM_LABEL, QA_ROOM_LOCATION, QA_ROOM_TERMS, type QaRoom } from '../../src/write/qa-dataset';
import { expect, test, type ShareWriterSession } from '../../src/write/write.fixture';

/**
 * ลิงก์แชร์ห้อง: สร้าง ดูรายการ เปิดหน้าแชร์สาธารณะ ซ่อนข้อมูลตามส่วน และยกเลิก (เขียนข้อมูลจริง)
 *
 * สิ่งที่ต้องมีก่อนรัน: E2E_ALLOW_WRITES=yes npm run test:write -- share-links และตั้ง E2E_QA_AGENT_UUID
 *   รอบแรก (ยังไม่มีห้องถาวร) API ต้องต่อ Storage ได้ เพราะต้องอัปรูปของห้อง
 *
 * ที่มา (develop accb616): apps/api/src/agent/listings/room-share-links.controller.ts และ room-share-links.service.ts
 *   (ไม่เปลี่ยนตั้งแต่ a7eb77c) เลขบรรทัดข้างล่างหมายถึง service ถ้าไม่ได้บอกไฟล์
 *   - สร้าง (104-160): ห้องต้องเป็นห้อง scout ของนายหน้า อายุ 1-30 วัน ค่าตั้งต้น 7 วัน (23-26, 48-57) ทุกส่วนเปิดเป็นค่าตั้งต้น (28-34)
 *     ถ้าไม่ส่ง contactId และเปิดส่วนผู้ติดต่อ ใช้ผู้ติดต่อหลักของห้อง (121-131) ถ้าปิดส่วนผู้ติดต่อ contactId เป็น null
 *   - หน้าสาธารณะ (203-232, 234-377): ไม่ต้องล็อกอิน ตอบ Cache-Control no-store และ Referrer-Policy no-referrer (controller 53-54)
 *     ลิงก์ที่ยกเลิกแล้วตอบ 410 "Share link has been disabled" (211)
 *   - ยกเลิก (182-201): ตั้ง revoked_at ครั้งแรกครั้งเดียว ยกเลิกซ้ำได้เวลาเดิม
 *
 * ข้อมูลที่เขียน
 *   - ห้องถาวร E2E-QA-ROOM-1 ของ qa-agent สร้างรอบแรกรอบเดียว (findOrCreateQaRoom ใน src/write/qa-dataset.ts) พร้อมรูป 1 ไฟล์ใน Storage
 *   - ลิงก์ลบไม่ได้ (ไม่มีเส้นทางลบ มีแค่ยกเลิก) 1 รอบสร้าง 12 ลิงก์ ทุกลิงก์ถูกยกเลิกในข้อเดียวกัน และ afterAll ยกเลิกลิงก์ของรอบนี้ที่ยัง active
 *     แถวของลิงก์จึงค้างในตาราง room_share_links เป็นสถานะ revoked
 * ข้อควรระวัง: คำตอบตอนสร้างมี url ที่มี token (บรรทัด 147, 152-159) และ API พิมพ์ url นี้ลง log ของ API ด้วย (บรรทัด 149-151)
 *   เทสไม่พิมพ์ url, token หรือ URL ของรูปลงผลรัน: ตรวจรูปแบบเป็นจริง/เท็จ และเปิดหน้าแชร์ผ่าน PublicRoomShareApi
 *   ซึ่งไม่เก็บ URL และใช้ fetch แทนตัวส่งคำขอของ Playwright (Playwright บันทึกที่อยู่เต็มของทุกคำขอลงรายงาน HTML)
 *   token ใน log ของ API ใช้ไม่ได้แล้วเมื่อบรรทัดเก็บกวาดบอกว่า "ยัง active 0"
 * ยังไม่ได้เทส: ลิงก์หมดอายุ (410 "Share link has expired") เพราะลิงก์อายุสั้นสุด 1 วัน และหน้าเว็บ /s/[token]
 * ห้ามรันพร้อม npm test: tests/api/share-links.spec.ts นับลิงก์ของห้องก่อนและหลัง
 */

/** ส่วนที่ซ่อนได้ในหน้าแชร์ (RoomShareSections ใน entities/room-share-link.entity.ts) */
const SECTIONS = ['photos', 'price', 'facilities', 'location', 'contact'] as const;
type Section = (typeof SECTIONS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
/** ความคลาดเคลื่อนที่ยอมรับระหว่างเวลาของเครื่องที่รันเทสกับเวลาของ API */
const CLOCK_SLACK_MS = 2 * 60 * 1000;

/** token ของลิงก์: base64url ของ 32 ไบต์ ยาว 43 ตัว (common/share-link-token.ts บรรทัด 4-6) */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

interface CreatedLink {
  id: number;
  url: string;
  expiresAt: string;
  shareSections: Record<Section, boolean>;
  contactId: number | null;
  status: string;
}

/** ห้องถาวรของรอบนี้ (ตั้งใน beforeAll) */
let room: QaRoom | undefined;
/** id ของลิงก์ที่รอบนี้สร้าง ใช้เก็บกวาดใน afterAll */
const createdIds = new Set<number>();

function requireRoom(): QaRoom {
  if (room === undefined) throw new Error('beforeAll ยังไม่ได้เตรียมห้องถาวร');
  return room;
}

/**
 * สร้างลิงก์ แล้วคืนผลพร้อม token ที่ตัดจาก url (ไม่พิมพ์ url)
 * จำ id ไว้ทันทีที่ API ตอบรหัส 2xx ที่มี id ก่อนตรวจผลอื่น afterAll จึงยกเลิกให้แม้การตรวจต่อจากนี้ไม่ผ่าน
 */
async function createLink(api: ShareWriterSession, body: Record<string, unknown>): Promise<CreatedLink & { token: string }> {
  const { roomId } = requireRoom();
  const response = await api.shareLinks.create(roomId, body);
  // จำ id ก่อนตรวจรหัส: ถ้า API สร้างลิงก์แล้วตอบรหัส 2xx อื่น (เช่น 200) afterAll ยังยกเลิกลิงก์นั้นได้
  const parsed = response.ok() ? ((await response.json().catch(() => ({}))) as Partial<CreatedLink>) : {};
  if (Number.isInteger(parsed.id)) createdIds.add(parsed.id as number);
  expect(response.status(), 'POST /agent/listings/:id/share-links ต้องตอบ 201 (ไม่พิมพ์ที่อยู่และเนื้อคำตอบ)').toBe(201);
  const link = parsed as CreatedLink;
  const token = String(link.url ?? '').split('/s/')[1] ?? '';
  expect(TOKEN_FORMAT.test(token), 'url ต้องลงท้ายด้วย /s/<token ยาว 43 ตัว> (ไม่พิมพ์ url)').toBe(true);
  return { ...link, token };
}

async function revokeLink(api: ShareWriterSession, id: number): Promise<{ id: number; status: string; revokedAt: string }> {
  return expectJsonQuiet(await api.shareLinks.revoke(requireRoom().roomId, id), 200, 'DELETE /agent/listings/:id/share-links/:linkId');
}

async function listLinks(api: ShareWriterSession): Promise<ShareLinkSummary[]> {
  return (await expectJsonQuiet<{ items: ShareLinkSummary[] }>(await api.shareLinks.list(requireRoom().roomId), 200, 'GET /agent/listings/:id/share-links')).items;
}

/** เวลาหมดอายุต้องเท่ากับเวลาตอนสร้างบวกจำนวนวัน (shareLinkExpiresAt: common/share-link-token.ts บรรทัด 17-22) */
function expectExpiry(expiresAt: string, days: number, sentAt: number, receivedAt: number) {
  const at = Date.parse(expiresAt);
  expect(at, `วันหมดอายุต้องไม่ก่อน ${days} วันนับจากตอนส่งคำขอ`).toBeGreaterThanOrEqual(sentAt + days * DAY_MS - CLOCK_SLACK_MS);
  expect(at, `วันหมดอายุต้องไม่เกิน ${days} วันนับจากตอนได้คำตอบ`).toBeLessThanOrEqual(receivedAt + days * DAY_MS + CLOCK_SLACK_MS);
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const field = (value: unknown, key: string): unknown => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined);

/**
 * ส่วนนี้แสดงอยู่ในหน้าแชร์หรือไม่ เทียบกับข้อมูลของห้องถาวร (toPublicDto บรรทัด 252-366)
 * คืนรายการสิ่งที่ไม่ตรง (ว่าง = แสดงครบ) ข้อความไม่มี URL ของรูปหรือข้อมูลอื่นนอกจากข้อมูลสมมติของห้องถาวร
 */
function shownProblems(body: Record<string, unknown>, section: Section, contactIndex: 0 | 1): string[] {
  const problems: string[] = [];
  if (section === 'photos') {
    const medias = list(body.medias);
    if (medias.length !== 1) problems.push(`รูปต้องมี 1 รูป (ได้ ${medias.length})`);
    else if (field(medias[0], 'isCover') !== true || field(medias[0], 'mediaType') !== 'image' || !String(field(medias[0], 'mediaUrl')).endsWith('.jpg')) {
      problems.push('รูปต้องเป็นรูปปก ชนิด image และเป็นไฟล์ .jpg');
    }
  }
  if (section === 'price') {
    const prices = list(body.prices);
    const row = prices[0];
    if (prices.length !== 1 || field(row, 'contractTypeCode') !== QA_ROOM_TERMS.contractTypeCode || field(row, 'price') !== QA_ROOM_TERMS.price) {
      problems.push(`ราคาต้องมี 1 แถว ${QA_ROOM_TERMS.contractTypeCode} ${QA_ROOM_TERMS.price}`);
    }
    if (body.advanceRentMonths !== QA_ROOM_TERMS.advanceRentMonths || body.depositMonths !== QA_ROOM_TERMS.depositMonths) {
      problems.push(`ค่าเช่าล่วงหน้า/เงินประกันต้องเป็น ${QA_ROOM_TERMS.advanceRentMonths}/${QA_ROOM_TERMS.depositMonths} เดือน (ได้ ${String(body.advanceRentMonths)}/${String(body.depositMonths)})`);
    }
  }
  if (section === 'facilities') {
    const items = list(body.facilityItems);
    if (items.length !== 1 || !list(body.facilities).includes(field(items[0], 'code'))) problems.push(`สิ่งอำนวยความสะดวกต้องมี 1 รายการ (ได้ ${items.length})`);
    const custom = list(body.customFacilities);
    if (custom.length !== 1 || custom[0] !== QA_ROOM_EXTRAS.customFacility || !list(body.facilities).includes(QA_ROOM_EXTRAS.customFacility)) {
      problems.push('สิ่งอำนวยความสะดวกที่พิมพ์เองต้องแสดง 1 รายการ');
    }
  }
  if (section === 'location') {
    const property = body.property;
    if (field(property, 'address') !== QA_ROOM_LOCATION.address || field(property, 'subdistrict') !== QA_ROOM_LOCATION.subdistrict || field(property, 'postalCode') !== QA_ROOM_LOCATION.postalCode) {
      problems.push('ที่อยู่ แขวง และรหัสไปรษณีย์ของโครงการต้องแสดง');
    }
    if (Number(body.latitude) !== QA_ROOM_LOCATION.latitude || Number(body.longitude) !== QA_ROOM_LOCATION.longitude) problems.push('พิกัดต้องแสดง');
    if (field(property, 'latitude') === null || field(property, 'longitude') === null) problems.push('พิกัดของโครงการต้องแสดง');
    const places = list(body.nearbyPlaces);
    if (places.length !== 1 || field(places[0], 'name') !== QA_ROOM_EXTRAS.nearbyPin.name) problems.push(`สถานที่ใกล้เคียงต้องมี 1 แห่ง (ได้ ${places.length})`);
  }
  if (section === 'contact') {
    const contacts = list(body.contacts);
    const want = QA_ROOM_CONTACTS[contactIndex];
    if (contacts.length !== 1 || field(contacts[0], 'name') !== want.name || field(contacts[0], 'phone') !== want.phone || field(contacts[0], 'email') !== want.email) {
      problems.push(`ผู้ติดต่อต้องเป็น ${want.name} คนเดียว (ได้ ${contacts.length} คน)`);
    } else if (field(contacts[0], 'isPrimary') !== (contactIndex === 0)) {
      problems.push(`isPrimary ของ ${want.name} ต้องเป็น ${contactIndex === 0}`);
    }
  }
  return problems;
}

/** ส่วนนี้ถูกซ่อนหรือไม่ (toPublicDto: medias 267-269, prices 287-291, facilities 303-307, location 327-345, contacts 364-366) */
function hiddenProblems(body: Record<string, unknown>, section: Section): string[] {
  const problems: string[] = [];
  if (section === 'photos' && list(body.medias).length !== 0) problems.push('รูปต้องว่าง');
  if (section === 'price' && (list(body.prices).length !== 0 || body.advanceRentMonths !== 0 || body.depositMonths !== 0)) problems.push('ราคาต้องว่างและเดือนเป็น 0');
  if (section === 'facilities' && (list(body.facilityItems).length + list(body.facilities).length + list(body.customFacilities).length !== 0)) problems.push('สิ่งอำนวยความสะดวกต้องว่าง');
  if (section === 'location') {
    const property = body.property;
    const hidden = ['address', 'subdistrict', 'postalCode', 'latitude', 'longitude'].filter((key) => field(property, key) !== null);
    if (hidden.length > 0) problems.push(`ช่องของโครงการต้องเป็น null: ${hidden.join(', ')}`);
    if (body.latitude !== null || body.longitude !== null) problems.push('พิกัดของห้องต้องเป็น null');
    if (list(body.nearbyPlaces).length !== 0) problems.push('สถานที่ใกล้เคียงต้องว่าง');
    // ส่วนที่ยังแสดงเมื่อซ่อนที่ตั้ง: ชื่อโครงการ เขต และจังหวัด (บรรทัด 329-341)
    if (field(property, 'name') !== `${QA_ROOM_LABEL} Tower` || field(property, 'district') !== QA_ROOM_LOCATION.district) problems.push('ชื่อโครงการและเขตต้องยังแสดง');
  }
  if (section === 'contact' && list(body.contacts).length !== 0) problems.push('ผู้ติดต่อต้องว่าง');
  return problems;
}

/** ช่องภายในที่หน้าแชร์ต้องไม่เปิดเผยทุกกรณี (บรรทัด 368-374 ; ห้องถาวรมีค่า listingTitle, nearbyOther และเอกสาร 1 ฉบับ การตรวจจึงไม่ผ่านถ้าช่องเหล่านี้หลุด) */
function internalFieldProblems(body: Record<string, unknown>): string[] {
  const problems: string[] = [];
  for (const key of ['listingTitle', 'listingSourceCode', 'roomId', 'visibility', 'nearbyOther']) {
    if (body[key] !== null) problems.push(`${key} ต้องเป็น null`);
  }
  if (list(body.documents).length !== 0 || !Array.isArray(body.documents)) problems.push('documents ต้องเป็นรายการว่าง');
  return problems;
}

async function openPublic(api: ShareWriterSession, token: string): Promise<PublicShareResult> {
  return api.publicShares.open(token);
}

test.beforeAll(async ({ shareWriter }) => {
  const found = await findOrCreateQaRoom(shareWriter, (objectPath) => {
    test.info().annotations.push({ type: 'ไฟล์ที่อัป', description: `${objectPath} (รูปของห้องถาวร)` });
  });
  console.log(`[เทสเขียนข้อมูล] ห้องถาวร ${QA_ROOM_LABEL} id ${found.roomId}${found.created ? ' (สร้างใหม่รอบนี้ พร้อมรูป 1 ไฟล์)' : ''}`);
  room = found;
});

test.afterAll(async ({ shareWriter }) => {
  if (room === undefined || createdIds.size === 0) return;
  // เก็บกวาด: ยกเลิกลิงก์ของรอบนี้ที่ยัง active (ไม่แตะลิงก์ที่รอบนี้ไม่ได้สร้าง)
  const before = (await listLinks(shareWriter)).filter((link) => createdIds.has(link.id));
  const active = before.filter((link) => link.status === 'active');
  for (const link of active) await revokeLink(shareWriter, link.id);
  const after = (await listLinks(shareWriter)).filter((link) => createdIds.has(link.id));
  const stillActive = after.filter((link) => link.status === 'active').map((link) => link.id);
  console.log(`[เทสเขียนข้อมูล] ลิงก์แชร์ของรอบนี้ ${createdIds.size} ลิงก์ | ยกเลิกตอนเก็บกวาด ${active.length} | ยัง active ${stillActive.length}`);
  expect(after.length, 'ลิงก์ทุกอันที่รอบนี้สร้างต้องอยู่ในรายการของห้อง').toBe(createdIds.size);
  expect(stillActive, 'ลิงก์ของรอบนี้ต้องไม่เหลือ active (id ตามนี้)').toEqual([]);
});

test('creating a link with no options gives an active 7-day link with every section and the primary contact', async ({ shareWriter }) => {
  // ขั้นที่ 1: สร้างลิงก์ด้วยเนื้อคำขอว่าง
  const sentAt = Date.now();
  const link = await createLink(shareWriter, {});
  const receivedAt = Date.now();
  try {
    // ขั้นที่ 2: คำตอบ: active, 7 วัน, ทุกส่วนเปิด, ผู้ติดต่อหลัก (บรรทัด 121-131)
    expect(link.status).toBe('active');
    expectExpiry(link.expiresAt, 7, sentAt, receivedAt);
    expect(link.shareSections).toEqual({ photos: true, price: true, facilities: true, location: true, contact: true });
    expect(link.contactId, 'ผู้ติดต่อตั้งต้นต้องเป็นผู้ติดต่อหลักของห้อง (Contact A)').toBe(requireRoom().contactIds[0]);

    // ขั้นที่ 3: รายการลิงก์ของห้อง: ลิงก์ใหม่อยู่บนสุด (เรียง id มากไปน้อย: บรรทัด 164-167) ข้อมูลตรงกับคำตอบตอนสร้าง และไม่มี token หรือ url
    const items = await listLinks(shareWriter);
    expect(items[0]?.id, 'ลิงก์ใหม่ต้องอยู่บนสุดของรายการ').toBe(link.id);
    // ตรวจว่าไม่มี token หรือ url ก่อน toMatchObject เพราะถ้า toMatchObject ไม่ผ่าน Playwright จะพิมพ์ทั้งแถว
    expect('token' in items[0] || 'url' in items[0], 'รายการต้องไม่มี token หรือ url').toBe(false);
    expect(items[0]).toMatchObject({ status: 'active', revokedAt: null, expiresAt: link.expiresAt, contactId: link.contactId, shareSections: link.shareSections });
  } finally {
    await revokeLink(shareWriter, link.id);
  }
});

test('the public page opens without login, shows every section of the room and hides internal fields', async ({ shareWriter }) => {
  const { roomId } = requireRoom();
  const link = await createLink(shareWriter, {});
  try {
    // ขั้นที่ 1: เปิดหน้าแชร์โดยไม่ล็อกอิน
    const page = await openPublic(shareWriter, link.token);
    expect(page.status, 'หน้าแชร์ของลิงก์ที่ใช้ได้ต้องตอบ 200').toBe(200);
    expect(page.cacheControl).toBe('no-store');
    expect(page.referrerPolicy).toBe('no-referrer');

    // ขั้นที่ 2: เป็นห้องเดียวกัน วันหมดอายุตรงกับลิงก์ และทุกส่วนแสดงครบตามข้อมูลของห้องถาวร
    expect(page.body.id, 'หน้าแชร์ต้องเป็นห้องถาวร').toBe(roomId);
    expect(page.body.expiresAt).toBe(link.expiresAt);
    expect(page.body.shareSections).toEqual(link.shareSections);
    expect(SECTIONS.flatMap((section) => shownProblems(page.body, section, 0)), 'ทุกส่วนต้องแสดงตามข้อมูลของห้องถาวร').toEqual([]);

    // ขั้นที่ 3: ช่องภายในต้องไม่เปิดเผย
    expect(internalFieldProblems(page.body)).toEqual([]);
  } finally {
    await revokeLink(shareWriter, link.id);
  }
});

for (const section of SECTIONS) {
  test(`turning off ${section} hides only that part of the public page`, async ({ shareWriter }) => {
    // ขั้นที่ 1: สร้างลิงก์ที่ปิดส่วนนี้ส่วนเดียว
    const link = await createLink(shareWriter, { shareSections: { [section]: false } });
    try {
      expect(link.shareSections[section], `${section} ในคำตอบต้องเป็น false`).toBe(false);
      expect(SECTIONS.filter((other) => other !== section).every((other) => link.shareSections[other]), 'ส่วนอื่นต้องยังเป็น true').toBe(true);
      // ปิดส่วนผู้ติดต่อและไม่ส่ง contactId: API ไม่เลือกผู้ติดต่อให้ (บรรทัด 113-131)
      expect(link.contactId, 'contactId').toBe(section === 'contact' ? null : requireRoom().contactIds[0]);

      // ขั้นที่ 2: หน้าแชร์ต้องซ่อนส่วนนี้ และส่วนอื่นยังแสดงครบ
      const page = await openPublic(shareWriter, link.token);
      expect(page.status).toBe(200);
      expect(hiddenProblems(page.body, section), `${section} ต้องถูกซ่อน`).toEqual([]);
      expect(
        SECTIONS.filter((other) => other !== section).flatMap((other) => shownProblems(page.body, other, 0)),
        'ส่วนอื่นต้องยังแสดง',
      ).toEqual([]);
      expect(internalFieldProblems(page.body)).toEqual([]);
    } finally {
      await revokeLink(shareWriter, link.id);
    }
  });
}

test('a link for the second contact shows only that contact', async ({ shareWriter }) => {
  const second = requireRoom().contactIds[1];
  // ขั้นที่ 1: สร้างลิงก์ที่เลือกผู้ติดต่อคนที่ 2 (ตรวจว่าเป็นผู้ติดต่อของห้อง: บรรทัด 86-96, 113-120)
  const link = await createLink(shareWriter, { contactId: second });
  try {
    expect(link.contactId).toBe(second);
    // ขั้นที่ 2: หน้าแชร์ต้องแสดงคนที่ 2 คนเดียว และไม่ใช่ผู้ติดต่อหลัก
    const page = await openPublic(shareWriter, link.token);
    expect(page.status).toBe(200);
    expect(shownProblems(page.body, 'contact', 1)).toEqual([]);
  } finally {
    await revokeLink(shareWriter, link.id);
  }
});

test('hiding the contact section also hides a contact that was chosen by id', async ({ shareWriter }) => {
  const primary = requireRoom().contactIds[0];
  // ขั้นที่ 1: ปิดส่วนผู้ติดต่อแต่ส่ง contactId ด้วย API ยังบันทึก contactId (บรรทัด 113-120 ตรวจและเก็บ id โดยไม่ดูว่าส่วนนี้ปิด)
  //   ข้อนี้ต่างจากข้อ "turning off contact" ซึ่ง contactId เป็น null หน้าแชร์จึงว่างอยู่แล้วแม้ไม่ได้ซ่อน
  const link = await createLink(shareWriter, { shareSections: { contact: false }, contactId: primary });
  try {
    expect(link.shareSections.contact).toBe(false);
    expect(link.contactId, 'contactId ที่ส่งต้องถูกบันทึก').toBe(primary);
    // ขั้นที่ 2: หน้าแชร์ต้องไม่แสดงผู้ติดต่อ (บรรทัด 347-366 แสดงเฉพาะเมื่อส่วนนี้เปิด)
    const page = await openPublic(shareWriter, link.token);
    expect(page.status).toBe(200);
    expect(hiddenProblems(page.body, 'contact')).toEqual([]);
  } finally {
    await revokeLink(shareWriter, link.id);
  }
});

for (const days of [1, 30]) {
  test(`a link that lasts ${days} day${days === 1 ? '' : 's'} expires ${days} day${days === 1 ? '' : 's'} after it is created`, async ({ shareWriter }) => {
    // ขั้นที่ 1: สร้างลิงก์ที่อายุเท่าค่าขอบ (1 และ 30 วัน: บรรทัด 25-26)
    const sentAt = Date.now();
    const link = await createLink(shareWriter, { expiresInDays: days });
    const receivedAt = Date.now();
    try {
      // ขั้นที่ 2: วันหมดอายุในคำตอบและในรายการต้องตรงกับจำนวนวัน
      expectExpiry(link.expiresAt, days, sentAt, receivedAt);
      expect((await listLinks(shareWriter)).find((item) => item.id === link.id)?.expiresAt).toBe(link.expiresAt);
    } finally {
      await revokeLink(shareWriter, link.id);
    }
  });
}

test('a revoked link answers 410 on the public page, shows as revoked, and revoking again keeps the first time', async ({ shareWriter }) => {
  const link = await createLink(shareWriter, {});
  // ขั้นที่ 1: ก่อนยกเลิก หน้าแชร์เปิดได้ (ตัวคุม: ยืนยันว่า 410 ด้านล่างมาจากการยกเลิก ไม่ใช่ลิงก์เสียตั้งแต่ต้น)
  expect((await openPublic(shareWriter, link.token)).status, 'ก่อนยกเลิกต้องเปิดได้').toBe(200);

  // ขั้นที่ 2: ยกเลิก ต้องได้ 200 สถานะ revoked และเวลายกเลิกอยู่ระหว่างตอนส่งคำขอกับตอนได้คำตอบ (บรรทัด 193)
  const revokeSentAt = Date.now();
  const first = await revokeLink(shareWriter, link.id);
  const revokeReceivedAt = Date.now();
  expect(first.id).toBe(link.id);
  expect(first.status).toBe('revoked');
  const revokedAt = Date.parse(first.revokedAt);
  expect(revokedAt, 'revokedAt ต้องไม่ก่อนตอนส่งคำขอยกเลิก').toBeGreaterThanOrEqual(revokeSentAt - CLOCK_SLACK_MS);
  expect(revokedAt, 'revokedAt ต้องไม่หลังตอนได้คำตอบ').toBeLessThanOrEqual(revokeReceivedAt + CLOCK_SLACK_MS);

  // ขั้นที่ 3: หน้าแชร์ต้องตอบ 410 พร้อมข้อความ (บรรทัด 211) และยังไม่ cache
  const page = await openPublic(shareWriter, link.token);
  expect(page.status, 'ลิงก์ที่ยกเลิกแล้วต้องตอบ 410').toBe(410);
  expect(page.body.message).toBe('Share link has been disabled');
  expect(page.cacheControl).toBe('no-store');
  expect(page.body.id, 'คำตอบ 410 ต้องไม่มีข้อมูลห้อง').toBeUndefined();

  // ขั้นที่ 4: รายการแสดง revoked ด้วยเวลาเดียวกัน
  const item = (await listLinks(shareWriter)).find((row) => row.id === link.id);
  expect(item?.status).toBe('revoked');
  expect(item?.revokedAt).toBe(first.revokedAt);

  // ขั้นที่ 5: ยกเลิกซ้ำได้ 200 และเวลาเดิม (บรรทัด 192-195 บันทึกเฉพาะเมื่อยังไม่เคยยกเลิก)
  const again = await revokeLink(shareWriter, link.id);
  expect(again.revokedAt, 'ยกเลิกซ้ำต้องได้เวลายกเลิกครั้งแรก').toBe(first.revokedAt);
});
