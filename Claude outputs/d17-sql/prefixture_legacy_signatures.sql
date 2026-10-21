-- ห้องทดลองเท่านั้น (Postgres ในเครื่องที่สร้างจาก baseline): ห้ามรันกับฐานข้อมูลของทีมหรือ Supabase
-- สัญญาที่มีลายเซ็นในคอลัมน์เดิม เพื่อทดสอบการคัดลอกใน 20261021120000_agreement_signatures.sql
-- ต้องรันก่อน migration และคงข้อมูลไว้ (COMMIT) เพราะ migration รันแยกอีกครั้ง
\set ON_ERROR_STOP 1
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.lease_contracts) THEN
    RAISE EXCEPTION 'prefixture: lease_contracts already has rows, this is not an empty lab database';
  END IF;
END $$;
INSERT INTO public.users (id, email) VALUES (8001, 'legacy-agent@lab.test');
INSERT INTO public.properties (id, name, address, district, province) VALUES (8001, 'Legacy Tower', '2 Lab Rd', 'Khlong Toei', 'Bangkok');
INSERT INTO public.rent_rooms (id, room_id, properties_id, room_status_id, owner_id) VALUES (8001, 'legacy-1', 8001, 1, 8001);
INSERT INTO public.leads (id, name, phone, created_by_user_id, status, rent_room_id) VALUES (8001, 'Legacy Lead', '+66810000001', 8001, 'booked', 8001);
INSERT INTO public.tenants (id, lead_id, name, phone, created_by_user_id) VALUES (8001, 8001, 'Legacy Tenant', '+66810000001', 8001);
INSERT INTO public.room_tenancies (id, rent_room_id, tenant_id, created_by_user_id) VALUES (8001, 8001, 8001, 8001);
-- 8001: ผู้ให้เช่าลงนาม 1 ตัว | 8002: ผู้ให้เช่า ผู้เช่า และนายหน้า (ไฟล์ต่างกันทุกฝ่าย)
-- 8003: นายหน้ามีเวลาลงนามแต่ไม่มีไฟล์ (ข้อมูลเก่าที่ไม่ครบ ยังต้องถูกคัดลอกเป็น legacy)
INSERT INTO public.lease_contracts (id, room_tenancy_id, rent_room_id, tenant_id, lead_id, created_by_user_id, start_date, template_id, agreement_type_code, status,
  owner_signed_at, owner_signature_url, tenant_signed_at, tenant_signature_url, agent_signed_at, agent_signature_url)
VALUES (8001, 8001, 8001, 8001, 8001, 8001, '2026-10-19', 6, 'broker_appointment', 'awaiting_signatures',
  '2026-10-19 10:00+07', 'legacy/owner.png', NULL, NULL, NULL, NULL),
       (8002, 8001, 8001, 8001, 8001, 8001, '2026-10-19', 7, 'reservation', 'awaiting_agent_review',
  '2026-10-19 11:00+07', 'legacy/owner2.png', '2026-10-19 11:05+07', 'legacy/tenant2.png', '2026-10-19 11:10+07', 'legacy/agent2.png'),
       (8003, 8001, 8001, 8001, 8001, 8001, '2026-10-19', 6, 'broker_appointment', 'awaiting_signatures',
  NULL, NULL, NULL, NULL, '2026-10-19 12:00+07', NULL);
COMMIT;
