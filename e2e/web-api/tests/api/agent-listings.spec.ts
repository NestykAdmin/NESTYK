import type { ListingDetail, ListingSummary, Paginated } from '../../src/api/types';
import { expect, test } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  isAscending,
  isDescending,
  pagingFallbackCases,
  walkAllPages,
} from '../../src/support/pagination';

/**
 * รายการห้องของนายหน้า (GET /agent/listings) และรายละเอียดห้อง (GET /agent/listings/:id)
 *
 * สิ่งที่ต้องมีก่อน
 *   - ล็อกอินแบบนักพัฒนาได้ (ดู auth.spec.ts)
 *   - บัญชีตัวอย่างมีห้องอย่างน้อย 1 ห้อง (ข้อมูลตัวอย่างของทีมให้ 30 ห้อง)
 * เทสไฟล์นี้อ่านอย่างเดียว และไม่ผูกกับจำนวนห้องที่แน่นอน จึงยังใช้ได้เมื่อข้อมูลตัวอย่างเปลี่ยน
 */

/** ค่า visibility ที่ฐานข้อมูลยอมให้ห้องของนายหน้ามีได้ (ข้อบังคับ chk_rent_rooms_scout_invariant) */
const VISIBILITIES = ['private', 'published'];

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id (ชนิด integer ของ PostgreSQL) เก็บได้ = 2^31 - 1 */
const INT32_MAX = 2_147_483_647;

/** ราคาต่ำสุดของห้อง: API ใช้ค่านี้ทั้งตอนเรียงตามราคาและตอนกรองช่วงราคา */
function lowestPrice(listing: ListingSummary): number {
  return Math.min(...listing.prices.map((row) => row.price));
}

