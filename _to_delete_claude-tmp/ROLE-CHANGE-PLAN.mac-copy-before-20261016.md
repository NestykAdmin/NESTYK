# แผนเปลี่ยน role: owner เดิม → landlord และเพิ่ม owner ใหม่

อ่านจากโค้ด branch `develop` commit `7f58a9b` (16 ต.ค. 2026) ข้อความในเอกสารนี้ "อ่านจากโค้ด" ทั้งหมด ยกเว้นหัวข้อ 8 (สคริปต์บัญชีทดสอบ) ที่ "รันแล้ว" ในห้องทดลอง ตรวจทานโดยผู้ตรวจอีกคนเทียบกับโค้ดแล้ว 52 ข้อ

## 1. สรุปสำหรับทีม

| role | ความหมายใหม่ | เทียบกับตอนนี้ |
|---|---|---|
| `guest` | ผู้ใช้ทั่วไป ทุกคนได้ตอนล็อกอินครั้งแรก | เหมือนเดิม |
| `tenant` | ผู้เช่า | เหมือนเดิม |
| **`landlord`** | เจ้าของห้องที่ **นายหน้าเป็นคนดูแลให้** มีหน้าที่ดูและเซ็นเอกสารที่นายหน้าส่งมา ดูบิลค่าเช่าที่ได้รับ | คือ `owner` เดิม (เปลี่ยนแค่ชื่อ) |
| **`owner`** (ใหม่) | เจ้าของห้องที่ **ปล่อยห้องเอง** ทำงานคล้ายนายหน้า ลงประกาศ แชร์ลิงก์ ฯลฯ | ยังไม่มี |
| `agent` | นายหน้า | เหมือนเดิม |
| `admin` | ผู้ดูแลระบบ | เหมือนเดิม |

ทำเป็น 2 รอบ เพราะถ้าทำพร้อมกัน ชื่อ `owner` จะมีความหมายสองแบบในช่วงเดียวกัน (ดูหัวข้อ 4)

- **รอบ 1 (landlord):** เปลี่ยนชื่อ role `owner` → `landlord` ทั้งฐานข้อมูลและโค้ด แล้วพักชื่อ `owner` ไว้ ไม่มี role ไหนใช้ชื่อนี้
- **รอบ 2 (owner ใหม่):** สร้าง role ใหม่สำหรับเจ้าของที่ปล่อยห้องเอง หลังจากทุก branch ที่ยังทำงานอยู่ merge รอบ 1 แล้ว

ข้อที่ทีมต้องตัดสินใจก่อนเริ่มอยู่ในหัวข้อ 9

## 2. role owner ตอนนี้ทำอะไรได้บ้าง

### ฐานข้อมูล
- `master_roles` เก็บชื่อ role (`name` unique) id ตาม seed: 1 guest, 2 owner, 3 tenant, 4 agent, 5 admin (`supabase/seed/masters.sql:271-276`)
- โค้ดทุกจุดหา role **ด้วยชื่อ** ไม่พบการเทียบด้วย id ตัวเลขใน `apps/api/src` มีแค่ seed ที่ใส่ id ตรง ๆ (`masters.sql`, `demo.sql:1420-1428`)
- ผลที่ตามมา: เปลี่ยนชื่อในแถว id 2 จาก `owner` เป็น `landlord` แล้ว ผู้ใช้ทุกคนที่มี role นี้ใน `user_roles` จะกลายเป็น landlord ทันที ไม่ต้องย้ายข้อมูล

### API ที่ role owner เข้าได้
| เส้นทาง | decorator | ไฟล์ |
|---|---|---|
| `GET /bills/received`, `/bills/received/:id/payment-slip` | `@Roles("owner")` | `billing/owner-bills.controller.ts:14` |
| `/contracts/mine*` (ดู แนบเอกสาร เซ็น) | `@Roles("tenant", "owner")` | `agent/contracts/party-contracts.controller.ts:28` |
| `/agent/places/*` (ค้นที่อยู่) | `@Roles('agent', 'owner')` | `agent/places/agent-places.controller.ts:10` |

จุดที่โค้ดอ้างชื่อ role `owner` นอก decorator:
- `ensurePartyLogin(..., role: "owner")` ให้ role แก่ผู้ให้เช่าตอนนายหน้าสร้างสัญญา (`agent-contracts.service.ts:2786-2796`, ชนิด `party-login.ts:77`)
- ค้นผู้ใช้ที่มี role owner ด้วย SQL `WHERE r.name = 'owner'` (`agent-contracts.service.ts:2298`) ใช้ใน `GET /agent/contracts/owner-users`
- รายชื่อ role ที่ขอให้ตัวเองได้ผ่าน `/auth/dev/roles` (`auth/auth.service.ts:27`)
- ชนิด `MasterRoleName` (`entities/master-role.entity.ts:6`) และ `UserRole` (`packages/types/src/roles.ts:1`)

