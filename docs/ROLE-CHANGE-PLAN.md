# แผนเปลี่ยน role: owner เดิม → landlord และเพิ่ม self_owner

อ่านจากโค้ด branch `develop` commit `7f58a9b` (16 ต.ค. 2026) ข้อความในเอกสารนี้ "อ่านจากโค้ด" ทั้งหมด ยกเว้นหัวข้อ 8 (สคริปต์บัญชีทดสอบ) ที่ "รันแล้ว" ในห้องทดลอง ฉบับแรกตรวจทานโดยผู้ตรวจอีกคนเทียบกับโค้ด 52 ข้อ ส่วนที่เพิ่มหลังตัดสินใจ (หัวข้อ 1, 4, 5, 6, 8, 9) ตรวจรอบที่ 2 อีก 41 ข้อ และแก้ตามผลแล้ว

**สถานะ 16 ต.ค. 2026: รอบ 1 แก้เสร็จใน working tree ของ `develop` (ยังไม่ commit)** ดูหัวข้อ 3.1

ทีมตัดสินใจ D1–D3 แล้วเมื่อ 16 ต.ค. 2026 (หัวข้อ 9) ส่วน D4 **พักไว้ ไม่ทำใน phase นี้** เพราะ phase นี้เน้นงานของ agent เป็นหลัก (ผลประเมินเก็บไว้ในหัวข้อ 5.3 สำหรับ phase ถัดไป)

## 1. สรุปสำหรับทีม

| รหัส role | ชื่อที่แสดง | ความหมาย | เทียบกับตอนนี้ |
|---|---|---|---|
| `guest` | ผู้ใช้ทั่วไป | ทุกคนได้ตอนล็อกอินครั้งแรก | เหมือนเดิม |
| `tenant` | ผู้เช่า | ผู้เช่า | เหมือนเดิม |
| **`landlord`** | ผู้ให้เช่า | เจ้าของห้องที่ **นายหน้าดูแลให้** ดูและเซ็นเอกสารที่นายหน้าส่งมา ดูบิลค่าเช่าที่ได้รับ | คือ `owner` เดิม เปลี่ยนแค่ชื่อ |
| **`self_owner`** | Owner / เจ้าของ | เจ้าของห้องที่ **ปล่อยห้องเอง** สร้างห้องได้ รับแจ้งเตือนการจ่ายค่าเช่า และเซ็นเอกสารที่ admin ของ NESTYK ดำเนินการให้ | ยังไม่มี |
| `agent` | นายหน้า | นายหน้า | เหมือนเดิม |
| `admin` | ผู้ดูแลระบบ | ผู้ดูแลระบบ | เหมือนเดิม |

รหัส `owner` **เลิกใช้ถาวร** หลังรอบ 1 ไม่นำกลับมาใช้กับ role ไหนอีก (D1) เพราะ API ทุกรุ่นใช้รหัสนี้หมายถึงผู้ให้เช่า ส่วนแอปรุ่นเก่าใช้ปนสองความหมาย (หัวข้อ 2) ถ้านำกลับมาใช้จะสับสนทั้งสองฝั่ง ส่วนคำว่า owner ในข้อมูลสัญญาและข้อมูลห้อง (ฝ่ายผู้ให้เช่า) คงไว้ตามเดิม (D2)

