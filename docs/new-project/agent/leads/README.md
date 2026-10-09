# Agent — Leads (ลูกค้าที่มาดูห้อง)

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | `blueprint` |
| โหมด | Agent `/agent` |
| รายการ | `/agent/leads` |
| สร้าง/แก้ | `/agent/leads/create` · `/agent/leads/[id]` |
| Role | `agent` |

**Lead** = ลูกค้าที่สนใจ/มาดูห้อง — ห้องหนึ่งมีได้หลาย lead (เช่น 10 คนมาดู = 10 แถว)  
**Tenant** = คนที่ทำสัญญาแล้ว — ดู [contracts pack](../contracts/README.md)

เมื่อ lead ทำสัญญา:

1. **`leads.status = booked`** (ยังอยู่ในตาราง lead)
2. **สร้างแถวใน `tenants`** + ตั้ง **`leads.tenant_id`**

**Prerequisite:** [roles pack](../../roles/README.md) · [dashboard](../dashboard/README.md) · [create-room/schema.sql](../create-room/schema.sql)

---

## เอกสาร

| ไฟล์ | อ่านเมื่อ |
|------|-----------|
| [flow.md](./flow.md) | status pipeline, promote → tenant |
| [add-lead-groups.md](./add-lead-groups.md) | ฟอร์ม Add Lead สองส่วนและข้อมูลขั้นต่ำสำหรับ matching |
| [matching.md](./matching.md) | hard set + AI score สำหรับจับคู่ห้องกับ lead |
| [match-settings.md](./match-settings.md) | กดจับคู่เอง · ตั้งค่ารายลีด · เก็บผลจับคู่ · ต่อสิทธิ์ตามแพ็กเกจ |
| [viewings.md](./viewings.md) | นัดดูห้อง (`lead_viewings`) จากหน้าการจับคู่ |
| [api.md](./api.md) | CRUD leads, เปลี่ยนสถานะ |
| [database.md](./database.md) | คอลัมน์, invariant |
| [schema.sql](./schema.sql) | DDL `leads` |

---

## Bootstrap

```bash
psql "$DATABASE_URL" -f docs/new-project/roles/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/create-room/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/leads/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/contracts/schema.sql
```

---

## สรุปคำศัพพ์

| คำ | ตาราง | หมายเหตุ |
|----|--------|----------|
| **Lead** | `leads` | pipeline ดูห้อง — เก็บทุกคนที่ติดต่อ |
| **Tenant** | `tenants` | เฉพาะคนที่เปิดสัญญา / booked |
| **Tenant (app role)** | `users` + role `tenant` | เมื่อผู้เช่า claim บัญชีแอป |

---

## Pack ถัดไป

- [contracts](../contracts/README.md) — สร้างสัญญาจาก lead `booked` + tenant