### แอปมือถือ
- โหมด owner มีแท็บ `dashboard`, `listings`, `services`, `income`, `menu` (`packages/ui/src/config/mobileTabMatrix.ts:29-35`)
- **โหมด owner ตอนนี้ปนกันสองความหมาย:**
  - งานของ landlord: กล่องสัญญาส่งค่าผ่าน `partyRole = activeRole === 'tenant' ? 'tenant' : 'owner'` (`apps/consumer-app/app/index.tsx:579,1520-1521`) ส่วนบิลที่ได้รับในแท็บ `income` เขียน `mode="owner"` ตายตัว (`index.tsx:1005-1006`)
  - งานของ owner ใหม่: แท็บ `listings` เปิดฟอร์มลงประกาศ แต่ปุ่มส่งเป็นแค่ `Alert` ยังไม่เรียก API (`index.tsx:1282-1294`)
- การสลับโหมดไม่ตรวจกับ role ที่ผู้ใช้มีจริง (`handleRoleChange` `index.tsx:522-534`) API เป็นตัวตรวจสิทธิ์จริงด้วย `RolesGuard` (`auth/guards/roles.guard.ts:32`)

### คำว่า owner ที่ **ไม่ใช่ role** (รอบ 1 ไม่ต้องแตะ)
| กลุ่ม | ตัวอย่าง | ความหมาย |
|---|---|---|
| ฝ่ายในสัญญา | `agreement_sign_invites.party`, `agreement_documents.subject` (CHECK มีค่า `'owner'`), `lease_contracts.owner_user_id`, `owner_signed_at`, `owner_signature_url`, `owner_delivered_at`, คีย์ JSON `ownerName` ใน `party_snapshot` | "ฝ่ายผู้ให้เช่า" ในสัญญา เป็นข้อมูลที่เก็บแล้ว |
| ข้อมูลทรัพย์ | ตาราง `property_owners`, `rent_rooms.owner_id`, `rent_rooms.property_owner_id`, `owner_bank_*` | เจ้าของห้องในข้อมูลห้อง |
| แหล่งประกาศ | listing source code `owner` (`masters.sql:254`) | ประกาศมาจากเจ้าของโดยตรง |

กลุ่มนี้มีความหมายตรงกับ landlord อยู่แล้ว (ฝ่ายผู้ให้เช่า) การเปลี่ยนชื่อต้องแก้ CHECK, ข้อมูลเดิม, PDF และชนิดข้อมูลร่วมกับแอป จึงแยกเป็นข้อตัดสินใจ D2 ไม่รวมในรอบ 1

## 3. งานแก้ รอบ 1: owner → landlord

### ฐานข้อมูล (1 migration ใหม่ใน `supabase/migrations`)
```sql
UPDATE public.master_roles
   SET name = 'landlord', details = 'Landlord — signs documents an agent sends'
 WHERE name = 'owner';
```
- id 2 เดิม `user_roles` ทุกแถวยังชี้ id 2 จึงไม่มีผู้ใช้หลุดสิทธิ์
- ห้ามแก้ baseline (กฎข้อ 2 ใน `supabase/MIGRATION-RULES.md`)
- `supabase/seed/masters.sql` แก้แถว id 2 เป็น `landlord` (seed ใช้กับฐานข้อมูลใหม่หลัง migration)
- `docs/new-project/roles/schema.sql:45-52` ใส่ `('owner', ...)` แบบ `ON CONFLICT (name) DO NOTHING` หลังเปลี่ยนชื่อแถว id 2 แล้ว ชื่อ `owner` ไม่ชนอะไร ถ้ามีคนรันไฟล์นี้ จะได้แถว `owner` ใหม่กลับมา ต้องแก้เป็น `landlord` ด้วย ไฟล์เดียวกันมีตัวอย่างการเปลี่ยนชื่อ `resident` → `tenant` (`:54-79`) ใช้เป็นแบบได้

