-- NESTYK master catalogs + agreement templates
-- Dumped from local docker (2026-10-14) with pg_dump --data-only --column-inserts.
-- Load with `npm run db:seed -w @nestyk/api -- <file>`: runs in one transaction with
-- session_replication_role = replica (circular FKs, triggers off) and replaces {{SUPABASE_URL}} with SUPABASE_URL.
-- Meant for an empty schema right after the baseline migration; rows keep their original ids.

SET session_replication_role = replica;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: master_agreement_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_agreement_types (id, code, name_th, name_en, icon, form_kind, sort_order, is_active) VALUES
	(1, 'reservation', 'หนังสือจองห้อง', 'Room reservation agreement', 'calendar', 'reservation', 10, true),
	(2, 'lease', 'สัญญาเช่า', 'Lease agreement', 'key', 'lease', 20, true),
	(3, 'broker_appointment', 'สัญญาแต่งตั้งนายหน้า', 'Broker appointment agreement', 'handshake', 'broker_appointment', 15, true),
	(4, 'lease_renewal', 'หนังสือต่อสัญญาเช่า', 'Lease renewal addendum', 'key', 'renewal', 25, true);


--
-- Data for Name: agreement_templates; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.agreement_templates (id, agreement_type_code, version, name, form_kind, data_schema, document_template_key, is_active) VALUES
	(10, 'lease_renewal', 1, 'หนังสือต่อสัญญาเช่า', 'renewal', '{"type": "object", "required": ["startDate", "endDate", "monthlyRent", "deposit"], "properties": {"deposit": {"type": "number"}, "endDate": {"type": "string"}, "startDate": {"type": "string"}, "monthlyRent": {"type": "number"}, "leaseRenewal": {"type": "object"}}, "additionalProperties": false}', 'lease_renewal/v1', true),
	(2, 'lease', 1, 'สัญญาเช่า', 'lease', '{"type": "object", "required": ["startDate", "endDate", "monthlyRent", "deposit"], "properties": {"deposit": {"type": "number", "minimum": 0}, "endDate": {"type": "string"}, "startDate": {"type": "string"}, "monthlyRent": {"type": "number", "exclusiveMinimum": 0}}, "additionalProperties": false}', NULL, false),
	(3, 'lease', 2, 'สัญญาเช่า', 'lease', '{"type": "object", "required": ["startDate", "endDate", "monthlyRent", "deposit"], "properties": {"deposit": {"type": "number", "minimum": 0}, "endDate": {"type": "string"}, "startDate": {"type": "string"}, "monthlyRent": {"type": "number", "exclusiveMinimum": 0}}, "additionalProperties": false}', NULL, false),
	(6, 'broker_appointment', 1, 'สัญญาแต่งตั้งนายหน้า (สำหรับเช่า)', 'broker_appointment', '{"type": "object", "required": ["startDate"], "properties": {"startDate": {"type": "string"}, "brokerAppointment": {"type": "object"}}, "additionalProperties": false}', 'broker_appointment/v1', true),
	(7, 'reservation', 3, 'หนังสือจองเช่าที่อยู่อาศัย', 'reservation', '{"type": "object", "required": ["startDate", "moveInDate", "reservationFee"], "properties": {"startDate": {"type": "string"}, "moveInDate": {"type": "string"}, "reservationFee": {"type": "number", "minimum": 0}, "reservationLetter": {"type": "object"}}, "additionalProperties": false}', 'reservation/letter-v1', true),
	(1, 'reservation', 1, 'หนังสือจองห้อง', 'reservation', '{"type": "object", "required": ["startDate", "moveInDate", "reservationFee"], "properties": {"startDate": {"type": "string"}, "moveInDate": {"type": "string"}, "reservationFee": {"type": "number", "minimum": 0}}, "additionalProperties": false}', 'reservation/mock-v2', false),
	(5, 'reservation', 2, 'หนังสือจองห้อง', 'reservation', '{"type": "object", "required": ["startDate", "moveInDate", "reservationFee"], "properties": {"startDate": {"type": "string"}, "moveInDate": {"type": "string"}, "reservationFee": {"type": "number", "minimum": 0}}, "additionalProperties": false}', 'reservation/mock-v2', false),
	(4, 'lease', 3, 'สัญญาเช่า', 'lease', '{"type": "object", "required": ["startDate", "endDate", "monthlyRent", "deposit"], "properties": {"deposit": {"type": "number", "minimum": 0}, "endDate": {"type": "string"}, "startDate": {"type": "string"}, "monthlyRent": {"type": "number", "exclusiveMinimum": 0}}, "additionalProperties": false}', NULL, false),
	(9, 'lease', 5, 'สัญญาเช่าเพื่ออยู่อาศัย', 'lease', '{"type": "object", "required": ["startDate", "endDate", "monthlyRent", "deposit"], "properties": {"deposit": {"type": "number", "minimum": 0}, "endDate": {"type": "string"}, "startDate": {"type": "string"}, "monthlyRent": {"type": "number", "exclusiveMinimum": 0}, "leaseAgreement": {"type": "object"}}, "additionalProperties": false}', 'lease/v1', true),
	(8, 'lease', 4, 'สัญญาเช่าเพื่ออยู่อาศัย', 'lease', '{"type": "object", "required": ["startDate", "endDate", "monthlyRent", "deposit"], "properties": {"deposit": {"type": "number", "minimum": 0}, "endDate": {"type": "string"}, "startDate": {"type": "string"}, "monthlyRent": {"type": "number", "exclusiveMinimum": 0}, "leaseAgreement": {"type": "object"}}, "additionalProperties": false}', 'lease/v1', false);


