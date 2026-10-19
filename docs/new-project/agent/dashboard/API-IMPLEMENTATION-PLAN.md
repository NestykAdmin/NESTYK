# แผนเชื่อม Agent Dashboard กับ API จริง

วันที่ตรวจ: 16 ตุลาคม 2026 · สถานะ: พัฒนา API และเชื่อม Mobile แล้วตามขอบเขตด้านล่าง
ขอบเขต: Consumer Mobile / role Agent, NestJS API และ shared types

## ผลการทำตามคำสั่งล่าสุด

ทำ summary + paginated work-items API และเชื่อม Mobile กับข้อมูลจริงแล้ว; สองฟีเจอร์ที่ผู้ใช้ให้เว้นไว้คือ follow-up และ commission แสดง “ยังไม่รองรับ” พร้อมค่าที่ไม่มีข้อมูลเป็น null
รายการงาน/บิลค้นหาและแบ่งหน้าได้ เปิดต้นทางด้วย tenant/contract IDs และคง query/page เมื่อกลับจากรายละเอียด
KPI ภาพรวมยังเปิดแท็บรายการหลัก; ยังไม่ได้เพิ่มตัวกรอง KPI เข้า API รายการเดิมหรือแก้ระบบค่าคอม/งานติดตาม/ปฏิทินส่วนอื่น
Core query ล้มเหลวคืน 503 พร้อม retry ทั้งหน้า; ไม่สร้าง partial totals หรือข้อมูลตัวอย่างแทนข้อผิดพลาด
ตรวจ implementation ล่าสุดที่ api.md/database.md; รายละเอียดต่อไปนี้เก็บเป็นแผนเดิมและข้อเสนอสำหรับรอบถัดไป

## 1. สิ่งที่พบในโค้ดปัจจุบัน

- `apps/consumer-app/app/index.tsx` สร้าง snapshot จาก `createAgentDashboardDemoFixture` ทุก section; refresh สร้าง fixture ใหม่ ยังไม่ได้เรียก dashboard API
- UI อยู่ใน `packages/feature-listing/src/components/MobileAgentDashboardBody.tsx`; มี business, actionRequired, schedule, inventory, clients, rent, commission และ activity
- View model อยู่ใน `packages/feature-listing/src/dashboard/types.ts` มี section status แต่ UI ยังไม่ใช้ status เหล่านี้ในการแยก loading/error/not_configured
- มี API และตารางจริงสำหรับห้อง, ลีด, นัดดูห้อง, ผู้เช่า, สัญญา และบิลแล้ว
- Blueprint ใน `api.md` / `database.md` ยังอธิบาย Dashboard รุ่นเก่า ต้องขยายตามหน้าจอปัจจุบันและ `DESIGN-SPEC.md`; ไม่ใช้ SQL ตัวอย่างเดิมเป็นข้อสรุปโดยไม่ตรวจ implementation
- คำว่า Tenant ในกลุ่มผู้ติดต่อยังรวมผู้เคยเช่าตามกฎปัจจุบัน; ตัวเลขผู้เช่าปัจจุบันบน Dashboard ต้องแยกเป็นคนที่กำลังเช่าจริง

## 2. ข้อมูลที่พร้อมและช่องว่าง

