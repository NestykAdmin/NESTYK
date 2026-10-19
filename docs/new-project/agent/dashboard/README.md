# Agent — Dashboard

เชื่อม Mobile Dashboard กับ API จริงแล้ว (16 ตุลาคม 2026): ห้อง ลีด ลูกค้า สัญญา นัดดูห้อง นัดจากปฏิทิน บิล และกิจกรรมล่าสุด
ลีดต้องติดตามและค่าคอมรับแล้ว/รอรับยังไม่รองรับและแสดงข้อความตามจริง ดู [API](./api.md), [Database](./database.md) และ [แผน/ขอบเขต](./API-IMPLEMENTATION-PLAN.md)
เนื้อหา flow/navigation ด้านล่างเป็น blueprint เดิม; หน้าจอจริงและ API docs ฉบับปัจจุบันเป็นแหล่งอ้างอิงของการเชื่อมข้อมูล

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | `mobile-integrated` (ยกเว้น follow-up / commission) |
| โหมด | Agent `/agent` |
| หน้าหลัก | `/agent/dashboard` |
| Role | `agent` |

Landing หลัง login โหมด Agent — สรุปงาน scout room · leads · สัญญา · ลิงก์ไปเมนูหลัก

**Prerequisite:** [roles pack](../../roles/README.md) · [create-room](../create-room/README.md)

---

## เอกสาร

| ไฟล์ | อ่านเมื่อ |
|------|-----------|
| [flow.md](./flow.md) | UX, nav, stat cards, quick actions |
| [api.md](./api.md) | `GET /agent/dashboard` |
| [database.md](./database.md) | aggregate queries — ไม่มีตารางใหม่ |

---

## สรุปฟีเจอร์

| ส่วน | เนื้อหา |
|------|---------|
| Welcome | ชื่อ agent · ข้อความต้อนรับ |
| Stat strip | ห้อง scout · lead ใหม่ · สัญญารอดำเนินการ · สัญญา active |
| Quick actions | Listings · Create room · Leads · Contracts |
| Reminders | lead ที่ต้องติดตาม · สัญญารอ review / ลายเซ็น |

---

## Navigation (agent)

| ลำดับ | เมนู | Route |
|------:|------|-------|
| 1 | **Dashboard** | `/agent/dashboard` |
| 2 | Listings | `/agent/listings` |
| 3 | Create room | `/agent/rooms/create` |
| 4 | Leads | `/agent/leads` |
| 5 | **Calendar** | `/agent/calendar` *(placeholder)* |
| 6 | Contracts | `/agent/contracts` |

Tab bar (mobile): Dashboard เป็น tab หลัก · รายการอื่นอยู่ side menu / More

---

## Bootstrap

ไม่มี DDL — aggregate จาก pack อื่น:

```bash
psql "$DATABASE_URL" -f docs/new-project/roles/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/create-room/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/leads/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/contracts/schema.sql
```

---

## Pack ที่เกี่ยวข้อง

| Pack | ความสัมพันธ์ |
|------|----------------|
| [listings](../listings/README.md) | stat ห้อง scout |
| [leads](../leads/README.md) | stat + reminders lead |
| [contracts](../contracts/README.md) | stat + reminders สัญญา |
| [calendar](../calendar/README.md) | เมนู placeholder |
| [create-room](../create-room/README.md) | quick action สร้างห้อง |
