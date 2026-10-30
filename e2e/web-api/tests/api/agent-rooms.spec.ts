import type {
  ContractTypeOption,
  FacilityOption,
  PropertyRow,
  PropertyTypeOption,
  RoomPartyOption,
  RoomTypeOption,
} from '../../src/api/types';
import type { UploadFile } from '../../src/api/rooms.api';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';

/**
 * ห้องของนายหน้า กลุ่ม /agent/rooms: ข้อมูลประกอบฟอร์มห้อง (GET) และคำขอสร้างหรือแก้ห้องที่ต้องถูกปฏิเสธ
 * ที่มาของค่าที่คาด: apps/api/src/agent/rooms/*.ts ที่ develop bc77a8b (qa/e2e ecc39f6) และผลยิงจริงในห้องทดลอง 30 ต.ค. 2026
 *
 * สิ่งที่ต้องมีก่อน
 *   - ล็อกอินแบบนักพัฒนาได้ (ดู auth.spec.ts) ผู้เรียกคือ fixture agent = qa-agent
 *   - ฐานข้อมูลมีข้อมูลกลาง (ประเภทโครงการ ประเภทสัญญา ประเภทห้อง สิ่งอำนวยความสะดวก) ตาม supabase/seed/masters.sql
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   - GET ทั้ง 7 เส้นทางอ่านอย่างเดียว (agent-rooms.service.ts 54-197)
 *   - POST และ PATCH: ส่งเนื้อคำขอที่ผิด ซึ่ง validateCreateBody ปฏิเสธก่อนเปิด transaction (service 415-588)
 *     หรือ PATCH ห้องที่ไม่มีจริง ซึ่งหาห้องไม่เจอและตอบ 404 ก่อนบันทึก (service 203-208)
 *   - media/upload และ media/enhance: ส่งแบบไม่มีไฟล์ หรือไฟล์ที่ไม่ใช่รูป normalizeJpeg ปฏิเสธก่อนเขียน Storage หรือเรียก Claid
 *     (room-photo-storage.service.ts 44-58, 72-80) ไม่ส่งรูปจริงเด็ดขาด
 *   - generate-listing-promo: ส่งเฉพาะ listing ที่ไม่ใช่ object ซึ่งถูกปฏิเสธก่อนเรียก Gemini (listing-promo.service.ts 194-199)
 *     ไม่ส่ง listing ที่เป็น object แม้คำขอนั้นจะถูกปฏิเสธด้วยเหตุอื่น เพราะถ้าตัวตรวจถัดไปถูกเปลี่ยน คำขอจะไปถึง Gemini ซึ่งมีค่าใช้จ่าย
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id (integer ของ PostgreSQL) เก็บได้ = 2^31 - 1 ใช้เป็น id ที่ไม่มีอยู่จริง */
const NO_SUCH_ID = 2_147_483_647;

/** ข้อความของ DatabaseIdPipe (apps/api/src/common/database-id.pipe.ts) เมื่อ id อยู่นอกช่วง 1 ถึง 2147483647 */
const ID_OUT_OF_RANGE = 'ID must be an integer between 1 and 2147483647';

/** กลุ่มสิ่งอำนวยความสะดวกที่ GET facilities คืน (agent-rooms.service.ts 89-109) */
const FACILITY_GROUPS = ['furniture', 'appliances', 'room_features', 'parking', 'project_facilities', 'security_services'];

/**
 * เนื้อคำขอห้องที่ผ่าน validateCreateBody ครบทุกข้อ (ยืนยันในห้องทดลองว่าได้ 404 Room not found กับห้องที่ไม่มีจริง)
 * ใช้กับ PATCH ห้องที่ไม่มีจริงเท่านั้น: ถ้าส่งไปที่ห้องจริงจะเขียนทับห้องนั้น และถ้าส่งไป POST จะสร้างห้องใหม่
 * ไม่มีช่อง contacts หรือ contact (ซึ่งจะสร้างผู้ติดต่อใหม่ใน resolveContactIds service 607-634)
 * contactIds เป็น 2147483647 ซึ่งไม่มีจริง เป็นด่านที่ 2: ถ้าการหาห้อง (service 208) หายไป
 * resolveContactIds ตอบ 404 'contactId not found for this agent' (service 597-603) ก่อนบันทึกห้องที่บรรทัด 282
 */
