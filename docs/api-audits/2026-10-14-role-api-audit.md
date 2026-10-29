# ผลตรวจ API Agent / Tenant / Owner — 14 ตุลาคม 2026

> รายงานนี้เก็บผลก่อนแก้ไว้เป็นหลักฐาน ผลแก้และตรวจซ้ำล่าสุดอยู่ใน [รายงานแก้ API/flow](2026-10-14-role-api-fixes.md)

ตรวจตาม controller ที่ลงทะเบียนจริงใน source ปัจจุบัน พบปัญหาที่ทำซ้ำได้ทั้งการตอบ 500, ขอบเขตสิทธิ์ Owner และสถานะการลงนามค้าง จึงยังสรุปว่า API ทุกเส้นใช้งานได้ไม่ได้

## ขอบเขตและผลทดสอบ

| การตรวจ | ผล / ข้อจำกัด |
| --- | --- |
| Inventory | 119 routes จาก 18 controllers: GET 62, POST 47, PATCH 6, DELETE 4 |
| Roles ที่ประกาศ | Agent 94, Tenant 14, Owner 15 (บางเส้นใช้ร่วมกัน); authenticated ทั่วไป 5; public 4 |
| Routing และ guards | ตรวจครบ 119 routes ด้วย controller, AuthGuard และ RolesGuard จริง กับ service จำลอง; anonymous, unsynced, Agent, Tenant, Owner, Guest ไม่มี route shadow หรือหลุดข้อจำกัด role ที่ประกาศ |
| GET กับฐานข้อมูลที่ตั้งค่า | 55 routes, connection บังคับ READ ONLY, บัญชีสังเคราะห์ที่ไม่ตรงกับข้อมูลลูกค้า: 12 routes ตอบ 500; อีก 43 ตอบ 200/404 ตามข้อมูลที่ไม่มี |
| ID เกิน PostgreSQL integer | 24 GET routes กับ ID 2147483648 ตอบ 500 ทั้งหมด; 17 routes เพิ่มจาก baseline ที่ใช้ ID ปกติ, อีก 7 ซ้อนกับ schema failure |
| Resource authorization / profile | service จริงกับ PostgreSQL schema ใหม่ที่มีแต่ข้อมูลสังเคราะห์ และลบ schema หลังจบ |
| ลายเซ็นเสีย | service จริงกับ DB/storage doubles และตัวสร้าง PDF จริง |
| Regression | API unit tests 213/213 ผ่าน; API build ผ่าน |

การตรวจ guards ยืนยันเฉพาะสิทธิ์ role ระดับ route ไม่ได้ยืนยันสิทธิ์ระดับรายการทุกข้อมูล การได้ 200/404 ด้วยบัญชีสังเคราะห์ไม่ใช่หลักฐานว่าเปิดข้อมูลลูกค้าหรือทำธุรกรรมจริงสำเร็จทุกเส้น

## ปัญหาที่ยืนยันได้

### 1. [P1] Schema ยังไม่รองรับ API ปิดสัญญาที่เพิ่มก่อนหน้า: Agent 12 GET routes ตอบ 500

ฐานข้อมูล `public` ที่ตั้งค่าใน workspace ยังไม่มี `leads.booking_released_at` ซึ่ง entity ปัจจุบันเลือกออกมาด้วย query จึงล้มแม้รายการนั้นไม่มีข้อมูลตรงกับบัญชีสังเคราะห์ `db:check -- --check` ยืนยัน missing column เดียวกัน

นี่เป็น deployment prerequisite ของงานปิดสัญญาก่อนหน้า: migration [20261014-contract-closure.sql](../../apps/api/migrations/20261014-contract-closure.sql) ยังไม่ได้ apply ในฐานข้อมูลที่ตรวจ ไม่ใช่ปัญหาที่ unit test ซึ่งจำลอง schema จะตรวจพบ ต้อง apply migration ก่อนใช้ API รุ่นนี้

