/**
 * วิธีหาชิ้นส่วนบนหน้าจอ รวมไว้ที่เดียวเพื่อให้ไฟล์หน้าจอ (Page Object) ทุกไฟล์หาชิ้นส่วนแบบเดียวกัน
 *
 * ลำดับการหา: 1) หาด้วย testID  2) ถ้าแอปยังไม่มี testID ของชิ้นส่วนนั้น จึงหาด้วยข้อความกำกับ
 *
 * ข้อ 2 เป็นข้อยกเว้นชั่วคราวของกฎชุดเทส (กฎ ง.12: เทสมือถือต้องหาชิ้นส่วนด้วย testID ไม่ใช่ข้อความบนจอ)
 *   ที่ commit 0b7682c และ a6b3b1e ชิ้นส่วนที่เทสใช้ยังไม่มี testID สักตัว (ตรวจจากโค้ด และจากเครื่องจริงในขั้นที่ 24 กับ 31) ถ้าไม่มีข้อ 2 จะเขียนเทสไม่ได้เลย
 *   ความเสี่ยงของการหาด้วยข้อความถูกลดไว้ 2 ทาง:
 *     - ข้อความกำกับของแต่ละชิ้นส่วนใส่ครบทุกภาษาที่ชุดเทสรู้จัก (inEveryLanguage ใน src/labels/) การหาจึงไม่ขึ้นกับภาษาที่แอปแสดง
 *       ส่วนการตรวจว่าแอปแสดงภาษาถูกไหม เป็นหน้าที่ของ expect ในไฟล์เทส ซึ่งอ่านข้อความจริงบนจอมาเทียบ
 *     - ข้อความทุกตัวอยู่ใน src/labels/ ที่เดียว
 *   เมื่อทีมเพิ่ม testID ตามชื่อใน testId ของแต่ละชิ้นส่วน ชุดเทสจะใช้ testID เองโดยไม่ต้องแก้ไฟล์ไหน
 *   และเมื่อครบทุกชิ้นส่วนแล้ว ให้ลบข้อ 2 ออก
 *
 * ทำไมใช้ accessibility id อย่างเดียว:
 *   บน iOS ทั้ง testID และข้อความกำกับ (accessibilityLabel) ถูกหาด้วยวิธีเดียวกัน คือ accessibility id (เขียนย่อว่า ~ค่า)
 *   ตัวขับเทียบค่ากับ testID ของชิ้นส่วน ถ้าชิ้นส่วนไม่มี testID จึงเทียบกับข้อความกำกับ
 *   (ที่มา: WebDriverAgent 16.13.6 ไฟล์ XCUIElement+FBFind.m ส่วน Search by Accessibility Id)
 *   และเป็นวิธีที่ใช้ได้ผลแล้วบนเครื่องที่ใช้เทส (ขั้นที่ 24) ส่วนวิธีแบบเงื่อนไข (predicate) ยังให้ผลไม่แน่นอนบนเครื่องนั้น
 */
import { env } from '../config/env';

export interface ElementSpec {
  /** คำเรียกชิ้นส่วนนี้ ใช้ในข้อความเมื่อเทสหาไม่เจอ */
  description: string;
  /** testID ของชิ้นส่วน รูปแบบ หน้าจอ.ชิ้นส่วน (ชื่อที่ QA เสนอให้ทีมเพิ่มในแอป) */
  testId: string;
  /** ข้อความกำกับที่ใช้หาเมื่อยังไม่มี testID ใส่ทุกค่าที่เป็นไปได้ เช่น ทุกภาษา หรือทุกสถานะของปุ่มที่ข้อความเปลี่ยนตามสถานะ */
  labels: readonly string[];
  /**
   * ชนิดที่ชิ้นส่วนต้องเป็น (ชื่อชนิดของ iOS เช่น XCUIElementTypeTextField) ใช้กับการหาด้วยข้อความเท่านั้น
   * จำเป็นเมื่อข้อความกำกับซ้ำกับชิ้นส่วนอื่น เช่น คำว่า "อีเมล" เป็นทั้งป้ายเหนือช่องและชื่อของช่องกรอก
   */
  types?: readonly string[];
}

