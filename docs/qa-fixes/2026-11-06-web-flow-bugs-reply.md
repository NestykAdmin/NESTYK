# ตอบ QA: บั๊กหน้าเว็บจากเทส flow — 6 พ.ย. 2026

- **จาก:** Jom
- **ถึง:** Aof (QA)
- **ตอบเอกสาร:** `nestyk-web-flow-bugs-for-dev-2026-11-06.md`
- **โค้ดที่แก้:** branch `feature/register` (ต่อจาก `cb13d85`) ยังไม่ commit จะแจ้งเลข commit อีกครั้งเมื่อ merge เข้า `pre/dev/review`

## สรุป

| เรื่อง | สถานะ | เทสของ QA ที่คาดว่าจะเห็น |
| --- | --- | --- |
| 1. `/tenant/home` แสดงสัญญาตัวอย่าง | **ยังไม่แก้** รอทีมตัดสินว่าหน้านี้ควรแสดงอะไร | ยังล้มตามคาด (known-bug เดิม) |
| 2. "Confirmed rent" ขึ้นทั้ง error และ "ยังไม่มีค่าเช่า" | **แก้แล้ว** | "Expected to fail, but passed" |
| 3. "Failed to fetch" | **แก้แล้ว** | "Expected to fail, but passed" ทั้ง 2 ข้อ |
| 4. ออกจากระบบแล้วแท็บอื่นไปคนละหน้า | **ข้ามไปก่อน** ตามที่คุยกับ QA (QA จะตั้งผ่าน ENV เอง) | ผลเหมือนเดิม ดูหัวข้อ 4 |

## เรื่องที่ 1: `/tenant/home` (เมนู "อยู่อาศัย") — ยังไม่แก้

- ยืนยันสาเหตุตามที่ QA เขียน ข้อความทั้งการ์ดเขียนตายไว้ใน `apps/consumer-app/app/index.tsx:1207-1220` มาตั้งแต่ตอนตั้งโปรเจกต์ (`e2f88ad`, 3 ก.ย. 2026) เป็นหน้าตัวอย่างที่ยังไม่ได้ต่อ API ทุกบัญชีจึงเห็นข้อมูลชุดเดียวกัน
- แท็บนี้มีในแถบล่างของผู้เช่าบนแอปมือถือด้วย (`packages/ui/src/config/mobileTabMatrix.ts:24`) ไม่ใช่แค่บนเว็บ
- หน้าภาพรวมของผู้เช่า (`/tenant`) เป็นคนละหน้า ไม่เกี่ยวกับเรื่องนี้
- เมื่อทีมตัดสินแล้วจะแจ้งอีกครั้ง

## เรื่องที่ 2: การ์ด "Confirmed rent" — แก้แล้ว

- `apps/consumer-app/components/OwnerConfirmedRent.tsx`
  - ข้อความ "Rent appears here after the agent confirms the slip." ขึ้นเฉพาะเมื่อโหลดสำเร็จและไม่มีบิลที่ชำระแล้ว (เพิ่ม `&& !error` ตามที่ QA เสนอ)
  - **เพิ่มจากที่ QA แจ้ง:** ตอนโหลดใหม่ (กดรีเฟรช) ล้าง error ของรอบก่อนทุกครั้ง เดิม error ค้างอยู่แม้รอบใหม่โหลดสำเร็จ
- เทสฝั่ง dev: `apps/consumer-app/components/owner-confirmed-rent.test.cjs` (ใหม่ 2 ข้อ)

## เรื่องที่ 3: "Failed to fetch" — แก้แล้ว

ใช้ทั้ง 2 แนวทางที่ QA เสนอ

- `apps/consumer-app/lib/api.ts`: คำขอที่ไม่ได้คำตอบเลย (เน็ตหลุด, เซิร์ฟเวอร์ล่ม, ถูกบล็อก) กลายเป็น `ApiError` ที่ `status = 0`, `code = 'NETWORK_ERROR'`
  - `message` ยังเป็นข้อความเดิมของเบราว์เซอร์ ไว้ดูใน log
  - คำขอที่ผู้เรียกยกเลิกเอง (`AbortError`) ยังส่งต่อเหมือนเดิม
  - เน็ตหลุดไม่นับเป็น session หมดอายุ