const VALID_ROOM_BODY = {
  visibility: 'private',
  contactIds: [NO_SUCH_ID],
  propertyId: 1,
  listingTitle: 'E2E-never-saved',
  roomTypeId: 1,
  listingSourceCode: 'owner',
  layout: [
    { code: 'bedroom', value: '1' },
    { code: 'bathroom', value: '1' },
  ],
  prices: [{ contractTypeId: 1, price: 1000, advanceRentMonths: 1, depositMonths: 1 }],
};

/** ไฟล์ข้อความที่ตั้งชื่อเป็น .jpg: sharp อ่านเป็นรูปไม่ได้ API จึงปฏิเสธก่อนเขียน */
const NOT_AN_IMAGE = { name: 'e2e-not-an-image.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('this is not an image') };

/** ตรวจว่ารายการไม่ว่าง และค่าในช่องที่ระบุไม่ซ้ำกัน */
function expectNonEmptyUnique<T>(items: T[], key: (item: T) => unknown, label: string): void {
  expect(Array.isArray(items), `${label} ต้องเป็นรายการ`).toBe(true);
  expect(items.length, `${label} ต้องมีอย่างน้อย 1 รายการ (ข้อมูลกลางจาก supabase/seed/masters.sql)`).toBeGreaterThan(0);
  const keys = items.map(key);
  expect(new Set(keys).size, `${label} มีค่าซ้ำ`).toBe(keys.length);
}

test.describe('reference lists for the room form', () => {
  test('GET /agent/rooms/property-types lists types with a unique id and code', async ({ agent }) => {
    // ขั้นที่ 1: อ่านรายการ
    const items = await expectJson<PropertyTypeOption[]>(await agent.rooms.propertyTypes(), 200);
    // ขั้นที่ 2: ไม่ว่าง id กับ code ไม่ซ้ำ และชนิดถูก
    expectNonEmptyUnique(items, (item) => item.id, 'property-types id');
    expectNonEmptyUnique(items, (item) => item.code, 'property-types code');
    for (const item of items) {
      expect(Number.isInteger(item.id) && item.id > 0).toBe(true);
      expect(typeof item.code).toBe('string');
    }
    // ขั้นที่ 3: เรียงตาม id (service 72-75)
    const ids = items.map((item) => item.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  test('GET /agent/rooms/contract-types lists active types with a positive term', async ({ agent }) => {
    // ขั้นที่ 1: อ่านรายการ
    const items = await expectJson<ContractTypeOption[]>(await agent.rooms.contractTypes(), 200);
    // ขั้นที่ 2: ไม่ว่าง ไม่ซ้ำ และระยะสัญญาเป็นจำนวนเดือนที่มากกว่า 0
    expectNonEmptyUnique(items, (item) => item.id, 'contract-types id');
    expectNonEmptyUnique(items, (item) => item.code, 'contract-types code');
    for (const item of items) {
      expect(Number.isInteger(item.termMonths) && item.termMonths > 0, `${item.code} termMonths ${item.termMonths}`).toBe(true);
    }
  });

  test('GET /agent/rooms/room-types lists active types with a bedroom count or null', async ({ agent }) => {
    // ขั้นที่ 1: อ่านรายการ
    const items = await expectJson<RoomTypeOption[]>(await agent.rooms.roomTypes(), 200);
    // ขั้นที่ 2: ไม่ว่าง ไม่ซ้ำ และ bedroomCount เป็นจำนวนเต็มไม่ติดลบ หรือ null (เช่น duplex, penthouse ใน masters.sql)
    expectNonEmptyUnique(items, (item) => item.id, 'room-types id');
    expectNonEmptyUnique(items, (item) => item.code, 'room-types code');
    for (const item of items) {
      const count = item.bedroomCount;
      expect(count === null || (Number.isInteger(count) && count >= 0), `${item.code} bedroomCount ${count}`).toBe(true);
    }
  });

  test('GET /agent/rooms/facilities lists facilities of the six room-form groups only', async ({ agent }) => {
    // ขั้นที่ 1: อ่านรายการ
    const items = await expectJson<FacilityOption[]>(await agent.rooms.facilities(), 200);
    // ขั้นที่ 2: code ไม่ซ้ำ กลุ่มอยู่ใน 6 กลุ่มที่ service กรอง และ isExtraCharge เป็น boolean
    expectNonEmptyUnique(items, (item) => item.code, 'facilities code');
    for (const item of items) {
      expect(FACILITY_GROUPS, `${item.code}`).toContain(item.groupCode);
      expect(typeof item.isExtraCharge, `${item.code}`).toBe('boolean');
    }
  });

  test('GET /agent/rooms/properties lists properties with a unique id', async ({ agent }) => {
    // ขั้นที่ 1: อ่านรายการ (qa-agent มีห้อง จึงได้โครงการที่ห้องของ qa-agent ใช้: service 54-67)
    const items = await expectJson<PropertyRow[]>(await agent.rooms.properties(), 200);
    // ขั้นที่ 2: ไม่ว่าง และ id เป็นจำนวนเต็มบวกที่ไม่ซ้ำ (ไม่ตรวจชื่อหรือที่อยู่ เพราะเป็นข้อมูลของทีม)
    expectNonEmptyUnique(items, (item) => item.id, 'properties id');
    for (const item of items) expect(Number.isInteger(item.id) && item.id > 0).toBe(true);
  });

  for (const list of [
    { name: 'contacts', call: (agent: ApiSession) => agent.rooms.contacts() },
    { name: 'property-owners', call: (agent: ApiSession) => agent.rooms.propertyOwners() },
  ]) {
    test(`GET /agent/rooms/${list.name} lists records with a unique id and a room count`, async ({ agent }) => {
      // ขั้นที่ 1: อ่านรายการ (กรองเฉพาะที่ qa-agent สร้าง: service 123-197) ว่างได้
      const items = await expectJson<RoomPartyOption[]>(await list.call(agent), 200);
      expect(Array.isArray(items)).toBe(true);
      if (items.length === 0) {
        test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: `qa-agent ยังไม่มี ${list.name} จึงตรวจได้แค่ว่าตอบเป็นรายการ` });
      }
      // ขั้นที่ 2: ตรวจเฉพาะ id, roomCount และชนิดของชื่อ ไม่เทียบค่า (เป็นข้อมูลส่วนตัว ถ้าเทสไม่ผ่าน Playwright จะพิมพ์ค่าที่เทียบ)
      const ids = items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of items) {
        expect(Number.isInteger(item.id) && item.id > 0).toBe(true);
        expect(Number.isInteger(item.roomCount) && item.roomCount >= 0).toBe(true);
        expect(typeof item.name).toBe('string');
      }
    });
  }

  test('GET /agent/rooms/property-types answers 401 without login', async ({ anonymous }) => {
    // ขั้นที่ 1: เรียกรายการประเภทโครงการโดยไม่ส่งหัวข้อ Authorization
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: AuthGuard ระดับ class (agent-rooms.controller.ts 27-29) ไม่มี Bearer token ได้ 401 (auth/guards/auth.guard.ts:39,44)
    expect(await expectError(await anonymous.rooms.propertyTypes(), 401)).toBe('Missing Bearer token');
  });
});

test.describe('creating or editing a room is refused before anything is saved', () => {
  test('POST /agent/rooms without a body answers 400', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง POST สร้างห้องโดยไม่มีเนื้อคำขอ
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: validateRoomInput ตรวจก่อนทุกอย่าง (room-input.ts 26-67) ก่อนเปิด transaction (service 203)
    expect(await expectError(await agent.rooms.create(), 400)).toBe('body must be an object');
  });

  test('POST /agent/rooms with an empty object answers 400 for the missing visibility', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง POST สร้างห้องด้วย object ว่าง
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: ข้อแรกของ validateCreateBody ที่ {} ไม่ผ่าน (agent-rooms.service.ts 453-455) ก่อนเปิด transaction (203)
    expect(await expectError(await agent.rooms.create({}), 400)).toBe('visibility must be private or published');
  });

  test('POST /agent/rooms without a contact answers 400', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง POST สร้างห้องที่มีแค่ visibility
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: ข้อถัดไปหลัง visibility: ต้องระบุผู้ติดต่อ (agent-rooms.service.ts 456-468)
    expect(await expectError(await agent.rooms.create({ visibility: 'private' }), 400)).toBe(
      'contactIds, contactId, contacts, or contact{name,phone} required',
    );
  });

  test('PATCH /agent/rooms/:id answers 404 for a room that does not exist, even with a valid body', async ({ agent }) => {
    // ขั้นที่ 1: เนื้อคำขอผ่านการตรวจครบ จึงไปถึงขั้นหาห้องของนายหน้า
    // ขั้นที่ 2: หาห้อง 2147483647 ไม่เจอ ต้องได้ 404 ก่อนบันทึก (service 203-208 ; ด่านที่ 2 คือ contactIds ดู VALID_ROOM_BODY)
    expect(await expectError(await agent.rooms.update(NO_SUCH_ID, VALID_ROOM_BODY), 404)).toBe('Room not found');
  });

  for (const id of ['0', '2147483648']) {
    test(`PATCH /agent/rooms/${id} answers 400 for an id out of range`, async ({ agent }) => {
      // ขั้นที่ 1: ส่ง PATCH ไปห้อง id นอกช่วง พร้อมเนื้อคำขอที่ถูก
      // ขั้นที่ 2: ต้องถูกปฏิเสธ: DatabaseIdPipe ตรวจ id ก่อนเรียก service
      expect(await expectError(await agent.rooms.update(id, VALID_ROOM_BODY), 400)).toBe(ID_OUT_OF_RANGE);
    });
  }

  test('PATCH /agent/rooms/abc answers 400 for an id that is not a number', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง PATCH ไปห้อง id ที่ไม่ใช่ตัวเลข
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: ParseIntPipe ของ NestJS ตอบ 400 (ข้อความ "Validation failed (numeric string is expected)" ในห้องทดลอง ตรวจแค่รหัสแบบชุดเทสเดิม)
    await expectError(await agent.rooms.update('abc', VALID_ROOM_BODY), 400);
  });
});