| ส่วนบน Dashboard | แหล่งข้อมูลจริง | สิ่งที่ต้องทำ |
|---|---|---|
| ชื่อ / วันที่ | Auth profile / เวลา server | ใช้ profile เดิม; format วันที่ที่ client ตาม locale และ Asia/Bangkok |
| ห้องพร้อมเสนอ / สต็อก | rent_rooms, master_room_statuses, properties และข้อมูลราคา/ประเภทห้อง | aggregate เฉพาะ scout rooms ของ Agent; แยก available กับ published/private; preview 2 ห้อง |
| ลีดเปิดอยู่ | leads | นับ new + inprogress; ไม่รวม booked/lost; viewing เป็นสถานะแสดงผลที่ derive จากนัด |
| ลูกค้าปัจจุบัน / สถานะลูกค้า | tenants, room_tenancies, lease_contracts, agreement_templates / master_agreement_types | นับ distinct tenant IDs ใน workflow ปัจจุบัน; แยกประวัติที่สิ้นสุดแล้ว |
| รอลงนาม | lease_contracts และ signatures | ใช้จำนวนผู้ลงนามที่แต่ละ form ต้องการ; รวมงานของคนที่เป็นผู้เช่าปัจจุบันด้วย |
| ใกล้ต่อสัญญา | lease_contracts และ lineage | ใช้ active lease/renewal ที่เข้าเกณฑ์ช่วง 30 วัน; ไม่รวมฉบับที่มี successor ไม่ได้ยกเลิกแล้ว |
| นัดวันนี้ / นัดถัดไป | lead_viewings | เฉพาะ viewing จริง; ตัด cancelled/done ออกจาก up next; ไม่สร้างนัดติดตามจาก fixture |
| ค่าเช่า / ค้างชำระ | tenant_bills เชื่อม lease_contracts | aggregate ครบทุกลูกค้า; ใช้ grace_until และกฎ billing เดิม |
| กิจกรรมล่าสุด | leads.created_at, contract delivery timestamps, tenant_bills.paid_at | union เหตุการณ์ที่มี timestamp จริง สูงสุด 3 รายการ; ไม่ถือเป็น audit log ครบทุกเหตุการณ์ |
| ลีดต้องติดตาม | ยังไม่มี dueAt / last-contact / follow-up task ที่เพียงพอ | ส่ง not_configured จนมีการบันทึกงานติดตามจริง; ห้ามใช้ created_at/updated_at แทนเวลานัดติดตาม |
| ค่าคอมรวม / รับแล้ว / รอรับ | มี agent_commission_confirmations แต่ยังไม่มีบัญชีการรับเงินจริง | ส่ง not_configured; เอกสารยืนยันค่าคอมไม่ใช่หลักฐานว่ารับเงินแล้ว |

## 3. API ที่เสนอ

### GET /api/v1/agent/dashboard?period=YYYY-MM

- Endpoint สรุปหน้า Dashboard; default period เป็นเดือนปัจจุบันตาม Asia/Bangkok
- period ใช้กับสรุปการเงิน; schedule ยังเป็นวันนี้ และงานเร่งด่วนยังเป็นงานเปิดทั้งหมด ไม่ถูกจำกัดตามเดือนที่เลือก
- ใช้ AuthGuard + RolesGuard + role agent; agentId จาก CurrentUser เท่านั้น ไม่รับจาก query
- ส่ง raw IDs, ISO timestamps, date-only strings, counts และยอดเงิน; ข้อความสถานะ/ชื่อประเภท/วันเวลาที่แสดงผลให้ client แปลด้วย i18n
- จำกัด inventory preview 2, activity 3; schedule ส่งจำนวนรวมและ preview ไม่เกิน 3 พร้อมนัดถัดไปที่คำนวณแยกจากรายการนัดที่ผ่านมา
- หน่วยเงิน THB; คำนวณด้วย PostgreSQL numeric ก่อน serialize ตาม convention ของระบบ ห้ามรวมเงินด้วย floating-point ที่ทำให้ทศนิยมคลาดเคลื่อน

โครงสร้างที่เสนอ:

```ts
type Section<T> =
  | { status: 'available'; data: T }
  | { status: 'not_configured'; data: null; reasonCode: string }
  | { status: 'error'; data: null; errorCode: string };

type AgentDashboardResponse = {
  computedAt: string; // เวลาที่คำนวณ response ไม่ใช่เวลาที่ข้อมูลต้นทางถูกแก้ไข
  timezone: 'Asia/Bangkok';
  today: string; // YYYY-MM-DD
  period: string; // YYYY-MM
  business: Section<BusinessSummary>;
  actionRequired: Section<ActionSummary>;
  schedule: Section<ScheduleSummary>;
  inventory: Section<InventorySummary>;
  clients: Section<ClientSummary>;
  rent: Section<RentSummary>;
  commission: Section<CommissionSummary>;
  activity: Section<ActivitySummary>;
};
```

- KPI ที่ข้อมูลพร้อมไม่ควรถูกปิดตามค่าคอม: business ต้องรองรับ commissionPending ที่ unavailable แยกจาก counts อื่น เช่น metric envelope หรือ nullable value + reason
- Action summary ระบุ availability ของแต่ละประเภทงานได้; ห้ามแสดงศูนย์สำหรับ follow-up ที่ยังไม่มีข้อมูล
- ไม่มีข้อมูลในบัญชีที่พร้อมใช้งาน = available + 0 / []; ข้อมูลไม่พร้อม = not_configured; query ล้มเหลว = error
- หากระบบฐานข้อมูลหลักล่มทั้งหมดให้ใช้ HTTP 503; partial failure ให้ section ที่พร้อมยังแสดงได้ ไม่คืน success พร้อมเลขศูนย์แทนข้อผิดพลาด
- Validation: period ต้องเป็นเดือนจริง; ปฏิเสธ repeated/unknown query; 400 สำหรับ input ไม่ถูกต้อง, 401/403 สำหรับสิทธิ์

