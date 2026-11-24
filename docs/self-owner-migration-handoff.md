# Self owner: migration ที่มากับ branch `feature/self-owner` (แจ้ง Mos, 23 พ.ย. 2026)

เขียนโดย Jom ไว้ให้ดูตอน merge `feature/self-owner` เข้า branch รวม (`UXUI/develop` แล้วต่อไป `develop`)
กติกาทั้งหมดอ้างอิง `supabase/MIGRATION-RULES.md`

## สรุปสั้น

- มี migration ใหม่ **1 ไฟล์**: `supabase/migrations/20261120081500_self_owner_rooms.sql`
- migration อื่นของงาน self owner (`20261118051846_self_owner_role.sql`) อยู่ใน `UXUI/develop` แล้ว
- ไฟล์นี้ **เพิ่มตารางใหม่อย่างเดียว** ไม่แก้ตารางเดิม ไม่ใส่ข้อมูล master ไม่ต้องแก้ seed
- ชื่อไฟล์ (20 พ.ย.) **เก่ากว่า** `20261123040000_viewing_requests.sql` ของ Mos แต่ไม่ต้องทำอะไรพิเศษ ดูหัวข้อ "เรื่องลำดับชื่อไฟล์"

## ไฟล์นี้ทำอะไร

ห้องที่เจ้าของลงประกาศเอง (ไม่ผ่านนายหน้า) แยกเก็บจากห้องของ agent (`rent_rooms`) ตามที่ตกลงกับ QA Aof (Jom ตัดสิน 20 พ.ย.) ใช้ตาราง `properties` (โครงการ/อาคาร) ร่วมกับ agent

| ตาราง | เก็บอะไร | FK |
|---|---|---|
| `self_owner_rooms` | ห้อง 1 แถวต่อห้อง | `owner_user_id` → `users` (CASCADE), `properties_id` → `properties`, `room_type_id` → `master_room_types`, `room_status_id` → `master_room_statuses` (RESTRICT) |
| `self_owner_room_prices` | ค่าเช่าตามแบบสัญญา | `room_id` → `self_owner_rooms` (CASCADE), `contract_type_id` → `master_contract_types` |
| `self_owner_room_medias` | รูปห้อง (มีรูปปกได้ 1 รูปต่อห้อง `uq_self_owner_room_medias_one_cover`) | `room_id` → `self_owner_rooms` (CASCADE) |
| `self_owner_room_facilities` | สิ่งอำนวยความสะดวก | `room_id` → `self_owner_rooms` (CASCADE), `facility_id` → `master_facilities` |

- เปิด RLS ทั้ง 4 ตารางในไฟล์เดียวกัน ไม่มี policy (เขียนผ่าน API เหมือนตารางอื่น)
- ไม่มี `CREATE INDEX CONCURRENTLY` รันใน transaction เดียวได้
- วิธีย้อนอยู่หัวไฟล์: `DROP TABLE public.self_owner_room_facilities, public.self_owner_room_medias, public.self_owner_room_prices, public.self_owner_rooms;` (ห้อง ราคา รูป และสิ่งอำนวยความสะดวกของ self owner หายทั้งหมด)
- โค้ดที่ใช้ตารางนี้: entity `apps/api/src/entities/self-owner-room*.entity.ts`, module `apps/api/src/self-owner/`
- การลบบัญชี (`auth.service.ts`) ลบห้องของ self owner และรูปของเขาใน bucket `property-images` ด้วย (รูปที่ห้อง agent ใช้อยู่ไม่ลบ)

## เรื่องลำดับชื่อไฟล์

ถ้าฐานข้อมูลไหนรัน `20261123040000_viewing_requests.sql` ไปก่อนแล้ว `20261120081500_self_owner_rooms.sql` ก็ยังรันตามปกติ