### API
| ไฟล์ | แก้ |
|---|---|
| `entities/master-role.entity.ts:6` | `MasterRoleName` เปลี่ยน `'owner'` → `'landlord'` |
| `billing/owner-bills.controller.ts:14` | `@Roles("landlord")` |
| `agent/contracts/party-contracts.controller.ts:28` | `@Roles("tenant", "landlord")` |
| `agent/places/agent-places.controller.ts:10` | `@Roles('agent', 'landlord')` (รอบ 2 เพิ่ม owner ใหม่) |
| `agent/contracts/party-login.ts:77` | ชนิด `role` เป็น `"landlord" \| "tenant"` |
| `agent/contracts/agent-contracts.service.ts:2794` | `role: "landlord"` |
| `agent/contracts/agent-contracts.service.ts:2298` | `WHERE r.name = 'landlord'` |
| `auth/auth.service.ts:27` | `DEV_GRANTABLE` เปลี่ยน `'owner'` → `'landlord'` |
| `auth/auth.service.ts:106` | ข้อความ error ที่บอกให้รัน `roles/schema.sql` ให้ชี้วิธีปัจจุบัน (`db:push` + `db:seed masters`) |
| `scripts/audit-role-routes.cjs:12,28,33` | role จำลองและรายชื่อที่ใช้ตัดสินสิทธิ์ `owner` → `landlord` (บรรทัด 17 `parties:['tenant','owner']` เป็นฝ่ายในสัญญา ไม่ต้องเปลี่ยน) |

ค่าฝ่ายในสัญญา (`"owner" \| "tenant"` ใน `partiesFor` `agent-contracts.service.ts:448-453` และ `party` ของลิงก์เซ็น) **ไม่เปลี่ยน** ในรอบนี้

### แอปและ package ร่วม
| ไฟล์ | แก้ |
|---|---|
| `packages/types/src/roles.ts:1` | `UserRole` เปลี่ยน `'owner'` → `'landlord'` |
| `packages/ui/src/config/mobileTabMatrix.ts:29,54` | คีย์ `landlord` เหลือแท็บที่เป็นงาน landlord (ตัด `listings` ไปไว้ owner ใหม่ในรอบ 2) |
| `packages/ui/src/config/mobileDrawerMenuMatrix.ts:113-146` | คีย์ `landlord` |
| `packages/ui/src/shells/MobileProfileDrawer.tsx:69,74` | ตัวเลือกสลับโหมด |
| `packages/i18n/src/types.ts:29,35,134,156,342` และไฟล์ locale ทุกภาษา | คีย์ `roles.landlord`, คำอธิบาย |
| `packages/config/theme/colors.json:41` | สีของ `landlord` (`tokens.colors.roles[role]` ใช้ชื่อ role เป็นคีย์) หน้าจอฝ่ายในสัญญาด้านล่างก็อ่านสีจากคีย์นี้ ต้องแก้คู่กัน |
| `packages/feature-services/src/matrix.ts:16` | คีย์ `landlord` |
| `apps/consumer-app/app/index.tsx` | `partyRole` (`:579`) ให้คืน `'owner'` (ฝ่ายในสัญญา) เมื่อ `activeRole === 'landlord'`, deep link (`:257-258`), dashboard (`:913-916`), เมนู (`:1553-1578`) |
| หน้าจอที่รับ `mode="owner"` | `PartyContractsScreen`, `TenantBillsScreen`, `TenantContractList`, `PartyContractDetail` ค่า `mode` คือฝ่ายในสัญญา คงค่า `'owner'` ไว้ได้ **แต่** หน้าจอเหล่านี้ใช้ค่านี้อ่านสีจาก `tokens.colors.roles` (`TenantContractList.tsx:96,226`, `PartyContractDetail.tsx:67`, `PartyContractsScreen.tsx:27`, `TenantBillsScreen.tsx:28`, `index.tsx:1391,1527`) ต้องแปลงฝ่าย `owner` เป็นคีย์สี `landlord` ก่อนอ่าน |
| `packages/feature-listing/src/config.ts:7,18` | `Extract<UserRole,'owner'\|'agent'>` และ `actorRole: 'owner'` หมายถึงเจ้าของที่ลงประกาศเอง ซึ่งเป็นงานของ owner ใหม่ รอบ 1 ให้ชี้ `landlord` ชั่วคราวหรือปิดไว้ แล้วย้ายไป owner ใหม่ในรอบ 2 |
| `apps/consumer-app/lib/config.ts:4`, `index.tsx:351,845,934,1283,1342`, `apps/web/lib/mock-data.ts:52` | จุดอื่นที่ใช้ `'owner'` เป็น role |
| `apps/consumer-app/lib/mock-data.ts:110-123` | คีย์ `Record<UserRole,…>` |