- **รอบ 1 (landlord):** เปลี่ยนชื่อ role `owner` → `landlord` ทั้งฐานข้อมูลและโค้ด
- **รอบ 2 (self_owner):** เพิ่ม role `self_owner` พร้อมเมนูตัวอย่าง (mockup) ในแอป ยังไม่เปิด API ให้ (D3)
- **phase ถัดไป (ไม่อยู่ใน phase นี้):** สร้างห้อง แจ้งเตือนค่าเช่า และเซ็นเอกสารของ self_owner ใช้งานจริง ต้องตัดสิน D4 ก่อน

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
  - งานของ self_owner: แท็บ `listings` เปิดฟอร์มลงประกาศ แต่ปุ่มส่งเป็นแค่ `Alert` ยังไม่เรียก API (`index.tsx:1282-1294`)
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
| `agent/places/agent-places.controller.ts:10` | `@Roles('agent')` landlord ไม่มีแท็บลงประกาศแล้ว จึงไม่ต้องใช้ค้นที่อยู่ (ตัดสิทธิ์ให้น้อยที่สุด) |
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
| `packages/ui/src/config/mobileTabMatrix.ts:29,54` | คีย์ `landlord` ตัดแท็บ `listings` ออกตั้งแต่รอบ 1 (landlord ไม่ได้ลงห้องเอง และปุ่มส่งของฟอร์มยังเป็นแค่ Alert) ฟอร์มลงประกาศยังอยู่ในโค้ด แต่ไม่มีทางเข้าจนถึง phase ถัดไป (หัวข้อ 5.2) |
| `packages/ui/src/config/mobileDrawerMenuMatrix.ts:113-146` | คีย์ `landlord` |
| `packages/ui/src/shells/MobileProfileDrawer.tsx:69,74` | ตัวเลือกสลับโหมด |
| `packages/i18n/src/types.ts:29,35,134,156,342` และไฟล์ locale ทุกภาษา | คีย์ `roles.landlord`, คำอธิบาย |
| `packages/config/theme/colors.json:41` | สีของ `landlord` (`tokens.colors.roles[role]` ใช้ชื่อ role เป็นคีย์) หน้าจอฝ่ายในสัญญาด้านล่างก็อ่านสีจากคีย์นี้ ต้องแก้คู่กัน |
| `packages/feature-services/src/matrix.ts:16` | คีย์ `landlord` |
| `apps/consumer-app/app/index.tsx` | `partyRole` (`:579`) ให้คืน `'owner'` (ฝ่ายในสัญญา) เมื่อ `activeRole === 'landlord'`, deep link (`:257-258`), dashboard (`:913-916`), เมนู (`:1553-1578`) |
| หน้าจอที่รับ `mode="owner"` | `PartyContractsScreen`, `TenantBillsScreen`, `TenantContractList`, `PartyContractDetail` ค่า `mode` คือฝ่ายในสัญญา คงค่า `'owner'` ไว้ได้ **แต่** หน้าจอเหล่านี้ใช้ค่านี้อ่านสีจาก `tokens.colors.roles` (`TenantContractList.tsx:96,226`, `PartyContractDetail.tsx:67`, `PartyContractsScreen.tsx:27`, `TenantBillsScreen.tsx:28`, `index.tsx:1391,1527`) ต้องแปลงฝ่าย `owner` เป็นคีย์สี `landlord` ก่อนอ่าน |
| `packages/feature-listing/src/config.ts:7,18` | `Extract<UserRole,'owner'\|'agent'>` และ `actorRole: 'owner'` หมายถึงเจ้าของที่ลงประกาศเอง ซึ่งเป็นงานของ self_owner รอบ 1 ให้ชี้ `landlord` ชั่วคราวเพื่อให้ build ผ่าน (ไม่มีทางเข้าแล้ว) แล้วเปลี่ยนเป็น `self_owner` ตอนเปิดใช้งานจริง |
| `apps/consumer-app/lib/config.ts:4`, `index.tsx:351,845,934,1283,1342`, `apps/web/lib/mock-data.ts:52` | จุดอื่นที่ใช้ `'owner'` เป็น role |
| `apps/consumer-app/lib/mock-data.ts:110-123` | คีย์ `Record<UserRole,…>` |

จุดที่มีชนิดข้อมูลกำกับ (`Record<UserRole, …>`, `@Roles(...)`, `MasterRoleName`) `tsc` จะแจ้งให้แก้เอง แต่ `tsc` จับไม่ได้ใน SQL ที่เป็นข้อความ (`agent-contracts.service.ts:2298`), `roleNames: string[]` (`auth/decorators/current-user.decorator.ts:5`) และ `roles: string[]` ในแอป (`lib/auth/AuthContext.tsx:30`) จุดเหล่านี้ใช้ `check:roles` (หัวข้อ 4) ไล่แทน

### 3.1 ผลรอบ 1 (16 ต.ค. 2026)

ทำตามตารางด้านบนครบ และเพิ่ม:
- migration `supabase/migrations/20261016100000_rename_owner_role_to_landlord.sql` เปลี่ยนชื่อแถว id 2 ถ้ามีทั้ง `owner` และ `landlord` (มีคนรัน seed เก่าซ้ำ) จะย้ายผู้ใช้ไป `landlord` แล้วลบ `owner` ฐานข้อมูลว่างไม่ทำอะไร (seed ใส่ `landlord` เอง)
- `masters.sql`: id 2 เป็น `landlord`, `setval` ของ `master_roles_id_seq` ใช้ `max(id)` / `docs/new-project/roles/schema.sql`: `landlord`
- ชนิด `ContractParty` และ `CONTRACT_PARTY_ROLE` ใน `packages/types/src/roles.ts` ใช้แทน union `"owner" | "tenant"` ใน API และแอป
- `RoleCatalogCheck` (`apps/api/src/database/role-catalog.check.ts`) ตัวกันข้อ 3 + เทส `apps/api/test/role-catalog.test.cjs` (`npm run test:roles -w @nestyk/api`)
- `npm run check:roles` (ที่ root, สคริปต์ `apps/api/scripts/check-roles.cjs`) ตัวกันข้อ 5
- `EXPO_PUBLIC_DEFAULT_ROLE=owner` แปลงเป็น `landlord` พร้อมคำเตือน (ตัวกันข้อ 6) / deep link ที่มีคำว่า owner เปิดโหมด landlord / เมนู `/owner/*` เปลี่ยนเป็น `/landlord/*`
- `MIGRATION-RULES.md` ข้อ 9