- `apps/api/scripts/db-push.cjs` เลือกไฟล์ที่ **ยังไม่มีใน** `supabase_migrations.schema_migrations` แล้วรันตามลำดับชื่อ ไม่สนว่าไฟล์ล่าสุดที่รันไปแล้วคืออะไร (MIGRATION-RULES หัวข้อ "ตั้งชื่อไฟล์ด้วยเวลาปัจจุบัน และระวังตอน merge")
- สองไฟล์นี้ไม่พึ่งกัน (ไม่ใช้ตารางหรือคอลัมน์ของกันและกัน) ลำดับไหนก็ได้
- **อย่าใช้ `supabase db push` ของ Supabase CLI** กับฐานข้อมูลที่รันไฟล์ใหม่กว่าไปแล้ว เพราะ CLI จะไม่ยอมรันไฟล์ที่เก่ากว่าถ้าไม่ใส่ `--include-all` ให้ใช้ `npm run db:push -w @nestyk/api` ตามปกติ

## ต้องทำอะไรตอน merge

**merge เข้า `UXUI/develop`** (ยังไม่แตะ Supabase dev)

1. ดึง branch รวมที่ merge แล้วมาที่เครื่อง แล้วรันกับฐานข้อมูลในเครื่อง:
   - `npm run db:push -w @nestyk/api -- --check` ต้องรันผ่านทุกไฟล์แล้วย้อนกลับ
   - `npm run db:push -w @nestyk/api`
   - `npm run db:check -w @nestyk/api -- --check` ต้องได้ `✓ entity ตรงกับฐานข้อมูล`
2. ฝั่งโค้ดมี conflict แบบเพิ่มทั้งสองฝั่ง แก้ไว้แล้วใน merge commit `c121f48` บน `feature/self-owner`:
   - `apps/api/src/app.module.ts`: มีทั้ง `SelfOwnerModule` และ `ViewingRequestsModule`
   - `apps/api/src/entities/index.ts`: import และ `ALL_ENTITIES` มีทั้ง entity ของ self owner และของ viewing request

**merge เข้า `develop`** (Railway รัน migration บน Supabase dev ทันที ตาม MIGRATION-RULES ข้อ 10)

- ทำขั้น 1 ข้างบนให้ผ่านก่อน และให้อีกคนรีวิวไฟล์ migration
- Railway จะรันเฉพาะ `20261120081500_self_owner_rooms.sql` (ถ้า `viewing_requests` ลงไปก่อนแล้ว) หรือรันทั้งสองไฟล์ใน transaction เดียว (ถ้ายังไม่ลง)
- ถ้าพัง Railway หยุด deploy ตัวนั้น API ตัวเดิมยังทำงาน ฐานข้อมูลไม่เปลี่ยน ดู error ที่ Deploy Logs ช่วง pre-deploy
- rollback โค้ดบน Railway ไม่ย้อนฐานข้อมูล แต่ไฟล์นี้เพิ่มตารางอย่างเดียว โค้ดรุ่นก่อนหน้ายังทำงานได้ตามปกติ

**หลังลง dev**

- บัญชี QA ที่จะทดสอบ self owner ต้องมี role `self_owner` (id 6) ซึ่งมาจาก `20261118051846_self_owner_role.sql`

## ที่ทดสอบแล้ว (ฐานข้อมูลในเครื่องของ Jom, 23 พ.ย.)

- `20261120081500_self_owner_rooms.sql` รันผ่าน `db:push` ตั้งแต่ 20 พ.ย. ใช้ทดสอบ API และหน้า self owner จริง (สร้างห้อง อัปรูป เปิด/ปิดประกาศ) ส่วนการลบบัญชีทดสอบด้วยเทสต์ของ API
- หลัง merge `UXUI/develop` วันที่ 23 พ.ย. ลง `20261123040000_viewing_requests.sql` เพิ่มบนฐานข้อมูลเดียวกัน (ลงหลังไฟล์ self owner) ได้ตาราง index constraint และ RLS ครบตามไฟล์ ข้อมูล self owner เดิมยังอยู่
- หลัง merge: API tsc ผ่าน, เทสต์ API (self owner 14, ลบบัญชี 11, viewing requests 10, public listings 41) ผ่าน, consumer-app 850/850, feature-listing 95/95, i18n 13/13

## ประวัติใน MIGRATION-RULES

- เพิ่มแถว `20261120081500_self_owner_rooms.sql` ในตาราง "ประวัติการแก้" ของ `supabase/MIGRATION-RULES.md` แล้ว (24 พ.ย.)
- แถวของ `20261123040000_viewing_requests.sql` ยังไม่มี