เส้นที่ยืนยัน 500:

- `GET /api/v1/agent/contracts/candidates`
- `GET /api/v1/agent/contracts/reservation-defaults/:leadId`
- `GET /api/v1/agent/contracts/broker-appointment-defaults/:leadId`
- `GET /api/v1/agent/contracts/lease-defaults/:leadId`
- `GET /api/v1/agent/leads`
- `GET /api/v1/agent/leads/:id`
- `GET /api/v1/agent/leads/:id/match-settings`
- `GET /api/v1/agent/leads/:id/match-runs/latest`
- `GET /api/v1/agent/viewings`
- `GET /api/v1/agent/tenants/leads`
- `GET /api/v1/agent/tenants`
- `GET /api/v1/agent/tenants/:id`

POST/PATCH ที่โหลด Lead อาจได้รับผลเหมือนกันตาม source แต่ไม่ได้ทดสอบการเขียนกับฐานข้อมูลลูกค้า จึงไม่นับเป็น failure ที่ยืนยันผ่าน HTTP ในรายงานนี้

### 2. [P1] Owner คนใหม่เข้าถึงบิลและสลิปของสัญญา Owner เดิมได้

เส้นที่เกี่ยวข้อง:

- `GET /api/v1/bills/received`
- `GET /api/v1/bills/received/:id/payment-slip`

`TenantBillingService.listReceived` และ `owned` ตรวจ `c.owner_user_id = userId OR room.owner_id = userId` ทำให้การเปลี่ยนเจ้าของห้องเปิดสิทธิ์ข้อมูลสัญญาเก่าให้เจ้าของใหม่ด้วย

ทำซ้ำด้วย contract owner=10, current room owner=20, สัญญา terminated และบิล paid: `receivedSlipUrl(20, 1)` คืน signed URL ได้ แต่ `contractForParty(20, 1)` ตอบ 404 เพราะไม่ใช่คู่สัญญา ไม่ได้เปิดสลิปลูกค้าจริง; storage ใน probe คืน URL สังเคราะห์

ควรผูกสิทธิ์บิลกับคู่สัญญาหรือการโอนสิทธิ์สัญญาที่บันทึกไว้อย่างชัดเจน หากจะใช้ current owner เป็น fallback ต้องจำกัดเฉพาะกรณีที่สัญญาไม่มี owner snapshot และนิยามนโยบายเดียวกับ API สัญญา

### 3. [P1] PNG ลายเซ็นเสียถูกบันทึก ทำให้สัญญาค้างตอนสร้าง PDF

เส้นที่ใช้ validator เดียวกัน:

- `POST /api/v1/agent/contracts/:id/sign`
- `POST /api/v1/contracts/mine/:id/sign` (Tenant / Owner)
- `POST /api/v1/public/contract-sign/:token`

`validateSign` ตรวจแค่จำนวน bytes และ PNG magic 8 bytes; storage upload ตรวจ magic เช่นกัน ไม่ได้ decode ภาพให้สำเร็จก่อนบันทึก ผู้เรียกสามารถส่ง magic PNG + bytes ขยะ รวม 48 bytes แล้วผ่านได้

probe เรียก Agent sign ด้วยทั้ง Owner/Tenant: สถานะไป `awaiting_agent_review`; สร้าง PDF ตอบ 400 “ไม่สามารถอ่านภาพลายเซ็นเพื่อสร้าง PDF ได้”; เซ็นแทนไฟล์เสียอีกครั้งตอบ 400 “ฝ่ายที่เลือกลงนามแล้ว”; แก้หรือยกเลิก draft ก็ถูกปฏิเสธ ส่วน API ปิดสัญญารับเฉพาะ active จึงไม่ช่วยกู้สถานะนี้

