-- ทดสอบ migration 20261021120000_agreement_signatures.sql ในห้องทดลอง (Postgres 16)
-- ห้องทดลองเท่านั้น: รันหลัง prefixture_legacy_signatures.sql และหลัง migration ทั้งไฟล์อยู่ใน transaction ที่ ROLLBACK ตอนจบ
-- แต่ละเคสบอกผลที่คาด: ok = ต้องบันทึกได้, reject = ฐานข้อมูลต้องปฏิเสธ
\set ON_ERROR_STOP 1
SET client_min_messages = warning;
BEGIN;

CREATE TEMP TABLE results (n int, name text, expect text, got text);
CREATE OR REPLACE FUNCTION pg_temp.try(n int, name text, expect text, stmt text) RETURNS void AS $$
DECLARE got text;
BEGIN
  BEGIN
    EXECUTE stmt;
    got := 'ok';
  EXCEPTION WHEN others THEN
    got := 'reject: ' || SQLERRM;
  END;
  INSERT INTO results VALUES (n, name, expect, got);
END $$ LANGUAGE plpgsql;

-- ข้อมูลตั้งต้น
INSERT INTO public.users (id, email) VALUES (9001, 'agent@lab.test'), (9002, 'owner@lab.test'), (9003, 'tenant@lab.test'), (9004, 'owner-signer@lab.test');
INSERT INTO public.properties (id, name, address, district, province) VALUES (9001, 'Lab Tower', '1 Lab Rd', 'Khlong Toei', 'Bangkok');
INSERT INTO public.rent_rooms (id, room_id, properties_id, room_status_id, owner_id) VALUES (9001, 'lab-1', 9001, 1, 9002);
INSERT INTO public.leads (id, name, phone, created_by_user_id, status, rent_room_id) VALUES (9001, 'Lab Lead', '+66812345678', 9001, 'booked', 9001);
INSERT INTO public.tenants (id, lead_id, name, phone, created_by_user_id) VALUES (9001, 9001, 'Lab Tenant', '+66812345678', 9001);
UPDATE public.leads SET tenant_id = 9001 WHERE id = 9001;
INSERT INTO public.room_tenancies (id, rent_room_id, tenant_id, created_by_user_id) VALUES (9001, 9001, 9001, 9001);
INSERT INTO public.lease_contracts (id, room_tenancy_id, rent_room_id, tenant_id, lead_id, created_by_user_id, start_date, template_id, agreement_type_code)
VALUES (9002, 9001, 9001, 9001, 9001, 9001, '2026-11-01', 9, 'lease');
INSERT INTO public.agreement_sign_invites (id, agreement_id, party, token_hash, expires_at, created_by_user_id)
VALUES (9001, 9002, 'tenant', repeat('a', 64), now() + interval '1 day', 9001);

-- การคัดลอกลายเซ็นเดิม (prefixture: 8001 ผู้ให้เช่า 1 ตัว, 8002 ครบ 3 ฝ่าย, 8003 นายหน้ามีเวลาแต่ไม่มีไฟล์)
SELECT pg_temp.try(1, 'คัดลอกครบ 5 ตัว ตรงฝ่าย ไฟล์ และเวลา', 'ok', $q$DO $d$ BEGIN
  IF (SELECT count(*) FROM public.agreement_signatures WHERE channel = 'legacy') <> 5 THEN RAISE EXCEPTION 'expected 5 legacy rows'; END IF;
  IF (SELECT signature_url FROM public.agreement_signatures WHERE agreement_id = 8002 AND party = 'agent') IS DISTINCT FROM 'legacy/agent2.png' THEN RAISE EXCEPTION 'agent file not copied from the agent column'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agreement_signatures WHERE agreement_id = 8003 AND party = 'agent' AND signature_url IS NULL) THEN RAISE EXCEPTION 'signature without file not copied'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.lease_contracts c
    CROSS JOIN LATERAL (VALUES ('owner', c.owner_signed_at, c.owner_signature_url), ('tenant', c.tenant_signed_at, c.tenant_signature_url), ('agent', c.agent_signed_at, c.agent_signature_url)) p(party, at, url)
    WHERE p.at IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.agreement_signatures s WHERE s.agreement_id = c.id AND s.party = p.party AND s.signed_at = p.at AND s.signature_url IS NOT DISTINCT FROM p.url AND s.voided_at IS NULL))
  THEN RAISE EXCEPTION 'a legacy signature was not copied'; END IF;
END $d$$q$);

