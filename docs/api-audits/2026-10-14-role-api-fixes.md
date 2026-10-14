# ผลแก้ API และ flow Agent — 14 ตุลาคม 2026

แก้ปัญหา 500 ที่ทำซ้ำได้จาก [รายงานตรวจเดิม](2026-10-14-role-api-audit.md) แล้ว โดยเน้น Agent; ส่วน Tenant/Owner เปลี่ยน API สัญญา บิล และการลงนามที่เกี่ยวข้อง ไม่ได้เปลี่ยนหน้าจออื่นของสอง role นี้

## ผลหลังแก้

| จุด | พฤติกรรมหลังแก้ |
| --- | --- |
| Agent 12 GET ตอบ 500 เพราะ Lead column ขาด | ใช้ migration ปิดสัญญาใน schema `public` ที่ workspace ตั้งค่าแล้ว; schema check ผ่าน และ GET ทั้ง 12 เส้นไม่ตอบ 500 |
| ID เกิน integer | DatabaseIdPipe รับเฉพาะ 1–2147483647 ครอบคลุม param ID ของ Agent และ API สัญญา/บิล Tenant/Owner; oversized, zero, negative, fractional ID ตอบ 400 ก่อน SQL |
| Query ซ้ำ / object | SingleQueryPipe ตรวจ query ที่ Agent ใช้; Places และ list/search ไม่เรียก string methods กับ array/object แล้ว |
| JSON ของ Rooms / listing promo ผิดชนิด | ตรวจ object/array, nested fields, IDs, column lengths และตัวเลขก่อน transaction/AI; ผิดชนิดตอบ 400 |
| Profile / Avatar ที่ Agent ใช้ | shared AuthService ตรวจ type/column limits ก่อน save; เมื่อข้อมูลจำเป็นถูกล้าง profileCompleted กลับเป็น false |
| Owner ใหม่เปิดสลิปเก่า | listReceived, slip ownership และ owner billing issuance ใช้ owner snapshot ของสัญญา; current room owner ใช้เป็น fallback เฉพาะสัญญาเก่าที่ owner_user_id เป็น null |
| PNG ลายเซ็นเสีย | Agent, party signing และ public invite decode PNG ก่อน upload/เปลี่ยนสถานะ; storage ตรวจซ้ำ จำกัดขนาด/จำนวน pixels และ normalize PNG ให้ PDF อ่านได้; request เสียไม่ล็อกสิทธิ์ลงนามซ้ำ |

## Flow จอง → สัญญาเช่า → ต่อ/ปิดสัญญา → บิล

- Lease defaults เลือกวันเข้าอยู่ ราคา เงินประกัน และเงินล่วงหน้าจากหนังสือจองที่ finalized ก่อนใช้ค่าเริ่มต้นจากห้อง จึงไม่เปลี่ยนยอดที่ตกลงเป็นราคาประกาศใหม่เอง
- Lease/renewal reject เงินติดลบ, NaN, Infinity, จำนวนเงินเกินขอบเขต และวันที่ครบกำหนดนอก 1–31 ก่อน save; overlay เป็นแหล่งข้อมูลยอดเดียวกับคอลัมน์ที่ billing ใช้ แทนการ fallback แล้วยังคงเอกสารที่ผิด
- วันผ่อนผันของบิลใหม่ตาม graceDay ในสัญญา; blank คงค่าเดิม due + 5 วัน หาก grace day อยู่ก่อน due day จะนับเป็นเดือนถัดไป และ clamp วันสิ้นเดือนสั้น
- Renewal แยกข้อความบัญชีเป็น bankName/accountName/accountNo; form ที่เติมจาก lease เก็บตำแหน่งทั้งสามช่องแม้บางช่องว่าง ปุ่มคัดลอกเลขบัญชีจึงไม่รวมชื่อธนาคารและชื่อบัญชี
- ยกเลิก draft ใช้ lock ลำดับ lead → room → contract ตาม creation/closure หากเป็น rental draft สุดท้ายที่ไม่มี sibling ถือการจอง จะตั้ง booking_released_at และปิด prospect ของฉบับนั้น ร่างต่อสัญญาที่อ้างฉบับหมดอายุแล้วไม่นับหนังสือจองเก่าเป็นผู้ถือห้อง ส่วนฉบับเดิมที่ยัง active ยังคงถือห้อง; การยกเลิก broker appointment อย่างเดียวไม่คืนการจอง
- งาน billing และการอ่านบิลเปิด prospect เป็น active เมื่อถึงวันเข้าอยู่ของสัญญาที่ active ภายใต้ parent lock; ไม่เปิด occupancy สำหรับสัญญาอนาคต และไม่เปิดกลับหลัง closure กรณีเซ็นล่วงหน้าจะเปลี่ยนในงานประจำวันหรือการอ่าน billing หลังถึงวันเริ่ม
- เพิ่ม `GET /api/v1/bills/agent/tenants/:tenantId` เพื่ออ่านบิลจริงทุกสถานะ, รอบถัดไป, ช่วงที่ชำระล่วงหน้า และประวัติรับเงิน ตรวจสิทธิ์ Tenant ของ Agent ก่อนอ่าน/ออกบิล
- AgentTenantsScreen ใช้ API นี้แทน demo หลังยืนยัน/ตีกลับสลิปจะอ่านข้อมูลจริงใหม่ ไม่สร้าง paidAt จากเวลาบนเครื่องและไม่เปลี่ยนบิลเป็น paid เอง หน้าบิลยังแสดงบิลค้างและประวัติเมื่อ lease ไม่มี active แล้ว
- แก้ AgentRoomEditor ที่ส่ง facility groupCode=null ให้เป็น undefined และย้าย state ของข้อมูลห้องใน listing wizard ให้ประกาศก่อนใช้ใน dependencies เพื่อให้สร้าง/แก้ห้องไม่ล้มตั้งแต่ render และผ่าน TypeScript