ควร decode PNG พร้อมจำกัดขนาดภาพก่อน upload/commit และใช้ไฟล์ PNG ที่ decode ได้ใน regression fixture ปัจจุบัน fixture ของ signing test ใช้ PNG magic + bytes ขยะเอง จึงพลาดกรณีนี้

### 4. [P2] ID เกินขอบเขตส่งต่อเข้า SQL แล้วตอบ 500 ทุก role

controller ใช้ `ParseIntPipe` ซึ่งไม่ได้บังคับขอบเขต PostgreSQL integer ส่ง `2147483648` ไป query แล้วเกิด error แทนตอบ 400 ที่ขอบ API ยืนยัน 24 GET routes รวม Tenant payment-slip, Owner received payment-slip และ contract/listing/lead/viewing ของ Agent ดูรายการครบใน evidence และตารางท้ายรายงาน

ควรใช้ positive integer pipe ที่จำกัดไม่เกิน `2147483647` ให้เหมือนกันทุกเส้นที่อ้าง integer primary key

### 5. [P2] Query ซ้ำใน Places ทำให้ตอบ 500 — Agent / Owner

เส้นทั้ง 4: `GET /api/v1/agent/places/autocomplete`, `/nearby`, `/reverse`, `/details`

`language=th&language=en` ถูก parser แปลงเป็น array แล้ว `.toLowerCase()` ล้ม; latitude/longitude ที่ส่งซ้ำก็ทำให้ `.trim()` ล้ม ยืนยันด้วย HTTP ผ่าน controller จริงโดยใช้ service จำลอง ไม่ได้เรียก Google

ควรตรวจชนิด query ว่าเป็น string เดียวและคืน 400 เมื่อส่ง array/object

### 6. [P2] Payload ผิดชนิดใน Rooms และ Listing promo ทำให้ตอบ 500

- `POST /api/v1/agent/rooms` และ `PATCH /api/v1/agent/rooms/:id`: `listingTitle: 42` หรือ `contact: {name: 42, phone: "0800000000"}` ทำให้ `.trim()` ล้มใน `validateCreateBody` ที่ทั้งสองเส้นใช้ร่วมกัน
- `POST /api/v1/agent/rooms/generate-listing-promo`: `listing: {}` กับ `outputLocale: ["th", "en"]` ทำให้ `.trim()` ล้มใน `normalizeLocale`

ทำซ้ำผ่าน service จริงก่อนถึง transaction/การเรียก AI จึงไม่ได้สร้างห้องหรือเรียก Gemini ควรตรวจ runtime type ก่อน string operations; TypeScript DTO ไม่ได้ตรวจ JSON ที่รับมาโดยอัตโนมัติ

### 7. [P2] Profile / Avatar ยาวเกิน column ตอบ 500 — ใช้ร่วมทุก role

- `PATCH /api/v1/auth/profile`: `firstName` 256 ตัวอักษร → PostgreSQL `22001` แทน 400
- `POST /api/v1/auth/profile/avatar`: URL ยาวเกิน 512 ตัวอักษร → PostgreSQL `22001` แทน 400

ทำซ้ำด้วย AuthService และตาราง users สังเคราะห์ที่ใช้ column limits ตรงกับ entity ควรตรวจ string type และความยาวก่อน save (`first_name`/`last_name` 255, phone 50, avatar URL 512)

### 8. [P2] ล้างเบอร์แล้ว `profileCompleted` ยัง true — ใช้ร่วมทุก role

`PATCH /api/v1/auth/profile` ด้วย `phone: null` สำเร็จ แต่ response/state ยัง `profileCompleted: true` เพราะ `updateProfile` ตั้ง flag เป็น true อย่างเดียว ไม่คำนวณกลับเป็น false เมื่อข้อมูลจำเป็นถูกล้าง probe ยืนยัน phone=null และ flag=true หลัง save

ควรคำนวณ flag จากข้อมูลจำเป็นหลัง patch ทุกครั้งให้ตรงกับเกณฑ์สร้าง profile