ผลตรวจ (รันบนเครื่อง Aof และห้องทดลอง):
| ตรวจ | ก่อนแก้ | หลังแก้ |
|---|---|---|
| `tsc --noEmit` 11 workspace | 0 error | 0 error |
| เทส API (`apps/api/test/*.test.cjs`) | ผ่าน 223 / ไม่ผ่าน 7 | ผ่าน 234 / ไม่ผ่าน 7 (+11 เทสใหม่ใน `role-catalog.test.cjs` ผ่านการตรวจของ test-reviewer และทดสอบด้วยการแก้โค้ดให้ผิด 3 แบบ เทสจับได้ทุกแบบ) |
| เทสแอป (`apps/consumer-app/**/*.test.cjs`) | 95/95 | 95/95 |
| `audit-role-routes.cjs` (120 เส้นทาง) | — | ไม่มีเส้นทางที่ role ผิดได้สิทธิ์, landlord ได้ 403 ที่ `/agent/places` |
| `check:roles` | — | ไม่เจอ / ทดสอบกับโค้ดแบบเก่า 9 รูปแบบ จับได้ครบ และไม่จับ `'owner'` ที่เป็นฝ่ายในสัญญา |
| migration (Postgres 16) | — | ฐานข้อมูลว่าง → push+seed ได้ `landlord` id 2 และ `db:check` ตรง 44 ตาราง / ฐานข้อมูลเดิมที่มี `owner` → เปลี่ยนชื่อ ผู้ใช้เดิมยังมีสิทธิ์ / มีทั้งสองแถว → ย้ายผู้ใช้แล้วลบ `owner` |

7 เทสที่ไม่ผ่านเป็นชุดเดียวกันทั้งก่อนและหลังแก้ ทั้งหมดต้องอ่านภาพด้วย `sharp` ซึ่งไฟล์ที่ติดตั้งในเครื่องเป็นของ macOS โหลดใน shell Linux ที่ใช้รันไม่ได้ ไม่เกี่ยวกับงานนี้ ต้องรันซ้ำบน Mac
ยืนยันแล้วว่า API หยุดจริงเมื่อตัวตรวจ role ไม่ผ่าน: Nest โยน error ใน `app.listen()` ก่อนเปิด port และ `bootstrap()` ใน `main.ts:67` ไม่ได้ดัก error จึงจบด้วย exit code 1 (ทดลองด้วยแอป Nest ขนาดเล็กรูปแบบเดียวกัน)

**ลำดับขึ้นระบบ (สำคัญ):** ขึ้น migration กับ Supabase dev **ก่อน** deploy โค้ดนี้ขึ้น Railway เพราะ API รุ่นนี้จะไม่ยอมเริ่มทำงานกับฐานข้อมูลที่ยังมี `owner` (Railway จะเริ่มใหม่ซ้ำเรื่อย ๆ) ส่วนช่วงระหว่าง migration ขึ้นแล้วแต่ยังไม่ deploy API รุ่นเก่าบน Railway จะตอบ 403 ที่เส้นทางของผู้ให้เช่า (ปิดเอง ไม่รั่ว) จึงควร deploy ต่อทันที

ยังไม่ได้ทำ: รัน migration กับ Supabase dev จริง และเปิดแอปจริงในโหมด landlord

## 4. ทำไมต้องแยก 2 รอบ และกันสับสนตอน merge หรือสลับ branch

ถ้าทีมใช้ฐานข้อมูล Supabase dev ร่วมกัน (แบบที่ตั้งไว้ตอนนี้) เมื่อ migration รอบ 1 ขึ้นแล้ว ทุก branch ที่ต่อฐานข้อมูลนั้นจะเห็นชื่อใหม่ทันที

| สถานการณ์ | แผนนี้ (เลิกใช้รหัส `owner` ถาวร) | ถ้าใช้รหัส `owner` ซ้ำกับ role ใหม่ (ไม่ได้เลือก) |
|---|---|---|
| โค้ดเก่า (ยังใช้ `'owner'` = ผู้ให้เช่า) ต่อฐานข้อมูลหลังรอบ 1 | ไม่มีใครมี role ชื่อ `owner` เส้นทางที่ใช้ `@Roles("owner")` ตอบ 403 เพราะ guard ตรวจชื่อ role จากฐานข้อมูล (`roles.guard.ts:32-34`) ไม่ให้สิทธิ์ผิดคน แต่มีผลข้างเคียง ดูข้อสังเกตใต้ตาราง | ผู้ใช้ owner ใหม่ถูกโค้ดเก่าถือเป็นผู้ให้เช่า เข้า `/contracts/mine`, `/bills/received` ได้ และ `GET /agent/contracts/owner-users` คืนรายชื่อ owner ใหม่ให้นายหน้าเป็นผู้ให้เช่า |
| branch เก่าที่เขียน `'owner'` (ความหมายผู้ให้เช่า) merge เข้ามาหลังรอบ 1 | `tsc` ไม่ผ่านในจุดที่มีชนิดกำกับ เช่น `@Roles` และ `party-login.ts:77` ส่วน SQL และ `includes('owner')` ต้องให้ `check:roles` จับ | ผ่าน `tsc` เงียบ ๆ แต่ความหมายผิด |
| แอปเก่าที่ตั้งโหมดเริ่มต้นเป็น `owner` | ดูตัวกันข้อ 6 | เปิดเข้าหน้าเจ้าของที่ปล่อยห้องเองทั้งที่ผู้ใช้เป็นผู้ให้เช่า |

