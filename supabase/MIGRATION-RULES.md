# กฎการขึ้นฐานข้อมูล (Supabase) ของ NESTYK

ใช้กับทุกครั้งที่เปลี่ยนโครงสร้างตาราง ข้อมูล master หรือ entity ตั้งแต่เปลี่ยนมาใช้ `supabase/migrations` + `npm run db:push` (commit `793465c`, 14 ต.ค. 2026)

## ภาพรวมของระบบใหม่

- `supabase/migrations/<YYYYMMDDHHMMSS>_<ชื่อ>.sql` คือที่เดียวที่เก็บการเปลี่ยนโครงสร้าง ไฟล์แรกคือ `20261014100838_baseline.sql` ซึ่งรวมทุกอย่างก่อนหน้าไว้แล้ว
- `npm run db:push -w @nestyk/api` อ่านไฟล์ในโฟลเดอร์นี้ เทียบกับตาราง `supabase_migrations.schema_migrations` ในฐานข้อมูล แล้วรันเฉพาะไฟล์ที่ยังไม่เคยรัน ทุกไฟล์ที่ค้างรันใน transaction เดียว ถ้าไฟล์ไหนพัง จะย้อนกลับทั้งหมด
- `supabase/seed/masters.sql` คือข้อมูล master และแม่แบบสัญญา ส่วน `demo.sql` คือข้อมูลทดสอบ ใส่ด้วย `npm run db:seed`
- `apps/api/migrations/` เป็นของระบบเก่า เก็บไว้เป็นประวัติเท่านั้น

## ลำดับขั้นตอนเวลาขึ้นฐานข้อมูล

**Supabase dev: Railway รันให้เองทุกครั้งที่ deploy** (`railway.json` ช่อง `preDeployCommand`) ดูข้อ 10 ขั้นตอนข้างล่างใช้กับฐานข้อมูลในเครื่อง และใช้ลองไฟล์ใหม่ก่อน push

1. `npm run db:push -w @nestyk/api -- --check` สั่งรันจริงแล้วย้อนกลับ เพื่อดูว่าทุกไฟล์รันผ่าน
2. `npm run db:push -w @nestyk/api` สั่งรันจริง
3. (เฉพาะฐานข้อมูลใหม่) `npm run db:seed -w @nestyk/api -- masters` ส่วน `demo` ให้ใส่เฉพาะ dev
4. `npm run db:check -w @nestyk/api -- --check` ต้องได้ `✓ entity ตรงกับฐานข้อมูล` ถ้าได้ `✗` ห้ามเปิดใช้ API กับฐานข้อมูลนั้น

## ข้อห้าม

**1. ห้ามเพิ่มไฟล์ใหม่ใน `apps/api/migrations/`**
`db:push` ไม่อ่านโฟลเดอร์นี้ ไฟล์ที่ใส่ไว้ในนี้จะไม่ถูกรันบน Supabase เลย
เคสที่เกิดขึ้นจริง: `20261014-contract-closure.sql` (commit `c35fd24`) เพิ่มคอลัมน์ `leads.booking_released_at` ใน entity แต่ไฟล์ไปอยู่ที่โฟลเดอร์เก่า ฐานข้อมูลที่สร้างจาก baseline จึงขาดคอลัมน์นี้ และเส้นทาง API เรื่องสัญญากับรายการห้องจะพัง แก้แล้วด้วยไฟล์ `20261014120000_contract_closure.sql`

**2. ห้ามแก้ไฟล์ migration ที่ push ไปแล้ว (รวม baseline)**
`db:push` จำแค่เลข version ของไฟล์ ถ้าแก้เนื้อหาไฟล์เดิม ฐานข้อมูลที่เคยรันไฟล์นั้นไปแล้วจะไม่รันซ้ำ ผลคือฐานข้อมูลของแต่ละคนจะไม่ตรงกัน ถ้าต้องแก้ ให้สร้างไฟล์ใหม่ที่ทำ `ALTER` ต่อจากของเดิม

**3. ห้ามตอบ `y` ตอน `db:check` ถามว่าจะรัน migration ให้ไหม**
ถ้าไม่ใส่ `--check` สคริปต์จะเสนอให้รันไฟล์จาก `apps/api/migrations/` หรือเขียนไฟล์ `*-schema-sync.sql` ลงโฟลเดอร์เก่า การรันแบบนี้ไม่ถูกบันทึกใน `supabase_migrations` และไม่อยู่ในโฟลเดอร์ที่ `db:push` อ่าน ให้ใส่ `-- --check` ทุกครั้ง แล้วแก้ด้วยการเพิ่มไฟล์ใน `supabase/migrations`