### GET /api/v1/agent/dashboard/work-items?kind=...&q=...&page=1&limit=20

- รายการงานที่กดจาก actionRequired; กรองที่ server ก่อนแบ่งหน้า default 20 / max 50
- คืน `{ items, total, page, limit }`; ใช้กฎคัดเลือกเดียวกับตัวนับใน Dashboard
- Stable identity เช่น `bill:123`, `signing:456`, `renewal:789`; คนเดียวมีหลายงานได้ แต่ไม่ซ้ำงานเดียวจากการ join หลายสัญญา
- แต่ละ item มี source IDs ที่จำเป็น เช่น billId / contractId / tenantId / leadId พร้อมข้อมูลสรุปสำหรับเปิดต้นทาง
- kind ที่ยังไม่พร้อมต้องคืน capability ที่ไม่พร้อมอย่างชัดเจน ไม่แสดงว่าไม่มีงาน
- เรียงงานเกินกำหนดก่อน แล้ววันที่ที่ต้องทำ และ ID เป็นตัวตัดสินเมื่อวันเท่ากัน
- Scope จาก Agent ที่ login เสมอ; source detail ที่กดต่อใช้ permission checks เดิม

### API เดิมที่ต้องใช้หรือขยาย

- ใช้ `GET /agent/viewings?from=...&to=...` สำหรับปฏิทินต่อจาก preview; แสดงสถานะ scheduled ตามจริง เพราะยังไม่มีฟิลด์ยืนยันนัดแยก
- ใช้รายละเอียดห้อง / ลีด / ผู้เช่า / สัญญา / billing เดิม; ไม่เพิ่ม endpoint รายละเอียดซ้ำเพื่อ Dashboard
- `GET /bills/agent` ปัจจุบันส่งเฉพาะสลิปที่รอตรวจ ไม่ใช่บิลทั้งหมด: หากใช้เป็นหน้ารายการค่าเช่าประจำเดือน ให้เพิ่มโหมด query period/status/q/page/limit โดยคงพฤติกรรมเดิมเมื่อไม่ส่ง query หรือแยก route รายการใหม่ภายใต้ billing ตามผลตรวจ compatibility
- ตรวจและเชื่อมตัวกรอง available rooms / open leads / current clients กับปลายทางจริง; ถ้า endpoint เดิมไม่รองรับ ให้เพิ่ม filter ฝั่ง server พร้อมทดสอบ counts ให้ตรงกัน

## 4. กฎการนับที่ต้องใช้ร่วมกัน