ผลข้างเคียงของแถวแรก (โค้ดฝั่งนายหน้าที่ยังเป็นรุ่นเก่า): ตอนสร้างสัญญาจากหนังสือจอง โค้ดสร้างบัญชีผู้เช่าเสร็จก่อนใน transaction ของตัวเอง (`agent-contracts.service.ts:2775-2785`, `party-login.ts:99`) แล้วสร้างบัญชี Supabase ของผู้ให้เช่านอก transaction (`party-login.ts:94-96`) ก่อนจะตอบ 400 "ไม่พบสิทธิ์ผู้ใช้ในระบบ" (`party-login.ts:128-129`) จึงเหลือข้อมูลที่เขียนไปแล้วบางส่วน นอกจากนี้ `owner-users` จะคืนรายการว่างโดยไม่แจ้ง และ `/auth/dev/roles` ตอบ 400 นี่คือเหตุผลที่ต้องให้ทุกคน merge ก่อนขึ้น migration (หัวข้อ "กติกาทีมช่วงเปลี่ยน")

### ตัวกันที่ต้องทำในรอบ 1
1. **ชนิดข้อมูลบังคับ:** ลบ `'owner'` ออกจาก `UserRole` และ `MasterRoleName` โค้ดจาก branch เก่าที่ใช้ role `'owner'` จะ build ไม่ผ่านตอน merge
2. **แยกชนิด "ฝ่ายในสัญญา" ออกจาก role:** ตอนนี้เขียนเป็น union ตรง ๆ หลายที่ (`Array<"owner" | "tenant">`) ให้ตั้งชื่อชนิดเดียว เช่น `ContractParty` ใน `packages/types` แล้วใช้ทุกที่ จะได้ไม่มีใครเอาชนิด role ไปปนกับฝ่ายในสัญญา
3. **API ตรวจรายชื่อ role ตอนเริ่ม:** เพิ่มขั้นตอนตอน API เริ่มทำงาน อ่าน `master_roles` แล้ว:
   - ถ้าไม่มี role ที่โค้ดต้องใช้ (เช่น `landlord`) หรือมี role ชื่อ `owner` ให้ **หยุด** พร้อมข้อความ เช่น "ฐานข้อมูลยังไม่ได้รัน migration role รอบ 1"
   - ถ้ามี role ที่โค้ดไม่รู้จักแต่ไม่ใช่ `owner` (เช่น `self_owner` ในฐานข้อมูลที่รันรอบ 2 แล้ว แต่โค้ดยังเป็นรอบ 1) ให้ **เตือนใน log** ไม่ต้องหยุด เพราะโค้ดที่ไม่รู้จัก role นั้นไม่มี `@Roles` ที่ให้สิทธิ์อยู่แล้ว ทีมจึงไม่ต้อง merge พร้อมกันทุกคนตอนขึ้นรอบ 2
   - ตัวตรวจ schema ที่มีอยู่ (`database/schema-drift.check.ts`) ไม่หยุด API และเรียกแบบไม่รอผล (`void this.run()` บรรทัด 13) ตัวตรวจ role ต้องเขียนให้รอผลและโยน error จึงจะหยุด API ได้จริง
   ตัวกันนี้กันได้เฉพาะโค้ดใหม่ โค้ดเก่าไม่มีตัวตรวจนี้ จึงต้องพึ่งข้อ 4
4. **เลิกใช้รหัส `owner` ถาวร:** หลังรอบ 1 ห้ามมี role ชื่อ `owner` ตลอดไป โค้ดเก่าจะปิดเองตามตารางด้านบน และไม่มีวันกลับมาเข้าใจผิดอีก
5. **สคริปต์ตรวจก่อน merge:** `npm run check:roles` ค้นรูปแบบที่ใช้ `owner` เป็น role (`@Roles(` ที่มี `'owner'`, `r.name = 'owner'`, `role: "owner"`, `roleNames.includes('owner')`) ถ้าเจอให้จบด้วย exit 1 ใส่ใน CI หรือขั้นตอนก่อน push
6. **โหมดเริ่มต้นของแอป:** `activeRole` เริ่มจาก `EXPO_PUBLIC_DEFAULT_ROLE` (`lib/config.ts:4-15`) และ `role-gate.ts:4` เขียนว่าไม่ได้เก็บไว้ในเครื่อง ถ้าค่าที่ตั้งไม่อยู่ในรายชื่อ role แอปจะใช้ `guest` แทนโดยไม่แจ้ง (`config.ts:14`) ดังนั้นหลังรอบ 1 ถ้า `.env` ของใครยังตั้ง `owner` จะกลายเป็น guest เงียบ ๆ ให้เพิ่มคำเตือนใน log หรือแปลง `owner` → `landlord` ในรอบ 1 ยังต้องอ่าน `lib/auth/session-storage.ts` ยืนยันว่าไม่มีการเก็บโหมดไว้จริง
7. **บันทึกใน `supabase/MIGRATION-RULES.md`:** เพิ่มข้อห้าม "ห้ามสร้าง role ชื่อ `owner`" และวิธีเช็กว่าฐานข้อมูลอยู่รอบไหน (`SELECT name FROM master_roles`)

### กติกาทีมช่วงเปลี่ยน
- ก่อน push migration รอบ 1 ขึ้น Supabase dev ให้ทุกคน merge `develop` ล่าสุดก่อน (รอบ 2 ไม่ต้องรอ เพราะตัวกันข้อ 3 แค่เตือนเมื่อเจอ role ที่โค้ดไม่รู้จัก)
- หลัง migration ขึ้นแล้ว ใครยังอยู่บน branch เก่า จะเห็นหน้าผู้ให้เช่าตอบ 403 ซึ่งเป็นสิ่งที่ตั้งใจ ให้ merge `develop` แทนการแก้ฐานข้อมูลกลับ