## สิ่งที่ทำและสิ่งที่ยังไม่ยืนยัน

เพิ่มตัวตรวจ [audit-role-routes.cjs](../../apps/api/scripts/audit-role-routes.cjs) และคำสั่ง `npm run audit:role-routes -w @nestyk/api`; แก้ fixture ของ `room-photos.test.cjs` ที่ขาด ListingPromoService provider จน test module boot ไม่ได้ ปัญหานี้เป็น test fixture; AgentModule ของแอปมี provider อยู่แล้ว

รอบ audit นี้ไม่ได้แก้ application source ตาม findings ข้างต้น และไม่ได้ apply migration ในฐานข้อมูลที่ตรวจ งาน API ปิดสัญญาที่ทำก่อนหน้ายังคงอยู่ ยอดบิลเดิมยังคงตามนโยบายที่ผู้ใช้เลือก

ยังไม่ได้พิสูจน์ Supabase JWT จริง, signed URL/การ upload storage จริง, Google Places, Gemini/บริการเอกสารภายนอก หรือ POST/PATCH/DELETE ทุกเส้นกับข้อมูลจริง ตัวตรวจ default mock service จึงยืนยัน routing/guards และ controller parsing เท่านั้น; โหมดฐานข้อมูลใช้ READ ONLY กับบัญชีสังเคราะห์ และข้าม Places เพื่อลดผลข้างเคียง

ปัญหา flow การจอง/เช่า/ต่อสัญญาที่ตรวจไว้ก่อนหน้า เช่นข้อมูลการเงินในเอกสารกับบิลไม่ตรงกันและ due/grace settings ดู [รายงาน flow เดิม](../new-project/agent/contracts/flow-audit-2026-10-14.md)

## วิธีรันและหลักฐาน

```sh
npm run build -w @nestyk/api
node --test apps/api/test/*.test.cjs
npm run audit:role-routes -w @nestyk/api
npm run audit:role-routes -w @nestyk/api -- --read-only-db
npm run audit:role-routes -w @nestyk/api -- --read-only-db --large-id
npm run db:check -w @nestyk/api -- --check
```

ตัวตรวจใช้ loopback ephemeral server และ identity สังเคราะห์ใน dev-auth เฉพาะ process ที่รัน ห้ามนำ harness ไปใช้เป็น application server โหมด default mock services ไม่มีการเขียน DB/storage ส่วน read-only บังคับ `default_transaction_read_only=on` ทุก connection ตัวตรวจเป็น diagnostic: พิมพ์ findings ลง JSON และไม่ได้ตั้ง exit code ล้มเมื่อพบ route 500 จึงต้องอ่านผล ไม่ควรใช้ exit code อย่างเดียวเป็น CI gate

หลักฐานใน repository ไม่มี response body ของลูกค้า:

- [routing/guard และ query results](evidence/2026-10-14/routes.json)
- [55 GET กับ read-only database](evidence/2026-10-14/readonly.json)
- [24 GET กับ ID เกินขอบเขต](evidence/2026-10-14/large-id.json)
- [Owner scope และ profile proofs](evidence/2026-10-14/owner-profile-probes.log)
- [Signature/PDF proof](evidence/2026-10-14/signature-probe.log)
- [Malformed payload proofs](evidence/2026-10-14/payload-probes.log)


## Inventory ทุก route


ทุกแถวผ่านการตรวจ route dispatch/guards ด้วย service จำลองตาม roles ที่ประกาศ Column DB แสดง HTTP status จากการเรียก GET จริงใน read-only mode ด้วย identity สังเคราะห์; “ไม่ได้รัน” หมายถึงไม่มีการทดสอบ route นั้นกับ DB จริงในรอบนี้ Column ID แสดงผลเมื่อส่ง 2147483648 และ column Query แสดง 500 ที่เกิดกับ duplicate query ผ่าน controller

