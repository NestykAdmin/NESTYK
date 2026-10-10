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
 *
 * การหาจากโครงสร้างหน้าจอที่อ่านมาแล้ว (nodesInSource, shownInSource) ใช้ลำดับเดียวกัน ชิ้นที่หาเจอถูกนับใน lookupReport เหมือนกัน
 *   ใช้เมื่อต้องดูทุกชิ้นที่ชื่อตรงในครั้งเดียว เช่น traits ของแท็บ หรือการตรวจว่าข้อความ "ไม่มี" บนจอ (ชุด session)
 *   ส่วนชิ้นที่หาด้วยข้อความแล้วไม่เคยเจอ (neverFoundByLabel) ตอนนี้พิมพ์เฉพาะในชุด session (wdio.session.conf.ts) เพราะชุดหลักยังไม่ใช้การหาแบบนี้
 */
import { env } from '../config/env';
import type { ScreenNode } from '../support/page-source';

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

/** testId ของชิ้นส่วนที่ nodesInSource หาด้วยข้อความแล้วไม่เจอ (ดู neverFoundByLabel) */
const searchedByLabel = new Set<string>();

/**
 * ชิ้นส่วนที่รอบนี้หาจากโครงสร้างหน้าจอด้วยข้อความกำกับ แล้วไม่เคยเจอเลย (ไม่เจอทั้งด้วย testID และข้อความ)
 * ในรอบที่ผ่าน ส่วนใหญ่คือชิ้นส่วนที่เทสตรวจว่า "ไม่แสดง" เช่น ข้อความโหลดไม่สำเร็จ ส่วนในรอบที่ไม่ผ่าน อาจมีชิ้นส่วนที่เทสรอแล้วไม่ขึ้นด้วย
 * ชิ้นส่วนกลุ่มนี้ไม่อยู่ใน lookupReport เพราะยังบอกไม่ได้ว่าแอปมี testID ของมันหรือไม่
 * ก่อนลบทางสำรอง (หาด้วยข้อความ) ต้องยืนยัน testID ของชิ้นส่วนกลุ่มนี้จากโค้ดของแอปก่อน ไม่อย่างนั้นการตรวจว่า "ไม่แสดง" จะผ่านเสมอ
 */