จุดที่มีชนิดข้อมูลกำกับ (`Record<UserRole, …>`, `@Roles(...)`, `MasterRoleName`) `tsc` จะแจ้งให้แก้เอง แต่ `tsc` จับไม่ได้ใน SQL ที่เป็นข้อความ (`agent-contracts.service.ts:2298`), `roleNames: string[]` (`auth/decorators/current-user.decorator.ts:5`) และ `roles: string[]` ในแอป (`lib/auth/AuthContext.tsx:30`) จุดเหล่านี้ใช้ `check:roles` (หัวข้อ 4) ไล่แทน

## 4. ทำไมต้องแยก 2 รอบ และกันสับสนตอน merge หรือสลับ branch

ถ้าทีมใช้ฐานข้อมูล Supabase dev ร่วมกัน (แบบที่ตั้งไว้ตอนนี้) เมื่อ migration รอบ 1 ขึ้นแล้ว ทุก branch ที่ต่อฐานข้อมูลนั้นจะเห็นชื่อใหม่ทันที

| สถานการณ์ | ถ้าทำ 2 รอบ | ถ้าทำรอบเดียว (ใช้ชื่อ owner ใหม่ทันที) |
|---|---|---|
| โค้ดเก่า (ยังใช้ `'owner'` = ผู้ให้เช่า) ต่อฐานข้อมูลหลังรอบ 1 | ไม่มีใครมี role ชื่อ `owner` เส้นทางที่ใช้ `@Roles("owner")` ตอบ 403 เพราะ guard ตรวจชื่อ role จากฐานข้อมูล (`roles.guard.ts:32-34`) ไม่ให้สิทธิ์ผิดคน แต่มีผลข้างเคียง ดูข้อสังเกตใต้ตาราง | ผู้ใช้ owner ใหม่ถูกโค้ดเก่าถือเป็นผู้ให้เช่า เข้า `/contracts/mine`, `/bills/received` ได้ และ `GET /agent/contracts/owner-users` คืนรายชื่อ owner ใหม่ให้นายหน้าเป็นผู้ให้เช่า |
| branch เก่าที่เขียน `'owner'` (ความหมายผู้ให้เช่า) merge เข้ามาหลังรอบ 1 | `tsc` ไม่ผ่านในจุดที่มีชนิดกำกับ เช่น `@Roles` และ `party-login.ts:77` ส่วน SQL และ `includes('owner')` ต้องให้ `check:roles` จับ | ผ่าน `tsc` เงียบ ๆ แต่ความหมายผิด |
| แอปเก่าที่ตั้งโหมดเริ่มต้นเป็น `owner` | ดูตัวกันข้อ 6 | เปิดเข้าหน้า owner ใหม่ทั้งที่ผู้ใช้เป็นผู้ให้เช่า |

ผลข้างเคียงของแถวแรก (โค้ดฝั่งนายหน้าที่ยังเป็นรุ่นเก่า): ตอนสร้างสัญญาจากหนังสือจอง โค้ดสร้างบัญชีผู้เช่าเสร็จก่อนใน transaction ของตัวเอง (`agent-contracts.service.ts:2775-2785`, `party-login.ts:99`) แล้วสร้างบัญชี Supabase ของผู้ให้เช่านอก transaction (`party-login.ts:94-96`) ก่อนจะตอบ 400 "ไม่พบสิทธิ์ผู้ใช้ในระบบ" (`party-login.ts:128-129`) จึงเหลือข้อมูลที่เขียนไปแล้วบางส่วน นอกจากนี้ `owner-users` จะคืนรายการว่างโดยไม่แจ้ง และ `/auth/dev/roles` ตอบ 400 นี่คือเหตุผลที่ต้องให้ทุกคน merge ก่อนขึ้น migration (หัวข้อ "กติกาทีมช่วงเปลี่ยน")

