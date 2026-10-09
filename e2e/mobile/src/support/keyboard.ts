/**
 * อ่านแป้นพิมพ์ที่ขึ้นอยู่บน iPhone จำลอง ใช้อธิบายสาเหตุเมื่อช่องรหัสผ่านแบบซ่อนตัวอักษรได้ตัวอักษรไม่ครบ
 *
 * ทำไมต้องมี
 *   บนเครื่องจำลองที่ใช้เทส (iPhone 18 Pro จำลอง iOS 27) ช่องแบบซ่อนตัวอักษรรับเฉพาะตัวอักษรที่มีปุ่มบนแป้นพิมพ์ที่ใช้อยู่
 *   ตัวอื่นหายไปโดยไม่มีข้อความแจ้ง ส่วนช่องที่แสดงตัวอักษรรับครบทุกตัว
 *   (ขั้นที่ 29 กับ 30 เมื่อ 8 ต.ค. 2026: แป้นพิมพ์ไทย พิมพ์ 'abcdef' เข้า 0 จาก 6 ตัว 'กขคงจบ' เข้าครบ ส่วนแป้นพิมพ์อังกฤษได้ผลกลับกัน)
 *   เทสที่แดงเพราะเรื่องนี้ได้ข้อความแค่แบบ Expected: 18 Received: 3 ซึ่งไม่บอกสาเหตุ
 *   บรรทัด [แป้นพิมพ์] ที่ไฟล์นี้พิมพ์จึงบอกแป้นพิมพ์ที่ขึ้นอยู่ตอนนั้นไว้ให้ดูคู่กัน
 *   รายละเอียดอยู่ใน README หัวข้อ "ข้อควรรู้ของเครื่องจำลองที่ใช้เทส"
 *
 * ขอบเขต
 *   - ไม่ตรวจผล ไม่แตะหน้าจอ และไม่ทำให้เทสผ่านหรือไม่ผ่าน ถ้าอ่านแป้นพิมพ์ไม่ได้ จะพิมพ์ว่าอ่านไม่ได้แล้วจบ
 *   - จากโครงสร้างหน้าจอที่อ่านมา ใช้เฉพาะชิ้นส่วนที่อยู่ในแป้นพิมพ์ ไม่พิมพ์ค่าของช่องกรอก และไม่พิมพ์ข้อความที่เทสพิมพ์ลงช่อง
 *   - วิธีอ่านแป้นพิมพ์ยกมาจากไฟล์ทดลองของขั้นที่ 29 และ 30 ซึ่งอ่านแป้นพิมพ์ไทยและอังกฤษบนเครื่องจริงได้ตรงกับที่ขึ้นบนจอ
 */

/**
 * ชนิดของแป้นพิมพ์ที่เห็นในโครงสร้างหน้าจอ
 *   thai = มีแต่ปุ่มตัวอักษรไทย  english = มีแต่ปุ่มตัวอักษรอังกฤษ  mixed = มีทั้ง 2 แบบ
 *   other = พบแป้นพิมพ์แต่ไม่มีปุ่มตัวอักษรไทยหรืออังกฤษ  none = ไม่พบแป้นพิมพ์
 */
export type KeyboardKind = 'thai' | 'english' | 'mixed' | 'other' | 'none';

export interface KeyboardInfo {
  kind: KeyboardKind;
  /** จำนวนปุ่มตัวอักษรภาษาอังกฤษ */
  latin: number;
  /** จำนวนปุ่มตัวอักษรไทย */
  thai: number;
  /** ปุ่มตัวอักษรแถวบนสุด เรียงจากซ้ายไปขวา ใช้ดูว่าเป็นแป้นพิมพ์แบบไหน เช่น q w e r t y */
  topRow: string[];
}

const KIND_NAME: Record<KeyboardKind, string> = {
  thai: 'ไทย',
  english: 'อังกฤษ',
  mixed: 'มีทั้งไทยและอังกฤษ',
  other: 'ไม่มีปุ่มตัวอักษรไทยหรืออังกฤษ',
  none: 'ไม่พบแป้นพิมพ์ในโครงสร้างหน้าจอ',
};

/** ชนิดที่ถือว่าอ่านแป้นพิมพ์ได้แล้ว (มีปุ่มตัวอักษร) */
const HAS_LETTER_KEYS: readonly KeyboardKind[] = ['thai', 'english', 'mixed'];

/**
 * เวลารอให้แป้นพิมพ์ที่มีปุ่มตัวอักษรปรากฏในโครงสร้างหน้าจอ และช่วงเวลาระหว่างการอ่านซ้ำ (มิลลิวินาที)
 * ค่าเดียวกับไฟล์ทดลองของขั้นที่ 29 และ 30 ซึ่งพบแป้นพิมพ์ทันทีที่ช่องถูกเลือก ค่านี้เผื่อไว้
 */
