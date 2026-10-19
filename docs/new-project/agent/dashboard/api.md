# Agent Dashboard API

เชื่อม Mobile Dashboard กับข้อมูลจริงแล้ว (16 ตุลาคม 2026)
Base URL: `/api/v1/agent/dashboard` · Bearer token · role `agent`

## GET /agent/dashboard

Query: `period=YYYY-MM` (ไม่บังคับ; default เดือนปัจจุบันใน Asia/Bangkok)

Response ใช้ `AgentDashboardData` ใน `packages/types/src/agent-dashboard.ts`:

- `computedAt`, `today`, `timezone`, `period`
- `business`: ห้องพร้อมเสนอ/ห้องทั้งหมด, ลีดเปิด, ลูกค้าปัจจุบัน distinct และผู้เช่าปัจจุบัน
- `actionRequired`: counts/amount ของ overdue_payment, awaiting_signature, renewal และสถานะไม่รองรับของ lead_follow_up
- `schedule`: นัดดูห้องจาก Lead และนัดที่เพิ่มจากปฏิทินทั้งหมดของวันนี้ตาม Asia/Bangkok รวมรายการที่เลยเวลาแล้ว ไม่มีข้อจำกัดจำนวน พร้อม total; นัดจากปฏิทินมี `kind: custom` และใช้หัวข้อนัดหมาย
- `inventory`: availability/visibility แยกแกน และ preview 2 ห้องล่าสุด
- `clients`: กลุ่มเตรียมสัญญา/รอลงนาม/กำลังเช่าแบบไม่ซ้ำคน และ renewal ใกล้สุด
- `rent`: ยอดบิลที่ออกแล้วในเดือนตาม due_date; totalDue, received, unpaid, overdue และ pending (ยังไม่เกิน grace)
- `commission`: status `not_configured`, total/received/pending เป็น null
- `activity`: ไม่เกิน 3 เหตุการณ์จากวันสร้างลีด, วันส่งสัญญา และวันยืนยันรับชำระจริง พร้อม source IDs

`lead_follow_up` มี status `not_configured` และ count null; `business.commissionPending` เป็น null
Mobile แสดง **ยังไม่รองรับ** และปิดการกดสองฟีเจอร์นี้ ไม่มีตัวเลขตัวอย่างในโหมดใช้งานจริง

ไม่มีการสร้างบิล ลงนาม หรือบันทึกการเงินจาก endpoint นี้ ส่วนวันที่/ชื่อประเภท/ข้อความแสดงผลใช้ locale ที่ client
`computedAt` คือเวลาคำนวณ ไม่ใช่ last-modified timestamp ของข้อมูลต้นทาง

## GET /agent/dashboard/work-items

Query:

| Query | ค่า |
|---|---|
| kind | overdue_payment / awaiting_signature / renewal / rent (บังคับ) |
| period | YYYY-MM; ใช้กับรายการ rent |
| q | ค้นหาชื่อบุคคล โครงการ ห้อง หรือเลขเอกสาร แบบ literal ไม่เกิน 255 ตัวอักษร |
| page | เริ่มที่ 1 |
| limit | default 20, สูงสุด 50 |

Response: `{ items: DashboardWorkItem[], total, page, limit }`

รายการมี stable ID ตามแหล่ง (`bill:`, `signing:`, `renewal:`, `rent:`), tenantId, contractId, billId,
ชื่อบุคคล/โครงการ/ห้อง, เลขเอกสาร, วันที่, ยอดเงิน และ awaitingReview
ค้นหาก่อนแบ่งหน้า เรียงวันที่แล้ว ID; counts ใช้ predicates เดียวกับ summary
แต่ละ request เป็น snapshot ของตัวเอง จำนวนอาจเปลี่ยนระหว่าง request หากมีการแก้ข้อมูลพร้อมกัน

- overdue_payment ครอบคลุมหนี้ทุกเดือน รวมบิลในประวัติสัญญาที่สิ้นสุดแล้ว
- rent เฉพาะบิลเดือนที่เลือก รวม paid/pending/overdue/awaiting_review
- การกดรายการเปิดผู้เช่าจริงและสัญญาที่สัมพันธ์กัน หรือหน้าบิลของบุคคลนั้น
- คงคำค้น/หน้ารายการเมื่อกลับจากรายละเอียด และล้างเมื่อเปลี่ยนบัญชี/บทบาท

## กฎและข้อจำกัด

- ทุกแหล่งกรองตาม Agent ใน token; ไม่รับ agentId จาก query
- ห้องเฉพาะ scout ของ Agent; available ไม่ใช่ published
- Open leads = new/inprogress; booked/lost ไม่นับ
- ลูกค้าที่เพิ่งจองและสร้าง tenant แล้วแต่ยังไม่มีสัญญา จะอยู่กลุ่มเตรียมสัญญา เฉพาะการจองที่ยังไม่ปล่อย
- Current clients ไม่รวมผู้เช่าที่เหลือเฉพาะประวัติสิ้นสุด รวมทั้งสถานะ active ที่วันสิ้นสุดผ่านแล้ว และใบจองเก่าที่มีสัญญาเช่าต่อแล้ว
- Signing ใช้สถานะ awaiting_signatures และตรวจ parties ตามชนิดเอกสาร
- Renewal = active lease/renewal ที่เริ่มแล้ว เหลือ 0–30 วัน และไม่มี successor ที่ยังไม่ cancelled
- ค่าเช่าใช้บิลที่มีอยู่จริง ไม่รวมเงินจอง/มัดจำ/ค่าคอม และไม่ใช่ projected rent หรือ cash flow ตาม paid_at ของเดือนอื่น
- สลิปรอตรวจยังไม่ถือว่าจ่ายแล้ว; overdue ใช้วันนี้ > grace_until ตาม Asia/Bangkok
- บัญชีใหม่ได้ available + 0 / []; เครือข่าย/ฐานข้อมูลล้มเหลวแสดง error/retry ไม่เติมยอดศูนย์
- KPI ภาพรวมยังเปิดแท็บรายการหลัก; งานเร่งด่วนและดูการชำระเงินเปิดรายการจาก Dashboard ที่ค้นหา/แบ่งหน้าได้

## Errors / Tests

400 invalid/repeated/unknown query หรือ kind ที่ไม่รองรับ · 401 ไม่ login · 403 role อื่น · 503 แหล่งข้อมูลไม่พร้อม

```bash
RUN_DASHBOARD_DB_TEST=1 npm run test:agent-dashboard -w @nestyk/api
node --test apps/consumer-app/components/agent-dashboard.test.cjs
```

Integration tests ใช้ schema ชั่วคราวและข้อมูลจำลอง แยกจากข้อมูลใช้งานจริง และลบ schema หลังทดสอบ
