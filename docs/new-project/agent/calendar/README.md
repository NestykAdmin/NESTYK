# Agent — Calendar

เมนู **ปฏิทิน** ใน Consumer App โหมด Agent — **นัดดูห้องเป็นข้อมูลจริง** จาก `lead_viewings` ส่วนติดตามลูกค้าและเซ็นสัญญายังเป็นข้อมูลจำลอง

- ปฏิทินรายเดือน เลื่อนเดือน เลือกวัน และกลับวันนี้
- นัดดูห้อง: ดึง `GET /agent/viewings` ตามเดือนที่แสดง (เผื่อหนึ่งสัปดาห์ก่อนและหลัง) ทุกครั้งที่เปิดเมนูหรือเลื่อนเดือน ไม่รวมนัดที่ยกเลิก — สร้าง/เลื่อน/ยกเลิกนัดได้จากหน้าห้องที่จับคู่กับลีด ดู [leads/viewings.md](../leads/viewings.md)
- ติดตามลูกค้า และเซ็นสัญญา: fixtures ในวันปัจจุบันและวันใกล้เคียง
- เพิ่มนัดจำลองสำหรับวันที่เลือก ตรวจหัวข้อและเวลา `HH:mm` (เก็บใน state เท่านั้น)
- เก็บรายการ วันที่ เดือน และร่างฟอร์มในหน่วยความจำของหน้าหลัก สลับเมนูแล้วกลับมาได้ รีโหลด/เริ่มแอปใหม่จะรีเซ็ตส่วนที่เป็นข้อมูลจำลอง
- ใช้ shell เดิม สีเหลืองแบรนด์ และธีมสว่าง/มืด รองรับ TH/EN/ZH/JA

## ไฟล์หลัก

- `apps/consumer-app/components/AgentCalendarScreen.tsx` — UI body
- `apps/consumer-app/lib/agent-calendar-viewings.ts` — ช่วงวันที่ที่ดึง และแปลง `LeadViewing` เป็นรายการในปฏิทิน
- `apps/consumer-app/lib/agent-calendar-demo.ts` — fixtures ติดตามลูกค้า/สัญญา และวันที่แบบ local
- `apps/consumer-app/app/index.tsx` — เชื่อมเมนู ดึงนัดดูห้อง และเก็บ state
- `packages/i18n/src/locales/*` — `agent.calendar.*`

หน้า web แยกใน `apps/agent` และ role อื่นไม่ได้เปลี่ยนในงานนี้

[Flow](./flow.md) · [API](./api.md)