-- ช่องทางและหลักฐาน
SELECT pg_temp.try(2, 'ลงในแอป มีรูปลายเซ็นและผู้กด', 'ok', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, signed_by_user_id, signature_url) VALUES (9002, 'owner', 'app', 9002, 'x/owner.png')$q$);
SELECT pg_temp.try(3, 'ฝ่ายเดิมลงซ้ำโดยไม่ยกเลิกแถวเดิม', 'reject:uq_agreement_signatures_live_party', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, signed_by_user_id, signature_url) VALUES (9002, 'owner', 'app', 9002, 'x/owner2.png')$q$);
SELECT pg_temp.try(4, 'ยกเลิกแถวเดิมแล้วลงใหม่ได้', 'ok', $q$UPDATE public.agreement_signatures SET voided_at = now() WHERE agreement_id = 9002 AND party = 'owner'; INSERT INTO public.agreement_signatures (agreement_id, party, channel, signed_by_user_id, signature_url) VALUES (9002, 'owner', 'app', 9004, 'x/owner3.png')$q$);
SELECT pg_temp.try(5, 'ลงผ่านลิงก์โดยไม่อ้างลิงก์', 'reject:chk_agreement_signatures_link', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, signature_url) VALUES (9002, 'tenant', 'link', 'x/tenant.png')$q$);
SELECT pg_temp.try(6, 'ลงผ่านลิงก์พร้อมอ้างลิงก์', 'ok', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, sign_invite_id, signature_url) VALUES (9002, 'tenant', 'link', 9001, 'x/tenant.png')$q$);
SELECT pg_temp.try(7, 'นายหน้ากดแทนแต่ไม่มีรูปลายเซ็น', 'reject:chk_agreement_signatures_evidence', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, signed_by_user_id) VALUES (9002, 'agent', 'on_site', 9001)$q$);
SELECT pg_temp.try(8, 'แนบไฟล์โดยไม่อ้างไฟล์', 'reject:chk_agreement_signatures_evidence', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, signed_by_user_id) VALUES (9002, 'agent', 'uploaded_file', 9001)$q$);
SELECT pg_temp.try(9, 'ช่องทางที่ไม่รู้จัก', 'reject:chk_agreement_signatures_channel', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, signature_url) VALUES (9002, 'agent', 'email', 'x/a.png')$q$);
SELECT pg_temp.try(10, 'ฝ่ายที่ไม่รู้จัก', 'reject:chk_agreement_signatures_party', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, signature_url) VALUES (9002, 'broker', 'app', 'x/a.png')$q$);
SELECT pg_temp.try(11, 'ไม่ระบุสัญญา', 'reject:not-null', $q$INSERT INTO public.agreement_signatures (party, channel, signature_url) VALUES ('agent', 'app', 'x/a.png')$q$);
SELECT pg_temp.try(12, 'legacy ของพยาน (ของเดิมไม่มีพยาน)', 'reject:chk_agreement_signatures_legacy', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, signer_name) VALUES (9002, 'witness', 'legacy', 'A')$q$);
-- พยาน (D9)
SELECT pg_temp.try(13, 'พยานไม่มีบัญชีและไม่มีชื่อ', 'reject:chk_agreement_signatures_witness_name', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, signer_name, signature_url) VALUES (9002, 'witness', 'on_site', '  ', 'x/w.png')$q$);
SELECT pg_temp.try(14, 'พยานไม่มีบัญชีแต่มีชื่อ', 'ok', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, signer_name, signature_url) VALUES (9002, 'witness', 'on_site', 'Witness A', 'x/w.png')$q$);
SELECT pg_temp.try(15, 'นายหน้าเป็นพยาน (มีบัญชี ไม่ใส่ชื่อ)', 'ok', $q$UPDATE public.agreement_signatures SET voided_at = now() WHERE agreement_id = 9002 AND party = 'witness'; INSERT INTO public.agreement_signatures (agreement_id, party, channel, signed_by_user_id, signature_url) VALUES (9002, 'witness', 'app', 9001, 'x/w2.png')$q$);
-- ความสัมพันธ์
SELECT pg_temp.try(16, 'ลบสัญญาที่มีบันทึกการลงนาม', 'reject:agreement_signatures_agreement_id_fkey', $q$DELETE FROM public.lease_contracts WHERE id = 9002$q$);
SELECT pg_temp.try(17, 'ลบผู้ใช้ที่เคยกด ประวัติยังอยู่ (ผู้กดเป็นค่าว่าง)', 'ok', $q$DO $d$ BEGIN
  DELETE FROM public.users WHERE id = 9004;
  IF NOT EXISTS (SELECT 1 FROM public.agreement_signatures WHERE agreement_id = 9002 AND party = 'owner' AND voided_at IS NULL AND signed_by_user_id IS NULL) THEN RAISE EXCEPTION 'row lost'; END IF;
END $d$$q$);
SELECT pg_temp.try(19, 'พยานคนที่ 2 ที่ยังใช้ได้ (ด่านครั้งเดียว)', 'reject:uq_agreement_signatures_live_party', $q$INSERT INTO public.agreement_signatures (agreement_id, party, channel, signer_name, signature_url) VALUES (9002, 'witness', 'on_site', 'Witness B', 'x/w3.png')$q$);
SELECT pg_temp.try(18, 'เปิด RLS', 'ok', $q$DO $d$ BEGIN IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.agreement_signatures'::regclass) THEN RAISE EXCEPTION 'rls off'; END IF; END $d$$q$);

SELECT n, name, expect, got,
       CASE WHEN (expect = 'ok' AND got = 'ok') OR (expect = 'reject' AND got LIKE 'reject%') OR (expect LIKE 'reject:%' AND got LIKE 'reject%' AND strpos(got, substr(expect, 8)) > 0) THEN 'PASS' ELSE 'FAIL' END AS result
FROM results ORDER BY n;
SELECT count(*) FILTER (WHERE (expect = 'ok' AND got = 'ok') OR (expect = 'reject' AND got LIKE 'reject%') OR (expect LIKE 'reject:%' AND got LIKE 'reject%' AND strpos(got, substr(expect, 8)) > 0)) AS pass, count(*) AS total FROM results;
ROLLBACK;
