/**
 * อ่านโครงสร้างหน้าจอ (XML ที่ Appium ส่งมาจาก browser.getPageSource) เป็นรายการชิ้นส่วน
 *
 * ทำไมไฟล์หน้าจอของชุด session ใช้ตัวนี้ ไม่ใช้ findElement อย่างเดียว:
 *   - สถานะ "ถูกเลือก" ของแท็บอ่านได้จากค่า traits ในโครงสร้างหน้าจอ (ขั้นที่ 34: แท็บที่ถูกเลือกมี traits="Selected")
 *   - หน้าหลังล็อกอินมีข้อความชื่อซ้ำกันหลายชิ้น บางชิ้นมองไม่เห็น (ขั้นที่ 34: คำว่า "ผู้เช่า" ในเนื้อหาของหน้าภาพรวมที่ y=1522)
 *     findElement คืนชิ้นแรกที่ชื่อตรง ซึ่งอาจเป็นชิ้นที่มองไม่เห็น ส่วนการอ่านทั้งหน้าดูได้ทุกชิ้นในครั้งเดียว
 *   - การตรวจว่าข้อความ "ไม่มี" บนจอ (เช่น ตัวโหลดหายแล้ว) ต้องดูทุกชิ้นที่ชื่อตรง ไม่ใช่แค่ชิ้นแรก
 * การหาชิ้นส่วนในรายการนี้ทำผ่าน nodesInSource กับ shownInSource ใน src/screens/locators.ts (testID ก่อน แล้วจึงข้อความ และนับในรายงาน [วิธีหาชิ้นส่วน])
 * การแตะยังทำผ่าน src/screens/locators.ts เหมือนเดิม
 *
 * ค่า value ของชิ้นส่วนไม่ถูกเก็บในรายการนี้ เพราะอาจเป็นข้อความที่ผู้ใช้พิมพ์ หรือรหัสผ่านที่แอปเติมไว้
 */

/** ชิ้นส่วน 1 ตัวในโครงสร้างหน้าจอ (ชนิดไม่มีคำนำหน้า XCUIElementType เช่น Button, StaticText, Other) */
export interface ScreenNode {
  type: string;
  name: string;
  label: string;
  visible: boolean;
  traits: string;
  /** ตำแหน่งแนวตั้งบนจอ (จุด) เป็น NaN ถ้าโครงสร้างหน้าจอไม่มีค่า y */
  y: number;
}

const XML_ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const decodeXml = (text: string): string => text.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity] ?? entity);

/** แยกชิ้นส่วนทุกตัวจากโครงสร้างหน้าจอ ตามลำดับในไฟล์ */
export function parseNodes(source: string): ScreenNode[] {
  const nodes: ScreenNode[] = [];
  for (const tag of source.matchAll(/<XCUIElementType(\w+)\b([^>]*)>/g)) {
    const attrs: Record<string, string> = {};
    for (const attr of tag[2].matchAll(/\s([A-Za-z]+)="([^"]*)"/g)) attrs[attr[1]] = decodeXml(attr[2]);
    nodes.push({
      type: tag[1],
      name: attrs.name ?? '',
      label: attrs.label ?? '',
      visible: attrs.visible === 'true',
      traits: attrs.traits ?? '',
      y: Number(attrs.y ?? 'NaN'),
    });
  }
  return nodes;
}

/** อ่านโครงสร้างหน้าจอตอนนี้ แล้วแยกเป็นรายการชิ้นส่วน */
export async function readScreen(): Promise<ScreenNode[]> {
  return parseNodes(await browser.getPageSource());
}

/** traits ของชิ้นส่วนบอกว่าถูกเลือกอยู่หรือไม่ (ค่า traits มาจาก WebDriverAgent เช่น "Selected" หรือ "Button, Selected") */
export const isSelected = (node: ScreenNode): boolean => /\bSelected\b/.test(node.traits);