/**
 * ช่วงเวลาระหว่างการถามซ้ำ (มิลลิวินาที) ตอนรอให้หน้าจอเปลี่ยน
 * เลือกจาก 2 ข้อ: สั้นพอที่เทสจะไม่รอเกินจำเป็น และยาวพอที่ชิ้นส่วนซึ่งยังเลื่อนอยู่จะขยับให้เห็นระหว่างการถาม 2 ครั้ง
 * (ภาพเคลื่อนไหวของหน้าที่เทสอยู่ยาว 0.24 ถึง 0.32 วินาที: MobileBottomSheet.tsx บรรทัด 78 ถึง 85 และ MobilePreloadScreen.tsx บรรทัด 219 ถึง 224)
 */
const POLL_INTERVAL_MS = 250;

/** วิธีที่หาชิ้นส่วนแต่ละตัวเจอครั้งล่าสุด (เก็บตาม testId) ใช้ทำรายงานท้ายรอบว่าชิ้นส่วนไหนยังไม่มี testID */
const foundBy = new Map<string, 'testID' | 'label'>();

/**
 * รายชื่อ testId ของชิ้นส่วนที่รอบนี้หาเจอ แยกตามวิธีที่หาเจอ
 * ใช้ตอบว่า "ลบทางสำรอง (หาด้วยข้อความ) ได้หรือยัง": ลบได้เมื่อรายการ byLabel ว่างในรอบที่รันครบทุกเทส
 */
export function lookupReport(): { byTestId: string[]; byLabel: string[] } {
  const byTestId: string[] = [];
  const byLabel: string[] = [];
  for (const [testId, method] of foundBy) {
    (method === 'testID' ? byTestId : byLabel).push(testId);
  }
  return { byTestId: byTestId.sort(), byLabel: byLabel.sort() };
}

function describeLocator(spec: ElementSpec): string {
  const labels = spec.labels.map((label) => `"${label}"`).join(' หรือ ');
  const typeNote = spec.types ? ` ชนิด ${spec.types.join(' หรือ ')}` : '';
  return `testID "${spec.testId}" หรือข้อความกำกับ ${labels}${typeNote}`;
}

/**
 * หาชิ้นส่วนตาม spec คืน undefined ถ้ายังไม่มีในโครงสร้างหน้าจอ
 * การมีอยู่ในโครงสร้างหน้าจอยังไม่ได้แปลว่าผู้ใช้มองเห็น (เช่น ถูกหน้าต้อนรับบังอยู่) ถ้าต้องการชิ้นส่วนที่มองเห็น ให้ใช้ waitUntilShown
 */
export async function findElement(spec: ElementSpec): Promise<WebdriverIO.Element | undefined> {
  // $$ = หาทุกชิ้นส่วนที่ตรง (ได้รายการว่างถ้าไม่มี)   ~ค่า = หาด้วย accessibility id
  // 1) testID: ไม่ซ้ำกันทั้งแอป จึงไม่ต้องดูชนิด
  const byTestId = await $$(`~${spec.testId}`).getElements();
  if (byTestId.length > 0) {
    foundBy.set(spec.testId, 'testID');
    return byTestId[0];
  }

  // 2) ข้อความกำกับ (ชั่วคราว)
  for (const label of spec.labels) {
    const candidates = await $$(`~${label}`).getElements();
    for (const candidate of candidates) {
      // getTagName บน iOS คืนชนิดของชิ้นส่วน เช่น XCUIElementTypeButton
      if (spec.types === undefined || spec.types.includes(await candidate.getTagName())) {
        foundBy.set(spec.testId, 'label');
        return candidate;
      }
    }
  }
  return undefined;
}