## 5. งานแก้ รอบ 2 และ phase ถัดไป: self_owner

### 5.1 รอบ 2: เพิ่ม role และเมนูตัวอย่าง
- migration ใหม่ ระบุ id ตายตัวตามกฎข้อ 5 ใน `MIGRATION-RULES.md` (seed ใส่ id 1–5 เอง ถ้าปล่อยให้ระบบเลือก id ฐานข้อมูลใหม่จะได้ id 1 แล้ว seed ชน):
  ```sql
  INSERT INTO public.master_roles (id, name, details)
  VALUES (6, 'self_owner', 'Owner who lists rooms without an agent') ON CONFLICT DO NOTHING;
  SELECT pg_catalog.setval('public.master_roles_id_seq', (SELECT max(id) FROM public.master_roles), true);
  ```
  และใน `masters.sql` เปลี่ยนแค่ `setval` ของ `master_roles_id_seq` (`masters.sql:395`) จากเลข 5 เป็น `(SELECT max(id) ...)` **ไม่ต้องเพิ่มแถว id 6 ใน seed** เพราะ migration ใส่ไว้แล้ว (ลำดับคือ `db:push` ก่อน `db:seed`) ถ้าเพิ่ม seed จะชน id 6 แบบเดียวกับ `master_contract_end_reasons` id 8
- เพิ่ม `self_owner` ใน `UserRole`, `MasterRoleName`, ตัวตรวจตอนเริ่ม API และ `check:roles`
- **API: ยังไม่เพิ่ม `self_owner` ใน `@Roles(...)` ของเส้นทางไหนเลย** เมนูในรอบนี้เป็นตัวอย่าง จึงไม่ต้องเปิดสิทธิ์ ถ้าเผลอกดไปเรียก API จะได้ 403 ซึ่งถูกต้อง
- แอป: คีย์ `self_owner` ใน `mobileTabMatrix`, `mobileDrawerMenuMatrix`, i18n (ชื่อที่แสดง "Owner / เจ้าของ"), สี และตัวเลือกสลับโหมด เมนูตัวอย่าง 3 อย่าง **ทุกเมนู** กดแล้วขึ้นข้อความ "เร็ว ๆ นี้" แบบเดียวกับเมนู occupancy ที่มีอยู่ (`index.tsx:1575`)

  | เมนูตัวอย่าง | phase ถัดไป |
  |---|---|
  | สร้างห้อง | ต่อฟอร์มลงประกาศเดิม (`index.tsx:1282-1294`) เข้า API ของ self_owner ฟอร์มนี้เรียกค้นที่อยู่ผ่าน `/agent/places` ซึ่งตอนนี้ตั้ง `@Roles('agent', 'owner')` (`agent-places.controller.ts:10`) ต้องเพิ่ม `self_owner` ตอนนั้นด้วย ไม่อย่างนั้นช่องค้นที่อยู่ได้ 403 |
  | แจ้งเตือนการจ่ายค่าเช่า | ออกแบบภายหลัง |
  | เอกสารรอเซ็น (admin NESTYK ดำเนินการ) | ออกแบบภายหลัง (หัวข้อ 5.2) |

### 5.2 phase ถัดไป: เปิดใช้งานจริง (ไม่อยู่ใน phase นี้)
ต้องออกแบบแยก โดยเฉพาะเอกสารที่ admin NESTYK ดำเนินการให้ ตอนนี้สัญญาทุกฉบับสร้างโดยนายหน้า (`created_by_user_id` ใน `lease_contracts`) และฝ่ายผู้ให้เช่าเซ็นผ่าน `/contracts/mine` ด้วยเงื่อนไข `owner_user_id` (`agent-contracts.service.ts:448-453`) ถ้าให้ self_owner เซ็นเอกสารเส้นเดียวกันได้ ต้องเพิ่ม `self_owner` ใน `@Roles` ของ `party-contracts.controller.ts:28` และให้ admin สร้างสัญญาได้ ซึ่งตอนนี้ยังไม่มีเส้นทางของ admin

### 5.3 D4: ห้องของ self_owner เก็บรวมหรือแยกจากห้องของนายหน้า (พักไว้ phase ถัดไป)

> สถานะ 16 ต.ค. 2026: **พักไว้** phase นี้ทำงานของ agent เป็นหลัก ไม่แตะตาราง `rent_rooms` และไม่ทำงานในหัวข้อนี้ ข้อมูลด้านล่างเป็นผลประเมินไว้ใช้ตัดสินใจตอนเริ่ม phase ถัดไป อ่านจากโค้ด commit `7f58a9b` ต้องตรวจกับโค้ดล่าสุดอีกครั้งก่อนใช้