--
-- Data for Name: master_document_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_document_types (code, name_th, is_active) VALUES
	('national_id', 'สำเนาบัตรประชาชน', true),
	('passport', 'สำเนาพาสปอร์ต', true),
	('ownership_proof', 'เอกสารแสดงกรรมสิทธิ์ห้อง', true),
	('power_of_attorney', 'หนังสือมอบอำนาจ', true),
	('other', 'เอกสารประกอบอื่น', true),
	('payment_proof', 'หลักฐานการจ่ายเงิน', true),
	('agent_commission_agreement', 'ข้อตกลงแบ่งค่าคอมมิชชั่นระหว่างเอเจนท์', true),
	('lease_annex_1', 'เอกสารแนบท้าย 1', true),
	('lease_annex_2', 'เอกสารแนบท้าย 2', true);


--
-- Data for Name: agreement_template_document_requirements; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.agreement_template_document_requirements (id, template_id, group_key, label, subject, document_type_code) VALUES
	(1, 3, 'tenant_identity', 'ยืนยันตัวตนผู้เช่า', 'tenant', 'national_id'),
	(2, 3, 'tenant_identity', 'ยืนยันตัวตนผู้เช่า', 'tenant', 'passport'),
	(3, 3, 'owner_identity', 'ยืนยันตัวตนผู้ให้เช่า', 'owner', 'national_id'),
	(4, 3, 'owner_identity', 'ยืนยันตัวตนผู้ให้เช่า', 'owner', 'passport'),
	(5, 3, 'ownership', 'หลักฐานกรรมสิทธิ์ห้อง', 'property', 'ownership_proof'),
	(6, 4, 'owner_identity', 'ยืนยันตัวตนผู้ให้เช่า', 'owner', 'national_id'),
	(7, 4, 'owner_identity', 'ยืนยันตัวตนผู้ให้เช่า', 'owner', 'passport'),
	(8, 4, 'tenant_identity', 'ยืนยันตัวตนผู้เช่า', 'tenant', 'national_id'),
	(9, 4, 'tenant_identity', 'ยืนยันตัวตนผู้เช่า', 'tenant', 'passport'),
	(10, 5, 'ownership', 'หลักฐานกรรมสิทธิ์ห้อง', 'property', 'ownership_proof'),
	(11, 7, 'ownership', 'หลักฐานกรรมสิทธิ์ห้อง', 'property', 'ownership_proof'),
	(12, 8, 'owner_identity', 'ยืนยันตัวตนผู้ให้เช่า', 'owner', 'national_id'),
	(13, 8, 'owner_identity', 'ยืนยันตัวตนผู้ให้เช่า', 'owner', 'passport'),
	(14, 8, 'tenant_identity', 'ยืนยันตัวตนผู้เช่า', 'tenant', 'national_id'),
	(15, 8, 'tenant_identity', 'ยืนยันตัวตนผู้เช่า', 'tenant', 'passport'),
	(16, 9, 'owner_identity', 'ยืนยันตัวตนผู้ให้เช่า', 'owner', 'national_id'),
	(17, 9, 'owner_identity', 'ยืนยันตัวตนผู้ให้เช่า', 'owner', 'passport'),
	(18, 9, 'tenant_identity', 'ยืนยันตัวตนผู้เช่า', 'tenant', 'national_id'),
	(19, 9, 'tenant_identity', 'ยืนยันตัวตนผู้เช่า', 'tenant', 'passport'),
	(20, 9, 'lease_annex_1', 'เอกสารแนบท้าย 1', 'property', 'lease_annex_1'),
	(21, 9, 'lease_annex_2', 'เอกสารแนบท้าย 2', 'property', 'lease_annex_2');


