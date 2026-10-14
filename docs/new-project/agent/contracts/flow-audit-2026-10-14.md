# ผลตรวจ flow Agent — 14 ตุลาคม 2026

> รายงานนี้เก็บผลก่อนแก้ไว้เป็นหลักฐาน ผลแก้และตรวจซ้ำล่าสุดอยู่ใน [รายงานแก้ API/flow](../../../api-audits/2026-10-14-role-api-fixes.md)

ตรวจจองห้อง → หนังสือจอง → สัญญาเช่า → ต่อสัญญา → บิลค่าเช่า → ปิดสัญญา โดยอ่านโค้ด จำลอง service และใช้ PostgreSQL integration ใน schema ชั่วคราว ไม่มีการแก้ข้อมูลลูกค้าหรือ apply migration ไปยัง schema ที่ใช้งานจริง

API และนโยบายปิดสัญญาอยู่ใน [api-close.md](./api-close.md)

## แก้ในงานนี้

| จุด | ผลหลังแก้ |
| --- | --- |
| API ปิดสัญญาไม่มี | เพิ่มเหตุผล master และ endpoint ปิด active lease/renewal พร้อมตรวจสิทธิ์ วันที่ และการเรียกซ้ำ |
| ปิดแล้วห้องยังติดการจอง | เพิ่ม booking release timestamp; เก็บประวัติห้อง/ผู้เช่า แต่คืนห้องเมื่อไม่มีสัญญาเช่าหรือ renewal ค้าง |
| ปิดฉบับเดิมแล้วอาจคืนห้องทั้งที่มี renewal | คง booking/occupancy เมื่อมีฉบับต่อสัญญาที่ยังไม่สิ้นสุด; ยุติก่อนกำหนดต้องจัดการ successor ก่อน |
| อ่าน active ก่อนปิดแล้วออกบิลหลังปิด | งานออกบิลอ่านสถานะใหม่ภายใต้ parent lock เดียวกับ closure |
| ยืนยันกับตีกลับสลิปพร้อมกันได้ paid แต่ไม่มีหลักฐาน | ยืนยันรับเงินต้องตรงกับ path และเวลาส่งสลิปที่อ่านมา คำขอเก่าตอบ 409 |
| เอกสารเก่าถูกแทนที่หลังปิด | ปิดการอัปโหลด/เขียน preview ของสัญญาที่สิ้นสุดแล้ว; stale upload ถูกปฏิเสธและ cleanup ไฟล์ใหม่ |
| สัญญาใหม่ย้อนหลังทับอดีตผู้เช่าที่ปิดแล้ว | ตรวจ overlap ของ expired/terminated ถึง effective end date; จองใหม่ได้หลังวันสิ้นสุดจริง |

บิลค้าง บิลจ่ายแล้ว สลิป และยอดเดิมถูกเก็บครบตามนโยบายที่ผู้ใช้เลือก ไม่มีการปรับยอด/คืนเงินโดยอัตโนมัติ

## บัคและงานที่ยังเหลือ

รายการต่อไปนี้แยกจาก API ปิดสัญญาที่เพิ่มในงานนี้ ยังไม่ได้แก้

