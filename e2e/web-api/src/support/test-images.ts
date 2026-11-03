/**
 * ไฟล์ภาพสังเคราะห์ขนาดเล็กสำหรับเทสอัปโหลดรูปโปรไฟล์ (สร้างด้วย sharp ในห้องทดลอง 3 พ.ย. 2026 ไม่มีข้อมูลของใคร)
 * ใช้ภาพสีพื้นเท่านั้น เพราะไฟล์ที่อัปโหลดสำเร็จจะอยู่ใน bucket สาธารณะ ใครมี URL ก็เปิดได้
 */

/** แปลง base64 เป็นไฟล์สำหรับ multipart */
function file(name: string, mimeType: string, base64: string) {
  return { name, mimeType, buffer: Buffer.from(base64, 'base64') };
}

/** PNG 4x3 พิกเซล สีน้ำเงิน (94 ไบต์) */
export const PNG_BLUE = () =>
  file('e2e-blue.png', 'image/png', 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWMwTjsDRww4OQA/XBC9rAe9TAAAAABJRU5ErkJggg==');

/** PNG 4x3 พิกเซล สีส้ม (94 ไบต์) ใช้เป็นรูปที่ 2 ตอนอัปโหลดซ้ำ */
export const PNG_ORANGE = () =>
  file('e2e-orange.png', 'image/png', 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWM4k2YMRww4OQBNtBC9EPF4ggAAAABJRU5ErkJggg==');

/** GIF 2x2 พิกเซล (43 ไบต์) API ไม่รับ GIF */
export const GIF_TINY = () => file('e2e-tiny.gif', 'image/gif', 'R0lGODlhAgACAIAAAExpcQAAACH5BAUAAAAALAAAAAACAAIAAAICjFMAOw==');

/** ไฟล์ข้อความที่ตั้งชื่อและชนิดว่าเป็น PNG (API ดูชนิดจากเนื้อไฟล์ ไม่ดูชื่อหรือชนิดที่ส่งมา) */
export const TEXT_AS_PNG = () => ({ name: 'e2e-not-an-image.png', mimeType: 'image/png', buffer: Buffer.from('e2e: this is not an image') });

/** เพดานขนาดไฟล์ของ API: MAX_PROFILE_AVATAR_BYTES = 5 MB (profile-avatar-storage.service.ts บรรทัด 6 ที่ develop accb616) */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
