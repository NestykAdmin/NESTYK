import type { Page } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { MAP_GATE, UI_LOCALE } from '../../src/web-ui/labels';
import { RoomsPage, ROOMS_VIEW_KEY } from '../../src/web-ui/pages/rooms.page';
import { COOKIE_CONSENT_VERSION, CookieNotice, MapConsentGate, readStorage, readStoredConsent } from '../../src/web-ui/pages/cookie-notice.page';
import { okJson, waitForApi } from '../../src/web-ui/support/api';

/**
 * ปุ่ม "แสดงแผนที่" ของกล่องที่ขึ้นแทนแผนที่ Google (PDPA: Mos แก้ที่ pre/dev/review cfd6633 ตอบ QA ข้อ 1 วันที่ 10 พ.ย. 2026)
 *   กติกา (allowCookieCategory ใน packages/ui/src/consent/cookieConsent.ts และคำตอบของ Mos):
 *   - ยังไม่เคยตอบแถบ: อนุญาตแผนที่อย่างเดียว ไม่ลบค่าที่จำไว้ แถบคุกกี้ยังค้าง (complete: false) เปิด "ตั้งค่า" แล้วช่องแผนที่ติ๊กไว้
 *   - เคยตอบแถบแล้ว: เปิดแผนที่เพิ่มอย่างเดียว คำตอบอื่นคงเดิม (ค่าเก่าที่ไม่มี complete นับว่าตอบแล้ว)
 *   - ทั้ง 2 แบบ: ก่อนกด ต้องไม่มีคำขอไป Google Maps เลย (สคริปต์แผนที่โหลดหลังอนุญาตเท่านั้น MapConsentGate.tsx:16-21)
 * ใช้หน้าต่างรายละเอียดห้องของ qa-agent (/agent/rooms) ซึ่งแสดงแผนที่ในส่วนทำเลเมื่อห้องมีพิกัด (RoomDesktopBody.tsx:472-487)
 *   อ่านอย่างเดียว: ค่าความยินยอมเก็บใน localStorage ของเบราว์เซอร์ ไม่มีอะไรเขียนลงฐานข้อมูล
 * สิ่งที่ต้องมีก่อนรัน: เว็บที่ตั้ง EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (ไม่มี key หน้าแสดงข้อความแผนที่ใช้ไม่ได้แทนกล่องนี้ NearbyPlacesMap.web.tsx:224-227)
 *   ตั้ง E2E_QA_AGENT_PASSWORD และ qa-agent ต้องมีห้องที่มีพิกัดในหน้าแรกของรายการห้อง
 * คำขอไป maps.googleapis.com ถูกนับแล้วตัดทิ้ง จึงไม่ใช้โควตาของ key และไม่ได้ตรวจว่าแผนที่แสดงขึ้นจริง
 * ข้อจำกัด: "ก่อนกดไม่มีคำขอ" ตรวจได้แค่ ณ ตอนที่กล่องขึ้นและก่อนกดทันที การรอว่า "ไม่มีอะไรเกิดขึ้น" ต้องหน่วงเวลาตายตัว จึงไม่ทำ
 *   ส่วน "หลังกดมีคำขอ" นับคำขอจากแผนที่ตัวไหนบนหน้าก็ได้ ไม่ได้ผูกกับแผนที่ของหน้าต่างนี้
 * build ที่ไม่มี key: หน้าต่างแสดงข้อความแผนที่ใช้ไม่ได้แทนกล่อง ทั้ง 2 ข้อจะข้ามพร้อมบอกเหตุผล
 */

interface RoomsResult {
  items: Array<{ id: number; latitude?: number | null; longitude?: number | null }>;
}

/** นับคำขอไป Google Maps แล้วตัดทิ้ง (ไม่จด URL เพราะมี key อยู่ใน query) */
async function blockGoogleMaps(page: Page): Promise<{ hits: number }> {
  const counter = { hits: 0 };
  await page.route(
    (url) => url.hostname === 'maps.googleapis.com',
    async (route) => {
      counter.hits += 1;
      await route.abort('blockedbyclient');
    },
  );
  return counter;
}

/**
 * ล็อกอินไปที่ /agent/rooms แล้วเปิดหน้าต่างของห้องแรกที่มีพิกัด คืนกล่อง "แสดงแผนที่" ในหน้าต่างนั้น
 * ห้องไม่มีพิกัดเลยในหน้าแรก: ข้ามข้อนี้ (ไม่ใช่บั๊ก กล่องขึ้นเฉพาะห้องที่มีพิกัด)
 */