- `packages/i18n/src/error-message.ts` (`localizedError`): นับเป็นข้อความสำหรับนักพัฒนา และแสดงข้อความสำรองที่แปลแล้วเสมอทุกภาษา สำหรับ
  - `code = 'NETWORK_ERROR'`
  - `AuthRetryableFetchError` ของ Supabase (เน็ตหลุดตอนเรียก Supabase Auth)
  - `TypeError` ทุกตัว (เช่น `fetch` ที่ไม่ได้ผ่าน `api.ts`)
- **ขอบเขต:** มีผลกับทุกหน้าที่ใช้ `localizedError` ไม่ใช่แค่ 2 จุดที่ QA ยืนยัน ครอบคลุมข้อความของ Chrome ("Failed to fetch"), Safari ("Load failed"), Firefox ("NetworkError when attempting to fetch resource.") และแอปมือถือ ("Network request failed")
- **ถ้าชุดเทสของ QA ตรวจ status ของ error เครือข่าย:** ตอนนี้เป็น `0` และ `code` เป็น `NETWORK_ERROR`
- เทสฝั่ง dev: `lib/api.test.cjs` (+2), `lib/localized-error.test.cjs` (+1)

## เรื่องที่ 4: ออกจากระบบในแท็บหนึ่ง — ข้ามไปก่อน

- **รอบนี้ไม่ได้แก้โค้ด** ตามที่ตกลงกับ QA ว่าจะตั้งผ่าน ENV เอง
- ตอนตรวจ เทส 3 ข้อใน `session-idle.spec.ts` จะได้ผลเหมือนรอบ 6 พ.ย.
  - 'signing out in one tab sends the other tab to the login page' ยังผ่านบ้างไม่ผ่านบ้าง
  - อีก 2 ข้อยังล้มตาม known-bug
  - ไม่ใช่ผลจากการแก้รอบนี้
- **ข้อมูลไว้ใช้ภายหลัง:** dev ดูโค้ดแล้ว ข้อสันนิษฐานของ QA เรื่องผลแบบเช้าเป็นไปได้จริง
  - `endSession` เรียก `supabase.auth.signOut({ scope: 'local' })` ก่อน แล้วค่อยเขียน `signedOut` (`AuthContext.tsx:343-350`)
  - ระหว่างนั้น session ที่ทุกแท็บใช้ร่วมกันถูกลบไปแล้ว แท็บอื่นที่ยิง API พอดีจะเขียน `expired` ทับ
  - ถ้าจะแก้ภายหลัง ให้เขียนเหตุผลก่อนเรียก Supabase

## เรื่องที่ QA ขอยืนยัน: ตัวเลขบนแดชบอร์ดนายหน้า

ยืนยันตามที่ QA เข้าใจ (`apps/api/src/agent/dashboard/agent-dashboard.service.ts`)

| การ์ด | นิยาม | บรรทัด |
| --- | --- | --- |
| Open leads | ลีดสถานะ `new` + `inprogress` (Normal + In care) | `:130` |
| Available listings | ห้องที่ `dealStatus === 'available'` เท่านั้น | `:133` |

ห้องทั้งหมดของนายหน้าส่งแยกเป็น `totalListings` QA เพิ่มเทสเทียบตัวเลขได้เลย

## อื่น ๆ ที่อยู่ในรอบเดียวกัน (แอปมือถือ)

- **hCaptcha บนมือถือ:** เดิมโจทย์ภาพ (ลาก/เลือกรูป) ถูกตัดเหลือแค่แถบหัว เพราะกล่องล็อกไว้ 304×78 แก้ให้กล่องขยายเมื่อโจทย์เปิด และหดกลับเมื่อปิด/ผ่าน (`apps/consumer-app/components/HcaptchaField.tsx`) มีผลกับ login, สมัคร, ลืมรหัส บนแอปมือถือ เว็บไม่เปลี่ยน
- ขอให้ QA ลองบนเครื่องจริงตอนที่โดนโจทย์ (เช่น login ผิดหลายรอบติดกัน) ว่าเห็นโจทย์ครบ ลากได้ กดยืนยันได้ โดยเฉพาะจอเล็ก