1. ห้อง: นับ rent_rooms ที่ is_scout_room = true และ created_by_user_id ตรงกับ Agent; available ใช้ room status จริง ไม่ใช้ visibility แทน; unknown ไม่ควรถูกแปลงเป็น available
2. ลีด: open = new/inprogress เท่านั้น; รายการและ counts ต้องใช้ predicate เดียวกัน
3. ลูกค้า: current clients นับบุคคล distinct ที่มี workflow ปัจจุบัน; ไม่ใช่จำนวนเอกสารหรือ user ที่มี role Tenant และไม่รวมคนที่เหลือเฉพาะสัญญาสิ้นสุดแล้ว
4. กลุ่มลูกค้าไม่ซ้ำคน: มี active tenancy/lease ครอบคลุมวันนี้ → tenants; ไม่มี active แต่รอลงนาม → signing; ที่เหลืออยู่ระหว่างจัดทำสัญญา → preparing ส่วนนี้ต้องเปลี่ยน label “ร่างสัญญา” ให้ครอบคลุม pending review/payment หากรวมสถานะเหล่านั้น ห้ามนับเป็น draft โดยไม่อธิบาย
5. Signing work นับเอกสารที่ยังต้องลงนาม ไม่ใช่จำนวนคน; reservation ต้อง owner/tenant/agent, lease และ renewal ต้อง owner/tenant, broker appointment ต้อง owner/agent; ไม่รวมสัญญาสิ้นสุด
6. Renewal ใช้ช่วง 0–30 วันใน Asia/Bangkok, แยกฉบับเดิมกับ successor และรักษาประวัติ; ไม่ใช้ contract ที่หมดอายุไปแล้วเป็น upcoming
7. Overdue ใช้ bill ที่ยังไม่ paid และวันนี้ > grace_until; สลิปที่ส่งมาแต่ยังไม่ยืนยันยังไม่ถือว่าจ่ายแล้ว และต้องแยก flag awaitingReview ให้ปลายทางแสดงการกระทำที่ถูกต้อง
8. ค่าเช่าเดือนที่เลือกใช้ due_date อยู่ในเดือนนั้น; totalDue / received / unpaid มาจากชุดบิลเดียวกัน, overdue เป็น subset ของ unpaid; received ในการ์ดนี้เป็นยอดชำระของบิลชุดนั้น ไม่ใช่ cash flow ตาม paid_at ของเดือนอื่น ห้ามรวมเงินจอง/มัดจำ/ค่าคอม และต้องแสดง pending ที่ยังไม่ overdue แยกจากสีแดง
9. บิลที่ยังไม่ออกห้ามถูกสร้างจาก GET Dashboard; ใช้ bill scheduler เดิม ตรวจความครบถ้วนและ failure ของการออกบิลก่อนถือว่ายอดพร้อมใช้งาน หากต้องการ projected rent ให้เป็น metric แยก ไม่แอบรวมกับ issued bills
10. กิจกรรมต้องมี event timestamp จริง; ไม่ใช้ updated_at สรุปว่า “ส่งสัญญา” หรือ “รับเงินแล้ว”

## 5. จุดที่ต้องแก้ฝั่ง Mobile ควบคู่กัน

- เปลี่ยน fixture adapter เป็น `agent-dashboard-api.ts` และ hook ที่จัดการ loading/error/retry/refresh; demo ใช้เฉพาะ preview ที่เปิดไว้อย่างชัดเจน
- ย้าย API/domain response types ไป `packages/types`; คง view-model และการแปลข้อความใน feature-listing ผ่าน adapter
- ให้แต่ละ section อ่าน status จริง; ห้ามใช้ default 0 เติมค่าที่ไม่มีข้อมูล และรองรับความพร้อมแยกของ KPI ค่าคอม
- แก้ rent ratio bar: ตอนนี้ใช้ received + overdue เป็นฐาน ทำให้ pending ที่ยังไม่ overdue หายไป ต้องแสดงสัดส่วนที่อ้างอิง totalDue
- เปลี่ยน label currentClients ที่ปัจจุบันใช้ “ผู้เช่าปัจจุบัน” ให้ตรงกับความหมาย distinct current clients; แยกตัวเลขผู้เช่าปัจจุบันเป็น metric ต่างหาก
- ทำปุ่ม actionRequired ไป work-items ที่กรองจริง; ปัจจุบัน lead_follow_up ใน AgentLeadsScreen แสดงป้ายแต่ไม่ส่ง filter เข้า API และ overdue ใน tenantWorkItems ยังไม่สร้างงานจากแหล่งจริง
- ขยาย typed navigation ให้เปิด source IDs จริง: viewAppointment ปัจจุบันละเลย appointmentId และเปิดเพียงปฏิทิน; ห้อง preview ก็เปิดเพียงแท็บห้อง ต้องเลือกห้อง/วัน/นัดที่สัมพันธ์กับรายการ
- แสดงเดือน/วัน/เวลาให้ตรง Asia/Bangkok; up next ต้องไม่ fallback ไปนัดอดีตเมื่อหมดนัดในวันนั้น
- รองรับ request cancellation/stale responses เมื่อเปลี่ยน role/account และคง shell เดิมเพื่อไม่ให้กระพริบ
- Refresh ต้องจบหลัง API settle; โหลดใหม่เมื่อกลับจากการสร้างลีด/ห้อง การลงนาม ยืนยันชำระเงิน หรือต่อสัญญา

## 6. ลำดับพัฒนา