test.describe('GET /agent/listings', () => {
  test('returns the first page with default paging', { tag: '@smoke' }, async ({ agent }) => {
    // ขั้นที่ 1: เรียกรายการห้องโดยไม่ส่งค่าแบ่งหน้า
    const body = await expectJson<Paginated<ListingSummary>>(await agent.listings.list(), 200);

    // ขั้นที่ 2: ต้องได้หน้า 1 ขนาดหน้าเริ่มต้น และมีห้องอย่างน้อย 1 ห้อง (จากข้อมูลตัวอย่าง)
    expect(body.page).toBe(1);
    expect(body.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(body.total, 'บัญชีตัวอย่างต้องมีห้องอย่างน้อย 1 ห้อง ถ้าเป็น 0 ให้ใส่ข้อมูลตัวอย่างของทีมก่อน').toBeGreaterThan(0);

    // ขั้นที่ 3: จำนวนรายการในหน้านี้ = ค่าที่น้อยกว่าระหว่าง total กับขนาดหน้า
    expect(body.items).toHaveLength(Math.min(body.total, DEFAULT_PAGE_SIZE));
  });

  test('every room carries the fields the listing screen needs', async ({ agent }) => {
    // ขั้นที่ 1: ดึงห้องมาให้มากที่สุดใน 1 หน้า
    const body = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit: MAX_PAGE_SIZE }), 200);

    // ขั้นที่ 2: ตรวจทีละห้อง
    for (const room of body.items) {
      const label = `ห้อง id ${room.id}`;
      expect(Number.isInteger(room.id) && room.id > 0, label).toBe(true);
      // เส้นทางนี้คืนเฉพาะห้องที่นายหน้าลงเอง (scout room) ซึ่งต้องมีสถานะการเผยแพร่เสมอ
      expect(room.isScoutRoom, label).toBe(true);
      expect(VISIBILITIES, label).toContain(room.visibility);
      // ราคาต้องเป็นตัวเลขที่ไม่ติดลบ
      for (const row of room.prices) {
        expect(Number.isFinite(row.price) && row.price >= 0, `${label} ราคา ${row.price}`).toBe(true);
      }
      // รูปปก: ไม่มีก็ได้ แต่ถ้ามีต้องเป็นที่อยู่แบบ http หรือ https
      if (room.coverMediaUrl !== null) expect(room.coverMediaUrl, label).toMatch(/^https?:\/\//);
      // เวลาแก้ไขล่าสุดต้องอ่านเป็นวันเวลาได้
      expect(Number.isNaN(Date.parse(room.updatedAt ?? '')), label).toBe(false);
    }

    // ขั้นที่ 3: ใน 1 หน้าต้องไม่มีห้องซ้ำ
    const ids = body.items.map((room) => room.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('pages do not overlap and together contain every room', async ({ agent }) => {
    // ขั้นที่ 1: อ่าน total ก่อน แล้วเลือกขนาดหน้าที่ทำให้ได้ประมาณ 3 หน้า (ไม่เกินเพดานของ API)
    const { total } = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit: 1 }), 200);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.ceil(total / 3)));
    test.skip(total > MAX_PAGE_SIZE * 20, `มี ${total} ห้อง มากเกินกว่าจะเดินอ่านทุกหน้าในเทสข้อเดียว`);

    // ขั้นที่ 2: เดินอ่านทุกหน้า
    const walk = await walkAllPages((query) => agent.listings.list(query), limit);

    // ขั้นที่ 3: จำนวนที่อ่านได้ต้องเท่ากับ total และไม่มี id ซ้ำข้ามหน้า
    expect(walk.ids).toHaveLength(walk.total);
    expect(new Set(walk.ids).size).toBe(walk.total);

    // ขั้นที่ 4: ทุกหน้าต้องเต็ม ยกเว้นหน้าสุดท้ายที่มีเท่าที่เหลือ
    const lastPageSize = walk.total - limit * (walk.pageSizes.length - 1);
    expect(walk.pageSizes.slice(0, -1).every((size) => size === limit)).toBe(true);
    expect(walk.pageSizes.at(-1)).toBe(lastPageSize);
  });

  test('a page past the end is empty but still reports the total', async ({ agent }) => {
    // ขั้นที่ 1: หาหมายเลขหน้าที่เลยหน้าสุดท้าย = ปัดขึ้น(total / limit) + 1
    const limit = 5;
    const first = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit }), 200);
    const pagePastEnd = Math.ceil(first.total / limit) + 1;

    // ขั้นที่ 2: ขอหน้านั้น ต้องได้รายการว่าง โดย total ยังเท่าเดิม (แอปใช้ total บอกว่ามีทั้งหมดกี่ห้อง)
    const body = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit, page: pagePastEnd }), 200);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(first.total);
    expect(body.page).toBe(pagePastEnd);
  });

  for (const paging of pagingFallbackCases) {
    test(`paging: ${paging.title}`, async ({ agent }) => {
      // ขั้นที่ 1: ส่งค่าแบ่งหน้าที่ใช้ไม่ได้   ขั้นที่ 2: API ต้องไม่ล้ม และตอบด้วยค่าที่ปรับให้ปลอดภัยแล้ว
      const body = await expectJson<Paginated<ListingSummary>>(await agent.listings.list(paging.query), 200);
      expect({ page: body.page, limit: body.limit }).toEqual(paging.expected);
      expect(body.items.length).toBeLessThanOrEqual(paging.expected.limit);
    });
  }

  test('sort=price_asc puts the cheapest room first', async ({ agent }) => {
    // ขั้นที่ 1: ขอรายการเรียงตามราคาจากน้อยไปมาก
    const body = await expectJson<Paginated<ListingSummary>>(
      await agent.listings.list({ sort: 'price_asc', limit: MAX_PAGE_SIZE }),
      200,
    );
    const priced = body.items.filter((room) => room.prices.length > 0);

    // ขั้นที่ 2: ราคาต่ำสุดของแต่ละห้องต้องไม่ลดลงเมื่อไล่ลงมา
    expect(isAscending(priced.map(lowestPrice))).toBe(true);

    // ขั้นที่ 3: ห้องที่ยังไม่มีราคา (ถ้ามี) ต้องอยู่ท้ายรายการ
    expect(body.items.slice(priced.length).every((room) => room.prices.length === 0)).toBe(true);
  });

  test('sort=price_desc puts the most expensive room first', async ({ agent }) => {
    // ขั้นที่ 1: ขอรายการเรียงตามราคาจากมากไปน้อย
    const body = await expectJson<Paginated<ListingSummary>>(
      await agent.listings.list({ sort: 'price_desc', limit: MAX_PAGE_SIZE }),
      200,
    );
    const priced = body.items.filter((room) => room.prices.length > 0);

    // ขั้นที่ 2: ราคาต่ำสุดของแต่ละห้องต้องไม่เพิ่มขึ้นเมื่อไล่ลงมา และห้องที่ไม่มีราคาอยู่ท้ายรายการ
    expect(isDescending(priced.map(lowestPrice))).toBe(true);
    expect(body.items.slice(priced.length).every((room) => room.prices.length === 0)).toBe(true);
  });

  test('the default order is most recently updated first, and an unknown sort uses it too', async ({ agent }) => {
    // ขั้นที่ 1: ขอรายการ 2 แบบ: ไม่ระบุการเรียง กับระบุค่าที่ API ไม่รู้จัก
    const byDefault = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit: MAX_PAGE_SIZE }), 200);
    const byUnknown = await expectJson<Paginated<ListingSummary>>(
      await agent.listings.list({ limit: MAX_PAGE_SIZE, sort: 'e2e-unknown-sort' }),
      200,
    );

    // ขั้นที่ 2: เวลาแก้ไขล่าสุดต้องเรียงจากใหม่ไปเก่า
    expect(isDescending(byDefault.items.map((room) => Date.parse(room.updatedAt ?? '')))).toBe(true);

    // ขั้นที่ 3: ค่าเรียงที่ไม่รู้จักต้องได้ลำดับเดียวกับค่าเริ่มต้น
    expect(byUnknown.items.map((room) => room.id)).toEqual(byDefault.items.map((room) => room.id));
  });

  test('visibility filter returns only matching rooms, and both values add up to the total', async ({ agent }) => {
    // ขั้นที่ 1: นับทั้งหมด แล้วกรองทีละค่า
    const all = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit: 1 }), 200);
    let sum = 0;
    for (const visibility of VISIBILITIES) {
      const body = await expectJson<Paginated<ListingSummary>>(
        await agent.listings.list({ visibility, limit: MAX_PAGE_SIZE }),
        200,
      );
      // ขั้นที่ 2: ทุกห้องที่ได้ต้องมีค่าตรงกับที่กรอง
      expect(body.items.every((room) => room.visibility === visibility), `กรอง ${visibility}`).toBe(true);
      sum += body.total;
    }

    // ขั้นที่ 3: ห้องของนายหน้ามีได้แค่ 2 ค่านี้ ผลรวมของสองกลุ่มจึงต้องเท่ากับจำนวนทั้งหมด
    expect(sum).toBe(all.total);
  });

  for (const listingSource of ['owner', 'co_agent']) {
    test(`listingSource=${listingSource} returns only rooms from that source`, async ({ agent }) => {
      // ขั้นที่ 1: กรองตามที่มาของห้อง   ขั้นที่ 2: ทุกห้องที่ได้ต้องมาจากที่มานั้น
      const body = await expectJson<Paginated<ListingSummary>>(
        await agent.listings.list({ listingSource, limit: MAX_PAGE_SIZE }),
        200,
      );
      expect(body.items.every((room) => room.listingSourceCode === listingSource)).toBe(true);
    });
  }

  test('roomStatus filter returns only rooms in that status, and nothing for an unknown status', async ({ agent }) => {
    // ขั้นที่ 1: กรองด้วยสถานะที่มีจริง ทุกห้องที่ได้ต้องอยู่ในสถานะนั้น
    const available = await expectJson<Paginated<ListingSummary>>(
      await agent.listings.list({ roomStatus: 'available', limit: MAX_PAGE_SIZE }),
      200,
    );
    expect(available.items.every((room) => room.roomStatusCode === 'available')).toBe(true);

    // ขั้นที่ 2: กรองด้วยสถานะที่ไม่มีในระบบ ต้องได้รายการว่าง ไม่ใช่ error
    const unknown = await expectJson<Paginated<ListingSummary>>(
      await agent.listings.list({ roomStatus: 'e2e-no-such-status' }),
      200,
    );
    expect(unknown).toMatchObject({ items: [], total: 0 });
  });

  test('price range filters compare against the lowest price of each room', async ({ agent }) => {
    // ขั้นที่ 1: หาราคากลางจากข้อมูลจริง เพื่อให้ทั้งสองฝั่งของเส้นแบ่งมีห้อง
    const all = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit: MAX_PAGE_SIZE }), 200);
    const prices = all.items.filter((room) => room.prices.length > 0).map(lowestPrice).sort((a, b) => a - b);
    test.skip(prices.length === 0, 'ไม่มีห้องที่มีราคา จึงทดสอบการกรองราคาไม่ได้');
    const middle = prices[Math.floor(prices.length / 2)]!;

    // ขั้นที่ 2: maxPrice = ราคากลาง ทุกห้องที่ได้ต้องมีราคาต่ำสุดไม่เกินค่านี้
    const upTo = await expectJson<Paginated<ListingSummary>>(
      await agent.listings.list({ maxPrice: String(middle), limit: MAX_PAGE_SIZE }),
      200,
    );
    expect(upTo.total).toBeGreaterThan(0);
    expect(upTo.items.every((room) => lowestPrice(room) <= middle)).toBe(true);

    // ขั้นที่ 3: minPrice = ราคากลาง ทุกห้องที่ได้ต้องมีราคาต่ำสุดตั้งแต่ค่านี้ขึ้นไป
    const from = await expectJson<Paginated<ListingSummary>>(
      await agent.listings.list({ minPrice: String(middle), limit: MAX_PAGE_SIZE }),
      200,
    );
    expect(from.total).toBeGreaterThan(0);
    expect(from.items.every((room) => lowestPrice(room) >= middle)).toBe(true);
  });

  const invalidFilters = [
    { name: 'bedrooms outside 0-4', query: { bedrooms: '9' } },
    { name: 'bedrooms that is not a number', query: { bedrooms: 'two' } },
    { name: 'a price that is not a number', query: { minPrice: 'cheap' } },
    { name: 'a price with more than 2 decimal places', query: { maxPrice: '10000.555' } },
    { name: 'a minimum price above the maximum price', query: { minPrice: '20000', maxPrice: '10000' } },
  ];
  for (const invalid of invalidFilters) {
    test(`answers 400 for ${invalid.name}`, async ({ agent }) => {
      // ขั้นที่ 1: ส่งตัวกรองที่ผิดกติกา   ขั้นที่ 2: ต้องได้ 400 (400 = คำขอผิดรูปแบบ) พร้อมข้อความบอกสาเหตุ
      const message = await expectError(await agent.listings.list(invalid.query), 400);
      expect(message.length).toBeGreaterThan(0);
    });
  }

  test('search finds a room by its title', async ({ agent }) => {
    // ขั้นที่ 1: หยิบชื่อประกาศของห้องจริง 1 ห้องมาเป็นคำค้น
    const all = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit: MAX_PAGE_SIZE }), 200);
    const target = all.items.find((room) => room.listingTitle);
    test.skip(!target, 'ไม่มีห้องที่มีชื่อประกาศ จึงทดสอบการค้นหาไม่ได้');

    // ขั้นที่ 2: ค้นด้วยชื่อนั้น ผลต้องมีห้องนั้นอยู่ด้วย
    const found = await expectJson<Paginated<ListingSummary>>(
      await agent.listings.list({ q: target!.listingTitle!, limit: MAX_PAGE_SIZE }),
      200,
    );
    expect(found.items.map((room) => room.id)).toContain(target!.id);
  });

  test('search with no match returns an empty list', async ({ agent }) => {
    // ขั้นที่ 1: ค้นด้วยคำที่ไม่มีทางตรงกับห้องไหน   ขั้นที่ 2: ต้องได้รายการว่างและ total เป็น 0
    const body = await expectJson<Paginated<ListingSummary>>(
      await agent.listings.list({ q: 'e2e-no-room-has-this-text-7f3a' }),
      200,
    );
    expect(body).toMatchObject({ items: [], total: 0 });
  });

  test(
    'answers 400 when the same query parameter is sent twice',
    {
      tag: '@known-bug',
      annotation: {
        type: 'issue',
        description: 'ส่ง q, roomStatus หรือ listingSource ซ้ำ 2 ครั้ง ทำให้ API ตอบ 500 ควรตอบ 400 แบบเดียวกับ GET /agent/leads',
      },
    },
    async ({ agent }) => {
      // test.fail = บอก Playwright ว่าเทสข้อนี้ "ต้องไม่ผ่าน" ในตอนนี้ เพราะเป็นบั๊กที่รู้แล้วและรอแก้
      // ผลรวมของชุดเทสจึงยังเขียว และวันที่ทีมแก้บั๊ก เทสข้อนี้จะกลายเป็นแดง เพื่อเตือนให้มาลบบรรทัดนี้ออก
      test.fail(true, 'API ตอบ 500 เมื่อส่งค่าเดียวกันซ้ำ 2 ครั้ง');

      // ขั้นที่ 1: ส่ง q ซ้ำ 2 ครั้งในที่อยู่เดียว (เฟรมเวิร์กจะแปลงค่าเป็นรายการ ซึ่งโค้ดส่วนนี้ไม่ได้เผื่อไว้)
      const response = await agent.client.get('agent/listings?q=a&q=b');

      // ขั้นที่ 2: ที่ถูกต้องคือปฏิเสธด้วย 400 ไม่ใช่ 500
      expect(response.status()).toBe(400);
    },
  );
});