**ข้อเท็จจริงจากโค้ด**
- `rent_rooms` แบ่งห้องด้วย `is_scout_room` (`baseline.sql:1800`) และมี CHECK 2 ตัวที่เกี่ยวข้อง (`baseline.sql:1816-1817`)
  - ห้องแบบ scout: ต้องมี `created_by_user_id`, `owner_id` ต้องว่าง, `visibility` เป็น private หรือ published
  - ห้องแบบไม่ใช่ scout: ต้องมี `owner_id` ส่วน `property_owner_id` และ `visibility` ต้องว่าง แปลว่าตั้ง published ไม่ได้ (CHECK ตัวที่บังคับคือ `chk_rent_rooms_owner_invariant` ตัวเดียว)
- **เอกสารออกแบบเดิมกันห้องแบบไม่ใช่ scout ไว้ให้เจ้าของที่ลงห้องเองอยู่แล้ว:** "Owner row (future): is_scout_room=false, owner_id set, visibility NULL" (`docs/new-project/agent/create-room/schema.sql:10`) และ "ห้องเดียวกับ Owner listing · แยกด้วย is_scout_room" (`:166`)
- ตอนนี้ API สร้างแต่ห้องแบบ scout (`agent-rooms.service.ts:271,275`) ห้องแบบไม่ใช่ scout ยังไม่มีใครใช้ ข้อมูลตัวอย่างก็ไม่มี โค้ดสร้างสัญญามีกรณีรองรับไว้ คือตั้ง `owner_id` ให้ห้องแบบไม่ใช่ scout (`agent-contracts.service.ts:2902`) โดยคอมเมนต์บรรทัด 2901 บอกว่าผู้ให้เช่าของห้อง scout เก็บไว้ในสัญญา ไม่ได้เก็บในห้อง
- โค้ดฝั่งนายหน้าและลิงก์แชร์ใช้เงื่อนไข `is_scout_room` 10 จุดใน 3 ไฟล์ (`agent-rooms.service.ts:62,205,271`, `agent-listings.service.ts:154,253,297,309,322`, `room-share-links.service.ts:80,217`) ส่วนใหญ่คู่กับ `created_by_user_id` และอีก 1 จุดในการสร้างสัญญา (`agent-contracts.service.ts:2902`) เส้นทางห้องทั้งหมดล็อก `@Roles('agent')` (`agent-rooms.controller.ts:29`, `agent-listings.controller.ts:12`, `room-share-links.controller.ts:20`)
- index สำหรับค้นห้องที่เปิดสาธารณะเก็บเฉพาะห้อง scout (`idx_rent_rooms_public_scout_listing ... WHERE is_scout_room = true AND visibility = 'published'`, `baseline.sql:3419`)
- `master_listing_sources` มีค่า `co_agent` (นายหน้าได้ห้องมาจากนายหน้าอื่น) และ `owner` (นายหน้าได้ห้องจากเจ้าของโดยตรง) (`masters.sql:253-254`) API รับแค่ 2 ค่านี้ (`agent-rooms.service.ts:529-530`)

**ทางเลือก**
| | (ก) รวม: ห้องแบบ scout + แหล่งประกาศ `self_owner` | (ข) แยก: ห้องแบบไม่ใช่ scout ที่ `owner_id` = เจ้าของ (ตามแบบเดิม) | (ค) รวม + คอลัมน์ใหม่บอกประเภทผู้ลง |
|---|---|---|---|
| วิธี | `created_by_user_id` = เจ้าของ เพิ่มค่า `self_owner` ใน `master_listing_sources` (id 3) และ API บังคับค่านี้เมื่อผู้สร้างมี role `self_owner` | `is_scout_room = false`, `owner_id` = ผู้ใช้ self_owner, `created_by_user_id` = ผู้ใช้คนเดียวกัน แหล่งประกาศใช้ค่า `owner` ที่มีอยู่ | เหมือน (ก) แต่เพิ่มคอลัมน์ เช่น `listed_by_kind` ค่า `agent` / `self_owner` |
| ต้องแก้ฐานข้อมูล | เพิ่ม 1 แถวใน master (id ตายตัว + `setval` ที่ `masters.sql:381` ซึ่งตั้งเลข 2 ตายตัว) | แก้ `chk_rent_rooms_owner_invariant` ตัวเดียวให้ห้องแบบนี้มี `visibility` ได้ และเพิ่ม index ค้นห้องสาธารณะของห้องแบบไม่ใช่ scout | เพิ่มคอลัมน์ + CHECK + เติมค่าให้ข้อมูลเดิม |
| ต้องแก้ API | เปิด `self_owner` ใน `@Roles` ของ controller ห้อง 3 ตัว, แก้การเลือกแหล่งประกาศ และไฟล์ที่ใช้ค่า `co_agent`/`owner` อีก 5 ไฟล์ (`listing-source.ts:7-22,33`, `agent-listings-api.ts:10,55`, `AgentRoomsScreen.tsx:40,83`, `MobileAgentListingsBody.tsx:25,188-194`, `AgentRoomEditor.tsx:30` ซึ่งแปลงค่าที่ไม่ใช่ `owner` เป็น `co_agent` ทั้งหมด) | ทำ service และเส้นทางของ self_owner แยก (เช่น `/owner/rooms`) ไม่ต้องแตะเงื่อนไข 10 จุดของนายหน้า และกันกรณีที่ `agent-contracts.service.ts:2902` เขียนทับ `owner_id` ถ้ามีสัญญาบนห้องของ self_owner | เหมือน (ก) + เขียนคอลัมน์ใหม่ |
| ข้อดี | แก้ฐานข้อมูลน้อยที่สุด | ตรงกับแบบเดิมของ schema, `owner_id` มีความหมายตรงตัว, ห้องของนายหน้ากับของเจ้าของแยกกันที่ระดับฐานข้อมูล เงื่อนไขเดิมของนายหน้ากันไม่ให้เห็นห้องของเจ้าของอยู่แล้ว | แยกเรื่อง "ใครลง" ออกจาก "ได้ข้อมูลมาจากไหน" |
| ข้อเสีย | ขัดกับแบบเดิมของ schema, คำว่า scout (ห้องที่นายหน้าหามา) ไม่ตรงความหมาย และต้องเปิดเส้นทางของนายหน้าให้ role อื่น | ต้องเขียน service ใหม่ แก้เทสที่ใช้ `is_scout_room` 3 ไฟล์ถ้าแตะของเดิม (`agent-listings.test.cjs`, `room-share-links.test.cjs`, `room-update.test.cjs`) | คอลัมน์ซ้ำกับสิ่งที่ `is_scout_room` บอกได้อยู่แล้ว |

