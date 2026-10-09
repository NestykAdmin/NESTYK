# Billing — การรับเงิน

---

## 1. ช่องทาง

| ช่องทาง | ใช้เมื่อ | ไลบรารี/บริการ |
|---------|---------|----------------|
| ซื้อในแอป iOS / Android | ผู้ใช้ซื้อจากแอปมือถือ | RevenueCat (`react-native-purchases`) ครอบ App Store + Google Play |
| เว็บ | ผู้ใช้ซื้อจากเว็บ (portal ในอนาคต) | Stripe Checkout + Customer Portal |
| manual | ทดสอบ · ลูกค้าองค์กรที่ออกใบแจ้งหนี้เอง | admin สร้าง `subscriptions.provider = 'manual'` |

ทุกช่องทางอัปเดตตาราง `subscriptions` ชุดเดียวกัน — ส่วนอื่นของระบบไม่ต้องรู้ว่าจ่ายทางไหน

> ฟีเจอร์ดิจิทัลที่ใช้ในแอปมือถือ **ต้องขายผ่านระบบซื้อในแอปของสโตร์** ตามกฎ App Store / Google Play · ห้ามมีปุ่มพาไปจ่ายนอกแอปบน iOS เว้นแต่กฎของ Apple ในประเทศนั้นอนุญาต — ตรวจกฎล่าสุดก่อนเปิดขาย

---

## 2. RevenueCat (มือถือ)

### ตั้งค่า

- สร้างสินค้าแบบ subscription ใน App Store Connect และ Google Play Console ต่อแพ็กเกจ เช่น `nestyk_pro_monthly`, `nestyk_business_monthly`
- ใน RevenueCat: entitlement ชื่อเดียวกับ `plans.code` (`pro`, `business`) และผูกสินค้าเข้า entitlement
- เก็บรหัสสินค้าใน `plans.store_products` (`ios`, `android`)

### ฝั่งแอป

- ตั้ง `appUserID` = `users.id` (เป็นสตริง) หลัง login — ห้ามใช้ anonymous ID เพื่อให้ webhook ผูกกับผู้ใช้ได้
- แสดงราคาจาก `Purchases.getOfferings()` (ราคาท้องถิ่นของสโตร์) ไม่ใช้ `display_price_thb`
- ซื้อสำเร็จ → เรียก `GET /me/entitlements` ใหม่ (สถานะจริงมาจาก webhook — ถ้ายังไม่อัปเดต ให้ poll สั้นๆ 2–3 ครั้ง)
- มีปุ่ม "กู้คืนการซื้อ" (`restorePurchases`) ตามกฎสโตร์

### ฝั่ง server

- webhook `POST /billing/webhooks/revenuecat` ([api.md §6](./api.md#6-webhook-ไม่ต้องใช้-bearer-token))
- แปลง event:

| RevenueCat event | ผล |
|------------------|----|
| `INITIAL_PURCHASE` | สร้าง subscription `active` (หรือ `trialing` ถ้าเป็นช่วงทดลอง) |
| `RENEWAL` | ต่อ `current_period_*` |
| `PRODUCT_CHANGE` | เปลี่ยน `plan_id` ตาม [flow.md §2](./flow.md#2-อัปเกรด--ดาวน์เกรด) |
| `CANCELLATION` | `cancel_at_period_end = true` |
| `UNCANCELLATION` | `cancel_at_period_end = false` |
| `BILLING_ISSUE` | `grace` |
| `EXPIRATION` | `expired` |

---

## 3. Stripe (เว็บ)

- `plans.store_products.stripe` = Price ID
- สร้าง Checkout Session ฝั่ง server ใส่ `client_reference_id = users.id`
- ผู้ใช้จัดการบัตร/ยกเลิกผ่าน Customer Portal
- webhook ที่ต้องรับ: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

---

## 4. ผู้ใช้ซื้อหลายช่องทาง

ห้ามมี subscription ที่ให้สิทธิ์ซ้อนกัน (บังคับด้วย partial unique index)

- ถ้ามีอยู่แล้ว ให้หน้าเลือกแพ็กเกจแสดง "จัดการแพ็กเกจ" ของช่องทางเดิมแทนปุ่มซื้อ
- ถ้าเกิดซ้อนจริง (เช่น webhook มาจากสองที่) ให้เก็บแพ็กเกจที่สูงกว่า และบันทึก `error` ใน `billing_webhook_events` ให้ทีมตรวจ

---

## 5. ตัวแปรแวดล้อม

| ตัวแปร | ที่ใช้ |
|--------|-------|
| `REVENUECAT_WEBHOOK_SECRET` | API — ตรวจ webhook |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | แอป — public SDK key |
| `STRIPE_SECRET_KEY` | API |
| `STRIPE_WEBHOOK_SECRET` | API — ตรวจ webhook |

---

## 6. ทดสอบ

- iOS: Sandbox tester ใน App Store Connect · Android: License testers + internal testing track
- RevenueCat sandbox แยกจาก production อัตโนมัติ — webhook ส่ง `environment: SANDBOX` ให้ server ข้ามหรือบันทึกแยกบน production
- Stripe test mode + `stripe listen --forward-to localhost:4000/api/v1/billing/webhooks/stripe`
- ทดสอบให้ครบ: ซื้อ · ต่ออายุ (sandbox รอบสั้น) · ยกเลิก · จ่ายไม่ผ่าน · กู้คืนการซื้อ · อัปเกรด/ดาวน์เกรด

---

## 7. ก่อนเปิดขาย

- [ ] ตรวจเรื่องภาษี (VAT) และการออกใบกำกับกับฝ่ายบัญชี
- [ ] ข้อความเงื่อนไขการต่ออายุอัตโนมัติ + ลิงก์นโยบายความเป็นส่วนตัว/ข้อกำหนด ในหน้าซื้อ (สโตร์บังคับ)
- [ ] แจ้งผู้ใช้เดิมล่วงหน้าก่อนลดสิทธิ์แพ็กเกจ `free` ([flow.md §6](./flow.md#6-ระยะการเปิดใช้))