export function neverFoundByLabel(): string[] {
  return [...searchedByLabel].filter((testId) => !foundBy.has(testId)).sort();
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
 * หาชิ้นส่วนตาม spec ในโครงสร้างหน้าจอที่อ่านมาแล้ว (readScreen ใน src/support/page-source.ts) ลำดับเดียวกับ findElement: testID ก่อน แล้วจึงข้อความกำกับ
 * คืนทุกชิ้นที่ตรง ทั้งที่มองเห็นและมองไม่เห็น (ต่างจาก findElement ที่คืนชิ้นแรกชิ้นเดียว)
 * matchesLabel: ใช้แทนการเทียบข้อความกำกับแบบตรงตัว เมื่อค่าที่หาไม่ใช่ข้อความคงที่ (เช่น อีเมลของบัญชี) ส่วน spec.types ยังใช้เหมือนเดิม
 */
export function nodesInSource(nodes: readonly ScreenNode[], spec: ElementSpec, matchesLabel?: (node: ScreenNode) => boolean): ScreenNode[] {
  // 1) testID: ชิ้นส่วนที่มี testID มีค่า name เป็น testID (WebDriverAgent ใช้ accessibilityIdentifier เป็น name ถ้ามี)
  const byTestId = nodes.filter((node) => node.name === spec.testId);
  if (byTestId.length > 0) {
    foundBy.set(spec.testId, 'testID');
    return byTestId;
  }

  // 2) ข้อความกำกับ (ชั่วคราว) ชนิดในโครงสร้างหน้าจอไม่มีคำนำหน้า XCUIElementType
  const types = spec.types?.map((type) => type.replace(/^XCUIElementType/, ''));
  const matches = matchesLabel ?? ((node: ScreenNode) => spec.labels.includes(node.label) || spec.labels.includes(node.name));
  const byLabel = nodes.filter((node) => (types === undefined || types.includes(node.type)) && matches(node));
  if (byLabel.length > 0) foundBy.set(spec.testId, 'label');
  else searchedByLabel.add(spec.testId);
  return byLabel;
}

/** เหมือน nodesInSource แต่คืนเฉพาะชิ้นที่มองเห็น */
export function shownInSource(nodes: readonly ScreenNode[], spec: ElementSpec, matchesLabel?: (node: ScreenNode) => boolean): ScreenNode[] {
  return nodesInSource(nodes, spec, matchesLabel).filter((node) => node.visible);
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
 * รอจนชิ้นส่วนมีอยู่ในโครงสร้างหน้าจอ และตำแหน่งกับขนาดเท่ากัน 2 ครั้งติดกัน (มองเห็นหรือไม่ก็ได้) แล้วคืนชิ้นส่วนนั้น
 * ใช้กับชิ้นส่วนที่อาจอยู่นอกจอ เช่น รอให้แผงที่เลื่อนเข้ามาจากข้างจอหยุดเลื่อน ก่อนอ่านหรือเลื่อนจอ
 * ชิ้นส่วนที่ไม่หยุดเคลื่อนที่เลยจะหมดเวลาที่นี่
 */
export async function waitUntilPlaced(spec: ElementSpec, timeoutMs: number = env.waitMs): Promise<WebdriverIO.Element> {
  const result: { element?: WebdriverIO.Element } = {};
  let previousRect: string | undefined;
  await browser.waitUntil(
    async () => {
      try {
        const element = await findElement(spec);
        if (element === undefined) {
          previousRect = undefined;
          return false;
        }
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
      timeoutMsg: `ไม่พบ${spec.description}ในโครงสร้างหน้าจอในตำแหน่งที่นิ่ง ภายใน ${timeoutMs / 1000} วินาที (หาด้วย ${describeLocator(spec)})`,
    },
  );
  if (result.element === undefined) throw new Error(`รอ${spec.description}จบแล้วแต่ไม่ได้ชิ้นส่วนกลับมา (ไม่ควรเกิด)`);
  return result.element;
}

/**
 * เลื่อนจอจนเห็นชิ้นส่วนที่มีอยู่ในโครงสร้างหน้าจอแต่อยู่นอกจอ แล้วคืนชิ้นส่วนที่มองเห็นและหยุดเคลื่อนที่ ใช้ก่อนแตะชิ้นส่วนในรายการที่เลื่อนได้
 * ตัวอย่าง: ปุ่มออกจากระบบท้ายแผงตั้งค่าแอปอยู่ที่ y=1018 ขณะที่จอสูง 874 จุด (ขั้นที่ 34) ต้องเลื่อนก่อนจึงแตะได้
 * ลำดับ
 *   1) รอจนชิ้นส่วนอยู่นิ่งในโครงสร้างหน้าจอ (waitUntilPlaced) เพราะแผงที่เลื่อนเข้ามาจากข้างจอยังขยับอยู่ช่วงหนึ่ง ถ้าสั่งเลื่อนจอตอนนั้น ผลจะไม่แน่นอน
 *   2) ถ้ายังมองไม่เห็น สั่งเลื่อนจอด้วย mobile: scroll แบบ toVisible ของตัวขับ xcuitest (ใช้ได้ผลบนเครื่องที่ใช้เทสในขั้นที่ 34)
 *   3) รอจนมองเห็นและหยุดเคลื่อนที่ (waitUntilSteady) ถ้าเลื่อนแล้วยังมองไม่เห็น จะหมดเวลาที่ขั้นนี้
 */
export async function scrollIntoView(spec: ElementSpec, timeoutMs: number = env.waitMs): Promise<WebdriverIO.Element> {
  const element = await waitUntilPlaced(spec, timeoutMs);
  if (!(await element.isDisplayed())) {
    // mobile: scroll แบบ toVisible = ให้ตัวขับเลื่อนรายการที่ชิ้นส่วนนี้อยู่ จนชิ้นส่วนเข้ามาอยู่ในจอ
    await browser.execute('mobile: scroll', { elementId: element.elementId, toVisible: true });
  }
  return waitUntilSteady(spec, timeoutMs);
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