--
-- Data for Name: master_contract_end_reasons; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_contract_end_reasons (id, code, name_th, name_en, applicable_status, default_deposit_policy, requires_note, sort_order, is_active) VALUES
	(1, 'term_completed', 'ครบกำหนดสัญญา', 'Term completed', 'expired', 'refund_after_deductions', false, 10, true),
	(2, 'non_payment', 'ค้างชำระค่าเช่า', 'Unpaid rent', 'terminated', 'refund_after_deductions', true, 20, true),
	(3, 'tenant_requested', 'ผู้เช่าขอยุติก่อนกำหนด', 'Early termination requested by tenant', 'terminated', 'manual_review', true, 30, true),
	(4, 'mutual_agreement', 'ทั้งสองฝ่ายตกลงยุติสัญญา', 'Termination by mutual agreement', 'terminated', 'manual_review', true, 40, true),
	(5, 'contract_breach', 'ผิดเงื่อนไขสัญญา', 'Contract breach', 'terminated', 'manual_review', true, 50, true),
	(6, 'other_termination', 'เหตุผลอื่นในการยุติสัญญา', 'Other termination reason', 'terminated', 'manual_review', true, 60, true),
	(7, 'draft_cancelled', 'ยกเลิกฉบับร่าง', 'Draft cancelled', 'cancelled', 'manual_review', true, 70, true);


--
-- Data for Name: master_contract_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_contract_types (id, code, term_months, sort_order, is_active) VALUES
	(1, 'monthly_12', 12, 1, true),
	(2, 'monthly_6', 6, 2, true),
	(3, 'monthly_3', 3, 3, true);


--
-- Data for Name: master_facilities_groups; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_facilities_groups (id, code, sort_order) VALUES
	(1, 'room', 100),
	(2, 'building', 100),
	(3, 'security', 100),
	(8, 'furniture', 10),
	(9, 'appliances', 20),
	(10, 'room_features', 30),
	(11, 'parking', 40),
	(12, 'project_facilities', 50),
	(13, 'security_services', 60),
	(4, 'popular', 1004),
	(5, 'in_room_home', 1005),
	(6, 'safety_security', 1006),
	(7, 'services_facilities', 1007);