| Method | Path | Roles | DB GET | ID เกินขอบเขต | Query ซ้ำ |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/agent/contracts/end-reasons` | agent | agent: 200 | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/close` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/types` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/types/:code/templates` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/:id/history` | agent | agent: 404 | agent: 500 | — |
| GET | `/api/v1/agent/contracts/candidates` | agent | agent: 500 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/owner-users` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/reservation-defaults/:leadId` | agent | agent: 500 | agent: 500 | — |
| GET | `/api/v1/agent/contracts/broker-appointment-defaults/:leadId` | agent | agent: 500 | agent: 500 | — |
| GET | `/api/v1/agent/contracts/lease-defaults/:leadId` | agent | agent: 500 | agent: 500 | — |
| GET | `/api/v1/agent/contracts` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/invoices/next-number` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/invoices` | agent | agent: 200 | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/invoices` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/commission-confirmations/next-number` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/commission-confirmations` | agent | agent: 200 | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/commission-confirmations` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/invoices/:invoiceId/receipt-defaults` | agent | agent: 404 | agent: 500 | — |
| POST | `/api/v1/agent/contracts/invoices/:invoiceId/receipt` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/:id` | agent | agent: 404 | agent: 500 | — |
| POST | `/api/v1/agent/contracts` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/:id/draft-template` | agent | agent: 404 | agent: 500 | — |
| POST | `/api/v1/agent/contracts/:id/draft` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/cancel-draft` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/reservation-preview` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/generate-reservation` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/broker-appointment-preview` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/generate-broker-appointment` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/lease-renewal-preview` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/generate-lease-renewal` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/lease-preview` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/generate-lease` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/sign` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/deliveries` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/sign-invites` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/:id/financial-documents/:kind` | agent | agent: 404 | agent: 500 | — |
| POST | `/api/v1/agent/contracts/:id/financial-documents/:kind` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/documents/:kind` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/:id/attachments` | agent | agent: 404 | agent: 500 | — |
| GET | `/api/v1/agent/contracts/:id/attachments/broker-appointment/defaults` | agent | agent: 404 | agent: 500 | — |
| POST | `/api/v1/agent/contracts/:id/attachments/broker-appointment` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/contracts/:id/attachments/:documentId/url` | agent | agent: 404 | agent: 500 | — |
| POST | `/api/v1/agent/contracts/:id/attachments` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| DELETE | `/api/v1/agent/contracts/:id/attachments/:documentId` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/attachments/:documentId/review` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/contracts/:id/attachments/reuse` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/contracts/mine` | tenant, owner | tenant: 200, owner: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/contracts/mine/rooms` | tenant, owner | tenant: 200, owner: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/contracts/mine/:id/attachments` | tenant, owner | tenant: 404, owner: 404 | tenant: 500, owner: 500 | — |
| GET | `/api/v1/contracts/mine/:id/attachments/:documentId/url` | tenant, owner | tenant: 404, owner: 404 | tenant: 500, owner: 500 | — |
| POST | `/api/v1/contracts/mine/:id/attachments` | tenant, owner | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/contracts/mine/:id/document` | tenant, owner | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/contracts/mine/:id/financial-documents/:kind` | tenant, owner | tenant: 404, owner: 404 | tenant: 500, owner: 500 | — |
| POST | `/api/v1/contracts/mine/:id/payment-slip` | tenant, owner | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/contracts/mine/:id/sign` | tenant, owner | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/public/contract-sign/:token` | public | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/public/contract-sign/:token` | public | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/leads/locations` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/leads/visa-types` | agent | agent: 200 | ไม่ได้รัน | — |
| POST | `/api/v1/agent/leads` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/leads` | agent | agent: 500 | ไม่ได้รัน | — |
| PATCH | `/api/v1/agent/leads/:id` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/leads/:id/mark-inprogress` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/leads/:id/mark-lost` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/leads/:id` | agent | agent: 500 | agent: 500 | — |
| GET | `/api/v1/agent/leads/:id/match-settings` | agent | agent: 500 | agent: 500 | — |
| PATCH | `/api/v1/agent/leads/:id/match-settings` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/leads/:id/match-runs` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| DELETE | `/api/v1/agent/leads/:id/match-runs` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/leads/:id/match-runs/latest` | agent | agent: 500 | agent: 500 | — |
| POST | `/api/v1/agent/leads/:id/viewings` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/leads/:id/viewings` | agent | agent: 404 | agent: 500 | — |
| GET | `/api/v1/agent/viewings` | agent | agent: 500 | ไม่ได้รัน | — |
| PATCH | `/api/v1/agent/viewings/:id` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/listings/:id` | agent | agent: 404 | agent: 500 | — |
| GET | `/api/v1/agent/listings` | agent | agent: 200 | ไม่ได้รัน | — |
| POST | `/api/v1/agent/listings/:id/share-links` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/listings/:id/share-links` | agent | agent: 404 | agent: 500 | — |
| DELETE | `/api/v1/agent/listings/:id/share-links/:linkId` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/public/room-shares/:token` | public | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/places/autocomplete` | agent, owner | ไม่ได้รัน | ไม่ได้รัน | 500 |
| GET | `/api/v1/agent/places/nearby` | agent, owner | ไม่ได้รัน | ไม่ได้รัน | 500 |
| GET | `/api/v1/agent/places/reverse` | agent, owner | ไม่ได้รัน | ไม่ได้รัน | 500 |
| GET | `/api/v1/agent/places/details` | agent, owner | ไม่ได้รัน | ไม่ได้รัน | 500 |
| GET | `/api/v1/agent/rooms/properties` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/rooms/property-types` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/rooms/contract-types` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/rooms/room-types` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/rooms/facilities` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/rooms/contacts` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/rooms/property-owners` | agent | agent: 200 | ไม่ได้รัน | — |
| POST | `/api/v1/agent/rooms/media/upload` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/rooms/media/enhance` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/rooms/generate-listing-promo` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| PATCH | `/api/v1/agent/rooms/:id` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/agent/rooms` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/agent/tenants/leads` | agent | agent: 500 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/tenants/rooms` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/tenants` | agent | agent: 500 | ไม่ได้รัน | — |
| GET | `/api/v1/agent/tenants/:id` | agent | agent: 500 | agent: 500 | — |
| POST | `/api/v1/agent/tenants` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| PATCH | `/api/v1/agent/tenants/:id` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/health` | public | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/auth/sync` | authenticated | ไม่ได้รัน | ไม่ได้รัน | — |
| PATCH | `/api/v1/auth/profile` | authenticated | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/auth/profile/avatar` | authenticated | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/auth/dev/roles` | authenticated | ไม่ได้รัน | ไม่ได้รัน | — |
| DELETE | `/api/v1/auth/dev/roles` | authenticated | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/bills/agent` | agent | agent: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/bills/agent/:id/payment-slip` | agent | agent: 404 | agent: 500 | — |
| POST | `/api/v1/bills/agent/:id/confirm` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/bills/agent/:id/return` | agent | ไม่ได้รัน | ไม่ได้รัน | — |
| GET | `/api/v1/bills/received` | owner | owner: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/bills/received/:id/payment-slip` | owner | owner: 404 | owner: 500 | — |
| GET | `/api/v1/bills/mine` | tenant | tenant: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/bills/mine/next` | tenant | tenant: 200 | ไม่ได้รัน | — |
| GET | `/api/v1/bills/mine/:id/payment-slip` | tenant | tenant: 404 | tenant: 500 | — |
| POST | `/api/v1/bills/mine/:id/payment-slip` | tenant | ไม่ได้รัน | ไม่ได้รัน | — |
| POST | `/api/v1/bills/mine/:id/confirm` | tenant | ไม่ได้รัน | ไม่ได้รัน | — |