**4. ห้ามใช้ `db:push -- --mark-applied` กับ Supabase จริง**
ตัวเลือกนี้บันทึกว่าไฟล์รันแล้วโดยไม่รันจริง ใช้ได้เฉพาะ docker ที่มีตารางครบอยู่ก่อนแล้ว ถ้าใช้ผิดที่ ฐานข้อมูลจะขาดตาราง และ `db:push` ครั้งต่อไปจะไม่เติมให้

**5. ห้ามใส่ข้อมูล master ใน migration โดยปล่อยให้ระบบเลือก id เอง**
`masters.sql` ใส่ id แบบตายตัว เช่น `master_contract_end_reasons` ใส่ id 1–7 ถ้า migration ใส่แถวใหม่โดยไม่ระบุ id ฐานข้อมูลใหม่ (ยังไม่มีแถว) จะให้ id 1 แล้ว seed จะพังเพราะ id ซ้ำ ให้ระบุ id ต่อจากค่าสูงสุดใน seed แล้วตั้ง sequence ตามค่าจริง:

```sql
INSERT INTO public.master_xxx (id, code, ...) VALUES (8, '...', ...) ON CONFLICT DO NOTHING;
SELECT pg_catalog.setval('public.master_xxx_id_seq', (SELECT max(id) FROM public.master_xxx), true);
```

และใน `masters.sql` บรรทัด `setval` ของตารางนั้นต้องใช้ `(SELECT max(id) ...)` ไม่ใช่ตัวเลขตายตัว

**6. ห้ามใส่ `demo` seed บน prod**
ผู้ใช้ใน demo ใช้ UUID สมมติที่เข้าได้ด้วย dev token เท่านั้น บน prod จะเป็นข้อมูลขยะที่ลบยาก

**7. ห้ามใช้ Transaction pooler (port 6543)**
`DATABASE_URL` ต้องเป็น Session pooler (`*.pooler.supabase.com:5432`) เพราะ transaction pooler ไม่รองรับ advisory lock และสถานะระดับ session

**8. ห้าม commit `.env` / `.env.api` และห้ามแปะรหัสผ่านหรือคีย์ในแชท**

**9. ห้ามสร้าง role ชื่อ `owner` อีก**
รหัส `owner` เลิกใช้ถาวรตั้งแต่ migration `20261016100000_rename_owner_role_to_landlord.sql` (เปลี่ยนเป็น `landlord` id เดิม) โค้ดรุ่นเก่าเข้าใจ `owner` ว่าผู้ให้เช่า ถ้ามีแถวนี้กลับมา API รุ่นใหม่จะไม่ยอมเริ่มทำงาน (`RoleCatalogCheck`) ส่วน API รุ่นเก่าจะให้สิทธิ์ผิดความหมาย
- เช็กว่าฐานข้อมูลอยู่รอบไหน: `SELECT id, name FROM public.master_roles ORDER BY id;` ถ้าเห็น `owner` = ยังไม่รันรอบ 1, เห็น `landlord` = รันแล้ว
- ก่อน push โค้ดที่แตะ role ให้รัน `npm run check:roles` (ที่ root) ต้องไม่เจออะไร
- คำว่า `owner` ที่เป็น "ฝ่ายผู้ให้เช่าในสัญญา" (`party`, `subject`, คอลัมน์ `owner_*`, ชนิด `ContractParty`) ใช้ต่อได้ตามปกติ ไม่ใช่ role
- role ใหม่ต้องเพิ่มใน `MASTER_ROLE_NAMES` (`apps/api/src/entities/master-role.entity.ts`) และใส่ id ตายตัวใน migration ตามข้อ 5 ถ้าโค้ดยังไม่รู้จัก role นั้น API จะแค่เตือนใน log