### ตัวกันที่ต้องทำในรอบ 1
1. **ชนิดข้อมูลบังคับ:** ลบ `'owner'` ออกจาก `UserRole` และ `MasterRoleName` โค้ดจาก branch เก่าที่ใช้ role `'owner'` จะ build ไม่ผ่านตอน merge
2. **แยกชนิด "ฝ่ายในสัญญา" ออกจาก role:** ตอนนี้เขียนเป็น union ตรง ๆ หลายที่ (`Array<"owner" | "tenant">`) ให้ตั้งชื่อชนิดเดียว เช่น `ContractParty` ใน `packages/types` แล้วใช้ทุกที่ จะได้ไม่มีใครเอาชนิด role ไปปนกับฝ่ายในสัญญา
3. **API ตรวจรายชื่อ role ตอนเริ่ม:** เพิ่มขั้นตอนตอน API เริ่มทำงาน (ใกล้กับ `checkSchemaDrift` ที่มีอยู่) อ่าน `master_roles` แล้ว:
   - ถ้าไม่มี role ที่โค้ดต้องใช้ (เช่น `landlord`) ให้หยุดพร้อมข้อความ "ฐานข้อมูลยังไม่ได้รัน migration role รอบ 1"
   - ถ้ามี role ที่โค้ดไม่รู้จัก (เช่น `owner` ก่อนโค้ดรอบ 2) ให้หยุดเช่นกัน
   ตัวกันนี้กันได้เฉพาะโค้ดใหม่ โค้ดเก่าไม่มีตัวตรวจนี้ จึงต้องพึ่งข้อ 4
4. **พักชื่อ `owner`:** หลังรอบ 1 ห้ามมี role ชื่อ `owner` จนกว่าจะเริ่มรอบ 2 โค้ดเก่าจะปิดเองตามตารางด้านบน
5. **สคริปต์ตรวจก่อน merge:** `npm run check:roles` ค้นรูปแบบที่ใช้ `owner` เป็น role (`@Roles(` ที่มี `'owner'`, `r.name = 'owner'`, `role: "owner"`, `roleNames.includes('owner')`) ถ้าเจอให้จบด้วย exit 1 ใส่ใน CI หรือขั้นตอนก่อน push
6. **โหมดเริ่มต้นของแอป:** `activeRole` เริ่มจาก `EXPO_PUBLIC_DEFAULT_ROLE` (`lib/config.ts:4-15`) และ `role-gate.ts:4` เขียนว่าไม่ได้เก็บไว้ในเครื่อง ถ้าค่าที่ตั้งไม่อยู่ในรายชื่อ role แอปจะใช้ `guest` แทนโดยไม่แจ้ง (`config.ts:14`) ดังนั้นหลังรอบ 1 ถ้า `.env` ของใครยังตั้ง `owner` จะกลายเป็น guest เงียบ ๆ ให้เพิ่มคำเตือนใน log หรือแปลง `owner` → `landlord` ในรอบ 1 ยังต้องอ่าน `lib/auth/session-storage.ts` ยืนยันว่าไม่มีการเก็บโหมดไว้จริง
7. **บันทึกใน `supabase/MIGRATION-RULES.md`:** เพิ่มข้อห้าม "ห้ามสร้าง role ชื่อ `owner` จนกว่าจะเริ่มรอบ 2" และวิธีเช็กว่าฐานข้อมูลอยู่รอบไหน (`SELECT name FROM master_roles`)

### กติกาทีมช่วงเปลี่ยน
- ก่อน push migration รอบ 1 ขึ้น Supabase dev ให้ทุกคน merge `develop` ล่าสุดก่อน
- หลัง migration ขึ้นแล้ว ใครยังอยู่บน branch เก่า จะเห็นหน้าผู้ให้เช่าตอบ 403 ซึ่งเป็นสิ่งที่ตั้งใจ ให้ merge `develop` แทนการแก้ฐานข้อมูลกลับ

## 5. งานแก้ รอบ 2: owner ใหม่ (ปล่อยห้องเอง)

### สิ่งที่โค้ดมีอยู่แล้วให้ใช้ต่อได้
- เส้นทางของนายหน้าหลายเส้นกรองข้อมูลตามผู้สร้าง (`created_by_user_id`) อยู่แล้ว เช่น ห้อง (`agent-rooms.service.ts:205,273`), ประกาศ (`agent-listings.service.ts:154-155`), ลิงก์แชร์ (`room-share-links.service.ts:80,92,165`), lead (`agent-leads.service.ts:265,335-336`) จึงเปิดให้ role ใหม่ใช้ด้วยการเพิ่มชื่อใน `@Roles(...)` ได้ ข้อยกเว้นที่เจอ: `GET /agent/rooms/properties` คืนโครงการทั้งตารางสูงสุด 100 แถวเมื่อผู้ใช้ยังไม่มีห้อง (`agent-rooms.service.ts:68-69`) ยังไม่ได้ตรวจครบทุกเส้น ต้องตรวจทีละเส้นก่อนเปิดให้ owner ใหม่
- ฟอร์มลงประกาศของโหมด owner มีหน้าจอแล้ว (`index.tsx:1282-1294`) แต่ยังไม่ส่งข้อมูลเข้า API