**ข้อเสนอสำหรับ phase ถัดไป (ความเห็น): (ข) แยก** ฉบับก่อนหน้าเสนอ (ก) โดยเข้าใจผิดว่าห้องแบบไม่ใช่ scout ใช้กับผู้ให้เช่าในสัญญาอยู่แล้ว ผู้ตรวจพบว่าไม่จริง และแบบเดิมของ schema กันไว้ให้กรณีนี้โดยตรง ตัวแยกที่ Aof ต้องการ ("type ที่บอกว่าเป็นของ agent หรือ self_owner") จึงมีอยู่แล้วคือ `is_scout_room` คู่กับ `owner_id` ไม่ต้องเพิ่มคอลัมน์ ไม่กระทบรอบ 1 และรอบ 2 ของ phase นี้

## 6. ลำดับงานและตรวจผล

| ลำดับ | งาน | ตรวจด้วย |
|---|---|---|
| 1 | รอบ 1: migration + โค้ด API + แอป + ตัวกันข้อ 1–7 ใน PR เดียว | `tsc` ทุก workspace, `npm run check:roles`, `db:check -- --check`, เทส API ที่มีอยู่ |
| 2 | `audit-role-routes.cjs` ด้วย role `landlord` | ไม่มีเส้นทางที่ role ผิดได้ 200 |
| 3 | push migration รอบ 1 ขึ้น Supabase dev หลังทุกคน merge แล้ว | `npm run db:test-users -w @nestyk/api` แล้วล็อกอิน `qa-landlord` เห็นกล่องสัญญาและบิล |
| 4 | รอบ 2: role `self_owner` + เมนูตัวอย่าง | `npm run db:test-users -w @nestyk/api` แล้วล็อกอิน `qa-self-owner` เห็นเมนูตัวอย่าง 3 อย่าง และเรียก API ของนายหน้าได้ 403 |
| — | phase ถัดไป (ไม่อยู่ใน phase นี้): เปิดใช้งานจริงตาม 5.2 และ D4 | ล็อกอิน `qa-agent` สร้างห้อง 1 ห้องก่อน (สคริปต์ไม่ได้สร้างห้องให้) แล้วล็อกอิน `qa-self-owner` สร้างห้องได้ และไม่เห็นห้องของ `qa-agent` |

## 7. ข้อสังเกตที่เจอระหว่างอ่าน (ยังไม่ได้ประเมินความเสี่ยง)
- `GET /agent/contracts/owner-users` ค้นผู้ใช้ที่มี role owner ทั้งระบบ ไม่กรองตามนายหน้า คืนอีเมล เบอร์ เลขบัตร สัญชาติ สูงสุด 15 แถว (`agent-contracts.service.ts:2279-2311`) หลังรอบ 1 ต้องเปลี่ยนเป็นค้น `landlord`
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
| `qa-self-owner@nestyk.test` | ยังไม่สร้าง (รอ role `self_owner` รอบ 2) | guest, self_owner |
| `qa-agent@nestyk.test` | guest, agent | guest, agent |
| `qa-admin@nestyk.test` | guest, admin | guest, admin |