**10. push เข้า `develop` = รัน migration บน Supabase dev ทันที**
`railway.json` สั่งให้ Railway รัน `node apps/api/scripts/db-push.cjs` หลัง build เสร็จ ก่อนเปิด API ตัวใหม่ ไม่มีขั้นยืนยันก่อน
- ก่อน merge ไฟล์ใน `supabase/migrations` ต้องรัน `db:push -- --check` กับฐานข้อมูลในเครื่องให้ผ่าน และให้อีกคนรีวิว
- ถ้า migration พัง Railway จะหยุด deploy ตัวนั้น (ไม่ลองซ้ำ) API ตัวเดิมยังเปิดอยู่ และฐานข้อมูลไม่เปลี่ยนเพราะทุกไฟล์รันใน transaction เดียว ดู error ได้ที่ Deploy Logs ช่วง pre-deploy
- **rollback บน Railway ไม่ได้ย้อนฐานข้อมูล** ถ้าย้อนไปโค้ดที่เก่ากว่า migration ล่าสุด โค้ดนั้นต้องยังทำงานกับฐานข้อมูลใหม่ได้ ถ้าไม่ได้ ให้แก้ด้วย migration ใหม่แทนการ rollback
- seed ไม่ถูกรัน ข้อมูล master ใหม่ต้องอยู่ใน migration ตามข้อ 5
- ห้ามย้าย `db-push` ไปรันตอน API เริ่มทำงาน (`main.ts` หรือ `migrationsRun` ของ TypeORM) เพราะทุกเครื่องที่รัน API จะแก้ฐานข้อมูลที่ `.env.api` ชี้อยู่ได้ และถ้าพังจะรีสตาร์ทวนไม่หยุด

## ข้อระวัง

**แก้ entity ต้องมี migration ในการแก้เดียวกัน**
เพิ่ม ลบ หรือเปลี่ยนคอลัมน์ใน `apps/api/src/entities` ต้องมีไฟล์ใน `supabase/migrations` คู่กันใน commit เดียวกัน ก่อน push code ให้รัน `db:check -- --check` กับฐานข้อมูล dev ของตัวเอง

**ตั้งชื่อไฟล์ด้วยเวลาปัจจุบัน และระวังตอน merge**
`db:push` รันไฟล์ที่ยังไม่เคยรันตามลำดับชื่อ แม้ไฟล์นั้นจะเก่ากว่าไฟล์ล่าสุดที่รันไปแล้ว ถ้า 2 คนสร้าง migration พร้อมกันแล้วไฟล์หนึ่งพึ่งอีกไฟล์ (เช่นใช้คอลัมน์ที่อีกไฟล์สร้าง) ให้ตรวจลำดับชื่อไฟล์ก่อน merge

**ตารางใหม่ต้องเปิด RLS ในไฟล์ของตัวเอง**
ส่วนท้ายของ baseline เปิด RLS และถอนสิทธิ์ `anon` / `authenticated` เฉพาะตารางที่มีอยู่ตอนนั้น ตารางที่สร้างทีหลังต้องเขียนเองในไฟล์เดียวกัน:

```sql
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;
```

ถ้าไม่ทำ ตารางใหม่อาจถูกอ่านผ่าน Data API ด้วยคีย์สาธารณะที่อยู่ในแอป

**เขียนชื่อ schema `public.` ทุกครั้ง**
baseline ตั้ง `search_path` เป็นค่าว่างระหว่างรัน ถึงสคริปต์จะคืนค่าให้หลังแต่ละไฟล์ แต่การเขียน `public.ชื่อตาราง` ชัด ๆ ไม่ต้องพึ่งค่านี้

**ทุกไฟล์รันใน transaction เดียว**
- ห้ามใช้ `CREATE INDEX CONCURRENTLY` หรือคำสั่งอื่นที่รันใน transaction ไม่ได้
- สคริปต์ตั้ง `lock_timeout 10s` และ `statement_timeout 120s` ถ้าแก้ตารางใหญ่หรือตารางที่มีคนใช้อยู่ อาจหมดเวลาได้ ให้ลอง `--check` ตอนคนใช้น้อย

**ถ้า dump baseline หรือ masters ใหม่**
- ตรวจว่าบรรทัด `setval` ของ `master_contract_end_reasons` ใน `masters.sql` ยังเป็น `(SELECT max(id) ...)`
- dump จาก Postgres 17 มีบรรทัด `SET transaction_timeout` ซึ่ง Postgres รุ่นต่ำกว่า 17 ไม่รู้จัก Supabase ใช้ 17 อยู่แล้ว แต่ถ้าลองกับ Postgres บนเครื่องรุ่นเก่าจะพังที่บรรทัดนี้

## ประวัติการแก้