ยังคงนโยบาย **เก็บยอดบิลที่ออกแล้ว ให้ Agent ปรับยอดแยกภายหลัง** ไม่มีการลบ/ปรับยอดบิลเก่า, ลบสลิป, เปลี่ยนสัญญาที่ปิดย้อนหลัง หรือคาดเดาสถานะลายเซ็นเดิม งานปิดสัญญา/คืนห้องและ concurrency guards ที่ทำก่อนหน้ายังคงอยู่

## หลักฐานตรวจซ้ำ

| การตรวจ | ผล |
| --- | --- |
| Routing / role guards | 120 routes (เพิ่ม Agent tenant billing 1 เส้น), ไม่มี shadow/role guard failure; malformed query ที่ตรวจไม่มี 500 |
| READ ONLY GET กับ configured DB | 56 routes, ใช้ identity สังเคราะห์ ไม่มี 500; ได้ 200/404 ตามการมีรายการ |
| ID 2147483648 | 25 GET routes ตอบ 400 ทั้งหมด; ครอบคลุม Agent, Tenant และ Owner |
| API regression | 230/230 ผ่าน รวม wrong input, readable/corrupt PNG, valid retry, booking defaults/cancellation และ billing |
| Consumer + listing helper regression | 94/94 ผ่าน รวม render บิลค้างและ paid history หลังหมดสัญญา |
| PostgreSQL integration | 2/2 ผ่าน ใน schema สังเคราะห์ที่ลบทิ้งหลังจบ รวม Owner scope, ยอด/paidAt จริง, occupancy, draft cancellation, closure, rollback และ concurrent billing |
| Build / TypeScript | API build และ consumer TypeScript ผ่าน |
| Schema | 44 ตารางตรงกับ entities; invoice_path ที่ entity ไม่ใช้เป็น warning เดิม ไม่ใช่ missing column |

รวม automated tests **326 tests ผ่าน** และ `git diff --check` ผ่าน

หลักฐาน: [routing](evidence/2026-10-14/fixes/routes.json), [READ ONLY GET](evidence/2026-10-14/fixes/readonly.json), [oversized ID](evidence/2026-10-14/fixes/large-id.json), [migration](evidence/2026-10-14/fixes/migration.log), [schema](evidence/2026-10-14/fixes/schema.log), [API tests](evidence/2026-10-14/fixes/api-tests.log), [PostgreSQL tests](evidence/2026-10-14/fixes/postgresql-tests.log), [consumer tests](evidence/2026-10-14/fixes/consumer-tests.log)

```sh
npm run build -w @nestyk/api
node --test apps/api/test/*.test.cjs
node --test apps/consumer-app/components/*.test.cjs apps/consumer-app/lib/*.test.cjs packages/feature-listing/test/*.test.cjs
./node_modules/.bin/tsc --noEmit -p apps/consumer-app/tsconfig.json
RUN_CONTRACT_CLOSURE_DB_TEST=1 node --test apps/api/test/contract-closure.integration.cjs
npm run audit:role-routes -w @nestyk/api
npm run audit:role-routes -w @nestyk/api -- --read-only-db
npm run audit:role-routes -w @nestyk/api -- --read-only-db --large-id
npm run db:check -w @nestyk/api -- --check
```

## ขอบเขตที่ยังไม่ได้พิสูจน์

ไม่ได้ทำทุก POST/PATCH/DELETE กับข้อมูลลูกค้า, ทดลองเงินจริง, JWT จริง หรือเรียก Supabase Storage/Google Places/Gemini/บริการเอกสารภายนอกทุกเส้น การตรวจ routes แบบ mock พิสูจน์ routing/guards/controller input เท่านั้น; READ ONLY GET ด้วยบัญชีสังเคราะห์ไม่ได้พิสูจน์การเปิดข้อมูลลูกค้าทุกราย

การเปลี่ยน schema ที่ตั้งค่าเสร็จแล้ว แต่ไม่ได้ deploy API/consumer ไป remote environment งานใหม่ เช่น automatic expiry, API ปรับยอด/คืนเงิน และ settlement UI ยังแยกจาก bug fixes รอบนี้