- รหัสผ่านทุกบัญชีเท่ากัน มาจาก `TEST_USER_PASSWORD` ใน `.env.api` ถ้ามี `#` ต้องครอบด้วย `"..."`
- หยุดทันทีถ้าไม่มี `ALLOW_TEST_USERS=true` (อ่านจาก `.env.api` หรือตัวแปรใน shell), ขาด `DATABASE_URL`/`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, รหัสผ่านสั้นกว่า 8 ตัว หรือโดเมนไม่มีจุด ห้ามตั้ง `ALLOW_TEST_USERS=true` ในไฟล์ที่ชี้ prod
- ถ้า API ตั้ง `ALLOW_DEV_ROLE_GRANT=true` แอปจะขอ `admin` ให้บัญชีเหล่านี้เองตอนล็อกอิน (หัวข้อ 7) role จะไม่ตรงตารางจนกว่าจะรันสคริปต์ซ้ำ ให้ตั้ง `EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT=false` ในแอป (ตั้งไว้แล้วใน `.env` ของ Aof)
- โดเมนเป็น `nestyk.test` ไม่ใช่ `nestyk` เฉย ๆ เพราะ API ตรวจอีเมลด้วย `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` ซึ่งต้องมีจุดหลัง `@` (`party-login.ts:83`, `agent-tenants.service.ts:59`, `agent-leads.service.ts:23`) ถ้าไม่มีจุด นายหน้าจะใส่อีเมลบัญชีทดสอบเป็นผู้เช่าหรือผู้ให้เช่าในสัญญาไม่ได้ ตั้งโดเมนอื่นได้ที่ `TEST_USER_EMAIL_DOMAIN`
- รันซ้ำได้: บัญชีที่มีแล้วจะถูกตั้งรหัสผ่านใหม่และตั้ง role ให้ตรงตามตาราง (role อื่นที่เกินมาถูกถอน) ถ้าแถว `users` ของอีเมลนั้นผูกกับ id ของ Supabase Auth ตัวเก่า จะผูกใหม่ให้ถูก ยกเว้นกรณีที่ id ของ Auth ไปผูกกับแถว `users` ของอีเมลอื่นอยู่แล้ว บัญชีนั้นจะขึ้น `ERROR` ในตาราง บัญชีอื่นทำต่อตามปกติ และสคริปต์จบด้วย exit code 1
- รหัส role กำหนดที่บรรทัด `SELF_OWNER_ROLE = 'self_owner'` ในสคริปต์ และสคริปต์ไม่ให้ role ชื่อ `owner` กับบัญชีไหนเลยเมื่อฐานข้อมูลมี `landlord` แล้ว

ผลที่รันในห้องทดลอง (Postgres 16 สร้างตารางจาก `baseline.sql` ที่ตัดบรรทัด `SET transaction_timeout` ซึ่ง Postgres 16 ไม่รู้จักออก + `20261014120000_contract_closure.sql` + `masters.sql`, Supabase Auth เป็นตัวจำลองที่ตอบ API admin แบบเดียวกัน): รายชื่อ role แบบเก่า สร้าง 5 บัญชี `qa-self-owner` รอ, รันซ้ำไม่สร้างซ้ำ, จำลองรอบ 1 (เปลี่ยนชื่อ id 2) แล้ว `qa-landlord` ยังเป็น id 2 และ `qa-self-owner` ยังรอ, จำลองรอบ 2 (เพิ่ม `self_owner` id 6) แล้ว `qa-self-owner` ถูกสร้าง, role ที่เกินมาถูกถอน, แถวที่ผูก id ผิดถูกผูกใหม่, กรณี id ชนกับอีเมลอื่นขึ้น ERROR เฉพาะบัญชีนั้น, ตัวกันรหัสสั้น / โดเมนไม่มีจุด / ไม่มี `ALLOW_TEST_USERS` หยุดได้ถูก
ที่ยังไม่ได้ทดสอบ: การเรียก Supabase Auth ตัวจริง (ห้องทดลองใช้ตัวจำลอง) ต้องดูผลตอน Aof รันบน Mac

## 9. ข้อตัดสินใจ

| # | คำถาม | ผล | วันที่ |
|---|---|---|---|
| D1 | role ใหม่ใช้รหัสอะไร | **`self_owner`** หน้าจอแสดง "Owner / เจ้าของ" รหัส `owner` เลิกใช้ถาวร | 16 ต.ค. 2026 |
| D2 | ฝ่ายในสัญญา (`party`/`subject` `'owner'`, คอลัมน์ `owner_*`) เปลี่ยนเป็น landlord ไหม | **(ก) คงไว้** ถือเป็น "ฝ่ายผู้ให้เช่า" แยกชนิด `ContractParty` ตามตัวกันข้อ 2 | 16 ต.ค. 2026 |
| D3 | self_owner ทำอะไรได้ | สร้างห้อง, รับแจ้งเตือนการจ่ายค่าเช่า, เซ็นเอกสารที่ admin NESTYK ดำเนินการ **เฟสนี้ทำแค่เมนูตัวอย่าง** ยังไม่ลงรายละเอียด | 16 ต.ค. 2026 |
| D4 | ห้องของ self_owner เก็บรวมหรือแยก | **พักไว้ phase ถัดไป** phase นี้เน้น agent ผลประเมินอยู่หัวข้อ 5.3 (ข้อเสนอ: (ข) แยก ตามแบบเดิมของ schema) | 16 ต.ค. 2026 |

## 10. ที่ยังไม่ได้อ่าน
ไฟล์ที่โค้ดอ้างถึงแต่ไม่ได้อยู่ในชุดที่อ่าน: `apps/consumer-app/components/OwnerConfirmedRent.tsx`, `apps/consumer-app/lib/tenant-bills-api.ts`, `apps/consumer-app/lib/tenant-workspace-copy.ts`, `apps/consumer-app/lib/agent-session.ts`, `apps/consumer-app/lib/auth/session-storage.ts`, `apps/consumer-app/lib/places-api.ts`, `apps/api/src/agent/contracts/contract-closure.ts`, `packages/i18n/src/locales/*` ต้องอ่านเพิ่มก่อนลงมือรอบ 1 เพื่อให้รายการแก้ในหัวข้อ 3 ครบ
