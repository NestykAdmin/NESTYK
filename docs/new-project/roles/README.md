# Roles & Access Control

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | `blueprint` |
| Scope | Guest `/` · Tenant `/tenant` · Landlord `/landlord` · Agent `/agent` · Admin `/admin` |
| DB | `master_roles` + `user_roles` |
| Auth | JWT provider → `POST /auth/sync` → `public.users` |

> **คำว่า owner มี 2 ความหมาย (ตั้งแต่ 2026-10-16, ดู [ROLE-CHANGE-PLAN.md](../../ROLE-CHANGE-PLAN.md))**
> - **role ของบัญชี** (`master_roles.name`): `landlord` = เจ้าของห้องที่เซ็นเอกสารที่ agent ส่งมา (เดิมชื่อ `owner`) · `self_owner` = เจ้าของที่ปล่อยห้องเอง (เฟส 2 ยังไม่มีในฐานข้อมูล) · role ชื่อ `owner` **เลิกใช้ถาวร** API จะไม่ยอมเริ่มถ้าพบ
> - **คู่สัญญา** (`ContractParty` = `'owner' | 'tenant'`): ฝั่งผู้ให้เช่าในสัญญา ใช้ในลิงก์เชิญเซ็น เอกสาร และคอลัมน์ `owner_*` ของสัญญา ยังชื่อ `owner` เหมือนเดิม คนที่เข้าสู่ระบบเป็นคู่สัญญาฝั่งนี้จะได้ role `landlord`

แยก **App mode (UX/route)** จาก **DB role (สิทธิ)** — user หนึ่งคนมีหลาย role ใน `user_roles` แต่เข้าได้เฉพาะ route ของ role นั้น

---

## เอกสาร (แยกตาม layer)

| ไฟล์ | อ่านเมื่อ |
|------|-----------|
| [flow.md](./flow.md) | Login, mode picker, gate, Access Denied, dev grant |
| [api.md](./api.md) | `/auth/sync`, profile, dev roles, assert ใน service |
| [database.md](./database.md) | ตาราง, seed, invariant, query |
| [schema.sql](./schema.sql) | DDL runnable |

---

## สรุปเร็ว: App mode vs DB role

| App mode | Route prefix | ต้องมีใน `user_roles` | Guest UX |
|----------|--------------|------------------------|----------|
| **Guest** | `/`, `/search`, `/rooms/*` | ไม่บังคับ | สาธารณะ — ไม่ผูก tenant/landlord/agent |
| **Tenant** | `/tenant` | `tenant` | — |
| **Landlord** | `/landlord` | `landlord` | — |
| **Self owner** (เฟส 2) | ยังไม่กำหนด | `self_owner` | เฟส 2 ยังไม่ได้ทำ (แผน: mockup เมนู) |
| **Agent** | `/agent` | `agent` | — |
| **Admin** | `/admin` | `admin` | — |

| DB `master_roles.name` | ความหมาย |
|------------------------|----------|
| `guest` | default ตอนสร้าง user — **ไม่ใช่** app mode แยก |
| `landlord` / `tenant` / `agent` / `admin` | management role — gate route + API |
| `self_owner` | เฟส 2: เจ้าของปล่อยห้องเอง ยังไม่ seed |
| ~~`owner`~~ | เลิกใช้ ห้ามสร้างกลับ (`supabase/MIGRATION-RULES.md` ข้อ 9, `npm run check:roles`) |

---

## Bootstrap DB

```bash
psql "$DATABASE_URL" -f docs/new-project/roles/schema.sql
```

---

## Pack ถัดไป

- [Agent dashboard](../agent/dashboard/README.md) — landing `/agent/dashboard`
- [Agent create room](../agent/create-room/README.md) — ต้องมี role `agent` + gate จาก pack นี้ก่อน

**หมายเหตุ:** role ใน DB = `agent` · **ไม่มี** `assistant`