async function openRoomWithMap(
  page: Page,
  loginAs: (role: 'agent', options?: { next?: string }) => Promise<void>,
): Promise<{ rooms: RoomsPage; gate: MapConsentGate }> {
  const listing = waitForApi(page, 'GET', '/agent/listings');
  await loginAs('agent', { next: '/agent/rooms' });
  const result = await okJson<RoomsResult>(await listing);
  // เงื่อนไขเดียวกับที่หน้าต่างใช้ตัดสินว่าจะแสดงแผนที่ (RoomDesktopBody.tsx:239-247): ไม่ใช่ null เป็นตัวเลข และอยู่ในช่วงของละติจูดกับลองจิจูด
  const room = result.items.find((item) => {
    const lat = item.latitude == null ? NaN : Number(item.latitude);
    const lng = item.longitude == null ? NaN : Number(item.longitude);
    return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
  });
  test.skip(!room, `หน้าแรกของรายการห้อง qa-agent (${result.items.length} ห้อง) ไม่มีห้องที่มีพิกัด`);
  const rooms = new RoomsPage(page);
  const detail = waitForApi(page, 'GET', `/agent/listings/${room!.id}`);
  await rooms.row(room!.id).click();
  await okJson<unknown>(await detail);
  const gate = new MapConsentGate(rooms.detail);
  // build ที่ไม่มี key ขึ้นข้อความแผนที่ใช้ไม่ได้แทนกล่อง (NearbyPlacesMap.web.tsx:224-227) รอให้ขึ้นอย่างใดอย่างหนึ่งก่อน แล้วข้ามถ้าไม่มี key
  const unavailable = rooms.detail.getByText(MAP_GATE[UI_LOCALE].mapUnavailable, { exact: true });
  await expect(gate.root.or(unavailable).first()).toBeVisible();
  test.skip(await unavailable.isVisible(), 'เว็บไม่ได้ตั้ง EXPO_PUBLIC_GOOGLE_MAPS_API_KEY จึงไม่มีกล่องแสดงแผนที่ (ตั้งใน .env แล้วเปิด npm run web ใหม่)');
  await expect(gate.root).toBeVisible();
  await expect(gate.root).toContainText(MAP_GATE[UI_LOCALE].mapOff);
  await expect(gate.show).toHaveText(MAP_GATE[UI_LOCALE].mapShow);
  return { rooms, gate };
}