const KEYBOARD_WAIT_MS = 3000;
const KEYBOARD_POLL_MS = 300;

/** ข้อความภายในที่ใช้แยก "หมดเวลา" ออกจากข้อผิดพลาดอื่นของ browser.waitUntil */
const TIMED_OUT = 'currentKeyboard: timed out';

const NO_KEYBOARD: KeyboardInfo = { kind: 'none', latin: 0, thai: 0, topRow: [] };

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** ค่าของ attribute ชื่อนั้นในแท็ก (ข้อความหลังชื่อชนิดของแท็ก) หรือ undefined ถ้าไม่มี */
function attribute(attrs: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(attrs);
  return match ? unescapeXml(match[1]) : undefined;
}

/**
 * อ่านแป้นพิมพ์จากโครงสร้างหน้าจอ (ข้อความ XML ที่ได้จาก getPageSource) ดูเฉพาะชิ้นส่วนที่อยู่ในชิ้นส่วนชนิด XCUIElementTypeKeyboard ตัวแรก
 * ปุ่มตัวอักษร = ชิ้นส่วนชนิด XCUIElementTypeKey ที่ข้อความกำกับยาว 1 ตัวอักษร (ปุ่มอื่น เช่น space, ลบ, ปุ่มสลับไปหน้าตัวเลข มีข้อความยาวกว่านั้น)
 * นับปุ่มทั้งตอนแป้นพิมพ์อยู่บนจอและอยู่นอกจอ เพราะตอนพิมพ์ช่องแบบซ่อนในขั้นที่ 26, 29 และ 30 แป้นพิมพ์อยู่นอกจอ (y=891 จอสูง 874)
 *   แต่ปุ่มยังอยู่ในโครงสร้างหน้าจอ และตัวอักษรที่เข้าช่องตรงกับภาษาของปุ่มเหล่านั้นทุกครั้ง
 */
export function readKeyboard(pageSource: string): KeyboardInfo {
  const start = pageSource.indexOf('<XCUIElementTypeKeyboard');
  if (start < 0) return NO_KEYBOARD;
  const openTag = /^<XCUIElementTypeKeyboard\b[^>]*>/.exec(pageSource.slice(start));
  // แท็กที่ปิดในตัว (<... />) คือแป้นพิมพ์ที่ไม่มีชิ้นส่วนข้างใน
  if (openTag === null || openTag[0].endsWith('/>')) return { ...NO_KEYBOARD, kind: 'other' };
  const end = pageSource.indexOf('</XCUIElementTypeKeyboard>', start);
  const inside = pageSource.slice(start + openTag[0].length, end < 0 ? undefined : end);

  const keys: { label: string; x: number; y: number }[] = [];
  // \b หลัง Key ทำให้ไม่นับแท็กของแป้นพิมพ์เอง (XCUIElementTypeKeyboard) ที่อาจซ้อนอยู่ข้างใน
  for (const match of inside.matchAll(/<XCUIElementTypeKey\b([^>]*)>/g)) {
    const label = attribute(match[1], 'label') ?? '';
    if ([...label].length === 1) {
      keys.push({ label, x: Number(attribute(match[1], 'x') ?? 0), y: Number(attribute(match[1], 'y') ?? 0) });
    }
  }
  const latin = keys.filter((key) => /^[A-Za-z]$/.test(key.label)).length;
  const thai = keys.filter((key) => /^[฀-๿]$/.test(key.label)).length;
  const kind: KeyboardKind = latin > 0 && thai > 0 ? 'mixed' : latin > 0 ? 'english' : thai > 0 ? 'thai' : 'other';
  const topY = Math.min(...keys.map((key) => key.y));
  const topRow = keys
    .filter((key) => key.y === topY)
    .sort((a, b) => a.x - b.x)
    .map((key) => key.label);
  return { kind, latin, thai, topRow };
}

/**
 * บรรยายแป้นพิมพ์ให้คนอ่าน เช่น "ไทย (ปุ่มตัวอักษรอังกฤษ 0 ปุ่ม ไทย 44 ปุ่ม แถวบน ๅ / _ ภ ถ ุ ึ ค ต จ ข ช)"
 * ถ้ามีปุ่มแต่ไม่มีปุ่มตัวอักษรไทยหรืออังกฤษ แป้นพิมพ์อาจอยู่หน้าตัวเลขหรือสัญลักษณ์ ซึ่งบอกภาษาไม่ได้ จึงบอกให้ไปดูไฟล์ค่าตั้งแทน
 */