--
-- Data for Name: master_facilities; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_facilities (id, group_id, code, sort_order, is_extra_charge) VALUES
	(1, 4, 'pop_05', 4, false),
	(2, 4, 'pop_04', 3, false),
	(3, 4, 'pop_02', 2, false),
	(4, 4, 'pop_03', 1, false),
	(5, 4, 'pop_01', 0, false),
	(6, 5, 'liv_09', 9, false),
	(7, 5, 'liv_08', 8, false),
	(8, 5, 'liv_06', 7, false),
	(9, 5, 'liv_05', 6, false),
	(10, 5, 'liv_04', 5, false),
	(11, 5, 'liv_03', 4, false),
	(12, 5, 'liv_02', 3, false),
	(13, 5, 'bed_04', 2, false),
	(14, 5, 'bed_02', 1, false),
	(15, 5, 'bed_01', 0, false),
	(16, 6, 'sec_06', 5, false),
	(17, 6, 'sec_05', 4, false),
	(18, 6, 'sec_04', 3, false),
	(19, 6, 'sec_03', 2, false),
	(20, 6, 'sec_02', 1, false),
	(21, 6, 'sec_01', 0, false),
	(22, 7, 'srv_09', 7, false),
	(23, 7, 'srv_08', 6, false),
	(24, 7, 'srv_07', 5, false),
	(25, 7, 'srv_06', 4, false),
	(26, 7, 'srv_05', 3, false),
	(27, 7, 'srv_04', 2, false),
	(28, 7, 'srv_01', 1, false),
	(29, 7, 'srv_02', 0, true),
	(30, 8, 'curtains', 8, false),
	(31, 8, 'storage_cabinet', 7, false),
	(32, 8, 'vanity_mirror', 6, false),
	(33, 8, 'desk', 5, false),
	(34, 8, 'dining_table', 4, false),
	(35, 8, 'tv_stand', 3, false),
	(36, 8, 'sofa', 2, false),
	(37, 8, 'wardrobe', 1, false),
	(38, 8, 'bed_mattress', 0, false),
	(39, 9, 'smart_home', 14, false),
	(40, 9, 'digital_door_lock', 13, false),
	(41, 9, 'water_filter', 12, false),
	(42, 9, 'range_hood', 11, false),
	(43, 9, 'gas_stove', 10, false),
	(44, 9, 'induction_stove', 9, false),
	(45, 9, 'water_heater', 8, false),
	(46, 9, 'dryer', 7, false),
	(47, 9, 'washing_machine', 6, false),
	(48, 9, 'microwave', 5, false),
	(49, 9, 'refrigerator', 4, false),
	(51, 9, 'tv', 2, false),
	(52, 9, 'fan', 1, false),
	(53, 9, 'air_conditioning', 0, false),
	(56, 10, 'storage_room', 7, false),
	(57, 10, 'drying_area', 6, false),
	(58, 10, 'mosquito_net', 5, false),
	(59, 10, 'balcony', 4, false),
	(60, 10, 'bathtub', 3, false),
	(62, 10, 'closed_kitchen', 1, false),
	(63, 10, 'open_kitchen', 0, false),
	(64, 11, 'private_ev_charger', 5, false),
	(65, 11, 'indoor_parking', 4, false),
	(66, 11, 'fixed_parking_slot', 3, false),
	(67, 11, 'bicycle_parking', 2, false),
	(68, 11, 'motorcycle_parking', 1, false),
	(69, 11, 'car_parking', 0, false),
	(70, 12, 'shared_ev_charger', 10, false),
	(71, 12, 'shuttle', 9, false),
	(72, 12, 'shared_laundry', 8, false),
	(73, 12, 'parcel_room', 7, false),
	(74, 12, 'playground', 6, false),
	(75, 12, 'cokitchen', 5, false),
	(76, 12, 'coworking', 4, false),
	(77, 12, 'shared_garden', 3, false),
	(78, 12, 'sauna', 2, false),
	(79, 12, 'gym', 1, false),
	(81, 13, 'pet_friendly', 7, false),
	(82, 13, 'housekeeping', 6, false),
	(83, 13, 'in_unit_internet', 5, false),
	(84, 13, 'fire_extinguisher', 4, false),
	(85, 13, 'smoke_detector', 3, false),
	(86, 13, 'cctv', 2, false),
	(87, 13, 'keycard_access', 1, false),
	(88, 13, 'security_24h', 0, false),
	(80, 12, 'shared_pool', 0, false);