test.describe('before the cookie bar is answered', () => {
  test.use({ cookieConsent: null });

  test('"Show map" allows maps only, keeps remembered settings, and the bar still asks', async ({ page, loginAs }) => {
    // ขั้นที่ 1: นับคำขอไป Google ตั้งแต่ก่อนเปิดหน้า แล้วเปิดหน้าต่างห้องที่มีกล่อง "แสดงแผนที่"
    const google = await blockGoogleMaps(page);
    const { rooms, gate } = await openRoomWithMap(page, loginAs);
    const notice = new CookieNotice(page);
    await expect(notice.root, 'ยังไม่เคยตอบ แถบต้องขึ้น').toBeVisible();
    expect(await readStoredConsent(page), 'ยังไม่เคยตอบ ต้องไม่มีค่าที่บันทึก').toBeNull();
    expect(google.hits, 'ก่อนอนุญาตต้องไม่มีคำขอไป Google Maps').toBe(0);

    // ขั้นที่ 2: ใส่ค่าที่จำไว้ 1 ตัวของหมวด "จำค่าที่คุณตั้ง" (มุมมองของหน้าห้อง) ไว้ตรวจว่าไม่ถูกลบ
    //   ก่อน cfd6633 ปุ่มนี้บันทึก maps:true แทนผู้ใช้และลบค่าของหมวดนี้ทั้งหมด (คำถามข้อ 1 ของ QA)
    //   ใช้ค่าที่แอปไม่มีทางเขียนเอง (แอปเขียนได้แค่ 'table' หรือ 'grid': rooms.page.ts:4) ถ้าถูกลบแล้วแอปเขียนใหม่ ผลจะไม่ออกมาเหมือนไม่ถูกลบ
    await page.evaluate((key) => window.localStorage.setItem(key, 'qa-sentinel'), ROOMS_VIEW_KEY);

    // ขั้นที่ 3: กด "แสดงแผนที่" กล่องหาย ค่าที่บันทึกเป็นแผนที่อย่างเดียวที่ยังไม่นับว่าตอบแถบ
    expect(google.hits, 'ก่อนกดทันทีต้องยังไม่มีคำขอไป Google Maps').toBe(0);
    await gate.show.click();
    await expect(gate.root).toHaveCount(0);
    await expect
      .poll(() => readStoredConsent(page))
      .toEqual({ version: COOKIE_CONSENT_VERSION, at: expect.any(String), preferences: false, maps: true, complete: false });
    expect(await readStorage(page, [ROOMS_VIEW_KEY]), 'ค่าที่จำไว้ต้องไม่ถูกลบ').toEqual({ [ROOMS_VIEW_KEY]: 'qa-sentinel' });
    await expect.poll(() => google.hits, { message: 'หลังอนุญาตต้องมีคำขอโหลดแผนที่จาก Google' }).toBeGreaterThan(0);

    // ขั้นที่ 4: แถบยังขึ้นให้ตอบหมวดที่เหลือ เปิด "ตั้งค่า" แล้วช่องแผนที่ติ๊กไว้ ช่อง "จำค่าที่คุณตั้ง" ยังไม่ติ๊ก
    //   ปิดหน้าต่างห้องก่อน: หน้าต่างอยู่เหนือแถบและรับการคลิกแทนปุ่มของแถบ (ผลรัน 10 พ.ย. 2026 web-ui-map-consent-en-run3.txt:
    //   "<section class="ard-card"> intercepts pointer events") ผู้ใช้ปิดหน้าต่างแล้วตอบแถบได้ตามปกติ
    await expect(notice.root, 'กดแสดงแผนที่อย่างเดียวยังไม่นับว่าตอบแถบ').toBeVisible();
    await rooms.detailBack.click();
    await expect(rooms.detail).toHaveCount(0);
    await expect(notice.root, 'ปิดหน้าต่างห้องแล้วแถบต้องยังขึ้น').toBeVisible();
    await notice.settings.click();
    await expect(notice.category('maps')).toBeChecked();
    await expect(notice.category('preferences')).not.toBeChecked();
  });
});

test.describe('after the cookie bar was answered', () => {
  // ค่าเริ่มต้นของ fixture (preferences: true, maps: false) ไม่มีช่อง complete จึงตรวจกติกา "ค่าเก่าที่ไม่มี complete นับว่าตอบแล้ว" ไปด้วย
  test.use({ cookieConsent: { preferences: true, maps: false } });

  test('"Show map" adds maps and keeps the other answer', async ({ page, loginAs }) => {
    // ขั้นที่ 1: เปิดหน้าต่างห้องที่มีกล่อง แถบต้องไม่ขึ้น และยังไม่มีคำขอไป Google
    const google = await blockGoogleMaps(page);
    const { gate } = await openRoomWithMap(page, loginAs);
    const notice = new CookieNotice(page);
    const before = await readStoredConsent(page);
    expect(before, 'fixture ต้องใส่ค่าเก่าที่ไม่มีช่อง complete').toMatchObject({ preferences: true, maps: false });
    expect(before && 'complete' in before, 'ค่าของ fixture ต้องไม่มีช่อง complete').toBe(false);
    await expect(notice.root, 'เคยตอบแล้ว แถบต้องไม่ขึ้น').toHaveCount(0);
    expect(google.hits, 'ก่อนอนุญาตต้องไม่มีคำขอไป Google Maps').toBe(0);

    // ขั้นที่ 2: กด "แสดงแผนที่" ได้แผนที่เพิ่ม "จำค่าที่คุณตั้ง" คงเดิม และนับว่าตอบแถบแล้ว
    expect(google.hits, 'ก่อนกดทันทีต้องยังไม่มีคำขอไป Google Maps').toBe(0);
    await gate.show.click();
    await expect(gate.root).toHaveCount(0);
    await expect
      .poll(() => readStoredConsent(page))
      .toEqual({ version: COOKIE_CONSENT_VERSION, at: expect.any(String), preferences: true, maps: true, complete: true });
    await expect.poll(() => google.hits, { message: 'หลังอนุญาตต้องมีคำขอโหลดแผนที่จาก Google' }).toBeGreaterThan(0);
    await expect(notice.root, 'เคยตอบแล้ว กดแสดงแผนที่ต้องไม่ทำให้แถบกลับมา').toHaveCount(0);
  });
});
