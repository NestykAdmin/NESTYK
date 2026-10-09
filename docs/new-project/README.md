# Portable blueprint — project ใหม่

เอกสารชุดนี้ออกแบบให้ **copy โฟลเดอร์ `docs/new-project/` ไป repo ใหม่** แล้ว implement ตาม layer

---

## Copy ไป repo ใหม่

```bash
cp -R docs/new-project /path/to/new-repo/docs/
```

| Pack | Path |
|------|------|
| Roles & access | `new-project/roles/` |
| Billing — แพ็กเกจ สิทธิ์ โควตา | `new-project/billing/` |
| Agent — create room | `new-project/agent/create-room/` |
| Agent — dashboard | `new-project/agent/dashboard/` |
| Agent — listings | `new-project/agent/listings/` |
| Agent — calendar | `new-project/agent/calendar/` |
| Agent — leads | `new-project/agent/leads/` |
| Agent — contracts | `new-project/agent/contracts/` |
| Docker / local Supabase | `new-project/docker/` + root `supabase/config.toml` |

---

## ลำดับ implement

1. [roles/schema.sql](./roles/schema.sql)
2. [agent/create-room/schema.sql](./agent/create-room/schema.sql) — **`rent_rooms`** unified table
3. [agent/leads/schema.sql](./agent/leads/schema.sql)
4. [agent/contracts/schema.sql](./agent/contracts/schema.sql)

Local Docker: ดู [docker/CHECKLIST.md](./docker/CHECKLIST.md) · จาก root รัน [docker/start-supabase-local.sh](./docker/start-supabase-local.sh) แล้ว [docker/apply-schema.sh](./docker/apply-schema.sh)

---

## Packs

| Pack | เนื้อหา |
|------|---------|
| [roles/](./roles/README.md) | Guest / Tenant / Owner / Agent / Admin |
| [billing/](./billing/README.md) | Subscription · แพ็กเกจ · สิทธิ์ตามฟีเจอร์ · โควตา — **blueprint** |
| [agent/create-room/](./agent/create-room/README.md) | **`rent_rooms`** · `is_scout_room` + `visibility` |
| [agent/dashboard/](./agent/dashboard/README.md) | หน้าหลัก agent · stat · quick actions |
| [agent/listings/](./agent/listings/README.md) | รายการห้อง scout · visibility toggle |
| [agent/calendar/](./agent/calendar/README.md) | ปฏิทิน — **placeholder** (หน้าเปล่า) |
| [agent/leads/](./agent/leads/README.md) | Lead CRM · `rent_room_id` |
| [agent/contracts/](./agent/contracts/README.md) | Tenant + สัญญา |
| [docker/](./docker/README.md) | Docker + Supabase local · checklist · apply-schema |

---

## ห้อง (listing) — unified model

| แนวคิด | ค่า |
|--------|-----|
| ตารางเดียว | **`rent_rooms`** |
| Agent scout | `is_scout_room = true` |
| Owner จริง (อนาคต) | `is_scout_room = false` + `owner_id` |
| Tag public/private | **`visibility`**: `private` \| `published` (scout) · `NULL` (owner) |

Child tables: `room_medias`, `rent_room_documents`, `room_layout_values`, `room_facilities`

---

## Naming (greenfield)

| แนวคิด | ค่า |
|--------|-----|
| Agent role | **`agent`** (ไม่มี role `assistant`) |
| Routes | `/agent/*` |
| Listing table | **`rent_rooms`** · `is_scout_room` + `visibility` |

โฟลเดอร์นี้เป็น **portable blueprint** — copy ไป repo ใหม่แล้ว implement ตาม pack
