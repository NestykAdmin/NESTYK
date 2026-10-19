# Agent calendar — API

ทุก endpoint ต้องเข้าสู่ระบบและมี role `agent`; ใช้ user ID จาก session เพื่อแยกข้อมูล

| Method | Path | หมายเหตุ |
|--------|------|----------|
| `GET` | `/agent/calendar/events?from=&to=` | นัดที่เพิ่มจากปฏิทิน เรียงตามเวลาและ ID |
| `POST` | `/agent/calendar/events` | บันทึกนัดที่ไม่ผูก Lead ใช้หัวข้อนัดหมายเพียงช่องเดียว |
| `PATCH` | `/agent/calendar/events/:id` | แก้หัวข้อ สถานที่ วันเวลา หรือเปลี่ยนสถานะ โดย `:id` เป็นเลข ID |
| `GET` | `/agent/viewings?from=&to=` | นัดดูห้องจาก Lead ไม่รวม `cancelled` |
| `POST` | `/agent/leads/:id/viewings` | สร้างนัดดูห้องจากหน้าห้องที่จับคู่ |
| `PATCH` | `/agent/viewings/:id` | เลื่อน / ยกเลิก / แก้หมายเหตุนัดดูห้อง |

## นัดจากปฏิทิน

`GET` รับ ISO datetime พร้อม timezone ช่วงบวกไม่เกิน 62 วัน โดยรวม `from` แต่ไม่รวม `to` (`[from,to)`) หน้าแอปดึงเดือนที่แสดงพร้อมเผื่อหนึ่งสัปดาห์ก่อนและหลัง

ตัวอย่าง `POST`:

```json
{
  "title": "รับกุญแจห้อง 1208",
  "location": "ล็อบบี้ The Line",
  "startsAt": "2026-10-16T16:00:00+07:00"
}
```

- `title`: ต้องมี สูงสุด 160 ตัวอักษร
- `location`: ไม่บังคับ สูงสุด 160 ตัวอักษร
- `startsAt`: ISO datetime พร้อม timezone; แอปแปลงวันและเวลาที่กรอกตาม Asia/Bangkok เสมอ
- ส่ง field อื่น เช่น user ID หรือ status ไม่ได้

รองรับ `kind` แบบไม่บังคับสำหรับ client รุ่นก่อน; client ใหม่ไม่ส่ง field นี้ และ API เก็บค่าว่างโดยไม่เปลี่ยนข้อมูลเก่า

ตอบ `201` เป็น `{id,title,kind,location,startsAt,status}` โดย `id` มี prefix `event-`, `startsAt` เป็น UTC ISO และสถานะเริ่มต้น `scheduled`

`PATCH` รับบางส่วนของ `{title,location,startsAt,status}` โดยต้องมีอย่างน้อยหนึ่ง field; สถานะที่รับคือ `scheduled`, `done`, `cancelled` ใช้ row lock ใน transaction เพื่อไม่ให้การแก้พร้อมกันทับข้อมูลจาก field อื่น

การยกเลิกเปลี่ยนสถานะเป็น `cancelled` โดยไม่ลบแถว และไม่รวมในรายการ Calendar หรือ Dashboard; นัดที่ยกเลิกแล้วแก้หรือเปิดใหม่ไม่ได้ (`409`) บัญชีอื่นแก้ไม่ได้ (`404`) ส่วนสถานะเก่า `pending` / `confirmed` อ่านเป็น `scheduled` เพื่อให้หน้าจอตรงกัน

ตาราง `agent_calendar_events` เก็บ user ID เจ้าของ พร้อม RLS; API เท่านั้นที่เข้าถึงข้อมูลได้ ไม่สร้าง Lead หรือ room viewing อัตโนมัติ

Dashboard รวมรายการเหล่านี้กับ `lead_viewings` ในตารางนัดทั้งหมดของวันนี้ รวมรายการที่เลยเวลาแล้ว พร้อม `kind: "custom"` และหัวข้อนัดหมาย

[README](./README.md) · [Flow](./flow.md)