test.describe('GET /agent/listings/:id', () => {
  test('returns the detail of a room taken from the list', { tag: '@smoke' }, async ({ agent }) => {
    // ขั้นที่ 1: หยิบห้องแรกจากรายการ
    const list = await expectJson<Paginated<ListingSummary>>(await agent.listings.list({ limit: 1 }), 200);
    expect(list.items, 'บัญชีตัวอย่างต้องมีห้องอย่างน้อย 1 ห้อง').toHaveLength(1);
    const summary = list.items[0]!;

    // ขั้นที่ 2: เปิดรายละเอียดด้วย id ของห้องนั้น
    const detail = await expectJson<ListingDetail>(await agent.listings.getById(summary.id), 200);

    // ขั้นที่ 3: ต้องเป็นห้องเดียวกัน และข้อมูลที่ซ้ำกับในรายการต้องตรงกัน
    expect(detail.id).toBe(summary.id);
    expect(detail.listingTitle).toBe(summary.listingTitle);
    expect(detail.visibility).toBe(summary.visibility);
    expect(detail.prices.map((row) => row.price)).toEqual(summary.prices.map((row) => row.price));

    // ขั้นที่ 4: รูปปกในรายการต้องตรงกับรูปในรายละเอียด
    // รูปปก = รูปที่ทำเครื่องหมายว่าเป็นปก ถ้าไม่มีรูปไหนถูกทำเครื่องหมาย ให้ใช้รูปแรก และถ้าห้องไม่มีรูปเลย รูปปกต้องว่าง
    const cover = detail.medias.find((media) => media.isCover) ?? detail.medias[0];
    expect(cover?.mediaUrl ?? null).toBe(summary.coverMediaUrl);
  });

  test('answers 404 for an id that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ใช้ id ที่มากที่สุดที่ฐานข้อมูลเก็บได้ ซึ่งไม่มีห้องไหนใช้   ขั้นที่ 2: ต้องได้ 404 (404 = ไม่พบ)
    await expectError(await agent.listings.getById(INT32_MAX), 404);
  });

  test('answers 400 for an id that is not a whole number', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง id ที่เป็นตัวอักษร และ id ที่เป็นทศนิยม   ขั้นที่ 2: ต้องได้ 400 ทั้งคู่
    await expectError(await agent.listings.getById('abc'), 400);
    await expectError(await agent.listings.getById('1.5'), 400);
  });

  test(
    'answers with a client error for an id above the 32-bit integer range',
    {
      tag: '@known-bug',
      annotation: {
        type: 'issue',
        description: 'id ที่เกิน 2147483647 ทำให้ API ตอบ 500 (ฐานข้อมูลแจ้ง out of range for type integer) ควรตอบ 404 หรือ 400',
      },
    },
    async ({ agent }) => {
      // บั๊กที่รู้แล้วอีกข้อ ใช้ test.fail แบบเดียวกับเทสเรื่องค่าซ้ำข้างบน
      test.fail(true, 'API ตอบ 500 เมื่อ id เกินช่วงของ integer');

      // ขั้นที่ 1: ส่ง id ที่มากกว่าค่าสูงสุดของ integer อยู่ 1
      const response = await agent.listings.getById(INT32_MAX + 1);

      // ขั้นที่ 2: ที่ถูกต้องคือปฏิเสธแบบความผิดของผู้เรียก (404 หรือ 400) ไม่ใช่ความผิดของเซิร์ฟเวอร์ (500)
      expect([400, 404]).toContain(response.status());
    },
  );
});