### สิ่งที่ต้องตัดสินใจก่อนลงมือ (D3, D4)
- owner ใหม่ใช้เส้นทางไหนบ้าง: เฉพาะลงประกาศ (ห้อง ประกาศ ลิงก์แชร์ ค้นที่อยู่ รูป) หรือรวม lead / นัดดูห้อง / ผู้เช่า / สัญญา ด้วย
- ห้องที่ owner ลงเองเป็นห้องประเภทไหนในตาราง `rent_rooms`: ตอนนี้มี CHECK 2 ตัว (`chk_rent_rooms_owner_invariant`, `chk_rent_rooms_scout_invariant` ใน `rent-room.entity.ts:28-29`)
  - ห้องแบบ scout (ที่นายหน้าลง) ต้องมี `created_by_user_id`, `owner_id` ต้องว่าง และ `visibility` ต้องเป็น private หรือ published
  - ห้องแบบไม่ใช่ scout ต้องมี `owner_id` และ `property_owner_id`, `visibility` ต้องว่าง แปลว่าตอนนี้ห้องแบบนี้ตั้งเป็น published ไม่ได้ (`baseline.sql:1816-1817`)
  - หน้ารายการประกาศกรอง `is_scout_room = TRUE` (`agent-listings.service.ts:154-155`)
  - โค้ดแอปที่สร้างห้องมีที่เดียวและตั้ง `is_scout_room: true` (`agent-rooms.service.ts:236-275`) ห้องแบบไม่ใช่ scout มีแค่ในเทส (`agreement-renewals.integration.cjs:50` ใช้ค่าเริ่มต้น false) และร่างใน `docs/new-project/agent/create-room/schema.sql:10` ("Owner row (future)") ถ้าห้องของ owner เป็นแบบไม่ใช่ scout ต้องแก้ทั้ง CHECK และการกรอง

### งานแก้หลักตัดสินใจแล้ว
- migration ใหม่ ระบุ id ตายตัวตามกฎข้อ 5 ใน `MIGRATION-RULES.md` (seed ใส่ id 1–5 เอง ถ้าปล่อยให้ระบบเลือก id ฐานข้อมูลใหม่จะได้ id 1 แล้ว seed ชน):
  ```sql
  INSERT INTO public.master_roles (id, name, details) VALUES (6, '<ชื่อที่เลือกใน D1>', 'Self-listing owner') ON CONFLICT DO NOTHING;
  SELECT pg_catalog.setval('public.master_roles_id_seq', (SELECT max(id) FROM public.master_roles), true);
  ```
  และใน `masters.sql` เพิ่มแถว id 6 กับเปลี่ยน `setval` ของ `master_roles_id_seq` (`masters.sql:395`) จากเลข 5 เป็น `(SELECT max(id) ...)`
- เพิ่มชื่อนี้ใน `UserRole`, `MasterRoleName`, ตัวตรวจตอนเริ่ม API, `check:roles`
- เพิ่มใน `@Roles(...)` ของ controller ตามขอบเขต D3
- แอป: คีย์ใหม่ใน `mobileTabMatrix` (แท็บ `listings` ย้ายมาที่นี่), drawer, i18n, สี และต่อปุ่มส่งของฟอร์มลงประกาศเข้า `POST /agent/rooms`

## 6. ลำดับงานและตรวจผล

| ลำดับ | งาน | ตรวจด้วย |
|---|---|---|
| 1 | ตัดสินใจ D1–D4 | — |
| 2 | รอบ 1: migration + โค้ด API + แอป + ตัวกันข้อ 1–7 ใน PR เดียว | `tsc` ทุก workspace, `npm run check:roles`, `db:check -- --check`, เทส API ที่มีอยู่ |
| 3 | `audit-role-routes.cjs` ด้วย role `landlord` | ไม่มีเส้นทางที่ role ผิดได้ 200 |
| 4 | push migration รอบ 1 ขึ้น Supabase dev หลังทุกคน merge แล้ว | `npm run db:test-users` แล้วล็อกอิน `qa-landlord` เห็นกล่องสัญญาและบิล |
| 5 | รอบ 2 ตามขอบเขต D3/D4 | ล็อกอิน `qa-owner` ลงห้องได้ และไม่เห็นห้องของ `qa-agent` |

