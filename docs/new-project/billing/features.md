# Billing — ทะเบียนรหัสฟีเจอร์

ทุกฟีเจอร์ที่จะล็อกตามแพ็กเกจ **ต้องลงทะเบียนที่นี่ก่อน** แล้วใช้รหัสเดียวกันทุกที่ (DB `plans.entitlements`, API, แอป, i18n)

---

## 1. รูปแบบรหัส

`<role>.<domain>.<action>` ตัวพิมพ์เล็ก คั่นด้วย `.` และ `_`

- ถูก: `agent.match.run` · `agent.ai.listing_promo` · `owner.listing.boost`
- ผิด: `matchRun` · `AGENT_MATCH` · `agent-match-run`

คีย์ i18n แทน `.` ด้วย `_` เช่น `billing.features.agent_match_run`

---

## 2. ชนิดสิทธิ์

| ชนิด | ค่าใน `plans.entitlements` | ความหมาย | ตัวอย่าง |
|------|---------------------------|----------|----------|
| `boolean` | `true` / `false` | เปิดหรือปิดฟีเจอร์ | ปรับคะแนนขั้นต่ำได้ไหม |
| `quota` | จำนวนเต็ม ≥ 0 หรือ `null` | จำนวนครั้งต่อรอบโควตา · `null` = ไม่จำกัด · `0` = ใช้ไม่ได้ | กดจับคู่ได้ 10 ครั้งต่อเดือน |
| `max` | จำนวนเต็ม ≥ 0 หรือ `null` | ค่าสูงสุดที่ตั้งได้ (ไม่ลดเมื่อใช้) · `null` = ไม่จำกัด | แสดงห้องสูงสุด 50 ห้อง |

ถ้าแพ็กเกจไม่มีคีย์ใดใน `entitlements` ให้ใช้ค่าในคอลัมน์ **ค่าเมื่อไม่ระบุ** ของตารางด้านล่าง (ปลอดภัยไว้ก่อน = ปิด / 0)

---

## 3. ทะเบียน

ค่าในตารางเป็น **ค่าตั้งต้น** แก้ได้ที่ตาราง `plans` โดยไม่ต้องแก้โค้ด

### 3.1 Agent — จับคู่ห้องกับลีด

รายละเอียดฟีเจอร์: [agent/leads/match-settings.md](../agent/leads/match-settings.md)

| รหัส | ชนิด | ค่าเมื่อไม่ระบุ | free | pro | business | ใช้ตรวจตอน |
|------|------|----------------|------|-----|----------|-----------|
| `agent.match.run` | quota | `0` | 10 | 100 | `null` | สั่งจับคู่ (`POST /agent/leads/:id/match-runs`) |
| `agent.match.max_results` | max | `10` | 10 | 50 | 100 | จำนวนห้องที่ส่งกลับในผลจับคู่ |
| `agent.match.min_score` | boolean | `false` | false | true | true | บันทึกคะแนนขั้นต่ำที่ไม่ใช่ค่าเริ่มต้น |
| `agent.match.budget_tolerance` | boolean | `false` | false | true | true | ยอมให้ราคาเกินงบ |
| `agent.match.radius_multiplier` | boolean | `false` | false | true | true | ขยายหรือลดระยะค้นหา |
| `agent.match.required_criteria` | boolean | `false` | false | true | true | ตั้งเกณฑ์ที่ต้องตรงเท่านั้น |
| `agent.match.weights` | boolean | `false` | false | false | true | ปรับน้ำหนักแต่ละเกณฑ์ |
| `agent.match.scope_cobroke` | boolean | `false` | false | false | true | รวมห้อง co-broke ของนายหน้าคนอื่น (อนาคต) |
| `agent.match.auto_notify` | boolean | `false` | false | false | true | แจ้งเตือนเมื่อมีห้องใหม่ที่ตรง |

### 3.2 Agent — AI

ฟีเจอร์ที่มีต้นทุนต่อครั้งจริง (เรียก Gemini / Claid) — มีในระบบแล้วแต่ยังไม่ล็อก

| รหัส | ชนิด | ค่าเมื่อไม่ระบุ | free | pro | business | ใช้ตรวจตอน |
|------|------|----------------|------|-----|----------|-----------|
| `agent.ai.listing_promo` | quota | `0` | 10 | 100 | `null` | `POST /agent/rooms/generate-listing-promo` |
| `agent.ai.photo_enhance` | quota | `0` | 5 | 50 | 200 | `POST /agent/rooms/media/enhance` |

### 3.3 Owner (สำรองไว้)

ยังไม่มีฟีเจอร์ — ใช้คำนำหน้า `owner.*` เมื่อเริ่มทำ

---

## 4. เพิ่มฟีเจอร์ใหม่ (checklist)

- [ ] เพิ่มแถวในตารางข้อ 3 พร้อมชนิด ค่าเมื่อไม่ระบุ และค่าของทุกแพ็กเกจ
- [ ] เพิ่มคีย์ในค่าคงที่ฝั่ง API (`FEATURE_REGISTRY` — รหัส → ชนิด + ค่าเมื่อไม่ระบุ) เพื่อให้ `GET /me/entitlements` ส่งครบทุกคีย์
- [ ] migration อัปเดต `plans.entitlements` ของทุกแพ็กเกจ
- [ ] ตรวจสิทธิ์ที่ server ตรงจุดที่ระบุในคอลัมน์ **ใช้ตรวจตอน** ([api.md §3](./api.md#3-การตรวจสิทธิ์ฝั่ง-server))
- [ ] i18n `billing.features.<key>` (ชื่อสั้น) และ `billing.featureHints.<key>` (คำอธิบายในแผ่นอัปเกรด) ครบ `th` / `en` / `zh` / `ja` + `types.ts`
- [ ] หน้าจอแสดงไอคอนกุญแจหรือป้ายโควตา ([client-ui.md](./client-ui.md))
