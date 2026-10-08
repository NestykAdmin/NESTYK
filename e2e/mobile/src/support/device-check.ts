/**
 * ตรวจเครื่องมือบนเครื่องที่ใช้เทส (ไม่ใช่เทสของแอป)
 *
 * ลองหาปุ่มของหน้าต้อนรับด้วยวิธีหาหลายแบบ แล้วพิมพ์ว่าแบบไหนได้ผลบนเครื่องนี้ ใช้เวลาเท่าไร
 * เปิดด้วย E2E_DEVICE_CHECK=true (ค่าเริ่มต้นคือปิด) ผลของส่วนนี้ไม่ทำให้ชุดเทสผ่านหรือไม่ผ่าน
 *
 * ทำไมต้องมี: ในขั้นที่ 24 วิธีหาแบบเงื่อนไข (predicate) หาปุ่มของหน้าต้อนรับไม่เจอ ทั้งที่วิธี accessibility id เจอหลังจากนั้น 0.05 วินาที
 *   (ดูจากข้อความของ Appium ในไฟล์ Claude outputs/logs/appium-step24.log ของเครื่องที่ใช้เทส)
 *   ยังแยกไม่ได้ว่าเป็นเรื่องจังหวะหรือวิธีนั้นใช้กับแอปนี้ไม่ได้ ส่วนนี้ลองซ้ำตอนที่หน้าจอนิ่งแล้ว จึงตัดเรื่องจังหวะออกได้
 */
import { env } from '../config/env';
import { labelsFor } from '../labels/index';

interface Strategy {
  /** ชื่อที่พิมพ์ในผล */
  title: string;
  /** ชื่อวิธีหาตามมาตรฐาน WebDriver และของ Appium */
  using: string;
  /** ค่าที่ใช้หา */
  value: string;
}

/** พิมพ์ผลการลองวิธีหาแต่ละแบบ ต้องเรียกตอนที่หน้าต้อนรับพร้อมให้แตะแล้ว */
export async function runDeviceCheck(): Promise<void> {
  const label = labelsFor(env.appLanguage).preload.tapToEnter;
  const strategies: Strategy[] = [
    { title: 'accessibility id (วิธีที่ชุดเทสใช้)', using: 'accessibility id', value: label },
    { title: 'predicate: label == ข้อความ', using: '-ios predicate string', value: `label == "${label}"` },
    { title: 'predicate: label IN {ข้อความ}', using: '-ios predicate string', value: `label IN {"${label}"}` },
    { title: 'predicate: name == ข้อความ', using: '-ios predicate string', value: `name == "${label}"` },
    { title: 'class chain + เงื่อนไข', using: '-ios class chain', value: `**/XCUIElementTypeButton[\`label == "${label}"\`]` },
    { title: 'xpath ตามชื่อ', using: 'xpath', value: `//XCUIElementTypeButton[@name="${label}"]` },
    { title: 'class name (ปุ่มทั้งหมด)', using: 'class name', value: 'XCUIElementTypeButton' },
  ];

  console.log('[ตรวจเครื่อง] ลองวิธีหาชิ้นส่วนกับปุ่มของหน้าต้อนรับ (ไม่นับเป็นผลเทส)');
  for (const strategy of strategies) {
    const startedAt = Date.now();
    try {
      // findElements = คำสั่งระดับล่างของ WebDriver ที่ระบุวิธีหาได้ตรง ๆ ได้รายการว่างถ้าไม่เจอ
      const found = await browser.findElements(strategy.using, strategy.value);
      const elapsed = Date.now() - startedAt;
      const verdict = found.length > 0 ? `เจอ ${found.length} ชิ้น` : 'ไม่เจอ';
      console.log(`[ตรวจเครื่อง] ${strategy.title}: ${verdict} (${elapsed} มิลลิวินาที)`);
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      const message = (error as Error).message.split('\n')[0].slice(0, 160);
      console.log(`[ตรวจเครื่อง] ${strategy.title}: ตัวขับแจ้งข้อผิดพลาด (${elapsed} มิลลิวินาที): ${message}`);
    }
  }
}