## 7. ข้อสังเกตที่เจอระหว่างอ่าน (ยังไม่ได้ประเมินความเสี่ยง)
- `GET /agent/contracts/owner-users` ค้นผู้ใช้ที่มี role owner ทั้งระบบ ไม่กรองตามนายหน้า คืนอีเมล เบอร์ เลขบัตร สัญชาติ สูงสุด 15 แถว (`agent-contracts.service.ts:2279-2311`) ถ้าในรอบ 2 owner ใหม่ใช้ชื่อเดิม รายชื่อนี้จะปนกัน
- แอปให้สลับไปทุกโหมดได้โดยไม่ดู role จริงของผู้ใช้ (`index.tsx:522-534`, `MobileProfileDrawer.tsx:74,115`)
- `/auth/dev/roles` ไม่มี `@Roles` ผู้ที่ล็อกอินแล้วขอ role ให้ตัวเองได้เมื่อ `ALLOW_DEV_ROLE_GRANT=true` (`auth.controller.ts:64-75`) และแอปเรียกเส้นนี้เองเพื่อขอ `admin` ทุกครั้งที่ล็อกอิน ถ้าไม่ได้ตั้ง `EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT=false` (`AuthContext.tsx:50-58`)
- เทสของ API ไม่มีกรณีผู้ใช้ที่มี role owner (ค้น `roleNames` ใน `apps/api/test` พบแค่ `agent`, `tenant`, `guest`)

## 8. บัญชีทดสอบ (รันแล้วในห้องทดลอง)

สคริปต์ `apps/api/scripts/db-test-users.cjs` คำสั่ง `npm run db:test-users -w @nestyk/api` (เพิ่มคำสั่งนี้ใน `apps/api/package.json` แล้ว) ใส่ `-- --check` เพื่อดูก่อนโดยไม่เขียนอะไร โหมดนี้บอกด้วยว่าจะถอน role ไหน

| อีเมล | role ที่ได้ ก่อนรอบ 1 | role ที่ได้ หลังรอบ 1–2 |
|---|---|---|
| `qa-guest@nestyk.test` | guest | guest |
| `qa-tenant@nestyk.test` | guest, tenant | guest, tenant |
| `qa-landlord@nestyk.test` | guest, owner (แถว id 2 ซึ่งตอนนี้แปลว่าผู้ให้เช่า) | guest, landlord (แถวเดิม id 2) |
| `qa-owner@nestyk.test` | ยังไม่สร้าง (รอ role ใหม่) | guest, owner ใหม่ |
| `qa-agent@nestyk.test` | guest, agent | guest, agent |
| `qa-admin@nestyk.test` | guest, admin | guest, admin |