| วันที่ | ไฟล์ | เรื่อง |
|---|---|---|
| 2026-10-29 | `20261029100000_deposit_settlement_search_path.sql` | สร้างฟังก์ชัน `validate_deposit_settlement` ใหม่ด้วย `SET search_path TO 'public'` และเขียน `public.` หน้าทุกตาราง แทน `SET search_path FROM CURRENT` ของไฟล์ `20261028100000` กติกาในฟังก์ชันเหมือนเดิม ไม่แก้ตารางและข้อมูล |
| 2026-10-28 | `20261028100000_move_out_deposit_refund.sql` | คืนเงินประกันตอนย้ายออก (D16): `contract_deposit_settlements` เพิ่ม `return_received_reference` เป็นหลักฐานที่รับเงินจากผู้ให้เช่า คู่กับสลิปโอนให้ผู้เช่า (`chk_deposit_refund_proof`) และให้ฟังก์ชัน `validate_deposit_settlement` อนุมัติได้เมื่อถึงวันสิ้นสุด หรือมี `notRenewing` หรือ `endsOn` แม้สถานะในตารางยังเป็น `active` สัญญาที่ยกเลิกอนุมัติไม่ได้ ขยาย `chk_contract_reminders_kind` ให้รับ `early_end_refund_late` และ `deposit_refund_late` ไม่แก้ข้อมูลเดิม |
| 2026-10-27 | `20261027160000_late_fee_invoices.sql` | ใบแจ้งหนี้ค่าปรับ (D12): `agent_invoices` รับ `invoice_kind` `late_fee` เพิ่ม `tenant_bill_id` อ้างถึง `tenant_bills` ใบค่าปรับต้องผูกสัญญาและบิล ออกในนามผู้ให้เช่า ยอดมากกว่า 0 และมีได้ 1 ใบต่อบิล (`uq_agent_invoices_one_late_fee`) ใส่ `tenant_bill_id` ได้เฉพาะใบค่าปรับ ไม่แก้ข้อมูลเดิม |
| 2026-10-26 | `20261026140000_deal_cancellations.sql` | การยกเลิกดีลก่อนส่งมอบห้อง (D5): ตาราง `deal_cancellations` เก็บฝ่ายที่เป็นเหตุ เหตุผล ไฟล์หลักฐาน (อย่างน้อย 1 ไฟล์) วันที่ได้รับแจ้ง ยอดที่ออกใบเสร็จแล้ว ยอดริบหรือยอดคืน วันครบกำหนดคืน และการบันทึกคืนเงิน (บันทึกได้ครั้งเดียว) เพิ่มเหตุผลสิ้นสุดสัญญา id 9 `deal_cancelled` และ id 10 `landlord_withdrew` (id คงที่เหมือน id 8 เพราะ seed ใส่ id 1 ถึง 7) และขยาย `chk_contract_reminders_kind` ให้รับ `refund_late` ไม่แก้ข้อมูลเดิม |
| 2026-10-26 | `20261026130000_contract_reminders.sql` | การเตือน (D4): ตาราง `contract_reminders` เก็บว่าเตือนเรื่องไหนให้ใครไปแล้ว (ชนิด สัญญา บิล วันครบกำหนด ผู้รับ) และส่งอีเมลแล้วหรือยัง เตือนครั้งเดียวต่อคนต่อรอบ (`uq_contract_reminders_once`) เรื่องค่าเช่าต้องมีบิล เรื่องอื่นต้องไม่มี (`chk_contract_reminders_bill`) เพิ่มตารางอย่างเดียว |
| 2026-10-26 | `20261026120000_deal_offer_revisions.sql` | ประวัติการแก้ข้อเสนอที่ผู้ให้เช่ายืนยันแล้ว (D2 รอบ 2): ตาราง `deal_offer_revisions` เก็บเลขฉบับ เหตุผล ช่องทางที่ผู้ให้เช่าตกลง (`phone`/`line`/`in_person`/`other`) และเงื่อนไขก่อนและหลังการแก้ 1 แถวต่อฉบับ (`uq_deal_offer_revisions_offer_revision`) ลบข้อเสนอที่มีประวัติไม่ได้ เพิ่มตารางอย่างเดียว |
| 2026-10-22 | `20261022160000_deposit_slip_return.sql` | ตีกลับสลิปเงินประกัน (D11): `agent_invoices` เพิ่ม `slip_return_note` (ไม่เกิน 500 ตัว ถ้ามีค่าต้องไม่ว่าง `chk_agent_invoices_slip_return`) เหตุผลที่ตีกลับสลิปค่าจองเก็บใน `data` ของหนังสือจอง ไม่มีคอลัมน์ |
| 2026-10-22 | `20261022150000_deal_offers.sql` | ข้อเสนอที่ผู้ให้เช่ายืนยัน (D2): ตาราง `deal_offers` เก็บค่าเช่า ระยะเวลา วันเริ่ม เงินประกัน วันครบกำหนด วันผ่อนผัน ค่าปรับ วันแจ้งต่อสัญญา นายหน้าอีกฝ่าย และใครยืนยันทางไหน lead กับห้องเดียวกันมีข้อเสนอที่ยังเปิดได้ครั้งละ 1 ฉบับ (`uq_deal_offers_one_open`) เพิ่มตารางอย่างเดียว |
| 2026-10-22 | `20261022140000_deposit_invoice_void.sql` | ยกเลิกใบแจ้งหนี้เงินประกัน (D7): `agent_invoices` เพิ่ม `voided_at` ใช้เมื่อปิดสัญญาตอนรอเงินประกัน ยกเลิกได้เฉพาะใบเงินประกันที่ยังไม่มีใบเสร็จ (`chk_agent_invoices_void`) ไม่แก้ข้อมูลเดิม |
| 2026-10-22 | `20261022130000_lease_status_deposit_handover.sql` | สถานะสัญญาเช่า (D7): `chk_lease_contracts_status` เอา `awaiting_payment` และ `awaiting_payment_verification` ออก เพิ่ม `awaiting_deposit` และ `awaiting_handover` ถ้ายังมีแถวที่ใช้สถานะเก่า migration หยุดและไม่เปลี่ยนอะไร |
| 2026-10-22 | `20261022120000_handover_records.sql`, `seed/masters.sql`, `seed/demo.sql` | ส่งมอบห้อง (D6): ตาราง `handover_records` (1 บันทึกต่อสัญญาและชนิด `move_in`/`move_out`), `handover_items`, `handover_photos` และ `agreement_signatures.handover_record_id` (แยก unique index ลายเซ็นสัญญากับลายเซ็นบันทึกส่งมอบ) · แม่แบบสัญญาเช่า id 11 (รุ่น 6) คัดลอกจาก id 9 แล้วปิด id 9 เฉพาะฐานข้อมูลที่มี id 9 อยู่แล้ว ฐานใหม่ได้ id 11 จาก `masters.sql` ถ้า id 11 ถูกใช้แล้ว migration หยุด · `setval` ใน seed ใช้ค่าสูงสุดจริงแทนเลขตายตัว |
| 2026-10-21 | `20261021130000_deposit_invoices.sql` | ใบแจ้งหนี้เงินประกัน (D10): `agent_invoices` เพิ่ม `invoice_kind` (`general`/`deposit`), `lease_contract_id`, `issuer_party`, `amount`, `due_date`, `slip_submitted_at` ใบเดิมทั้งหมดเป็น `general` ในนามนายหน้าตามเดิม ใบ `deposit` ต้องผูกสัญญา ออกในนามผู้ให้เช่า ยอดมากกว่า 0 และมีได้ 1 ใบต่อสัญญา (`uq_agent_invoices_one_deposit`) |
| 2026-10-21 | `20261021120000_agreement_signatures.sql` | ตารางบันทึกการลงนาม `agreement_signatures` (D17: ใครกด ช่องทาง ลิงก์ และ D9: พยาน) คัดลอกลายเซ็นเดิมเป็นช่องทาง `legacy` คอลัมน์ลายเซ็นเดิมใน `lease_contracts` ยังอยู่และยังถูกเขียน จนกว่าจะมีไฟล์ cleanup รอบที่ 2 |
| 2026-10-19 | `20261019100000_link_qa_accounts.sql` | ผูกบัญชีเทส `qa-<role>@nestyk.test` ที่สร้างไว้ใน Supabase Authentication กับชื่อ เบอร์ และ role (ไม่สร้างบัญชี ไม่มีรหัสผ่าน ถ้าไม่มีบัญชีพวกนี้จะไม่ทำอะไร) |
| 2026-10-16 | `railway.json` | ให้ Railway รัน `db-push` ก่อน deploy ทุกครั้ง (ข้อ 10) |
| 2026-10-16 | `20261016100000_rename_owner_role_to_landlord.sql`, `seed/masters.sql` | เปลี่ยน role `owner` → `landlord` (id 2 เดิม) และ `setval` ของ `master_roles_id_seq` ใช้ `max(id)` ดู `docs/ROLE-CHANGE-PLAN.md` |
| 2026-10-15 | `20261014120000_contract_closure.sql`, `seed/masters.sql` | ย้าย contract-closure จากโฟลเดอร์เก่ามาโฟลเดอร์ใหม่ (คอลัมน์ `leads.booking_released_at`, index `uq_leads_one_booked_per_room` แบบใหม่, เหตุผลจบสัญญา `before_start_cancelled` id 8) และแก้ `setval` ใน seed ให้ใช้ `max(id)` |
