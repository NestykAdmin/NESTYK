# Agent leads — API

| | |
|--|--|
| กลับ | [README](./README.md) |
| Flow | [flow.md](./flow.md) |
| Database | [database.md](./database.md) |

Base: `/agent/leads` · Auth: Bearer JWT + role `agent`

---

## `GET /agent/leads`

Query: `rentRoomId`, `status`, `q` (name/phone), `sort`, `page`, `limit`

`sort`: `updated_desc` (default) | `created_desc` | `created_asc` | `name_asc` | `budget_asc` | `budget_desc` | `status_asc` | `status_desc`

`leads.updated_at` moves on every lead edit, status change and match-settings save (TypeORM `@UpdateDateColumn`), and also when a match run is stored (`POST /agent/leads/:id/match-runs`) and when a viewing is booked or changed (`POST /agent/leads/:id/viewings`, `PATCH /agent/viewings/:id` — move, cancel or note), in the same transaction. Clearing match results does not move it.

`status` (สถานะที่แสดง): `new` | `inprogress` | `viewing` | `booked` | `lost` — ค่าอื่นได้ 400 · `viewing` = ลีด `new` / `inprogress` ที่มีนัด `scheduled` ที่ยังไม่ถึงเวลา และ `new` / `inprogress` **ไม่รวม** ลีดเหล่านั้น (ตรงกับป้ายในแถว) — SQL `DISPLAY_STATUS_SQL` ใน `agent-leads.service.ts`

Response มี `statusCounts` = `{ new, inprogress, viewing, booked, lost }` นับตามคำค้นและตัวกรองทำเลเดียวกัน แต่**ไม่รวม** `status` (ใช้แสดงตัวเลขบนชิปสถานะทุกตัว; "ทั้งหมด" = ผลรวม)

---

## `GET /agent/leads/:id`

อ่านรายละเอียด — **ไม่เปลี่ยน status**

---

## `POST /agent/leads`

```json
{
  "rentRoomId": 42,
  "firstName": "สมหญิง",
  "lastName": "ใจดี",
  "phone": "0898765432",
  "email": "somying@email.com",
  "otherContacts": [{ "channel": "line", "value": "@somying" }],
  "source": "walk_in",
  "notes": "สนใจเฟอร์นิเจอร์ครบ",
  "status": "new"
}
```

**Response `201`:** `{ "id": 101, "status": "new", "tenantId": null }`  
(server บังคับ `status = new` แม้ client ส่งค่าอื่น)

---

## `PATCH /agent/leads/:id`

อัปเดตโปรไฟล์ / ความต้องการ — **ไม่รับเปลี่ยน status**

---

## `POST /agent/leads/:id/mark-inprogress`

เริ่มดูแล · จาก `new` หรือ `lost` → `inprogress` (เคลียร์ `lostReason`)

**Errors:** `409` ถ้า `booked`

---

## `POST /agent/leads/:id/mark-lost`

```json
{ "lostReason": "เลือกห้องอื่น" }
```

→ `status = lost` · `lostReason` บังคับ (1–500 ตัวอักษร)

**Errors:** `409` ถ้า `booked`

---

## `POST /agent/leads/:id/book`

จอง / เลือกเช่า — **promote เป็น tenant** (transaction)

1. `leads.status = booked`
2. `INSERT tenants` (copy name, phone, email จาก lead · `lead_id`)
3. `leads.tenant_id = tenants.id`

**Response `200`:**

```json
{
  "lead": {
    "id": 101,
    "status": "booked",
    "tenantId": 7
  },
  "tenant": {
    "id": 7,
    "leadId": 101,
    "name": "สมหญิง ใจดี",
    "phone": "0898765432",
    "userId": null
  }
}
```

**Errors**

| Code | กรณี |
|------|------|
| 409 | lead เป็น `booked` แล้ว / มี `tenant_id` แล้ว |
| 409 | ห้องมี tenant active อยู่แล้ว |

จากนั้น → [POST /agent/contracts](../contracts/api.md) ด้วย `leadId` หรือ `tenantId`

---

## `POST /agent/leads/:id/mark-lost`

(ย้ายไปด้านบน — ใช้ endpoint นี้สำหรับปิด lead พร้อมเหตุผล)