--
-- Data for Name: master_layouts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_layouts (id, code) VALUES
	(1, 'bedroom'),
	(2, 'bathroom'),
	(3, 'room_size'),
	(4, 'floor'),
	(5, 'building');


--
-- Data for Name: master_listing_sources; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_listing_sources (id, code, sort_order, is_active) VALUES
	(1, 'co_agent', 1, true),
	(2, 'owner', 2, true);


--
-- Data for Name: master_property_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_property_types (id, code) VALUES
	(1, 'condo'),
	(2, 'apartment'),
	(3, 'house');


--
-- Data for Name: master_roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_roles (id, name, details) VALUES
	(1, 'guest', 'Default app identity — not a gated management mode'),
	(2, 'owner', 'Property owner mode — /owner'),
	(3, 'tenant', 'Tenant mode — /tenant'),
	(4, 'agent', 'Field agent mode — /agent'),
	(5, 'admin', 'Admin operations — /admin');


--
-- Data for Name: master_room_statuses; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_room_statuses (id, code) VALUES
	(1, 'available'),
	(2, 'rented'),
	(3, 'pending_verification'),
	(4, 'needs_edit');


--
-- Data for Name: master_room_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_room_types (id, code, bedroom_count, sort_order, is_active) VALUES
	(1, 'studio', 0, 1, true),
	(2, 'one_bedroom', 1, 2, true),
	(3, 'one_bedroom_plus', 1, 3, true),
	(4, 'two_bedroom', 2, 4, true),
	(5, 'three_bedroom', 3, 5, true),
	(6, 'four_bedroom', 4, 6, true),
	(7, 'duplex', NULL, 7, true),
	(8, 'penthouse', NULL, 8, true);


--
-- Data for Name: master_visa_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.master_visa_types (id, code, sort_order, is_active) VALUES
	(1, 'tourist', 1, true),
	(2, 'non_immigrant_b', 2, true),
	(3, 'non_immigrant_ed', 3, true),
	(4, 'non_immigrant_o', 4, true),
	(5, 'elite', 5, true),
	(6, 'ltr', 6, true),
	(7, 'dtv', 7, true),
	(8, 'other', 8, true);


--
-- Name: agreement_template_document_requirements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agreement_template_document_requirements_id_seq', 21, true);


--
-- Name: agreement_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agreement_templates_id_seq', 10, true);


--
-- Name: master_agreement_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_agreement_types_id_seq', 4, true);


--
-- Name: master_contract_end_reasons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

-- max(id), not a fixed 7: migration 20261014120000_contract_closure adds id 8 before this seed runs.
SELECT pg_catalog.setval('public.master_contract_end_reasons_id_seq', (SELECT max(id) FROM public.master_contract_end_reasons), true);


--
-- Name: master_contract_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_contract_types_id_seq', 3, true);


--
-- Name: master_facilities_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_facilities_groups_id_seq', 13, true);


--
-- Name: master_facilities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_facilities_id_seq', 89, true);


--
-- Name: master_layouts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_layouts_id_seq', 5, true);


--
-- Name: master_listing_sources_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_listing_sources_id_seq', 2, true);


--
-- Name: master_property_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_property_types_id_seq', 3, true);


--
-- Name: master_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_roles_id_seq', 5, true);


--
-- Name: master_room_statuses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_room_statuses_id_seq', 4, true);


--
-- Name: master_room_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_room_types_id_seq', 8, true);


--
-- Name: master_visa_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_visa_types_id_seq', 16, true);


--
-- PostgreSQL database dump complete
--



SET session_replication_role = origin;
