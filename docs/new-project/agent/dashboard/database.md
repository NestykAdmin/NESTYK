# Agent Dashboard — Database

อ่านอย่างเดียว ไม่มีตารางหรือ migration ใหม่สำหรับ Dashboard
Query หลัก: `apps/api/src/agent/dashboard/dashboard-query.ts`
Service: `apps/api/src/agent/dashboard/agent-dashboard.service.ts`

| Source | ใช้สำหรับ |
|---|---|
| rent_rooms + master_room_statuses | สต็อก scout ของ Agent, availability, visibility |
| properties, master_room_types, rent_room_prices และ prices JSON เดิม | ห้อง preview 2 รายการ |
| leads | open count และ lead-added events |
| tenants + lease_contracts + agreement_templates/master_agreement_types | distinct current clients, signing, renewals และ contract-delivered events |
| tenant_bills เชื่อมสัญญาและผู้เช่าของ Agent | สรุปบิล, หนี้ทุกเดือน, payments และ payment-recorded events |
| lead_viewings เชื่อม lead/room ของ Agent | นัดดูห้องทั้งหมดของวันนี้ที่ไม่ยกเลิก รวมรายการเลยเวลา ดูห้องแล้ว และ Lead ที่ปิดแล้ว |
| agent_calendar_events ของ Agent | นัดทั้งหมดที่เพิ่มจากปฏิทินในวันนี้ รวมรายการที่เลยเวลาแล้ว พร้อมหัวข้อนัดหมาย |

ทุก source scope ด้วย created_by_user_id และตรวจผู้เช่า/ลีด/ห้องที่เชื่อมกันตาม Agent ของ request
ไม่ส่ง signatures, bank accounts, slip paths หรือ PDF URLs ใน summary

Summary ใช้ SQL statement เดียวสำหรับ counts/previews/events; work-items ใช้ CTE predicates ชุดเดียวกัน
Count และรายการของแต่ละหน้าคำนวณใน statement เดียว ป้องกัน total หายเมื่อหน้าปัจจุบันว่าง
การเปิด Dashboard ไม่เรียก ensure/insert bills; การออกบิลยังเป็นหน้าที่ billing scheduler/workflow เดิม

ค่าเช่ารายเดือนอิง due_date; received คือบิลในเดือนนั้นที่ยืนยัน paid แล้ว
pending และ overdue เป็นคนละส่วนของ unpaid; overdue ตรวจ grace_until ด้วยวันที่ Asia/Bangkok
บิลเก่าที่ยังค้างไม่ถูกซ่อนเพราะสัญญาสิ้นสุดแล้ว แต่ไม่ปนในยอดเดือนอื่น

ลูกค้าที่เพิ่งจองและยังไม่มีสัญญาอ่านจาก leads.tenant_id + status booked + booking_released_at ว่าง
ไม่นับ booked lead ที่ปล่อยการจองแล้ว และไม่ใช้ใบจองเก่ามาดึง former tenant กลับเข้า current clients

ไม่มี follow-up due date หรือ commission ledger ในรอบนี้ จึงไม่มี query คำนวณสองฟีเจอร์นี้จากข้อมูลที่ไม่เพียงพอ

ทดสอบด้วย PostgreSQL schema ชั่วคราว: `apps/api/test/agent-dashboard.test.cjs`
ทดสอบสัญญาหลายฉบับต่อคน, สถานะ active ค้างหลังหมดอายุ, lineage, หนี้ข้ามเดือน, literal search,
pagination เกิน 20 รายการ, วัน/เวลาข้ามเที่ยงคืน Bangkok และสิทธิ์ข้าม Agent
