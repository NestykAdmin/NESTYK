# Billing — API

Base: `http://localhost:4000/api/v1` (global prefix `api/v1`)  
Auth header: `Authorization: Bearer <access_token>`

---

## 1. `GET /me/entitlements`

สิทธิ์ทั้งหมดของผู้ใช้ปัจจุบัน — แอปเรียกตอนเปิดแอป กลับเข้าแอป และหลังซื้อแพ็กเกจ

**Response**

```json
{
  "plan": {
    "code": "free",
    "status": null,
    "periodEnd": null,
    "cancelAtPeriodEnd": false
  },
  "features": {
    "agent.match.run": {
      "type": "quota",
      "limit": 10,
      "used": 3,
      "remaining": 7,
      "resetsAt": "2026-11-01T00:00:00+07:00"
    },
    "agent.match.max_results": { "type": "max", "value": 10 },
    "agent.match.min_score": { "type": "boolean", "enabled": false, "requiredPlan": "pro" }
  }
}
```

| Field | ความหมาย |
|-------|----------|
| `plan.status` | สถานะ subscription · `null` = ไม่มี subscription (ใช้แพ็กเกจ default) |
| `features` | **ครบทุกคีย์** ใน registry ([features.md](./features.md)) แม้แพ็กเกจไม่ได้ระบุ |
| `limit` / `value` | `null` = ไม่จำกัด |
| `requiredPlan` | แพ็กเกจถูกสุดที่เปิดฟีเจอร์นี้ — ใช้ในแผ่นอัปเกรด · ไม่มีเมื่อเปิดอยู่แล้ว |

แอป cache ได้ แต่ **ห้ามใช้ตัดสินสิทธิ์แทน server**

---

## 2. `GET /billing/plans`

รายการแพ็กเกจที่เปิดขาย (`is_active = true`) เรียงตาม `sort_order` — ใช้ในหน้าเลือกแพ็กเกจ

```json
{
  "items": [
    {
      "code": "pro",
      "displayPriceThb": 299,
      "storeProducts": { "ios": "nestyk_pro_monthly", "android": "nestyk_pro_monthly", "stripe": "price_123" },
      "entitlements": { "agent.match.run": 100, "agent.match.min_score": true }
    }
  ]
}
```

ชื่อและคำอธิบายแพ็กเกจแปลฝั่งแอปจาก `billing.plans.<code>` · ราคาจริงให้แสดงจาก SDK ของสโตร์ ([payments.md](./payments.md))

---

## 3. การตรวจสิทธิ์ฝั่ง server

โมดูล `billing` ใน `apps/api` มี `EntitlementsService`:

| เมธอด | ใช้กับ | พฤติกรรม |
|-------|--------|----------|
| `get(userId, key)` | ทุกชนิด | คืนค่าสิทธิ์ตามลำดับ override → subscription → default → registry |
| `assertEnabled(userId, key)` | `boolean` | ปิดอยู่ → `FEATURE_LOCKED` |
| `clamp(userId, key, wanted)` | `max` | คืนค่าที่ไม่เกินสิทธิ์ (ไม่ throw) |
| `consume(userId, key, { idempotencyKey, quantity, ref, manager })` | `quota` | ตัดโควตาแบบ atomic ([database.md §5](./database.md#5-usage_counters)) · เกิน → `PLAN_LIMIT` · key ซ้ำ → คืนผลเดิม |
| `refund(eventId, manager)` | `quota` | คืนโควตาเมื่องานล้มเหลวหลังตัดแล้ว |

และ decorator สำหรับฟีเจอร์แบบเปิด/ปิดทั้ง endpoint:

```ts
@Post(':id/match-runs')
@RequireFeature('agent.match.run')   // boolean/quota > 0 — ไม่ตัดโควตา
async run(...) { /* consume() อยู่ใน service ภายใน transaction เดียวกับงาน */ }
```

กติกา:

- ตัดโควตา **ใน transaction เดียวกับการบันทึกผลงาน** (`DataSource.transaction`) ถ้าบันทึกไม่สำเร็จ โควตาไม่ถูกตัด
- งานที่เรียกบริการภายนอกนาน (AI) ตัดก่อนเรียก แล้ว `refund()` เมื่อล้มเหลว
- ค่าตั้งค่าที่เกินสิทธิ์ (เช่น ขอผลจับคู่ 50 ห้องแต่สิทธิ์ 10) ให้ **clamp แล้วบอกในผลลัพธ์** แทนการ error — ดูตัวอย่างใน [match-settings.md](../agent/leads/match-settings.md)

---

## 4. รหัสข้อผิดพลาด

ทั้งสองกรณีตอบ **HTTP 403**

```json
{
  "statusCode": 403,
  "code": "PLAN_LIMIT",
  "feature": "agent.match.run",
  "limit": 10,
  "used": 10,
  "resetsAt": "2026-11-01T00:00:00+07:00",
  "requiredPlan": "pro"
}
```

```json
{
  "statusCode": 403,
  "code": "FEATURE_LOCKED",
  "feature": "agent.match.weights",
  "requiredPlan": "business"
}
```

| `code` | เมื่อไร | แอปทำอะไร |
|--------|---------|-----------|
| `PLAN_LIMIT` | โควตาหมดในรอบนี้ | แผ่นอัปเกรด + บอกวันรีเซ็ต |
| `FEATURE_LOCKED` | แพ็กเกจไม่เปิดฟีเจอร์นี้ | แผ่นอัปเกรดพร้อมชื่อแพ็กเกจที่ต้องใช้ |

---

## 5. Idempotency

endpoint ที่ตัดโควตารับ header `Idempotency-Key: <uuid>` (แอปสร้างใหม่ต่อการกดหนึ่งครั้ง และใช้ค่าเดิมเมื่อ retry)

- key ซ้ำ + งานสำเร็จแล้ว → คืนผลเดิม ไม่ตัดโควตาซ้ำ
- ไม่ส่ง header → server สร้างให้เอง (กันซ้ำไม่ได้)

---

## 6. Webhook (ไม่ต้องใช้ Bearer token)

| Endpoint | ตรวจความถูกต้องด้วย |
|----------|---------------------|
| `POST /billing/webhooks/revenuecat` | header `Authorization` = `REVENUECAT_WEBHOOK_SECRET` |
| `POST /billing/webhooks/stripe` | ลายเซ็น `Stripe-Signature` + `STRIPE_WEBHOOK_SECRET` |

ขั้นตอนทุก event:

1. ตรวจลายเซ็น/secret — ไม่ผ่าน → 401
2. insert `billing_webhook_events` — `event_id` ซ้ำ → ตอบ 200 แล้วจบ
3. ใน transaction: แปลง event เป็นสถานะ ([flow.md](./flow.md)) แล้ว upsert `subscriptions`
4. ตั้ง `processed_at` · ล้มเหลว → เก็บ `error` แล้วตอบ 500 ให้ผู้ให้บริการส่งซ้ำ

---

## 7. Admin (อนาคต)

| Endpoint | หน้าที่ |
|----------|---------|
| `GET /admin/billing/plans` · `PATCH /admin/billing/plans/:code` | ดู/แก้สิทธิ์ของแพ็กเกจ |
| `POST /admin/billing/overrides` · `DELETE /admin/billing/overrides/:id` | ให้/ถอนสิทธิ์พิเศษรายคน |
| `POST /admin/billing/subscriptions` | ให้แพ็กเกจแบบ `manual` (ทดสอบ, ลูกค้าองค์กร) |
| `GET /admin/billing/usage?userId=` | ดูยอดใช้และประวัติ |

Role ที่เข้าได้: `admin` เท่านั้น
