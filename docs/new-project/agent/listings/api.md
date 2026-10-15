# Agent listings — API

| | |
|--|--|
| กลับ | [README](./README.md) |
| Flow | [flow.md](./flow.md) |
| Database | [database.md](./database.md) |

Base: `/agent/listings` · Auth: Bearer JWT + role `agent`

**Scope:** อ่าน/แก้ scout room ที่ `created_by_user_id = agent` เท่านั้น

สร้างห้องใหม่ → [create-room/api.md](../create-room/api.md) (`POST /agent/rooms`)

---

## `GET /agent/listings`

รายการห้อง scout ของ agent

**Query**

| Param | Type | หมายเหตุ |
|-------|------|----------|
| `page` | int | default `1` |
| `limit` | int | default `20` · max `50` |
| `q` | string | ค้นหา property name · listing title · property owner name/phone |
| `visibility` | `private` \| `published` | optional filter |

**Server filter (บังคับ)**

```
is_scout_room = true
AND created_by_user_id = :currentAgentId
```

**Response `200`**

```json
{
  "items": [
    {
      "id": 42,
      "listingTitle": "ห้องสวย วิวดี",
      "visibility": "private",
      "isScoutRoom": true,
      "roomStatusCode": "available",
      "property": {
        "id": 5,
        "name": "ลุมพินี พาร์ค",
        "district": "พญาไท",
        "province": "กรุงเทพมหานคร"
      },
      "propertyOwner": {
        "id": 12,
        "name": "คุณสมชาย",
        "phone": "0812345678"
      },
      "prices": [{ "contractTypeCode": "monthly_12", "price": 12000 }],
      "coverMediaUrl": "https://...",
      "latitude": 13.737,
      "longitude": 100.56,
      "roomTypeCode": "studio",
      "availableFromDate": "2026-10-15",
      "leadCount": 3
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

`leadCount` optional — aggregate จาก `leads` ที่ `rent_room_id = id`

`latitude` / `longitude` — พิกัดห้อง ถ้าไม่มีใช้พิกัดตึก (`property`); `null` เมื่อไม่มีทั้งคู่ ใช้คำนวณผล matching เบื้องต้นฝั่ง client (`limit` สูงสุด 50)

`roomTypeCode` — `master_room_types.code` ของห้อง หรือ `null` ใช้เทียบประเภทห้องในผล matching

`availableFromDate` — วันที่ห้องว่าง (`YYYY-MM-DD`) ใช้เทียบวันย้ายเข้าในผล matching

---

## `GET /agent/listings/:id`

รายละเอียดห้อง scout — 403/404 ถ้าไม่ใช่ของ agent หรือไม่ใช่ scout

**Response `200`**

```json
{
  "id": 42,
  "listingTitle": "ห้องสวย วิวดี",
  "listingDescription": "...",
  "visibility": "published",
  "isScoutRoom": true,
  "roomStatusCode": "available",
  "availableFromDate": "2026-04-01",
  "waterRatePerUnit": 18,
  "electricRatePerUnit": 7,
  "prices": [{ "contractTypeCode": "monthly_12", "price": 12000 }],
  "property": { "id": 5, "name": "...", "address": "..." },
  "propertyOwner": { "id": 12, "name": "...", "phone": "..." },
  "layout": [{ "code": "bedroom", "value": "1" }],
  "facilities": [],
  "medias": [{ "mediaUrl": "...", "category": "room", "isCover": true, "sortOrder": 0 }],
  "documents": [],
  "nearbyPlaces": [],
  "viewCount": 0,
  "createdAt": "2026-03-01T10:00:00Z"
}
```

---

## `PATCH /agent/listings/:id/visibility`

สลับ tag public/private

```json
{ "visibility": "published" }
```

**Validation**

- `visibility` ∈ `private` | `published`
- room ต้อง `is_scout_room = true` และเป็นของ agent

**Response `200`**

```json
{ "id": 42, "visibility": "published" }
```

---

## `PATCH /agent/listings/:id`

แก้ประกาศ scout (partial update)

```json
{
  "listingTitle": "ห้องใหม่ ราคาพิเศษ",
  "prices": [{ "contractTypeId": 1, "price": 11500 }],
  "visibility": "private",
  "contactId": 12
}
```

**ห้าม** ส่ง `isScoutRoom`, `ownerId`, `createdByUserId`

**Response `200`:** body เหมือน `GET /agent/listings/:id`

---

## Endpoints ที่เกี่ยวข้อง (create-room pack)

| Method | Path | ใช้เมื่อ |
|--------|------|----------|
| `POST` | `/agent/rooms` | สร้างห้องใหม่ |
| `POST` | `/agent/rooms/media/upload` | อัปโหลดรูปใน wizard |
| `GET` | `/agent/rooms/contacts` | picker ผู้ติดต่อ |
| `GET` | `/agent/rooms/contacts/:id` | รายละเอียดผู้ติดต่อ |
| `PATCH` | `/agent/rooms/contacts/:id` | แก้ไขข้อมูลหลักของผู้ติดต่อ |
| `GET` | `/agent/rooms/owner-contacts` | เจ้าของห้องที่ยังไม่เคยปล่อยเช่า (Owner) |
| `GET` | `/agent/rooms/landlord-contacts` | เจ้าของห้องที่เคยปล่อยเช่าแล้ว (Landlord) |
| `GET` | `/agent/rooms/room-types` | master ประเภทห้อง |
| `GET` | `/agent/rooms/contract-types` | master ประเภทสัญญา |
| `GET` | `/agent/rooms/property-owners` | เจ้าของห้องจริง — ใช้ตอนทำสัญญา |
| `GET` | `/agent/rooms/properties` | reuse โครงการ |

ทั้งสอง endpoint คืนข้อมูล `{ id, name, phone, roomCount }[]` ทั้งหมด เรียงตามชื่อ
โดยเลือกผู้ติดต่อของ Agent ปัจจุบันที่ผูกกับ scout room ของตนเองซึ่งมี source `owner`

- Owner: เจ้าของที่ยังไม่มีประวัติการปล่อยเช่าในห้อง source `owner` ที่เชื่อมกับตน
- Landlord: เจ้าของที่มีประวัติการปล่อยเช่าอย่างน้อยหนึ่งห้อง แม้ปัจจุบันทุกห้องจะว่าง

แบ่งกลุ่มตามตัวผู้ติดต่อ ไม่ใช่แยกตามสถานะปัจจุบันของแต่ละห้อง เมื่อเคยเป็น Landlord แล้ว
การย้ายออก หมดสัญญา หรือยกเลิกสัญญาจะไม่ทำให้กลับไปอยู่ใน Owner
ใช้ประวัติการเข้าพัก/สัญญาเช่าหรือสัญญาต่ออายุที่เคยมีผล ตามกฎเดียวกับ Tenant
สัญญาร่าง หนังสือจอง และรายการ prospect เพียงอย่างเดียวยังไม่ถือว่าเคยปล่อยเช่า
แต่ละคนแสดงในกลุ่มเดียว และ `roomCount` นับห้อง source `owner` ทั้งหมดที่เชื่อมกับคนนี้
ไม่รวม Co-Agent หรือข้อมูลห้อง/สัญญาของ Agent อื่น

### รายละเอียดและการแก้ไขผู้ติดต่อ

รายชื่อ Lead/Tenant และกฎการคงประเภท Tenant หลังจบสัญญาอยู่ใน [Contact directory](../contacts.md)

`GET contacts/:id` คืน `{ id, name, phone, email, lineId, facebook, note }` ของผู้ติดต่อที่เป็นของ Agent ปัจจุบันเท่านั้น
`PATCH contacts/:id` รับเฉพาะ `name`, `phone`, `email`, `lineId`, `facebook`, `note`
ส่งเฉพาะช่องที่ต้องการแก้ได้ และล้างช่องเสริมด้วย `null` หรือข้อความว่างได้ ชื่อและเบอร์โทรต้องไม่ว่าง
ขีดจำกัดความยาว: ชื่อ/อีเมล/Facebook 255, เบอร์โทร 50, LINE ID 100, หมายเหตุ 500 ตัวอักษร

อัปเดตแถวเดิมใน `contacts` โดยคงรหัสและความสัมพันธ์ `rent_room_contacts` ไว้
รายชื่อ Owner/Landlord, picker ผู้ติดต่อ, รายการห้อง, รายละเอียดห้อง และลิงก์แชร์ที่แสดงผู้ติดต่อนี้จึงอ่านข้อมูลใหม่จากแหล่งเดียวกัน
แอปอัปเดตรายชื่อและชื่อบนหัวหน้ารายละเอียดทันทีหลังเซฟ พร้อมทำให้ข้อมูลห้องที่เกี่ยวข้องโหลดใหม่
ข้อมูลที่เป็น snapshot ในเอกสารสัญญาที่ออกแล้วไม่ได้ถูกแก้ย้อนหลังด้วย endpoint นี้

เบอร์โทรซ้ำกับผู้ติดต่อคนอื่นใน Agent เดียวกันคืน `409` โดยไม่รวมคนหรือเปลี่ยนรหัสผู้ติดต่อ
การอ่าน/แก้ไขรหัสคนของ Agent อื่นหรือรหัสที่ไม่มีอยู่คืน `404` และข้อมูลช่องที่ไม่รองรับหรือผิดรูปแบบคืน `400`

---

## Errors

| Code | กรณี |
|------|------|
| 401 | ไม่มี JWT |
| 403 | ไม่มี role `agent` |
| 404 | ไม่พบห้อง / ไม่ใช่ scout / ไม่ใช่ของ agent |
| 400 | visibility ไม่ถูกต้อง |
