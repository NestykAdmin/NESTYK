# Docker — Local Supabase (DB + Storage)

Local stack mirrors hosted Supabase: **one** `supabase start` provides Postgres (app DB) + Storage (+ Auth/Studio).  
Deploy later by swapping `.env.api` URL/keys to the cloud project — same code paths.

## Quick start

จาก root monorepo:

```bash
# 1) Supabase local (Postgres :54422 + API/Storage :54421)
./docs/new-project/docker/start-supabase-local.sh
# → คัดลอก SUPABASE_* ใส่ root `.env.api` ถ้ายังไม่ตรงกับ status
# → DATABASE_URL ชี้ 127.0.0.1:54422 (ดู .env.api.example)

# 2) App schema + demo data (ใน Postgres ของชุดเดียวกัน)
./docs/new-project/docker/apply-schema.sh
./docs/new-project/docker/seed-dev-user.sh
./docs/new-project/docker/seed-agent-demo.sh
./docs/new-project/docker/seed-agent-demo-extra.sh   # (ทางเลือก) +20 ห้องเต็มรูปแบบ + 3 ลีดมีหมุด

# 3) Demo photos → Storage + room_medias
./docs/new-project/docker/seed-agent-photos.sh
# เฉพาะห้องที่ยังไม่มีรูป (เช่น หลัง seed-agent-demo-extra.sh)
DEMO_PHOTOS_MISSING_ONLY=1 ./docs/new-project/docker/seed-agent-photos.sh
```

> รัน `seed-agent-demo.sh` ซ้ำจะลบห้อง `demo-agent-*` ทั้งหมด รวมห้อง 11–30 — ให้รัน `seed-agent-demo-extra.sh` ใหม่ตามหลัง

Connection แอป (ตรงกับ root `.env.api`):

```
postgresql://postgres:postgres@127.0.0.1:54422/postgres
```

Local Supabase API / Storage:

```
http://127.0.0.1:54421
```

> `supabase db reset` จะล้างทั้ง DB รวมตารางแอป — ใช้เมื่อตั้งใจเริ่มใหม่เท่านั้น  
> Auth มือถือยังใช้ `ALLOW_DEV_AUTH` ได้ตามเดิม

### Dev login (portable)

| Field | Value |
|-------|--------|
| Email | `admin@jitsamrit.com` |
| Password | `Jitsamrit2026` |
| UUID | `00000000-0000-4000-8000-000000000001` |

Requires root `.env`: `EXPO_PUBLIC_USE_DEV_AUTH=true` (+ matching `EXPO_PUBLIC_DEV_LOGIN_*`) and API `.env.api`: `ALLOW_DEV_AUTH=true`.

- Frontend env: root `.env` / `.env.example`
- Backend env: root `.env.api` / `.env.api.example`
- Auth rules: `.cursor/rules/auth-supabase.mdc`
- Photos: `docs/new-project/agent/create-room/photos.md`

Schema อยู่ที่ `public` ตาม blueprint (ไม่ใช้ `NESTYK_PROPTECH` ของ skeleton เก่า)

## ตรวจ entity กับฐานข้อมูล (`db:check`)

```bash
npm run db:check -w @nestyk/api            # ตรวจ ถ้าไม่ตรงจะถามว่าจะปรับไหม (y/N)
npm run db:check -w @nestyk/api -- --check # ตรวจอย่างเดียว ไม่ถาม (CI) — ไม่ตรง = exit 1
```

- เทียบ entity ทุกตัว (`ALL_ENTITIES`) กับฐานข้อมูลใน `.env.api` (`DATABASE_URL` + `DB_SCHEMA`) ระดับ ตาราง / คอลัมน์ / ชนิดข้อมูล / NULL
- **error:** ขาดตาราง · ขาดคอลัมน์ · ชนิดข้อมูลไม่ตรง · NULL ไม่ตรง — **เตือนเฉยๆ:** คอลัมน์ที่มีในฐานข้อมูลแต่ entity ไม่ใช้
- **ตอบ y:**
  - ขาดตาราง/คอลัมน์ → รันไฟล์ใน `apps/api/migrations/` ที่สร้างสิ่งนั้น (ไฟล์ `CREATE TABLE` ก่อน `ALTER`) ใน transaction เดียว พังกลางทาง = rollback ทั้งหมด
  - ไม่มีไฟล์ migration รองรับ → สร้าง `migrations/<วันที่>-schema-sync.sql` จาก entity (เพิ่มอย่างเดียว) ให้ตรวจก่อน แล้วรัน `db:check` อีกครั้ง
  - ชนิดข้อมูล / NULL ไม่ตรง → **ไม่ปรับอัตโนมัติ** (อาจทำข้อมูลเสีย) แสดง SQL แนะนำให้ตัดสินใจเอง
- ไม่ใช้ `typeorm schema:sync` / `schema:log` เพราะ entity ไม่ได้ประกาศ FK / index / CHECK ที่ไฟล์ SQL สร้างไว้ — TypeORM จะสั่งลบทิ้ง
- API ตรวจซ้ำตอนเปิด (`SchemaDriftCheck`) ถ้าไม่ตรงขึ้น `ERROR [SchemaDrift]` ใน log แต่ API ยังเปิดต่อ
- โค้ด: `apps/api/src/database/schema-drift.ts` · เทสต์: `npm run test:schema -w @nestyk/api`

## Files

| File | Role |
|------|------|
| [start-supabase-local.sh](./start-supabase-local.sh) | `npx supabase start` — DB + Storage ใน Docker |
| [apply-schema.sh](./apply-schema.sh) | Apply schemas + migrations บน `supabase_db_NESTYK` |
| [seed-dev-user.sql](./seed-dev-user.sql) / [.sh](./seed-dev-user.sh) | Seed sample admin profile |
| [seed-agent-demo.sql](./seed-agent-demo.sql) / [.sh](./seed-agent-demo.sh) | Seed **10** scout rooms + 6 leads |
| [seed-agent-demo-extra.sql](./seed-agent-demo-extra.sql) / [.sh](./seed-agent-demo-extra.sh) | +**20** ห้องกรอกครบ (`demo-agent-11..30`: ราคา 12/6/3 เดือน, layout, facilities) + 3 ลีดมีหมุด — ครอบคลุมเคส matching |
| [seed-agent-photos.mjs](./seed-agent-photos.mjs) / [.sh](./seed-agent-photos.sh) | อัปโหลดรูป mock → `property-images` + `room_medias` (`DEMO_PHOTOS_MISSING_ONLY=1` = เฉพาะห้องที่ยังไม่มีรูป) |
| root `supabase/config.toml` | Config สำหรับ Supabase CLI local stack |