test.describe('photo upload and enhance refuse anything that is not an image', () => {
  const routes = [
    {
      name: 'media/upload',
      withoutFile: (agent: ApiSession) => agent.rooms.uploadWithoutFile(),
      multipart: (agent: ApiSession, form: Record<string, string | UploadFile>) =>
        agent.rooms.uploadMultipart(form),
    },
    {
      name: 'media/enhance',
      withoutFile: (agent: ApiSession) => agent.rooms.enhanceWithoutFile(),
      multipart: (agent: ApiSession, form: Record<string, string | UploadFile>) =>
        agent.rooms.enhanceMultipart(form),
    },
  ];
  for (const route of routes) {
    test(`POST /agent/rooms/${route.name} without a file answers 400`, async ({ agent }) => {
      // ขั้นที่ 1: ส่งคำขอแบบ JSON ที่ไม่แนบไฟล์
      // ขั้นที่ 2: ต้องถูกปฏิเสธ: normalizeJpeg: ไม่มีไฟล์ (room-photo-storage.service.ts:45) ก่อนเขียน Storage (60-61) หรือเรียก Claid (93-119)
      expect(await expectError(await route.withoutFile(agent), 400)).toBe('Choose an image file');
    });

    test(`POST /agent/rooms/${route.name} with a file that is not an image answers 400`, async ({ agent }) => {
      // ขั้นที่ 1: แนบไฟล์ข้อความที่ตั้งชื่อเป็น .jpg
      // ขั้นที่ 2: ต้องถูกปฏิเสธ: normalizeJpeg: sharp อ่านไฟล์ไม่ได้ (บรรทัด 56) ก่อนเขียน Storage หรือเรียก Claid
      expect(await expectError(await route.multipart(agent, { file: NOT_AN_IMAGE }), 400)).toBe(
        'Use a valid JPEG, PNG or WebP image (up to 40 megapixels)',
      );
    });

    test(`POST /agent/rooms/${route.name} with an extra text field answers 400`, async ({ agent }) => {
      // ขั้นที่ 1: ส่ง multipart ที่มีแค่ช่องข้อความ ไม่มีไฟล์
      // ขั้นที่ 2: ต้องถูกปฏิเสธ: FileInterceptor ตั้ง limits fields 0 (agent-rooms.controller.ts 74, 83) multer ปฏิเสธช่องข้อความ
      // ตรวจข้อความของ multer (ยืนยันในห้องทดลอง 30 ต.ค. 2026) ถ้า fields 0 หายไป คำขอจะไปถึง normalizeJpeg และได้ 'Choose an image file' แทน
      expect(await expectError(await route.multipart(agent, { caption: 'e2e' }), 400)).toBe('Too many fields');
    });
  }
});

test.describe('listing promo generation is refused before the AI is called', () => {
  for (const body of [{}, { listing: [] }, { listing: 'e2e' }]) {
    test(`POST /agent/rooms/generate-listing-promo with ${JSON.stringify(body)} answers 400`, async ({ agent }) => {
      // ขั้นที่ 1: ส่งเนื้อคำขอที่ listing ไม่ใช่ object
      // ขั้นที่ 2: ต้องถูกปฏิเสธ: listing ต้องเป็น object (listing-promo.service.ts 197-199) ตรวจก่อนเรียก Gemini
      expect(await expectError(await agent.rooms.generatePromo(body), 400)).toBe('listing must be an object');
    });
  }
});