- [ ] 1. สรุป shared contract และกฎการนับตามข้อ 3–4; อัปเดต api.md/database.md ให้ตรง implementation เป้าหมาย
- [ ] 2. เพิ่ม `apps/api/src/agent/dashboard/agent-dashboard.controller.ts`, service และ query helpers; register ใน AgentModule; เพิ่ม shared types และ isolated-schema integration tests
- [ ] 3. ทำ summary สำหรับห้อง ลีด ลูกค้า สัญญา นัดดูห้อง บิล และ activity; คืน not_configured สำหรับ follow-up และ commission ที่ข้อมูลยังไม่ครบ
- [ ] 4. ทำ work-items และ query filters สำหรับปลายทาง ให้จำนวนบนการ์ดตรงกับรายการทุกหน้า; ขยาย billing list โดยไม่กระทบผู้เรียกเดิม
- [ ] 5. เพิ่ม consumer API adapter/hook; เชื่อม MobileAgentDashboardBody และ index.tsx; เพิ่ม i18n ทั้ง th/en/zh/ja; จัดการ unavailable/partial failure และ navigation ตาม ID
- [ ] 6. ตรวจ permission, ความถูกต้องของยอด, pagination, refresh และ UI บน iOS/Android ก่อนขยาย Web
- [ ] 7. เฟสถัดไป: เพิ่ม follow-up tasks ที่มี dueAt/status/agent/lead จริง และ commission ledger พร้อมรายการรับเงิน/ยอดคงเหลือ; ต้องมี flow บันทึกและตรวจสิทธิ์ก่อนเปิด metrics เหล่านี้ ไม่ตีความเอกสารเก่าเป็นรายการรับเงินเอง

เฟสแรกไม่ต้องเพิ่มตาราง Dashboard; ประเมิน index จาก query plan จริงก่อนเพิ่ม migration โดยเฉพาะ bills ตาม contract/due_date, viewings ตาม agent/เวลา และ contracts ตาม agent/status/end_date

## 7. เกณฑ์ตรวจรับ

- บัญชี Agent A ไม่เห็น counts, source IDs หรือเงินของ Agent B; anonymous 401 และ role อื่น 403
- ตัวนับตรงกับ total ของ work-items/ปลายทางหลัง search/filter; ทดสอบข้อมูลเกิน 20 รายการและ join ที่อาจทำให้จำนวนซ้ำ
- คนเดียวมีหลายห้อง/หลายสัญญา/หลาย renewal ไม่ถูกนับซ้ำในจำนวนลูกค้า แต่ยังมีงานแยกตามเอกสารได้
- Room availability และ visibility ไม่ปนกัน; former Tenant คงอยู่ในผู้ติดต่อ แต่ไม่ถูกนับเป็นผู้เช่าปัจจุบัน
- ทดสอบ grace date, วันหมดอายุพอดี, ช่วงต่อสัญญา, สิ้นเดือน/ปี และขอบเขตเที่ยงคืน Asia/Bangkok
- เดือนที่มีบิล paid/pending/overdue/awaiting review ผสมกันต้องรวมยอดได้ถูกต้อง; ไม่มีการสร้างบิลหรือแก้สัญญาจากการเปิด Dashboard
- ไม่มีนัด → empty; ไม่มีนัดอนาคต → ไม่มี up next; cancelled/done ไม่ขึ้นเป็นนัดถัดไป
- ไม่พร้อม/ผิดพลาด/ไม่มีข้อมูลเป็นคนละสถานะ; ไม่มีข้อมูลตัวอย่างในโหมดใช้งานจริง
- ปุ่มบน Dashboard เปิดรายละเอียดหรือรายการตรงกับ ID/filter และช่วงเดือน; refresh/กลับจากรายละเอียด/เปลี่ยนบัญชีไม่แสดงข้อมูลเก่า
- Backend integration tests + consumer state/navigation tests + TypeScript ผ่าน; ตรวจ Mobile ตามข้อกำหนดดีไซน์

## แหล่งที่ตรวจ

- `apps/consumer-app/app/index.tsx`
- `packages/feature-listing/src/dashboard/types.ts` และ `demo-fixture.ts`
- `packages/feature-listing/src/components/MobileAgentDashboardBody.tsx`
- `apps/api/src/agent/{rooms,listings,leads,tenants,contracts}` และ entities ที่สัมพันธ์กัน
- `apps/api/src/billing/{agent-bills.controller,tenant-billing.service,rent-schedule,tenant-billing.scheduler}.ts`
- `apps/consumer-app/lib/{tenant-work,tenant-detail,agent-calendar-viewings,agent-calendar-demo}.ts`
- `apps/consumer-app/components/{AgentLeadsScreen,AgentTenantsScreen}.tsx`
- `docs/new-project/agent/dashboard/{README,DESIGN-SPEC,api,database,flow}.md`