- รหัสผ่านทุกบัญชีเท่ากัน มาจาก `TEST_USER_PASSWORD` ใน `.env.api` ถ้ามี `#` ต้องครอบด้วย `"..."`
- หยุดทันทีถ้าไม่มี `ALLOW_TEST_USERS=true` (อ่านจาก `.env.api` หรือตัวแปรใน shell), ขาด `DATABASE_URL`/`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, รหัสผ่านสั้นกว่า 8 ตัว หรือโดเมนไม่มีจุด ห้ามตั้ง `ALLOW_TEST_USERS=true` ในไฟล์ที่ชี้ prod
- ถ้า API ตั้ง `ALLOW_DEV_ROLE_GRANT=true` แอปจะขอ `admin` ให้บัญชีเหล่านี้เองตอนล็อกอิน (หัวข้อ 7) role จะไม่ตรงตารางจนกว่าจะรันสคริปต์ซ้ำ ให้ตั้ง `EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT=false` ในแอป (ตั้งไว้แล้วใน `.env` ของ Aof)
- โดเมนเป็น `nestyk.test` ไม่ใช่ `nestyk` เฉย ๆ เพราะ API ตรวจอีเมลด้วย `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` ซึ่งต้องมีจุดหลัง `@` (`party-login.ts:83`, `agent-tenants.service.ts:59`, `agent-leads.service.ts:23`) ถ้าไม่มีจุด นายหน้าจะใส่อีเมลบัญชีทดสอบเป็นผู้เช่าหรือผู้ให้เช่าในสัญญาไม่ได้ ตั้งโดเมนอื่นได้ที่ `TEST_USER_EMAIL_DOMAIN`
- รันซ้ำได้: บัญชีที่มีแล้วจะถูกตั้งรหัสผ่านใหม่และตั้ง role ให้ตรงตามตาราง (role อื่นที่เกินมาถูกถอน) ถ้าแถว `users` ของอีเมลนั้นผูกกับ id ของ Supabase Auth ตัวเก่า จะผูกใหม่ให้ถูก ยกเว้นกรณีที่ id ของ Auth ไปผูกกับแถว `users` ของอีเมลอื่นอยู่แล้ว บัญชีนั้นจะขึ้น `ERROR` ในตาราง บัญชีอื่นทำต่อตามปกติ และสคริปต์จบด้วย exit code 1
- ชื่อ role ของ owner ใหม่กำหนดที่บรรทัด `NEW_OWNER_ROLE` ในสคริปต์ ถ้า D1 เลือกชื่ออื่น แก้บรรทัดเดียว

ผลที่รันในห้องทดลอง (Postgres 16 สร้างตารางจาก `baseline.sql` ที่ตัดบรรทัด `SET transaction_timeout` ซึ่ง Postgres 16 ไม่รู้จักออก + `20261014120000_contract_closure.sql` + `masters.sql`, Supabase Auth เป็นตัวจำลองที่ตอบ API admin แบบเดียวกัน): รายชื่อ role แบบเก่า สร้าง 5 บัญชี `qa-owner` รอ, รันซ้ำไม่สร้างซ้ำ, จำลอง migration (เปลี่ยนชื่อ id 2 + เพิ่ม owner) แล้ว `qa-landlord` ยังเป็น id 2 และ `qa-owner` ถูกสร้าง, role ที่เกินมาถูกถอน, แถวที่ผูก id ผิดถูกผูกใหม่, กรณี id ชนกับอีเมลอื่นขึ้น ERROR เฉพาะบัญชีนั้น, ตัวกันรหัสสั้น / โดเมนไม่มีจุด / ไม่มี `ALLOW_TEST_USERS` หยุดได้ถูก
ที่ยังไม่ได้ทดสอบ: การเรียก Supabase Auth ตัวจริง (ห้องทดลองใช้ตัวจำลอง) ต้องดูผลตอน Aof รันบน Mac

## 9. ข้อที่ต้องตัดสินใจ

| # | คำถาม | ทางเลือก | ข้อเสนอ |
|---|---|---|---|
| D1 | role ใหม่ใช้รหัสในระบบว่าอะไร | (ก) `owner` ตามที่ต้องการ (ข) รหัสใหม่ที่ไม่เคยใช้ เช่น `self_owner` แต่หน้าจอยังแสดงคำว่า "Owner / เจ้าของ" | **(ข)** เพราะโค้ดเก่าทุกรุ่นที่เคย build ไว้ (รวมแอปในเครื่องผู้ทดสอบ) แปลรหัส `owner` ว่าผู้ให้เช่า ถ้าใช้รหัสใหม่ ตัวกันในหัวข้อ 4 ใช้ได้ตลอด ถ้าเลือก (ก) ต้องรอจนไม่มีใครใช้โค้ดก่อนรอบ 1 แล้ว และตัวกันข้อ 4 จะหายไปตั้งแต่รอบ 2 |
| D2 | ฝ่ายในสัญญา (`party`/`subject` `'owner'`, คอลัมน์ `owner_*`) เปลี่ยนเป็น `landlord` ด้วยไหม | (ก) คงไว้ ถือว่าเป็น "ฝ่ายผู้ให้เช่า" (ข) เปลี่ยนทีหลังเป็นงานแยก | (ก) ในรอบนี้ เขียนคำอธิบายศัพท์ในเอกสาร และแยกชนิด `ContractParty` ตามตัวกันข้อ 2 |
| D3 | owner ใหม่ทำอะไรได้บ้าง | เฉพาะลงประกาศ / รวม lead, นัดดู, ผู้เช่า, สัญญา | ต้องให้ทีมธุรกิจตอบ |
| D4 | ห้องของ owner ใหม่เก็บแบบไหนใน `rent_rooms` | ใช้แบบ scout เหมือนนายหน้า (แก้น้อย) / แบบไม่ใช่ scout ที่มี `owner_id` (ตรงความหมายกว่า แต่ต้องแก้ CHECK และการกรอง) | ต้องตัดสินพร้อม D3 |

## 10. ที่ยังไม่ได้อ่าน
ไฟล์ที่โค้ดอ้างถึงแต่ไม่ได้อยู่ในชุดที่อ่าน: `apps/consumer-app/components/OwnerConfirmedRent.tsx`, `apps/consumer-app/lib/tenant-bills-api.ts`, `apps/consumer-app/lib/tenant-workspace-copy.ts`, `apps/consumer-app/lib/agent-session.ts`, `apps/consumer-app/lib/auth/session-storage.ts`, `apps/api/src/agent/contracts/contract-closure.ts`, `packages/i18n/src/locales/*` ต้องอ่านเพิ่มก่อนลงมือรอบ 1 เพื่อให้รายการแก้ในหัวข้อ 3 ครบ