/**
 * ข้อผิดพลาดที่เกิดได้ตามปกติตอนหน้าจอกำลังเปลี่ยน: ชิ้นส่วนที่เพิ่งหาเจอถูกถอดออกไปก่อนที่จะถามต่อ
 * ข้อผิดพลาดแบบอื่น (เช่น ต่อ Appium ไม่ได้) ต้องไม่ถูกกลืน ไม่อย่างนั้นการรอให้ชิ้นส่วน "หายไป" จะผ่านทั้งที่ถามไม่ได้
 */
function isScreenChangingError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /stale element reference|no such element/i.test(text);
}

/** ผู้ใช้มองเห็นชิ้นส่วนนี้อยู่หรือไม่ ณ ตอนที่ถาม (ไม่รอ) */
export async function isShown(spec: ElementSpec): Promise<boolean> {
  try {
    const element = await findElement(spec);
    return element !== undefined && (await element.isDisplayed());
  } catch (error) {
    if (isScreenChangingError(error)) return false;
    throw error;
  }
}

/**
 * รอจนผู้ใช้มองเห็นชิ้นส่วน (และกดได้ ถ้า mustBeEnabled) แล้วคืนชิ้นส่วนนั้น
 * ข้อผิดพลาดที่ไม่ใช่เรื่องหน้าจอกำลังเปลี่ยนจะถูกโยนต่อ: WebdriverIO จะถามซ้ำจนหมดเวลา แล้วรายงานข้อผิดพลาดนั้นแทนข้อความหมดเวลา
 */
async function waitForElement(spec: ElementSpec, timeoutMs: number, mustBeEnabled: boolean): Promise<WebdriverIO.Element> {
  // เก็บผลไว้ในกล่อง เพราะค่าถูกใส่จากฟังก์ชันข้างใน (TypeScript ตามค่าของตัวแปรธรรมดาข้ามฟังก์ชันไม่ได้)
  const result: { element?: WebdriverIO.Element } = {};
  const wanted = mustBeEnabled ? `${spec.description}ในสภาพที่กดได้` : spec.description;
  await browser.waitUntil(
    async () => {
      try {
        const element = await findElement(spec);
        if (element !== undefined && (await element.isDisplayed()) && (!mustBeEnabled || (await element.isEnabled()))) {
          result.element = element;
          return true;
        }
      } catch (error) {
        // หน้าจอกำลังเปลี่ยน ให้ถามรอบถัดไป
        if (!isScreenChangingError(error)) throw error;
      }
      return false;
    },
    {
      timeout: timeoutMs,
      interval: POLL_INTERVAL_MS,
      timeoutMsg: `ไม่เห็น${wanted} ภายใน ${timeoutMs / 1000} วินาที (หาด้วย ${describeLocator(spec)})`,
    },
  );
  if (result.element === undefined) throw new Error(`รอ${wanted}จบแล้วแต่ไม่ได้ชิ้นส่วนกลับมา (ไม่ควรเกิด)`);
  return result.element;
}

/** รอจนผู้ใช้มองเห็นชิ้นส่วน แล้วคืนชิ้นส่วนนั้น ถ้าเกินเวลาจะหยุดเทสพร้อมบอกว่ารออะไรและหาด้วยอะไร */
export async function waitUntilShown(spec: ElementSpec, timeoutMs: number = env.waitMs): Promise<WebdriverIO.Element> {
  return waitForElement(spec, timeoutMs, false);
}

/** รอจนผู้ใช้มองเห็นชิ้นส่วนและชิ้นส่วนนั้นกดได้ (ไม่ถูกตั้งเป็น disabled) แล้วคืนชิ้นส่วนนั้น */
export async function waitUntilEnabled(spec: ElementSpec, timeoutMs: number = env.waitMs): Promise<WebdriverIO.Element> {
  return waitForElement(spec, timeoutMs, true);
}

