# Billing — แพ็กเกจ สิทธิ์ และโควตา (Subscription)

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | `blueprint` (ยังไม่ implement) |
| ใช้กับ | ทุก role ที่มีฟีเจอร์เสียเงิน — เริ่มที่ `agent` · เผื่อ `owner` ในอนาคต |
| ฝั่ง server | `apps/api` (NestJS) — โมดูลใหม่ `billing` |
| ฝั่งแอป | `apps/consumer-app` + `@nestyk/ui` (`MobileAiQuotaAction`, `MobileBottomSheet`) |

**Prerequisite:** [roles pack](../roles/README.md) (ตาราง `users`)

---

## เป้าหมาย

1. ล็อกฟีเจอร์ตามแพ็กเกจได้ **โดยไม่ต้องปล่อยแอปเวอร์ชันใหม่** — สิทธิ์ทั้งหมดอยู่ในตาราง `plans` ที่ server
2. ทุกฟีเจอร์ที่จะล็อกต้องลงทะเบียนใน [features.md](./features.md) ที่เดียว ใช้ชื่อรหัสเดียวกันทั้ง DB, API, แอป และ i18n
3. **server เป็นผู้ตัดสินสิทธิ์เสมอ** แอปใช้ข้อมูลสิทธิ์แค่เพื่อแสดงผล (ไอคอนกุญแจ ป้ายโควตา แผ่นอัปเกรด)
4. เปิดระบบได้ก่อนเริ่มเก็บเงิน — ทุกคนอยู่แพ็กเกจ `free` ที่ตั้งสิทธิ์ไว้กว้าง วันที่จะขายจริงแค่ลดตัวเลขในตาราง

---

## คำศัพท์

| คำ | ความหมาย |
|----|----------|
| **แพ็กเกจ (plan)** | ชุดสิทธิ์ที่ขาย เช่น `free` · `pro` · `business` — แถวในตาราง `plans` |
| **สิทธิ์ (entitlement)** | ค่าของฟีเจอร์หนึ่งในแพ็กเกจหนึ่ง เช่น `agent.match.run = 10` |
| **รหัสฟีเจอร์ (feature key)** | ชื่อกลางของฟีเจอร์ รูปแบบ `<role>.<domain>.<action>` เช่น `agent.match.run` |
| **โควตา (quota)** | สิทธิ์ชนิดนับจำนวนครั้งต่อรอบ — ใช้แล้วลด รีเซ็ตเมื่อขึ้นรอบใหม่ |
| **รอบโควตา (usage period)** | ช่วงเวลาที่นับโควตา ดู [flow.md §4](./flow.md#4-รอบโควตา) |
| **subscription** | การสมัครแพ็กเกจของผู้ใช้หนึ่งคน — แถวในตาราง `subscriptions` · ไม่มีแถว = แพ็กเกจ `free` |
| **override** | สิทธิ์พิเศษรายคนที่ทับค่าของแพ็กเกจ เช่น แจกโควตาเพิ่มช่วงโปรโมชัน |

---

## เอกสาร

| ไฟล์ | อ่านเมื่อ |
|------|-----------|
| [features.md](./features.md) | ทะเบียนรหัสฟีเจอร์ ชนิดสิทธิ์ และค่าของแต่ละแพ็กเกจ |
| [database.md](./database.md) | ตาราง คอลัมน์ และกติกาข้อมูล |
| [schema.sql](./schema.sql) | DDL ร่าง |
| [api.md](./api.md) | `GET /me/entitlements` · การตรวจสิทธิ์ฝั่ง server · รหัสข้อผิดพลาด · webhook |
| [flow.md](./flow.md) | สถานะ subscription · อัปเกรด/ดาวน์เกรด · รอบโควตา · ระยะการเปิดใช้ |
| [payments.md](./payments.md) | รับเงินผ่าน RevenueCat (ซื้อในแอป) และ Stripe (เว็บ) |
| [client-ui.md](./client-ui.md) | หน้าจอฝั่งแอป · คีย์ i18n `billing.*` |

ฟีเจอร์ที่ใช้ชุดนี้แล้ว:

| ฟีเจอร์ | เอกสาร |
|---------|--------|
| ตั้งค่าและกดจับคู่ห้องกับลีด | [agent/leads/match-settings.md](../agent/leads/match-settings.md) |

---

## ลำดับ implement

1. [schema.sql](./schema.sql) — `plans` + seed `free` / `pro` / `business`
2. โมดูล `billing` ใน API: `EntitlementsService` + `GET /me/entitlements` ([api.md](./api.md))
3. ต่อการตรวจสิทธิ์เข้าฟีเจอร์แรก (จับคู่ห้อง) — ทุกคนยังเป็น `free` แบบสิทธิ์กว้าง
4. หน้าจอฝั่งแอป: ป้ายโควตา ไอคอนกุญแจ แผ่นอัปเกรด ([client-ui.md](./client-ui.md))
5. รับเงินจริง ([payments.md](./payments.md)) แล้วค่อยปรับตัวเลขแพ็กเกจ `free`

---

## กติกาที่ต้องยึด

- ชื่อแพ็กเกจและชื่อฟีเจอร์ **ไม่เก็บเป็นข้อความหลายภาษาใน DB** — เก็บแค่ `code` แล้วแปลผ่าน i18n (`billing.plans.<code>`, `billing.features.<key>`) ตามกฎ Master Catalog ของโปรเจกต์
- งานที่แตะหลายตาราง (ตัดโควตา + บันทึกผลงาน, webhook + อัปเดต subscription) ใช้ `DataSource.transaction`
- ห้ามเชื่อค่าสิทธิ์ที่แอปส่งมา — server อ่านจาก DB ทุกครั้ง
