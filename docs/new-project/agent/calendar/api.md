# Agent calendar — API

| | |
|--|--|
| กลับ | [README](./README.md) |
| Flow | [flow.md](./flow.md) |

---

## สถานะ

**นัดดูห้อง** ใช้ API ของลีด — ดูรายละเอียดใน [leads/viewings.md](../leads/viewings.md)

| Method | Path | หมายเหตุ |
|--------|------|----------|
| `GET` | `/agent/viewings?from=&to=` | ISO datetime · ช่วงไม่เกิน 62 วัน · ไม่รวม `cancelled` · เรียงตามเวลา |
| `POST` | `/agent/leads/:id/viewings` | สร้างนัด (จากหน้าห้องที่จับคู่) |
| `PATCH` | `/agent/viewings/:id` | เลื่อน / ยกเลิก / แก้หมายเหตุ |

ติดตามลูกค้า และเซ็นสัญญา **ยังไม่มี API** — ใช้ข้อมูลจำลองและ React state เท่านั้น

---

## อนาคต (draft)

- ติดตามลูกค้า: derive จาก `leads` (เช่นวันนัดติดตาม) หรือตาราง events แยก
- เซ็นสัญญา: derive จากสัญญาที่รอเซ็น
- นัด manual ที่ไม่ผูกลีด: `POST /agent/calendar/events` หากจำเป็น