/**
 * รอจนผู้ใช้มองเห็นชิ้นส่วนและชิ้นส่วนหยุดเคลื่อนที่ แล้วคืนชิ้นส่วนนั้น ใช้ก่อนแตะ ลบ หรือพิมพ์ทุกครั้ง
 * เหตุผล: ตัวขับแตะที่ตำแหน่งของชิ้นส่วน ณ ตอนที่สั่ง ถ้าชิ้นส่วนยังเลื่อนอยู่ การแตะจะพลาดไปโดนอย่างอื่น
 *   เช่น ตัวเลือกในแผ่นเลือกภาษาที่กำลังเลื่อนขึ้น หรือฟอร์มที่ขยับขึ้นตอนแป้นพิมพ์เปิด
 *   การรอแอป "นิ่ง" ของตัวขับเองไม่ครอบคลุมภาพเคลื่อนไหวทุกแบบ (ขั้นที่ 24: หน้าต้อนรับมีภาพเคลื่อนไหววนอยู่ แต่ตัวขับมองว่านิ่ง)
 * วิธีตรวจ: ถามตำแหน่งกับขนาดของชิ้นส่วนซ้ำ ถ้า 2 ครั้งติดกันได้ค่าเท่ากัน ถือว่าหยุดแล้ว
 */
export async function waitUntilSteady(spec: ElementSpec, timeoutMs: number = env.waitMs): Promise<WebdriverIO.Element> {
  const result: { element?: WebdriverIO.Element } = {};
  let previousRect: string | undefined;
  await browser.waitUntil(
    async () => {
      try {
        const element = await findElement(spec);
        if (element === undefined || !(await element.isDisplayed())) {
          previousRect = undefined;
          return false;
        }
        // getElementRect = ตำแหน่ง (x, y) กับขนาด (width, height) ของชิ้นส่วนบนจอ
        const rect = JSON.stringify(await browser.getElementRect(element.elementId));
        const steady = rect === previousRect;
        previousRect = rect;
        if (steady) result.element = element;
        return steady;
      } catch (error) {
        // หน้าจอกำลังเปลี่ยน ให้เริ่มเทียบใหม่ในรอบถัดไป
        if (!isScreenChangingError(error)) throw error;
        previousRect = undefined;
        return false;
      }
    },
    {
      timeout: timeoutMs,
      interval: POLL_INTERVAL_MS,
      timeoutMsg: `ไม่เห็น${spec.description}อยู่นิ่งพอให้สั่งงาน ภายใน ${timeoutMs / 1000} วินาที (หาด้วย ${describeLocator(spec)})`,
    },
  );
  if (result.element === undefined) throw new Error(`รอ${spec.description}จบแล้วแต่ไม่ได้ชิ้นส่วนกลับมา (ไม่ควรเกิด)`);
  return result.element;
}

/** แตะชิ้นส่วน โดยรอให้ชิ้นส่วนแสดงและหยุดเคลื่อนที่ก่อน */
export async function tap(spec: ElementSpec, timeoutMs: number = env.waitMs): Promise<void> {
  await (await waitUntilSteady(spec, timeoutMs)).click();
}

/**
 * รอจนผู้ใช้ไม่เห็นชิ้นส่วนนี้แล้ว (หายจากโครงสร้างหน้าจอ หรือถูกซ่อน)
 * ถ้าถามหน้าจอไม่ได้ (เช่น ต่อ Appium ไม่ได้) การรอนี้จะไม่ผ่าน แต่จบด้วยข้อผิดพลาดนั้นเมื่อหมดเวลา
 */
export async function waitUntilGone(spec: ElementSpec, timeoutMs: number = env.waitMs): Promise<void> {
  await browser.waitUntil(async () => !(await isShown(spec)), {
    timeout: timeoutMs,
    interval: POLL_INTERVAL_MS,
    timeoutMsg: `${spec.description}ยังแสดงอยู่หลังรอ ${timeoutMs / 1000} วินาที (หาด้วย ${describeLocator(spec)})`,
  });
}