export function describeKeyboard(info: KeyboardInfo): string {
  if (info.kind === 'none') return KIND_NAME.none;
  const pageNote =
    info.kind === 'other' && info.topRow.length > 0
      ? ' อาจเป็นหน้าตัวเลขหรือสัญลักษณ์ของแป้นพิมพ์ ให้ดูภาษาจากไฟล์ค่าตั้งของเครื่องจำลองตาม README'
      : '';
  return `${KIND_NAME[info.kind]} (ปุ่มตัวอักษรอังกฤษ ${info.latin} ปุ่ม ไทย ${info.thai} ปุ่ม แถวบน ${info.topRow.join(' ') || '-'})${pageNote}`;
}

/**
 * แป้นพิมพ์ที่ขึ้นอยู่ตอนนี้ ถ้ายังไม่เห็นปุ่ม อ่านซ้ำได้ถึง KEYBOARD_WAIT_MS แล้วคืนผลล่าสุด
 * หยุดรอทันทีที่เห็นปุ่มที่มีข้อความ 1 ตัวอักษร แม้จะไม่ใช่ตัวอักษรไทยหรืออังกฤษ (เช่น หน้าตัวเลข) เพราะรอต่อก็ไม่ช่วยให้บอกภาษาได้
 */
export async function currentKeyboard(): Promise<KeyboardInfo> {
  // ช่องเดียวสำหรับผลล่าสุด เป็นรายการเพราะค่าถูกใส่จากฟังก์ชันข้างใน (แบบเดียวกับ readUntil ใน src/support/wait.ts)
  const latest: KeyboardInfo[] = [NO_KEYBOARD];
  try {
    await browser.waitUntil(
      async () => {
        latest[0] = readKeyboard(await browser.getPageSource());
        return HAS_LETTER_KEYS.includes(latest[0].kind) || latest[0].topRow.length > 0;
      },
      { timeout: KEYBOARD_WAIT_MS, interval: KEYBOARD_POLL_MS, timeoutMsg: TIMED_OUT },
    );
  } catch (error) {
    // หมดเวลา: คืนผลล่าสุด (เช่น ไม่พบแป้นพิมพ์)   ข้อผิดพลาดแบบอื่น (เช่น อ่านโครงสร้างหน้าจอไม่ได้) โยนต่อ
    if (!(error instanceof Error) || error.message !== TIMED_OUT) throw error;
  }
  return latest[0];
}

/** บรรทัดแรกของข้อความผิดพลาด ตัดให้สั้น */
function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0].slice(0, 160);
}

/**
 * พิมพ์บรรทัด [แป้นพิมพ์] บอกแป้นพิมพ์ที่ขึ้นอยู่ ใช้เมื่อช่องได้ตัวอักษรน้อยกว่าที่พิมพ์
 * ไม่โยนข้อผิดพลาด: บรรทัดนี้เป็นข้อมูลประกอบ ผลเทสยังตัดสินที่ expect ในไฟล์เทส
 * ไม่บอกจำนวนตัวอักษรที่พิมพ์ เพื่อไม่ให้ความยาวของรหัสผ่านไปอยู่ในผลรัน (เทสที่ต้องรู้ความยาวตรวจเองด้วย expect)
 * @param field คำเรียกช่อง เช่น "ช่องรหัสผ่านแบบซ่อนตัวอักษร"
 * @param got จำนวนตัวอักษรที่อยู่ในช่องหลังพิมพ์
 */
export async function reportKeyboardForMissingCharacters(field: string, got: number): Promise<void> {
  let keyboard: string;
  try {
    keyboard = describeKeyboard(await currentKeyboard());
  } catch (error) {
    keyboard = `อ่านแป้นพิมพ์ไม่ได้ (${firstLine(error)})`;
  }
  console.log(
    `[แป้นพิมพ์] ${field}ได้ตัวอักษร ${got} ตัว น้อยกว่าที่พิมพ์ | แป้นพิมพ์ที่ขึ้นอยู่: ${keyboard} | ` +
      'ช่องแบบนี้รับเฉพาะตัวอักษรที่มีปุ่มบนแป้นพิมพ์ที่ใช้อยู่ ถ้าข้อความที่พิมพ์มีตัวอักษรที่ไม่มีบนแป้นพิมพ์นี้ ' +
      'ให้สลับแป้นพิมพ์ของเครื่องจำลอง (README หัวข้อ "ข้อควรรู้ของเครื่องจำลองที่ใช้เทส")',
  );
}