1. **[P1] หน้าบิล Agent เป็นข้อมูลตัวอย่าง** — `tenant-billing-demo.ts` เปิด flag และกำหนดบิลค่าเช่าเป็น paid โดยไม่มีการรับเงินจริง `AgentTenantsScreen.tsx` ดึงเฉพาะสลิปรอตรวจ หลังยืนยัน/ตีกลับและ refresh ข้อมูลตัวอย่างกลับมาทับวันที่รับเงินจริง ยอดค้างและประวัติรับเงินจึงยังใช้เป็นบัญชีจริงไม่ได้
2. **[P1] ยอดเอกสาร lease/renewal อาจไม่ตรงกับ billing เมื่อส่ง payload ผิดผ่าน API** — `saveDraft` fallback ไปใช้ยอด top-level หากยอดใน overlay ติดลบ/ไม่เป็นตัวเลข แต่ยังเก็บค่า overlay ผิดไว้ให้ PDF ตัวอย่างค่าเช่าระดับบน 15000, `leaseRenewal.monthlyRent = "-1"` ถูกบันทึกเป็นคอลัมน์ 15000 กับเอกสาร -1 ควร reject ค่า overlay ผิดแทน fallback
3. **[P2] วันผ่อนผันในสัญญาถูกละเลย** — `leaseAgreement.graceDay` มี label “ผ่อนผันถึงวันที่” แต่ `rent-schedule.ts` ใช้ due + 5 วันเสมอ ทดสอบ due day 1 และ grace day 15 ได้ `grace_until = วันที่ 6` แทนวันที่ 15 กระทบสถานะค้างชำระและช่วงเวลาที่ออกบิล ต้องกำหนดความหมาย field ให้ตรงกันทั้งเอกสารและ scheduler
4. **[P2] ข้อมูลบัญชีหลัง renewal ไม่แยกช่อง** — ฟอร์มเติม `ธนาคาร / ชื่อบัญชี / เลขบัญชี` แต่ `leaseForm` ส่งทั้งข้อความเป็น `payTo.accountNo` ปุ่ม copy account จึงคัดลอกข้อความทั้งหมดและชื่อธนาคาร/ชื่อบัญชีว่าง
5. **[P2] dueDay ของ renewal รับ 00–99** — ตรวจแค่จำนวนหลัก ทั้งที่ billing รับ 1–31 เท่านั้น ค่า 99 ถูกบันทึกในเอกสาร แต่ scheduler ใช้วันเริ่มสัญญาแทน
6. **[P2] lease defaults ไม่อ้างวันเข้าอยู่/ยอดที่ตกลงในหนังสือจอง** — `leaseDefaults` ใช้วันที่จัดทำเป็นวันเริ่มเช่าและราคาในห้องเป็นค่าเริ่มต้น หาก Agent ไม่แก้ ระยะเช่าและยอดอาจไม่ตรงกับหนังสือจอง
7. **[P2] ยกเลิก draft ยังไม่คืนการจอง** — endpoint `cancel-draft` เดิมเปลี่ยนเฉพาะสัญญา ไม่ได้ตั้ง `booking_released_at`; ผู้จองคนใหม่ยังถูก 409 แม้ยกเลิกฉบับร่างใบสุดท้ายแล้ว ต้องเพิ่ม flow ยกเลิกการจองและตรวจ sibling ที่เกี่ยวข้องก่อนคืนห้อง
8. **[P2] หน้าบิล Agent ซ่อนข้อมูลเมื่อไม่มี active lease** — `TenantBillsBody.tsx` return ก่อน render บิลค้าง/ประวัติเมื่อ leaseActive เป็น false หลังปิดสัญญา API บิลเดิมยังรองรับการชำระ แต่หน้าจอนี้เข้าถึงไม่ได้

9. **[P2] สถานะ occupancy ยังไม่เดินตามสัญญา** — การสร้าง PDF เปลี่ยน lease/renewal เป็น active แต่ยังไม่มีการเปลี่ยน room_tenancies จาก prospect เป็น active เมื่อเริ่มเข้าพัก ในโค้ดที่ตรวจจึงยังไม่มีขั้นตอนให้ continuous renewal ใช้ active occupancy ตามที่ตั้งใจ และ move-in date ของ occupancy อาจว่าง

ข้อจำกัดที่ตั้งใจในโค้ดปัจจุบัน: ไม่มี job ปิดครบกำหนดอัตโนมัติ, ไม่ออกบิลที่ไม่เคยสร้างย้อนหลังหลังพ้น grace window และยังไม่มี API ปรับยอดบิล/คืนเงิน/settlement UI งานเหล่านี้ต้องทำต่อเพื่อให้ flow บัญชีใช้งานครบ

## การตรวจสอบ

- Agent API regression: 127 tests ผ่าน (รวม closure/auth และ historical document guards)
- Billing: 16 tests ผ่าน รวม concurrent return/confirmation และจ่ายหนี้หลังปิดสัญญา
- Consumer components/helpers และ listing helpers: 92 tests ผ่าน
- Listing/share-link/schema regression: 13 tests ผ่าน
- PostgreSQL closure integration: 1 test ผ่าน ใช้ migration จริงใน schema ชั่วคราว
- รวม 249 tests ผ่าน; API build, TypeScript check และ `git diff --check`: ผ่าน
- Consumer TypeScript check เดิมยังมี error ใน AgentRoomEditor และ MobileCreateListingWizardBody นอกงานนี้ ไม่มีการแก้โค้ดสองส่วนนี้

ไม่ได้ทดสอบกด UI บนอุปกรณ์จริง และไม่ได้ deploy หรือ apply migration ลง schema ที่ใช้งานจริง
