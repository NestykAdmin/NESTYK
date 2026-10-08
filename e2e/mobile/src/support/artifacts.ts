/**
 * เก็บหลักฐานเมื่อเทสไม่ผ่าน: โครงสร้างหน้าจอ (รายการชิ้นส่วนทั้งหมดในรูปแบบ XML) และภาพหน้าจอ
 *
 * ทำไมเก็บ 2 อย่าง: ภาพบอกว่าผู้ใช้เห็นอะไร ส่วนโครงสร้างหน้าจอบอกว่าเครื่องมือเทสเห็นอะไร
 *   เช่น ชิ้นส่วนอยู่บนจอแต่ชื่อกำกับไม่ตรงกับที่เทสหา จะเห็นได้จากไฟล์ XML เท่านั้น
 *   อีกข้อที่เห็นจากภาพหน้าจอของขั้นที่ 24 (step24_artifact_2_after_enter.png): ภาพไม่แสดงค่าในช่องรหัสผ่านที่กำลังซ่อนตัวอักษร
 *   ช่องจึงดูว่างในภาพ ทั้งที่ไฟล์ XML ของตอนเดียวกันบอกว่าช่องมีค่าอยู่
 *
 * รหัสผ่านต้องไม่ไปอยู่ในหลักฐาน:
 *   - ในไฟล์ XML ค่าของช่องรหัสผ่านถูกแทนด้วยคำว่า (ซ่อน) เสมอ
 *   - ภาพหน้าจอซ่อนค่าไม่ได้ จึงไม่ถ่ายเมื่อช่องรหัสผ่านกำลังแสดงตัวอักษร
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inEveryLanguage } from '../labels/index';
import { PASSWORD_FIELD_TEST_ID } from '../screens/LoginScreen';

/** โฟลเดอร์เก็บหลักฐาน (อยู่ใน .gitignore) */
export const RESULTS_DIR = path.resolve('test-results');

/** ข้อความกำกับของช่องรหัสผ่านในทุกภาษาที่ชุดเทสรู้จัก */
const PASSWORD_FIELD_LABELS = inEveryLanguage((labels) => labels.auth.password);

/** แท็กเปิดของช่องกรอกทั้ง 2 ชนิดในโครงสร้างหน้าจอ */
const TEXT_FIELD_TAG = /<XCUIElementType(?:Secure)?TextField\b[^>]*>/g;

const isSecureField = (tag: string): boolean => tag.startsWith('<XCUIElementTypeSecureTextField');

/** แท็กนี้เป็นช่องรหัสผ่านที่กำลังแสดงตัวอักษรหรือไม่ (ดูจาก testID หรือข้อความกำกับ เพราะชนิดเป็น TextField ธรรมดา) */
const isVisiblePasswordField = (tag: string): boolean =>
  !isSecureField(tag) &&
  (tag.includes(`name="${PASSWORD_FIELD_TEST_ID}"`) ||
    PASSWORD_FIELD_LABELS.some((label) => tag.includes(`name="${label}"`) || tag.includes(`label="${label}"`)));

/** แทนค่าของช่องรหัสผ่านในโครงสร้างหน้าจอด้วยคำว่า (ซ่อน) ทั้งตอนซ่อนและตอนแสดงตัวอักษร */
export function maskPasswordValues(pageSource: string): string {
  return pageSource.replace(TEXT_FIELD_TAG, (tag) =>
    isSecureField(tag) || isVisiblePasswordField(tag) ? tag.replace(/\svalue="[^"]*"/, ' value="(ซ่อน)"') : tag,
  );
}

/** หน้าจอนี้มีช่องรหัสผ่านที่กำลังแสดงตัวอักษรอยู่หรือไม่ */
export function showsPasswordCharacters(pageSource: string): boolean {
  return (pageSource.match(TEXT_FIELD_TAG) ?? []).some(isVisiblePasswordField);
}

/** แปลงชื่อเทสเป็นชื่อไฟล์ที่ใช้ได้ทุกระบบ */
function fileSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'test'
  );
}

/** เก็บโครงสร้างหน้าจอกับภาพหน้าจอของเทสที่ไม่ผ่าน คืนที่อยู่ของไฟล์ที่เก็บได้ */
export async function saveFailureArtifacts(testTitle: string): Promise<string[]> {
  const saved: string[] = [];
  const base = path.join(RESULTS_DIR, `${Date.now()}-${fileSlug(testTitle)}`);
  mkdirSync(RESULTS_DIR, { recursive: true });

  // อ่านโครงสร้างหน้าจอก่อน เพราะใช้ตัดสินว่าถ่ายภาพหน้าจอได้ไหม
  let pageSource: string | undefined;
  try {
    pageSource = await browser.getPageSource();
    writeFileSync(`${base}.xml`, maskPasswordValues(pageSource));
    saved.push(`${base}.xml`);
  } catch (error) {
    console.log(`  เก็บโครงสร้างหน้าจอไม่ได้: ${(error as Error).message}`);
  }

  if (pageSource !== undefined && showsPasswordCharacters(pageSource)) {
    console.log('  ไม่เก็บภาพหน้าจอของเทสข้อนี้ เพราะช่องรหัสผ่านกำลังแสดงตัวอักษร (ดูไฟล์ XML แทน)');
    return saved;
  }
  try {
    await browser.saveScreenshot(`${base}.png`);
    saved.push(`${base}.png`);
  } catch (error) {
    console.log(`  เก็บภาพหน้าจอไม่ได้: ${(error as Error).message}`);
  }
  return saved;
}
