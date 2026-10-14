# API ปิดสัญญาเช่า

เพิ่มเมื่อ 14 ตุลาคม 2026 รองรับสัญญาเช่าและหนังสือต่อสัญญาที่มีสถานะ `active` เท่านั้น ใช้ authentication และ role `agent` เดิม และจำกัดสิทธิ์ตามผู้สร้างสัญญา ห้อง และ Lead

## เหตุผลปิดสัญญา

`GET /agent/contracts/end-reasons`

คืนเหตุผลที่เปิดใช้งานจาก `master_contract_end_reasons` พร้อม `code`, `nameTh`, `nameEn`, `status` และ `requiresNote` ไม่รวม `draft_cancelled` ซึ่งต้องใช้ endpoint ยกเลิกฉบับร่างเดิม

## ปิดสัญญา

`POST /agent/contracts/:id/close`

```json
{
  "endReasonCode": "tenant_requested",
  "effectiveEndDate": "2026-10-12",
  "note": "ผู้เช่าขอยุติสัญญาและส่งคืนห้อง"
}
```

- `effectiveEndDate` ต้องเป็นวันที่จริงในรูปแบบ `YYYY-MM-DD` และไม่อยู่ในอนาคต
- ระบบกำหนดสถานะจากเหตุผลใน master ไม่รับสถานะหรือยอดเงินจาก caller
- `expired`: ต้องใช้วันสิ้นสุดเดิม และปิดได้หลังวันนั้นเท่านั้น เพื่อไม่ปิดก่อนจบวันสุดท้ายที่เช่า
- `terminated`: วันสิ้นสุดจริงต้องตั้งแต่วันเริ่มเช่า และก่อนวันสิ้นสุดเดิม
- `cancelled`: สำหรับสัญญาที่ลงนาม/ออกเอกสารแล้วแต่ยังไม่เริ่มเช่า ใช้เหตุผล `before_start_cancelled` และวันที่ก่อนวันเริ่มเช่า
- เหตุผลที่กำหนดให้มีหมายเหตุต้องระบุ `note`; หมายเหตุยาวได้ไม่เกิน 1,000 ตัวอักษร
- ยุติหรือยกเลิกไม่ได้หากมีฉบับต่อสัญญาที่ยังไม่สิ้นสุด ต้องจัดการฉบับต่อสัญญาก่อน
- ป้องกันการยกเลิก/ยุติปลายทางที่มีเงินประกันรอยกยอดซึ่งอนุมัติแล้ว ต้องจัดการการโอนก่อน
- หากเรียกซ้ำด้วยเหตุผล วันที่ และหมายเหตุเดิม จะคืนข้อมูลเดิมโดยไม่เขียนเวลาใหม่ หากเปลี่ยนข้อมูลหลังปิดแล้วตอบ `409`

ผลลัพธ์:

```json
{
  "contract": { "id": 20, "status": "terminated", "effectiveEndDate": "2026-10-12" },
  "billing": {
    "policy": "retain_existing",
    "unpaidCount": 1,
    "unpaidAmount": "15000.00",
    "paidCount": 2,
    "billsDueAfterEndCount": 1
  }
}
```

`contract` จริงคืน payload `AgentContract` เต็ม ยอดเงินใน `billing.unpaidAmount` เป็น decimal string; บิลรอตรวจสลิปยังรวมในยอดไม่ยืนยันชำระ `billsDueAfterEndCount` นับทั้งบิลจ่ายแล้วและยังไม่จ่ายที่ครบกำหนดหลังวันที่ปิด เพื่อให้ตรวจยอดเรียกเก็บหรือเงินที่ต้องปรับแยก

ตามนโยบายที่เลือก **เก็บยอดบิลเดิมทั้งหมด** ไม่ลบหนี้ ไม่เปลี่ยนบิลเป็นจ่ายแล้ว ไม่คิดตามวัน ไม่คืนเงินหรือหักเงินประกันอัตโนมัติ API ปรับยอดบิล/คืนเงินแยกยังไม่ได้เพิ่มในงานนี้

## ข้อมูลและ concurrency

บันทึกเหตุผล วันที่สิ้นสุดจริง ผู้บันทึก และเวลาบันทึก โดยเก็บวันสิ้นสุดตามเอกสารเดิม ลายเซ็น PDF และข้อมูลสัญญาไว้ การปิดสัญญาและการออกบิลใช้ lock ของสัญญาเดียวกัน งานออกบิลต้องอ่าน `active` ใหม่ภายใต้ lock ก่อน insert จึงไม่ใช้ snapshot เก่าหลังปิดแล้ว

คืนการจองด้วย `leads.booking_released_at` โดยไม่ลบ Lead/Tenant หรือเปลี่ยนห้องในประวัติ คืนห้องเมื่อไม่มี lease/renewal ที่ยังไม่สิ้นสุดของ Lead ในห้องนั้น หากยังมี renewal ค้างหรือใช้งานอยู่จะคงการจองและ occupancy ที่ร่วมกันไว้ การต่อสัญญาจากฉบับหมดอายุที่คืนห้องแล้วจะต้องยึดการจองใหม่ภายใต้ room lock และถูกปฏิเสธหากมีผู้จองคนใหม่

ป้องกันเอกสารของสัญญาที่สิ้นสุดแล้วถูกอัปโหลดทับหรือเขียน preview ใหม่ การอัปโหลดที่อ่านสัญญาก่อนปิดจะบันทึกไม่สำเร็จและลบเฉพาะไฟล์ใหม่ที่ค้างไว้

การตรวจช่วงวันชนกันรวมช่วงที่เคยมีผู้เช่าของสัญญา `expired`/`terminated` ด้วย ใช้ `effective_end_date` หากมี ยกเว้นสัญญา `cancelled` ซึ่งไม่ได้สร้าง occupancy

## Migration และการตรวจสอบ

ต้องมี migration `20261009-contract-end-deposits.sql` ก่อน จากนั้น:

```sh
npm run db:contract-closure -w @nestyk/api -- --check
npm run db:contract-closure -w @nestyk/api -- --apply
npm run db:contract-closure -w @nestyk/api -- --check
```

`--check` อ่านสถานะ schema เท่านั้น `--apply` รัน migration ใหม่ใน transaction พร้อม advisory lock และ timeout เพิ่ม timestamp คืนการจอง เปลี่ยน unique index ให้ไม่นับการจองที่คืนแล้ว และเพิ่มเหตุผลยกเลิกก่อนเริ่มเช่า ไม่ปิดสัญญาหรือสรุปเงินย้อนหลังจากข้อมูลเก่า

```sh
npm run test:contract-closure -w @nestyk/api
RUN_CONTRACT_CLOSURE_DB_TEST=1 node --test apps/api/test/contract-closure.integration.cjs
npm run test:agent-tenants -w @nestyk/api
```

PostgreSQL integration ใช้ schema ใหม่และ fixture สังเคราะห์เท่านั้น ไม่คัดลอกข้อมูลลูกค้า ทดสอบ migration ซ้ำ, closure, rollback, ประวัติบิล, การจองใหม่, renewal occupancy, approved deposit carry และการปิดพร้อมออกบิล ก่อนลบ schema ทิ้ง

การปิดเมื่อครบกำหนดยังเรียกผ่าน API นี้ ยังไม่มี job เปลี่ยนสัญญาเป็น `expired` อัตโนมัติ
