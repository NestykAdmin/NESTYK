-- NESTYK demo data (dev only): users, rooms, leads, tenants
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
-- Data for Name: properties; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.properties (id, name, property_type_id, address, subdistrict, district, province, postal_code, latitude, longitude, created_at, updated_at) VALUES
	(1, 'DEMO · The Line Asoke', 1, '123 Sukhumvit 21', 'Khlong Toei Nuea', 'Watthana', 'Bangkok', '10110', 13.7382000, 100.5605000, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00'),
	(2, 'DEMO · Noble Around Ari', 1, '88 Phahonyothin Rd', 'Samsen Nai', 'Phaya Thai', 'Bangkok', '10400', 13.7796000, 100.5446000, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00'),
	(3, 'DEMO · Dcondo Nimman', 1, '15 Nimmanhaemin Rd', 'Su Thep', 'Mueang Chiang Mai', 'Chiang Mai', '50200', 18.7961000, 98.9676000, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00'),
	(4, 'DEMO · Ideo Q Thonglor', 1, '55 Sukhumvit 55', 'Khlong Tan Nuea', 'Watthana', 'Bangkok', '10110', 13.7308000, 100.5821000, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00'),
	(5, 'DEMO · Rhythm On Nut', 1, '99 Sukhumvit 77', 'Suan Luang', 'Suan Luang', 'Bangkok', '10250', 13.7054000, 100.6012000, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00'),
	(6, 'DEMO · The Room Phrom Phong', 1, '12 Sukhumvit 31', 'Khlong Tan Nuea', 'Watthana', 'Bangkok', '10110', 13.7331000, 100.5698000, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00'),
	(7, 'DEMO · Ashton Silom', 1, '8 Silom Rd', 'Suriyawong', 'Bang Rak', 'Bangkok', '10500', 13.7264000, 100.5236000, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00'),
	(8, 'DEMO · Life Asoke Hype', 1, '7 Rama IX Rd', 'Huai Khwang', 'Huai Khwang', 'Bangkok', '10310', 13.7579000, 100.5642000, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00'),
	(9, 'DEMO · Aspire Rama 9', 1, '33 Rama IX Rd', 'Bang Kapi', 'Huai Khwang', 'Bangkok', '10310', 13.7498000, 100.5945000, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00'),
	(10, 'DEMO · Supalai Monte Chiang Mai', 1, '21 Chang Khlan Rd', 'Chang Khlan', 'Mueang Chiang Mai', 'Chiang Mai', '50100', 18.7852000, 98.9998000, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00'),
	(11, 'THE LINE Phahon-Pradipat', 1, 'Thanon Pradiphat', '-', 'Phaya Thai', 'Krung Thep Maha Nakhon', '10400', 13.7908656, 100.5461123, '2026-09-16 04:29:15.991104+00', '2026-09-16 04:29:15.991104+00'),
	(12, 'Wind Sukhumvit 23', 1, '136 ซอย สุขุมวิท 23', 'แขวงคลองเตยเหนือ', 'เขตวัฒนา', 'กรุงเทพมหานคร', '10110', 13.7397985, 100.5644289, '2026-09-17 06:56:56.44971+00', '2026-09-17 06:56:56.44971+00'),
	(13, 'DEMO · The Esse Asoke', 1, '9 Sukhumvit 21', 'คลองเตยเหนือ', 'วัฒนา', 'กรุงเทพมหานคร', '10110', 13.7390000, 100.5620000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(14, 'DEMO · Lumpini Suite Sathorn', 1, '22 Sathorn Soi 1', 'ทุ่งมหาเมฆ', 'สาทร', 'กรุงเทพมหานคร', '10120', 13.7240000, 100.5430000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(15, 'DEMO · Park 24', 1, '24 Sukhumvit 24', 'คลองตัน', 'คลองเตย', 'กรุงเทพมหานคร', '10110', 13.7220000, 100.5690000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(16, 'DEMO · Happyland Bangkapi', 3, '88 Happyland Rd', 'คลองจั่น', 'บางกะปิ', 'กรุงเทพมหานคร', '10240', 13.7700000, 100.6420000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(17, 'DEMO · Ramkhamhaeng Residence', 1, '150 Ramkhamhaeng Rd', 'หัวหมาก', 'บางกะปิ', 'กรุงเทพมหานคร', '10240', 13.7560000, 100.6120000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(18, 'DEMO · Edge Sukhumvit 23', 1, '23 Sukhumvit 23', 'คลองเตยเหนือ', 'วัฒนา', 'กรุงเทพมหานคร', '10110', 13.7410000, 100.5640000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(19, 'DEMO · Siamese Exclusive 31', 1, '31 Sukhumvit 31', 'คลองเตยเหนือ', 'วัฒนา', 'กรุงเทพมหานคร', '10110', 13.7345000, 100.5665000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(20, 'DEMO · Park Origin Phrom Phong', 1, '1 Sukhumvit 24', 'คลองตัน', 'คลองเตย', 'กรุงเทพมหานคร', '10110', 13.7300000, 100.5710000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(21, 'DEMO · Noble Ploenchit', 1, '888 Ploenchit Rd', 'ลุมพินี', 'ปทุมวัน', 'กรุงเทพมหานคร', '10330', 13.7430000, 100.5480000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(22, 'DEMO · Rhythm Ekkamai', 1, '63 Sukhumvit 63', 'คลองตันเหนือ', 'วัฒนา', 'กรุงเทพมหานคร', '10110', 13.7200000, 100.5880000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(23, 'DEMO · Ideo Mobi Sukhumvit', 1, '77 Sukhumvit 77', 'พระโขนงเหนือ', 'วัฒนา', 'กรุงเทพมหานคร', '10110', 13.7050000, 100.6000000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(24, 'DEMO · Ideo Rama 9 - Asoke', 1, '2 Rama IX Rd', 'ห้วยขวาง', 'ห้วยขวาง', 'กรุงเทพมหานคร', '10310', 13.7560000, 100.5660000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(25, 'DEMO · The Mall Residence Bangkapi', 1, '3522 Lat Phrao Rd', 'คลองจั่น', 'บางกะปิ', 'กรุงเทพมหานคร', '10240', 13.7660000, 100.6470000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(26, 'DEMO · Saladaeng One', 1, '1 Sala Daeng Rd', 'สีลม', 'บางรัก', 'กรุงเทพมหานคร', '10500', 13.7285000, 100.5390000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(27, 'DEMO · 98 Wireless', 1, '98 Wireless Rd', 'ลุมพินี', 'ปทุมวัน', 'กรุงเทพมหานคร', '10330', 13.7400000, 100.5480000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(28, 'DEMO · The Lofts Asoke', 1, '1 Asoke-Din Daeng Rd', 'มักกะสัน', 'ราชเทวี', 'กรุงเทพมหานคร', '10400', 13.7420000, 100.5610000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(29, 'DEMO · Circle Living Prototype', 1, '36 New Petchburi Rd', 'มักกะสัน', 'ราชเทวี', 'กรุงเทพมหานคร', '10400', 13.7500000, 100.5530000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(30, 'DEMO · Ideo Mobi Bangna', 1, '9 Bangna-Trad Rd', 'บางนา', 'บางนา', 'กรุงเทพมหานคร', '10260', 13.6680000, 100.6050000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(31, 'DEMO · Ideo Q Ari', 1, '1 Phahonyothin 7', 'สามเสนใน', 'พญาไท', 'กรุงเทพมหานคร', '10400', 13.7810000, 100.5440000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00'),
	(32, 'DEMO · Chaengwattana Condo', 1, '120 Chaeng Watthana Rd', 'ทุ่งสองห้อง', 'หลักสี่', 'กรุงเทพมหานคร', '10210', 13.9000000, 100.5300000, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users (id, supabase_user_id, email, password, first_name, last_name, phone, avatar_url, profile_completed, created_at, identity_number, nationality) VALUES
	(1, '00000000-0000-4000-8000-000000000001', 'admin@jitsamrit.com', NULL, 'Admin', 'Jitsamrit', NULL, NULL, true, '2026-09-11 09:23:32.479086+00', NULL, NULL),
	(2, '22222222-2222-4222-8222-222222222222', 'agent-promo@nestyk.local', NULL, 'Agent', 'Dev', NULL, NULL, false, '2026-09-21 04:40:42.709137+00', NULL, NULL),
	(3, '00000000-0000-4000-8000-000000000099', 'enhance-test@nestyk.local', NULL, 'Agent', 'Dev', NULL, NULL, false, '2026-09-21 10:10:20.264487+00', NULL, NULL);


--
-- Data for Name: property_owners; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.property_owners (id, name, phone, email, note, created_by_user_id, user_id, created_at) VALUES
	(1, 'คุณสมชาย DEMO', '0811111111', 'somchai.demo@example.com', '[DEMO_SEED] Bangkok owner A', 1, NULL, '2026-09-11 09:23:32.968704+00'),
	(2, 'คุณมาลี DEMO', '0822222222', 'malee.demo@example.com', '[DEMO_SEED] Bangkok owner B', 1, NULL, '2026-09-11 09:23:32.968704+00'),
	(3, 'คุณวิชัย DEMO', '0833333333', 'wichai.demo@example.com', '[DEMO_SEED] CNX / outer BKK', 1, NULL, '2026-09-11 09:23:32.968704+00');


--
-- Data for Name: rent_rooms; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.rent_rooms (id, room_id, listing_title, listing_description, available_from_date, prices, custom_facilities, latitude, longitude, nearby_other, nearby_places, water_rate_per_unit, electric_rate_per_unit, advance_rent_months, deposit_months, owner_identity_number, owner_bank_name, owner_bank_account, is_scout_room, visibility, created_by_user_id, property_owner_id, owner_id, properties_id, room_type_id, listing_source_id, room_status_id, view_count, last_viewed_at, created_at, updated_at, promo_title) VALUES
	(2, 'demo-agent-2', 'DEMO · Ari 1BR with pool', 'One bedroom with building pool access. [DEMO_SEED]', '2026-09-18', '[{"code": "monthly_12", "price": 26000, "contractTypeId": 1}]', '[]', 13.7796000, 100.5446000, NULL, '[]', 20.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 2, NULL, 2, 2, 2, 4, 0, NULL, '2026-09-11 09:23:32.968704+00', '2026-09-14 09:03:45.308664+00', NULL),
	(3, 'demo-agent-3', 'DEMO · Nimman 2BR private', 'Private scout listing — not on guest search. [DEMO_SEED]', '2026-09-25', '[{"code": "monthly_12", "price": 22000, "contractTypeId": 1}]', '[]', 18.7961000, 98.9676000, NULL, '[]', 15.00, 5.00, 1, 1, NULL, NULL, NULL, true, 'private', 1, 3, NULL, 3, 4, 1, 3, 0, NULL, '2026-09-11 09:23:32.968704+00', '2026-09-14 09:03:45.30992+00', NULL),
	(16, 'demo-agent-14', 'DEMO · Happyland Bangkapi 3BR', 'ทาวน์โฮม 3 ห้องนอน เหมาะครอบครัว สัญญาสั้น 6 หรือ 3 เดือนเท่านั้น [DEMO_SEED]', '2026-09-25', '[{"price": 26000, "depositMonths": 2, "contractTypeId": 2, "contractTypeCode": "monthly_6", "advanceRentMonths": 1}, {"price": 28000, "depositMonths": 2, "contractTypeId": 3, "contractTypeCode": "monthly_3", "advanceRentMonths": 1}]', '["The Mall บางกะปิ"]', 13.7700000, 100.6420000, NULL, '[]', 18.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 3, NULL, 16, 5, 2, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'บ้านเดี่ยว Happyland 3 ห้องนอน ใกล้ The Mall บางกะปิ'),
	(17, 'demo-agent-15', 'DEMO · Ramkhamhaeng Residence 3BR', 'ห้องกว้าง 3 ห้องนอน ราคาคุ้ม ใกล้ ม.รามคำแหง / Airport Link รามคำแหง [DEMO_SEED]', '2026-10-16', '[{"price": 24000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '[]', 13.7560000, 100.6120000, NULL, '[]', 17.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 3, NULL, 17, 5, 1, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Ramkhamhaeng Residence 3 ห้องนอน ใกล้ ม.รามคำแหง'),
	(18, 'demo-agent-16', 'DEMO · Edge Sukhumvit 23 2BR', 'ห้อง 2 ห้องนอนแต่งใหม่ ใกล้ BTS อโศก / MRT สุขุมวิท รับสัญญา 12 หรือ 6 เดือน [DEMO_SEED]', '2026-09-30', '[{"price": 27000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}, {"price": 29000, "depositMonths": 2, "contractTypeId": 2, "contractTypeCode": "monthly_6", "advanceRentMonths": 1}]', '["Srinakharinwirot Univ."]', 13.7410000, 100.5640000, NULL, '[]', 18.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 1, NULL, 18, 4, 1, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Edge Sukhumvit 23 2 ห้องนอน ใกล้ MRT สุขุมวิท'),
	(1, 'demo-agent-1', 'DEMO · Asoke Studio near BTS', 'Bright studio, co-agent listing near Asoke. [DEMO_SEED]', '2026-09-11', '[{"code": "monthly_12", "price": 18000, "contractTypeId": 1}]', '[]', 13.7382000, 100.5605000, NULL, '[]', 18.00, 6.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 1, NULL, 1, 1, 2, 1, 0, NULL, '2026-09-11 09:23:32.968704+00', '2026-09-14 09:03:45.305107+00', NULL),
	(4, 'demo-agent-4', 'DEMO · Thonglor 1BR loft', 'Loft-style 1BR steps from Ekkamai. [DEMO_SEED]', '2026-09-14', '[{"code": "monthly_12", "price": 32000, "contractTypeId": 1}]', '[]', 13.7308000, 100.5821000, NULL, '[]', 22.00, 8.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 1, NULL, 4, 2, 2, 1, 0, NULL, '2026-09-11 09:23:32.968704+00', '2026-09-14 09:03:45.311101+00', NULL),
	(5, 'demo-agent-5', 'DEMO · On Nut Studio value', 'Affordable studio near Airport Link. [DEMO_SEED]', '2026-09-21', '[{"code": "monthly_12", "price": 14000, "contractTypeId": 1}]', '[]', 13.7054000, 100.6012000, NULL, '[]', 16.00, 5.00, 1, 1, NULL, NULL, NULL, true, 'published', 1, 2, NULL, 5, 1, 2, 1, 0, NULL, '2026-09-11 09:23:32.968704+00', '2026-09-14 09:03:45.311997+00', NULL),
	(6, 'demo-agent-6', 'DEMO · Phrom Phong 2BR family', 'Spacious 2BR for couple / small family. [DEMO_SEED]', '2026-09-16', '[{"code": "monthly_12", "price": 45000, "contractTypeId": 1}]', '[]', 13.7331000, 100.5698000, NULL, '[]', 25.00, 8.00, 2, 2, NULL, NULL, NULL, true, 'published', 1, 1, NULL, 6, 4, 1, 1, 0, NULL, '2026-09-11 09:23:32.968704+00', '2026-09-14 09:03:45.312883+00', NULL),
	(7, 'demo-agent-7', 'DEMO · Silom 1BR CBD', 'City-view 1BR near BTS Sala Daeng. [DEMO_SEED]', '2026-09-13', '[{"code": "monthly_12", "price": 28000, "contractTypeId": 1}]', '[]', 13.7264000, 100.5236000, NULL, '[]', 20.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 2, NULL, 7, 2, 1, 3, 0, NULL, '2026-09-11 09:23:32.968704+00', '2026-09-14 09:03:45.313494+00', NULL),
	(8, 'demo-agent-8', 'DEMO · Asoke Hype Studio', 'New studio near MRT Rama 9 / Central. [DEMO_SEED]', '2026-09-12', '[{"code": "monthly_12", "price": 21000, "contractTypeId": 1}]', '[]', 13.7579000, 100.5642000, NULL, '[]', 18.00, 6.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 3, NULL, 8, 1, 1, 2, 0, NULL, '2026-09-11 09:23:32.968704+00', '2026-09-14 09:03:45.314281+00', NULL),
	(9, 'demo-agent-9', 'DEMO · Rama 9 1BR private', 'Private listing near Airport Link Makkasan. [DEMO_SEED]', '2026-10-02', '[{"code": "monthly_12", "price": 24000, "contractTypeId": 1}]', '[]', 13.7498000, 100.5945000, NULL, '[]', 18.00, 6.00, 1, 2, NULL, NULL, NULL, true, 'private', 1, 3, NULL, 9, 2, 1, 2, 0, NULL, '2026-09-11 09:23:32.968704+00', '2026-09-14 09:03:45.315069+00', NULL),
	(10, 'demo-agent-10', 'DEMO · Night Bazaar 2BR', 'Chiang Mai 2BR near Night Bazaar / Ping River. [DEMO_SEED]', '2026-10-11', '[{"price": 19000, "contractTypeId": 1, "contractTypeCode": "monthly_12"}]', '[]', 18.7852000, 98.9998000, '', '[]', 15.00, 5.00, 1, 1, NULL, NULL, NULL, true, 'published', 1, NULL, NULL, 10, 4, 2, 1, 0, NULL, '2026-09-11 09:23:32.968704+00', '2026-09-14 09:03:45.315744+00', NULL),
	(11, NULL, 'Test', '', '2026-09-16', '[{"price": 20000, "depositMonths": 2, "contractTypeId": 2, "contractTypeCode": "monthly_6", "advanceRentMonths": 1}, {"price": 15000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '[]', 13.7908656, 100.5461123, '', '[]', NULL, NULL, 1, 2, NULL, NULL, NULL, true, 'private', 1, NULL, NULL, 11, 4, 2, 1, 0, NULL, '2026-09-16 04:29:15.991104+00', '2026-09-16 09:37:59.157339+00', NULL),
	(12, NULL, 'Test agent', 'สัมผัสชีวิตเมืองที่สะดวกสบาย ณ Wind Sukhumvit 23 คอนโดมิเนียมหรูใจกลางสุขุมวิท 23 ทำเลที่ตอบโจทย์ทุกไลฟ์สไตล์ ใกล้สถานีรถไฟฟ้า ให้คุณเดินทางสู่ทุกจุดหมายได้อย่างง่ายดาย

📍 รายละเอียดห้อง:
*   ชั้น 9 อาคาร B
*   1 ห้องนอน 1 ห้องน้ำ
*   ขนาด 40 ตร.ม.
*   ครัวปิดและระเบียงส่วนตัว
*   พร้อมพื้นที่ตากผ้า

 amenity สิ่งอำนวยความสะดวก:
*   สระว่ายน้ำ
*   ฟิตเนส
*   สวนส่วนกลาง
*   โคเวิร์กกิ้งสเปซ
*   เลี้ยงสัตว์ได้
*   จอดรถยนต์ส่วนตัว
*   รปภ. 24 ชม., กล้องวงจรปิด, คีย์การ์ด
*   มีร้าน 7-11 และตู้เต่าบินให้บริการภายในโครงการ

 nearby สถานที่ใกล้เคียง:
*   MRT สุขุมวิท (352 ม.)
*   BTS/MRT อโศก (540 ม.)
*   โรงพยาบาลจักษุ รัตนิน (757 ม.)
*   อุทยานเบญจสิริ (1067 ม.)

💰 ราคาเช่า:
*   สัญญา 6 เดือน: 18,000 บาท/เดือน (มัดจำ 2 เดือน, ล่วงหน้า 1 เดือน)
*   สัญญา 12 เดือน: 16,000 บาท/เดือน (มัดจำ 2 เดือน, ล่วงหน้า 1 เดือน) – คุ้มค่ายิ่งขึ้น!

สนใจเข้าชมห้อง หรือสอบถามข้อมูลเพิ่มเติม กรุณากดปุ่ม "นัดดูห้อง" ด้านล่างได้เลย', '2026-09-24', '[{"price": 18000, "depositMonths": 2, "contractTypeId": 2, "contractTypeCode": "monthly_6", "advanceRentMonths": 1}, {"price": 16000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '["7-11", "Taobin"]', 13.7397985, 100.5644289, '', '[{"name": "สุขุมวิท", "type": "subway_station", "placeId": "ChIJF6qNZeOe4jARM-EeADLGC48", "latitude": 13.7385266, "vicinity": "แขวงคลองเตยเหนือ เขตวัฒนา", "longitude": 100.5614475, "distanceMeters": 352}, {"name": "Jennifersoft thailand co. ,ltd", "type": "university", "placeId": "ChIJi3TE2zSf4jAR9bkm4oBgheE", "latitude": 13.7418444, "vicinity": "163 อาคารรัชภาคย์ ถนน สุขุมวิท เขตวัฒนา", "longitude": 100.5618667, "distanceMeters": 358}, {"name": "สวัสดิการ 3", "type": "university", "placeId": "ChIJZXMjuvqe4jARXiyhaWuMiSQ", "latitude": 13.743602, "vicinity": "114 ถนน สุขุมวิท แขวงคลองเตยเหนือ เขตวัฒนา", "longitude": 100.5641759, "distanceMeters": 424}, {"name": "มหาลัย", "type": "university", "placeId": "ChIJzyqTawCf4jARtKorj5Bmq0k", "latitude": 13.7434566, "vicinity": "223/6 สุขุมวิท 31 แขวงคลองเตยเหนือ เขตวัฒนา", "longitude": 100.5663307, "distanceMeters": 456}, {"name": "บริษัท อาคาเดเมียร์ อิตาเลียนา (ประเทศไทย) จำกัด", "type": "university", "placeId": "ChIJc-r7UlOf4jARv4ykxJJ1pFk", "latitude": 13.735722, "vicinity": "ชั้น 3 อาคาร จัสมินซิตี้ เลขที่ 2 ถ. สุขุมวิท 23 คลองเตยเหนือ", "longitude": 100.563032, "distanceMeters": 478}, {"name": "ภาควิชาภูมิศาสตร์ คณะสังคมศาสตร์", "type": "university", "placeId": "ChIJNcXm1j6f4jAR9Cf6CrQDBXw", "latitude": 13.7445788, "vicinity": "อาคาร 11 114 ถนน สุขุมวิท แขวงคลองเตยเหนือ เขตวัฒนา", "longitude": 100.5639115, "distanceMeters": 534}, {"name": "อโศก", "type": "subway_station", "placeId": "ChIJeWHF8PGe4jARKwOP02NGsBI", "latitude": 13.7370587, "vicinity": "ถนน กำแพงเพชร 7 แขวงบางกะปิ เขตห้วยขวาง", "longitude": 100.5603061, "distanceMeters": 540}, {"name": "โรงพยาบาลจักษุ รัตนิน", "type": "hospital", "placeId": "ChIJ1Tea3u-e4jARTwqtXHHc8Uk", "latitude": 13.746461, "vicinity": "80/1 ถนน สุขุมวิท แขวงคลองเตยเหนือ เขตวัฒนา", "longitude": 100.5630061, "distanceMeters": 757}, {"name": "อุทยานเบญจสิริ", "type": "park", "placeId": "ChIJt9HTSwKf4jARsDoLPbMAAQ8", "latitude": 13.7306775, "vicinity": "ถนน สุขุมวิท แขวงคลองตัน เขตคลองเตย", "longitude": 100.5675008, "distanceMeters": 1067}, {"name": "สวนเบญจกิติ", "type": "park", "placeId": "ChIJmfMfvBuf4jAR9rugvZd5Lyc", "latitude": 13.7292483, "vicinity": "ถนน รัชดาภิเษก แขวงคลองเตย เขตคลองเตย", "longitude": 100.5585653, "distanceMeters": 1333}, {"name": "โรงพยาบาลสมิติเวช สุขุมวิท", "type": "hospital", "placeId": "ChIJVaLgEVWe4jARdUsUqC_39Kk", "latitude": 13.7348727, "vicinity": "133 สุขุมวิท 49 แขวงคลองตันเหนือ เขตวัฒนา", "longitude": 100.5765805, "distanceMeters": 1422}, {"name": "โรงพยาบาลพระรามเก้า", "type": "hospital", "placeId": "ChIJSedJ9PSe4jARkuAlzDXNXLA", "latitude": 13.7532843, "vicinity": "99 ถนน พระราม 9 แขวงบางกะปิ เขตห้วยขวาง", "longitude": 100.5706561, "distanceMeters": 1643}]', NULL, NULL, 1, 2, NULL, NULL, NULL, true, 'private', 1, NULL, NULL, 12, 3, 2, 1, 0, NULL, '2026-09-17 06:56:56.44971+00', '2026-09-24 07:08:34.02836+00', 'Wind Sukhumvit 23: 1 ห้องนอน 40 ตร.ม. ใกล้ MRT สุขุมวิท ✨'),
	(13, 'demo-agent-11', 'DEMO · The Esse Asoke 3BR', 'ห้อง 3 ห้องนอนมุมสูง วิวเมือง เดิน 3 นาทีถึง BTS อโศก / MRT สุขุมวิท เฟอร์นิเจอร์ครบพร้อมเข้าอยู่ [DEMO_SEED]', '2026-09-28', '[{"price": 29000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}, {"price": 32000, "depositMonths": 2, "contractTypeId": 2, "contractTypeCode": "monthly_6", "advanceRentMonths": 1}]', '["Terminal 21", "7-11"]', 13.7390000, 100.5620000, 'ใกล้ Terminal 21', '[]', 18.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 1, NULL, 13, 5, 1, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'The Esse Asoke 3 ห้องนอน 120 ตร.ม. ติด BTS อโศก'),
	(14, 'demo-agent-12', 'DEMO · Lumpini Suite Sathorn 3BR', 'ห้องครอบครัว 3 ห้องนอน 2 ห้องน้ำ ใกล้สวนลุมพินี เดินถึง MRT ลุมพินี [DEMO_SEED]', '2026-10-08', '[{"price": 28500, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '["สวนลุมพินี"]', 13.7240000, 100.5430000, NULL, '[]', 18.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 2, NULL, 14, 5, 2, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Lumpini Suite 3 ห้องนอน ใกล้ MRT ลุมพินี'),
	(15, 'demo-agent-13', 'DEMO · Park 24 3BR', 'ห้อง 3 ห้องนอนวิวสวน ใกล้ BTS พร้อมพงษ์ / Emquartier สัญญา 12 หรือ 6 เดือน [DEMO_SEED]', '2026-10-01', '[{"price": 30000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}, {"price": 33000, "depositMonths": 2, "contractTypeId": 2, "contractTypeCode": "monthly_6", "advanceRentMonths": 1}]', '["Emquartier", "Benjasiri Park"]', 13.7220000, 100.5690000, 'ใกล้ Emquartier', '[]', 20.00, 8.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 1, NULL, 15, 5, 1, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Park 24 3 ห้องนอน วิวสวนเบญจสิริ'),
	(30, 'demo-agent-28', 'DEMO · Ideo Mobi Bangna 3BR', 'ห้อง 3 ห้องนอน ใกล้ BTS บางนา / BITEC [DEMO_SEED]', '2026-09-27', '[{"price": 25000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '["BITEC"]', 13.6680000, 100.6050000, NULL, '[]', 17.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 3, NULL, 30, 5, 2, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Ideo Mobi Bangna 3 ห้องนอน ใกล้ BTS บางนา'),
	(19, 'demo-agent-17', 'DEMO · Siamese Exclusive 31 1BR', 'ห้อง 1 ห้องนอนตกแต่งโมเดิร์น เดินถึง BTS พร้อมพงษ์ มีสัญญา 12 / 6 / 3 เดือน [DEMO_SEED]', '2026-10-10', '[{"price": 22000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}, {"price": 24000, "depositMonths": 2, "contractTypeId": 2, "contractTypeCode": "monthly_6", "advanceRentMonths": 1}, {"price": 26000, "depositMonths": 2, "contractTypeId": 3, "contractTypeCode": "monthly_3", "advanceRentMonths": 1}]', '["7-11"]', 13.7345000, 100.5665000, NULL, '[]', 18.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 2, NULL, 19, 2, 2, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Siamese Exclusive 31 1 ห้องนอน ใกล้ BTS พร้อมพงษ์'),
	(20, 'demo-agent-18', 'DEMO · Park Origin Phrom Phong 1BR+', 'ห้อง 1 ห้องนอน + ห้องทำงาน ติด BTS พร้อมพงษ์ ชั้นสูงวิวสวน [DEMO_SEED]', '2026-10-01', '[{"price": 26000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '["Emporium"]', 13.7300000, 100.5710000, NULL, '[]', 20.00, 8.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 1, NULL, 20, 3, 1, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Park Origin Phrom Phong 1 ห้องนอน+ ติด BTS'),
	(21, 'demo-agent-19', 'DEMO · Noble Ploenchit Studio', 'สตูดิโอพร้อมอยู่ ติด BTS เพลินจิต เหมาะคนทำงานย่าน CBD [DEMO_SEED]', '2026-09-20', '[{"price": 18000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}, {"price": 19500, "depositMonths": 2, "contractTypeId": 2, "contractTypeCode": "monthly_6", "advanceRentMonths": 1}]', '["Central Embassy"]', 13.7430000, 100.5480000, NULL, '[]', 18.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 2, NULL, 21, 1, 2, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Noble Ploenchit สตูดิโอ ติด BTS เพลินจิต'),
	(22, 'demo-agent-20', 'DEMO · Rhythm Ekkamai 2BR', 'ห้อง 2 ห้องนอนชั้นสูง ใกล้ BTS เอกมัย ว่างกลางเดือนพฤศจิกายน [DEMO_SEED]', '2026-11-14', '[{"price": 29500, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '["Gateway Ekkamai"]', 13.7200000, 100.5880000, NULL, '[]', 20.00, 8.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 1, NULL, 22, 4, 1, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Rhythm Ekkamai 2 ห้องนอน ใกล้ BTS เอกมัย'),
	(23, 'demo-agent-21', 'DEMO · Ideo Mobi Sukhumvit Studio', 'สตูดิโอราคาประหยัด ใกล้ BTS อ่อนนุช สัญญา 12 หรือ 3 เดือน [DEMO_SEED]', '2026-10-05', '[{"price": 15000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}, {"price": 17000, "depositMonths": 2, "contractTypeId": 3, "contractTypeCode": "monthly_3", "advanceRentMonths": 1}]', '["Tesco Lotus"]', 13.7050000, 100.6000000, NULL, '[]', 17.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 3, NULL, 23, 1, 2, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Ideo Mobi Sukhumvit สตูดิโอ ใกล้ BTS อ่อนนุช'),
	(24, 'demo-agent-22', 'DEMO · Ideo Rama 9 - Asoke 1BR', 'ห้อง 1 ห้องนอนใหม่ ใกล้ MRT พระราม 9 / Central Rama 9 [DEMO_SEED]', '2026-10-12', '[{"price": 21000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}, {"price": 23000, "depositMonths": 2, "contractTypeId": 2, "contractTypeCode": "monthly_6", "advanceRentMonths": 1}]', '["Central Rama 9"]', 13.7560000, 100.5660000, NULL, '[]', 18.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 2, NULL, 24, 2, 1, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Ideo Rama 9 - Asoke 1 ห้องนอน ใกล้ MRT พระราม 9'),
	(25, 'demo-agent-23', 'DEMO · The Mall Residence Bangkapi 2BR', 'ห้อง 2 ห้องนอนติดห้าง เหมาะครอบครัวเล็ก [DEMO_SEED]', '2026-10-03', '[{"price": 23000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '["The Mall บางกะปิ"]', 13.7660000, 100.6470000, NULL, '[]', 17.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 3, NULL, 25, 4, 2, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'The Mall Residence 2 ห้องนอน ติด The Mall บางกะปิ'),
	(26, 'demo-agent-24', 'DEMO · Saladaeng One 3BR', 'ห้อง 3 ห้องนอนหรู ใกล้ BTS ศาลาแดง — เช่าแล้ว [DEMO_SEED]', '2026-09-29', '[{"price": 29900, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '[]', 13.7285000, 100.5390000, NULL, '[]', 20.00, 8.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 2, NULL, 26, 5, 1, 2, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Saladaeng One 3 ห้องนอน ใกล้ BTS ศาลาแดง'),
	(27, 'demo-agent-25', 'DEMO · 98 Wireless 3BR', 'ลักซ์ชัวรี 3 ห้องนอน ถนนวิทยุ วิวสวนลุมพินี [DEMO_SEED]', '2026-10-01', '[{"price": 85000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '["Central Embassy", "สวนลุมพินี"]', 13.7400000, 100.5480000, NULL, '[]', 25.00, 9.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 1, NULL, 27, 5, 1, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', '98 Wireless 3 ห้องนอน ลักซ์ชัวรี ถนนวิทยุ'),
	(28, 'demo-agent-26', 'DEMO · The Lofts Asoke 3BR', 'ห้อง 3 ห้องนอนสไตล์ลอฟต์ ติด MRT เพชรบุรี [DEMO_SEED]', '2026-10-01', '[{"price": 45000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}, {"price": 48000, "depositMonths": 2, "contractTypeId": 2, "contractTypeCode": "monthly_6", "advanceRentMonths": 1}]', '[]', 13.7420000, 100.5610000, NULL, '[]', 20.00, 8.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 2, NULL, 28, 5, 2, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'The Lofts Asoke 3 ห้องนอน ติด MRT เพชรบุรี'),
	(29, 'demo-agent-27', 'DEMO · Circle Living Prototype 2BR', 'ห้อง 2 ห้องนอนกว้าง ใกล้ Airport Link มักกะสัน [DEMO_SEED]', '2026-09-26', '[{"price": 36000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '[]', 13.7500000, 100.5530000, NULL, '[]', 18.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 1, NULL, 29, 4, 1, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Circle Living Prototype 2 ห้องนอน เพชรบุรีตัดใหม่'),
	(31, 'demo-agent-29', 'DEMO · Ideo Q Ari Studio', 'สตูดิโอใหม่ ติด BTS อารีย์ สัญญา 12 หรือ 6 เดือน [DEMO_SEED]', '2026-10-01', '[{"price": 17000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}, {"price": 17500, "depositMonths": 2, "contractTypeId": 2, "contractTypeCode": "monthly_6", "advanceRentMonths": 1}]', '["La Villa Ari"]', 13.7810000, 100.5440000, NULL, '[]', 18.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'published', 1, 2, NULL, 31, 1, 1, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-09-30 10:05:00.228159+00', 'Ideo Q Ari สตูดิโอ ติด BTS อารีย์'),
	(32, 'demo-agent-30', 'DEMO · Chaengwattana Condo 2BR', 'สัมผัสชีวิตที่สะดวกสบายที่ DEMO · Chaengwattana Condo บนถนนแจ้งวัฒนะ ทุ่งสองห้อง หลักสี่ กรุงเทพมหานคร.

✨ รายละเอียดห้อง:
📍 ขนาด 60 ตร.ม.
🛌 2 ห้องนอน
🛁 1 ห้องน้ำ
🍳 ครัวปิด
🏙️ ชั้น 8 อาคาร A

🏊 สิ่งอำนวยความสะดวก:
• สระว่ายน้ำ
• ที่จอดรถยนต์
• รปภ. 24 ชม.
• กล้องวงจรปิด
• แอร์
• เครื่องซักผ้า
• ครัวปิด
• เฟอร์นิเจอร์ครบครัน (ผ้าม่าน, โซฟา, เตียงและที่นอน, ตู้เสื้อผ้า)
• เครื่องทำน้ำอุ่น
• ตู้เย็น

💰 ราคาเช่า:
• สัญญา 12 เดือน: 20,000 บาท/เดือน
• ค่าประกัน: 2 เดือน
• ค่าเช่าล่วงหน้า: 1 เดือน

สนใจห้องนี้? คลิกปุ่ม ''นัดดูห้อง'' เพื่อเข้าชมได้เลย!', '2026-10-01', '[{"price": 20000, "depositMonths": 2, "contractTypeId": 1, "contractTypeCode": "monthly_12", "advanceRentMonths": 1}]', '[]', 13.9000000, 100.5300000, '', '[]', 17.00, 7.00, 1, 2, NULL, NULL, NULL, true, 'private', 1, NULL, NULL, 32, 4, 2, 1, 0, NULL, '2026-09-30 10:05:00.228159+00', '2026-10-01 07:23:19.426464+00', 'คอนโด DEMO แจ้งวัฒนะ 2 ห้องนอน 60 ตร.ม. ชั้น 8 ✨');


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.leads (id, rent_room_id, name, phone, email, source, desired_room_type_id, budget_min, budget_max, other_contacts, nationality, location_place_id, location_name, latitude, longitude, radius_km, province, locations, preferred_location, move_in_plan, has_pets, occupation, visa_type_id, lease_duration_months, uses_car, occupant_count, is_smoker, status, viewed_at, lost_reason, notes, tenant_id, created_by_user_id, created_at, updated_at, first_name, last_name, match_settings) VALUES
	(7, NULL, 'Test A', '1234545', NULL, NULL, 5, 8000.00, 30000.00, '[]', 'Thai', NULL, NULL, NULL, NULL, 3, 'กรุงเทพมหานคร', '{คลองเตย,สาทร,บางกะปิ}', NULL, '2026-10-01', false, NULL, 8, 12, true, 1, false, 'inprogress', NULL, NULL, NULL, NULL, 1, '2026-09-24 09:52:47.376996+00', '2026-10-05 03:47:30.517223+00', 'Test', 'A', '{"minScore": 60, "maxResults": 20}'),
	(1, 1, 'Ananya Wong', '0800000001', 'ananya.demo@example.com', 'facebook', 1, 15000.00, 20000.00, '[]', NULL, NULL, NULL, NULL, NULL, NULL, 'Bangkok', '{Watthana,"Khlong Toei"}', 'Near Asoke BTS', 'This month', false, NULL, NULL, 12, false, 1, false, 'new', NULL, NULL, '[DEMO_SEED] Hot lead for Asoke studio', NULL, 1, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00', 'Ananya', 'Wong', NULL),
	(2, 1, 'James Miller', '0800000002', 'james.demo@example.com', 'line', 1, 16000.00, 22000.00, '[]', NULL, NULL, NULL, NULL, NULL, NULL, 'Bangkok', '{Watthana}', 'Asoke / Terminal 21 area', 'Next week', false, NULL, 1, 12, true, 1, false, 'inprogress', NULL, NULL, '[DEMO_SEED] Viewing scheduled', NULL, 1, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00', 'James', 'Miller', NULL),
	(4, 2, 'Kenji Sato', '0800000004', 'kenji.demo@example.com', 'co_agent', 2, 25000.00, 28000.00, '[]', NULL, NULL, NULL, NULL, NULL, NULL, 'Bangkok', '{"Phaya Thai"}', 'Near Ari BTS', 'Flexible', false, NULL, NULL, 6, false, 1, false, 'new', NULL, NULL, '[DEMO_SEED] Co-broke inquiry', NULL, 1, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00', 'Kenji', 'Sato', NULL),
	(5, NULL, 'Somying Open', '0800000005', NULL, 'phone', 4, 18000.00, 25000.00, '[]', NULL, NULL, NULL, NULL, NULL, NULL, 'Chiang Mai', '{"Mueang Chiang Mai"}', 'Nimman / Downtown', 'Immediately', false, NULL, NULL, 12, true, 2, false, 'new', NULL, NULL, '[DEMO_SEED] Lead without room yet', NULL, 1, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00', 'Somying', 'Open', NULL),
	(6, 3, 'Lost Lead Demo', '0800000006', 'lost.demo@example.com', 'facebook', 4, 20000.00, 24000.00, '[]', NULL, NULL, NULL, NULL, NULL, NULL, 'Chiang Mai', '{"Mueang Chiang Mai"}', 'Nimman', 'Was urgent', false, NULL, NULL, 12, false, 1, true, 'lost', NULL, NULL, '[DEMO_SEED] Chose another agent', NULL, 1, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00', 'Lost', 'Lead Demo', NULL),
	(3, 2, 'Pimchanok S.', '0800000003', 'pim.demo@example.com', 'walk_in', 2, 24000.00, 30000.00, '[]', NULL, NULL, NULL, NULL, NULL, NULL, 'Bangkok', '{"Phaya Thai"}', 'Ari / Sanam Pao', 'October', true, NULL, NULL, 12, false, 2, false, 'inprogress', NULL, NULL, '[DEMO_SEED] Already viewed Ari 1BR', NULL, 1, '2026-09-11 09:23:32.968704+00', '2026-09-11 09:23:32.968704+00', 'Pimchanok', 'S.', NULL),
	(8, 19, 'Demo อโศก 1BR', '0800000011', 'asoke.demo@example.com', 'facebook', 2, 20000.00, 28000.00, '[]', 'Japanese', NULL, NULL, NULL, NULL, 3, 'กรุงเทพมหานคร', '{คลองเตย,วัฒนา}', 'ใกล้ BTS อโศก หรือพร้อมพงษ์', '2026-10-15', false, 'พนักงานบริษัท', NULL, 12, false, 1, false, 'booked', NULL, NULL, '[DEMO_SEED_EXTRA] Asoke 1BR', 1, 1, '2026-09-30 10:05:00.228159+00', '2026-10-06 06:14:50.983754+00', 'Demo', 'อโศก 1BR', '{"minScore": 80, "maxResults": 20}'),
	(13, NULL, 'Yuki Tanaka', '+819012345678', 'yuki.tanaka@demo.nestyk.test', NULL, 2, 25000.00, 35000.00, '[{"value": "yuki.t", "channel": "line"}]', 'Japanese', NULL, NULL, NULL, NULL, 1, 'กรุงเทพมหานคร', '{วัฒนา}', NULL, '2026-12-01', true, 'Office worker', 2, 12, false, 1, false, 'new', NULL, NULL, 'เลี้ยงแมว 1 ตัว ต้องการคอนโดที่อนุญาตสัตว์เลี้ยง', NULL, 1, '2026-09-29 08:57:14.673237+00', '2026-09-29 08:57:14.673237+00', 'Yuki', 'Tanaka', NULL),
	(10, NULL, 'Demo พระราม 9 2BR', '0800000013', 'rama9.demo@example.com', 'walk_in', 4, 25000.00, 40000.00, '[{"value": "@TESTER", "channel": "line"}, {"value": "Test Face", "channel": "facebook"}]', 'Chinese', NULL, NULL, NULL, NULL, 5, 'กรุงเทพมหานคร', '{ห้วยขวาง,ดินแดง}', NULL, '2026-10-01', true, 'ผู้จัดการ', NULL, 12, true, 3, false, 'inprogress', NULL, NULL, '[DEMO_SEED_EXTRA] Rama 9 2BR family', NULL, 1, '2026-09-30 10:05:00.228159+00', '2026-10-02 03:51:27.817088+00', 'Demo', 'พระราม 9 2BR', '{"minScore": 70, "maxResults": 50}'),
	(9, NULL, 'Demo อารีย์ Studio', '0800000012', 'ari.demo@example.com', 'line', 1, 12000.00, 18000.00, '[]', 'Thai', NULL, NULL, NULL, NULL, 1, 'กรุงเทพมหานคร', '{พญาไท,ราชเทวี}', 'เดินถึง BTS ได้', '2026-10-05', false, 'ฟรีแลนซ์', NULL, 6, false, 1, false, 'inprogress', NULL, NULL, '[DEMO_SEED_EXTRA] Ari studio', NULL, 1, '2026-09-30 10:05:00.228159+00', '2026-10-02 04:14:56.399925+00', 'Demo', 'อารีย์ Studio', '{"minScore": 80, "maxResults": 20}'),
	(11, NULL, 'สมชาย ใจดี', '+66812345601', 'somchai.j@demo.nestyk.test', NULL, 2, 12000.00, 18000.00, '[{"value": "@somchai.j", "channel": "line"}]', 'Thai', NULL, NULL, NULL, NULL, 3, 'กรุงเทพมหานคร', '{วัฒนา}', NULL, '2026-10-15', false, 'Office worker', NULL, 12, false, 1, false, 'new', NULL, NULL, 'ทำงานแถวอโศก อยากเดินถึง BTS ได้', NULL, 1, '2026-09-30 08:57:14.673237+00', '2026-10-07 03:58:42.16+00', 'สมชาย', 'ใจดี', '{"maxScore": 100, "minScore": 65, "maxResults": 10}'),
	(12, 20, 'Wei Li', '+8613812345678', 'liwei@demo.nestyk.test', NULL, 3, 35000.00, 50000.00, '[{"value": "liwei_bkk", "channel": "wechat"}]', 'Chinese', NULL, NULL, NULL, NULL, 5, 'กรุงเทพมหานคร', '{ห้วยขวาง}', NULL, '2026-11-01', false, 'Business owner', 2, 12, true, 3, false, 'booked', '2026-09-28 10:57:14.673237+00', NULL, 'มากับภรรยาและลูก 1 คน ต้องการที่จอดรถ', 2, 1, '2026-09-28 08:57:14.673237+00', '2026-10-06 07:28:24.061338+00', 'Wei', 'Li', '{"minScore": 50, "maxResults": 100}'),
	(14, NULL, 'Ji-woo Kim', '+821012345678', 'jiwoo.kim@demo.nestyk.test', NULL, 1, 10000.00, 15000.00, '[{"value": "KakaoTalk: jiwoo.kim", "channel": "other"}]', 'Korean', NULL, NULL, NULL, NULL, 3, 'กรุงเทพมหานคร', '{ปทุมวัน}', NULL, '2027-01-05', false, 'Student', 3, 6, false, 1, false, 'inprogress', '2026-09-25 10:57:14.673237+00', NULL, 'นักศึกษาแลกเปลี่ยน 1 เทอม', NULL, 1, '2026-09-25 08:57:14.673237+00', '2026-09-25 08:57:14.673237+00', 'Ji-woo', 'Kim', NULL),
	(15, NULL, 'Arjun Sharma', '+919812345678', 'arjun.sharma@demo.nestyk.test', NULL, 3, 20000.00, 28000.00, '[{"value": "+919812345678", "channel": "whatsapp"}]', 'Indian', NULL, NULL, NULL, NULL, 3, 'กรุงเทพมหานคร', '{พญาไท,ราชเทวี}', NULL, '2026-10-20', false, 'Medical professional', 2, 12, true, 2, false, 'lost', '2026-09-19 10:57:14.673237+00', 'ได้ห้องผ่านเอเจนต์อื่นแล้ว', 'แพทย์ประจำ รพ.ราชวิถี อยู่กับภรรยา', NULL, 1, '2026-09-19 08:57:14.673237+00', '2026-09-19 08:57:14.673237+00', 'Arjun', 'Sharma', NULL),
	(20, NULL, 'ธนพล วงศ์ใหญ่', '+66623456789', 'thanaphon.w@demo.nestyk.test', NULL, 4, 25000.00, 35000.00, '[{"value": "thanaphon.w", "channel": "line"}]', 'Thai', NULL, NULL, NULL, NULL, 5, 'นนทบุรี', '{ปากเกร็ด,บางใหญ่}', NULL, '2027-02-01', false, 'Government officer', NULL, 12, true, 4, false, 'lost', '2026-09-11 10:57:14.673237+00', 'งบไม่พอสำหรับห้อง 2 ห้องนอนในโซนนี้', 'ครอบครัว 4 คน ลูกเรียนแถวแจ้งวัฒนะ', NULL, 1, '2026-09-11 08:57:14.673237+00', '2026-09-11 08:57:14.673237+00', 'ธนพล', 'วงศ์ใหญ่', NULL),
	(16, NULL, 'James Wilson', '+447700900123', 'james.wilson@demo.nestyk.test', NULL, 2, 18000.00, 25000.00, '[{"value": "+447700900123", "channel": "whatsapp"}, {"value": "@jwilson", "channel": "telegram"}]', 'British', NULL, NULL, NULL, NULL, 5, 'เชียงใหม่', '{เมืองเชียงใหม่}', NULL, '2026-11-15', false, 'Teacher', 2, 12, false, 1, true, 'new', NULL, NULL, 'ครูสอนภาษาอังกฤษ สูบบุหรี่ ต้องการห้องมีระเบียง', NULL, 1, '2026-10-01 08:57:14.673237+00', '2026-10-02 04:06:01.571593+00', 'James', 'Wilson', '{"minScore": 70, "maxResults": 50}'),
	(18, NULL, 'Minh Anh Nguyen', '+84912345678', 'minhanh.nguyen@demo.nestyk.test', NULL, 1, 12000.00, 16000.00, '[{"value": "+84912345678", "channel": "whatsapp"}, {"value": "Zalo: 0912345678", "channel": "other"}]', 'Vietnamese', NULL, NULL, NULL, NULL, 1, 'กรุงเทพมหานคร', '{บางรัก,สาทร}', NULL, '2026-12-15', false, 'Office worker', 2, 6, false, 2, false, 'inprogress', '2026-09-27 10:57:14.673237+00', NULL, 'แชร์ห้องกับเพื่อนร่วมงาน', NULL, 1, '2026-09-27 08:57:14.673237+00', '2026-10-06 07:13:59.649+00', 'Minh Anh', 'Nguyen', '{"minScore": 70, "maxResults": 20}'),
	(19, NULL, 'Michael Brown', '+14155552671', 'michael.brown@demo.nestyk.test', NULL, 5, 60000.00, 90000.00, '[{"value": "+14155552671", "channel": "whatsapp"}]', 'American', NULL, NULL, NULL, NULL, 5, 'ชลบุรี', '{บางละมุง}', NULL, '2026-11-01', true, 'Retired', 5, 12, true, 2, false, 'new', NULL, NULL, 'เกษียณ ย้ายมาอยู่ระยะยาวกับภรรยา ต้องการวิวทะเล', NULL, 1, '2026-09-29 08:57:14.673237+00', '2026-10-06 07:31:02.604+00', 'Michael', 'Brown', NULL),
	(17, NULL, 'นภา ศรีสุข', '+66898765432', 'napa.s@demo.nestyk.test', NULL, 1, 8000.00, 12000.00, '[{"value": "napa.srisuk", "channel": "line"}, {"value": "Napa Srisuk", "channel": "facebook"}]', 'Thai', NULL, NULL, NULL, NULL, 3, 'กรุงเทพมหานคร', '{พระโขนง}', NULL, '2026-10-10', true, 'Freelancer', NULL, 3, false, 1, false, 'new', NULL, NULL, 'มีสุนัขพันธุ์เล็ก 1 ตัว ขอสัญญาสั้นก่อน', NULL, 1, '2026-09-30 08:57:14.673237+00', '2026-10-05 07:27:59.414+00', 'นภา', 'ศรีสุข', '{"minScore": 50, "maxResults": 10}');


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tenants (id, lead_id, name, phone, email, note, user_id, created_by_user_id, created_at, updated_at, identity_number, nationality, first_name, last_name) VALUES
	(1, 8, 'Demo อโศก 1BR', '0800000011', 'asoke.demo@example.com', NULL, NULL, 1, '2026-10-06 06:14:50.983754+00', '2026-10-06 06:14:50.983754+00', NULL, 'Japanese', 'Demo', 'อโศก 1BR'),
	(2, 12, 'Wei Li', '+8613812345678', 'liwei@demo.nestyk.test', NULL, NULL, 1, '2026-10-06 07:28:24.061338+00', '2026-10-06 07:28:24.061338+00', NULL, 'Chinese', 'Wei', 'Li');


--
-- Data for Name: agent_commission_confirmations; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: agent_invoices; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: room_tenancies; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: lease_contracts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: agreement_documents; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: agreement_sign_invites; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.contacts (id, name, phone, email, note, created_by_user_id, created_at, line_id, facebook) VALUES
	(1, 'Jame', '1234567890', NULL, NULL, 1, '2026-09-11 09:34:57.005329+00', NULL, NULL),
	(2, 'Alex', '2345678', NULL, NULL, 1, '2026-09-16 04:29:15.991104+00', NULL, NULL),
	(3, 'Jim', '0900000000000000', NULL, NULL, 1, '2026-09-17 06:56:56.44971+00', NULL, NULL);


--
-- Data for Name: contract_deposit_settlements; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: contract_deposit_transfers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: deposit_deduction_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: lead_locations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.lead_locations (id, lead_id, rank, place_id, name, latitude, longitude, province, district, created_at) VALUES
	(3, 7, 1, 'ChIJQ9P2QACf4jAR23V64z2wi1Y', 'Asok BTS Station', 13.7367311, 100.5605338, 'กรุงเทพมหานคร', 'คลองเตย', '2026-09-30 06:21:43.025229+00'),
	(4, 7, 2, 'ChIJSdYURwCf4jARLO7y4gC5UZ8', 'MRT ลุมพินี ทางออก3', 13.7264431, 100.5450216, 'กรุงเทพมหานคร', 'สาทร', '2026-09-30 06:21:43.025229+00'),
	(5, 7, 3, 'ElRCYW5na2FwaSAtIFRoZSBNYWxsIEJhbmdrYXBpLCBLaGV0IEJhbmcgS2FwaSwgS3J1bmcgVGhlcCBNYWhhIE5ha2hvbiAxMDI0MCwgVGhhaWxhbmQiLiosChQKEgnvD-qcjWEdMRFYb4y2TLFFCRIUChIJzayLqB9iHTER4E3iXbIAAQM', 'บางกะปิ - เดอะมอลล์บางกะปิ', 13.7646867, 100.6446271, 'กรุงเทพมหานคร', 'บางกะปิ', '2026-09-30 06:21:43.025229+00'),
	(6, 8, 1, NULL, 'BTS อโศก', 13.7367, 100.5605, 'กรุงเทพมหานคร', 'คลองเตย', '2026-09-30 10:05:00.228159+00'),
	(7, 8, 2, NULL, 'BTS พร้อมพงษ์', 13.7305, 100.5697, 'กรุงเทพมหานคร', 'วัฒนา', '2026-09-30 10:05:00.228159+00'),
	(8, 9, 1, NULL, 'BTS อารีย์', 13.7797, 100.5446, 'กรุงเทพมหานคร', 'พญาไท', '2026-09-30 10:05:00.228159+00'),
	(9, 9, 2, NULL, 'อนุสาวรีย์ชัยสมรภูมิ', 13.7628, 100.5372, 'กรุงเทพมหานคร', 'ราชเทวี', '2026-09-30 10:05:00.228159+00'),
	(14, 10, 1, NULL, 'MRT พระราม 9', 13.7575, 100.5652, 'กรุงเทพมหานคร', 'ห้วยขวาง', '2026-10-01 05:18:02.876621+00'),
	(15, 10, 2, NULL, 'MRT ศูนย์วัฒนธรรมแห่งประเทศไทย', 13.7659, 100.5701, 'กรุงเทพมหานคร', 'ดินแดง', '2026-10-01 05:18:02.876621+00'),
	(16, 11, 1, NULL, 'BTS Asok', 13.737, 100.5603, 'กรุงเทพมหานคร', 'วัฒนา', '2026-10-01 08:57:14.673237+00'),
	(17, 11, 2, NULL, 'BTS Phrom Phong', 13.7305, 100.5697, 'กรุงเทพมหานคร', 'วัฒนา', '2026-10-01 08:57:14.673237+00'),
	(20, 13, 1, NULL, 'BTS Thong Lo', 13.7244, 100.5783, 'กรุงเทพมหานคร', 'วัฒนา', '2026-10-01 08:57:14.673237+00'),
	(21, 13, 2, NULL, 'BTS Phrom Phong', 13.7305, 100.5697, 'กรุงเทพมหานคร', 'วัฒนา', '2026-10-01 08:57:14.673237+00'),
	(22, 14, 1, NULL, 'Chulalongkorn University', 13.7384, 100.532, 'กรุงเทพมหานคร', 'ปทุมวัน', '2026-10-01 08:57:14.673237+00'),
	(23, 14, 2, NULL, 'Siam Paragon', 13.7462, 100.5347, 'กรุงเทพมหานคร', 'ปทุมวัน', '2026-10-01 08:57:14.673237+00'),
	(24, 15, 1, NULL, 'BTS Ari', 13.7795, 100.5446, 'กรุงเทพมหานคร', 'พญาไท', '2026-10-01 08:57:14.673237+00'),
	(25, 15, 2, NULL, 'Victory Monument', 13.7628, 100.5372, 'กรุงเทพมหานคร', 'ราชเทวี', '2026-10-01 08:57:14.673237+00'),
	(26, 16, 1, NULL, 'MAYA Lifestyle Shopping Center', 18.8024, 98.9675, 'เชียงใหม่', 'เมืองเชียงใหม่', '2026-10-01 08:57:14.673237+00'),
	(27, 16, 2, NULL, 'Chiang Mai University', 18.806, 98.952, 'เชียงใหม่', 'เมืองเชียงใหม่', '2026-10-01 08:57:14.673237+00'),
	(28, 17, 1, NULL, 'BTS On Nut', 13.7056, 100.601, 'กรุงเทพมหานคร', 'พระโขนง', '2026-10-01 08:57:14.673237+00'),
	(29, 18, 1, NULL, 'BTS Sala Daeng', 13.7286, 100.5343, 'กรุงเทพมหานคร', 'บางรัก', '2026-10-01 08:57:14.673237+00'),
	(30, 18, 2, NULL, 'BTS Chong Nonsi', 13.7237, 100.5294, 'กรุงเทพมหานคร', 'สาทร', '2026-10-01 08:57:14.673237+00'),
	(31, 19, 1, NULL, 'Central Festival Pattaya Beach', 12.9349, 100.8833, 'ชลบุรี', 'บางละมุง', '2026-10-01 08:57:14.673237+00'),
	(32, 19, 2, NULL, 'Jomtien Beach', 12.8869, 100.8721, 'ชลบุรี', 'บางละมุง', '2026-10-01 08:57:14.673237+00'),
	(33, 20, 1, NULL, 'IMPACT Muang Thong Thani', 13.9116, 100.548, 'นนทบุรี', 'ปากเกร็ด', '2026-10-01 08:57:14.673237+00'),
	(34, 20, 2, NULL, 'Central WestGate', 13.8769, 100.4111, 'นนทบุรี', 'บางใหญ่', '2026-10-01 08:57:14.673237+00'),
	(35, 12, 1, NULL, 'MRT Thailand Cultural Centre', 13.766, 100.5703, 'กรุงเทพมหานคร', 'ห้วยขวาง', '2026-10-06 07:23:52.735356+00'),
	(36, 12, 2, NULL, 'MRT Huai Khwang', 13.7786, 100.5737, 'กรุงเทพมหานคร', 'ห้วยขวาง', '2026-10-06 07:23:52.735356+00');


--
-- Data for Name: lead_match_runs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.lead_match_runs (id, lead_id, run_by_user_id, settings, input_hash, scoring_version, candidate_count, result_count, top_score, created_at) VALUES
	(9, 10, 1, '{"minScore": 70, "maxResults": 50}', '1e34bdf6200f34a27c0188f6c2694205301078181754b41aeb787d294b67e157', 1, 20, 19, 100, '2026-10-02 03:51:27.864719+00'),
	(10, 16, 1, '{"minScore": 70, "maxResults": 50}', '37f7b15a1314bf762d9575af62fa63285165605b8715640fc2ca3751bb6bcbb5', 1, 1, 1, 80, '2026-10-02 04:06:01.656158+00'),
	(11, 9, 1, '{"minScore": 70, "maxResults": 50}', '8323341fad9dea7124fc7473536eabcb9e3840c0e2caaaec303e3ee03872939c', 1, 1, 1, 100, '2026-10-02 04:14:50.808506+00'),
	(12, 9, 1, '{"minScore": 80, "maxResults": 20}', '5858060b6cc7683d95c78a3b99f27fde97c44a93af8b7e2380392548f19c9631', 1, 1, 1, 100, '2026-10-02 04:14:56.451119+00'),
	(13, 8, 1, '{"minScore": 70, "maxResults": 50}', '1a0d3bcf02b94a2ab604518c6c5596ae929a78e4a0a2a11b1eb646ab54481069', 1, 11, 7, 100, '2026-10-02 09:39:08.942212+00'),
	(14, 8, 1, '{"minScore": 80, "maxResults": 20}', 'ff68eecd8d9d2da313f5bc442c8e42194219fadb4fce09276a744ac57fbc5594', 1, 11, 7, 100, '2026-10-02 09:39:20.101921+00'),
	(15, 17, 1, '{"minScore": 70, "maxResults": 50}', 'f5bf79ad5f9316fdc43b1ce1e46632921cefacc50cb1f1eb43ccb191f831f36b', 1, 0, 0, NULL, '2026-10-05 03:47:13.749124+00'),
	(16, 7, 1, '{"minScore": 60, "maxResults": 20}', '3031544288a6f7728a5d941dc98f474a4edfdba3208fabbd39e11f8a7ba2b268', 1, 17, 16, 100, '2026-10-05 03:47:30.570453+00'),
	(17, 17, 1, '{"minScore": 60, "maxResults": 50}', '73c094836601dc988807306f98dfabcc9400845c696ea6ff78419dffe0b5a729', 1, 0, 0, NULL, '2026-10-05 07:27:55.386753+00'),
	(18, 17, 1, '{"minScore": 50, "maxResults": 10}', '34af41bc6cf33a3f6124b6e1bf2d93d4a0ff0736b57f2d33992d325cdbc113c9', 1, 0, 0, NULL, '2026-10-05 07:27:59.411945+00'),
	(20, 18, 1, '{"minScore": 70, "maxResults": 20}', 'b25cceea6b887983fcd5f0e87bd602b15816e63a48d72c327d2f5d1b07fec6a5', 1, 0, 0, NULL, '2026-10-06 07:13:59.62611+00'),
	(27, 12, 1, '{"minScore": 50, "maxResults": 100}', 'caa5933d86d88c6ea45fcaaae8ce63e51d974ae71f0c42462fec6040dbc6e2d2', 1, 21, 20, 100, '2026-10-06 07:18:29.064362+00'),
	(28, 12, 1, '{"minScore": 70, "maxResults": 100}', '2a0cf6263db39b462402e9da4f0a20f5728d61cab750944d3f5babeec44b030f', 1, 21, 20, 100, '2026-10-06 07:20:22.963387+00'),
	(29, 12, 1, '{"minScore": 70, "maxResults": 50}', 'b5b267c4fde7c4cde7cdb0b2c24438674b98c432db8958d4da691064f604ce58', 1, 21, 20, 100, '2026-10-06 07:23:06.604654+00'),
	(30, 12, 1, '{"minScore": 50, "maxResults": 100}', 'caa5933d86d88c6ea45fcaaae8ce63e51d974ae71f0c42462fec6040dbc6e2d2', 1, 21, 20, 100, '2026-10-06 07:23:25.067548+00'),
	(31, 12, 1, '{"minScore": 50, "maxResults": 100}', '2dbec3d91d389b95bd12280c7ccb88d0b560918e5753fe0be0c173effa13761f', 1, 21, 20, 100, '2026-10-06 07:24:01.055416+00'),
	(32, 19, 1, '{"minScore": 50, "maxResults": 10}', '02e332bb0e8615675d3626c6f3a69c489ae8a49895f45412a6dce1d67db85804', 1, 0, 0, NULL, '2026-10-06 07:31:02.594272+00'),
	(33, 11, 1, '{"minScore": 80, "maxResults": 10}', 'efff2f2902851ab8506b04816e3a9dc52d894fd9dbc7e60b6a71e36a64d80996', 1, 6, 3, 80, '2026-10-06 10:04:35.351549+00'),
	(34, 11, 1, '{"maxScore": 100, "minScore": 65, "maxResults": 10}', '0cb746f397bf294d9a8c3e3e9a1c06f4eca63fb97c2d8c869912e8a95f02bdb7', 1, 6, 6, 80, '2026-10-07 03:58:42.134646+00');


--
-- Data for Name: lead_match_results; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.lead_match_results (id, run_id, rent_room_id, rank, score, location_score, price, term_months, distance_km, pin_rank, comparison) VALUES
	(318, 30, 29, 1, 100, 100, 36000.00, 12, 2.580015684536064, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 36000, "score": 100, "status": "pass", "headroom": 14000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-26"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.580015684536064, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(72, 9, 29, 1, 100, 100, 36000.00, 12, 1.5594145842287996, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 36000, "score": 100, "status": "pass", "headroom": 4000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-26"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.5594145842287996, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(73, 9, 18, 2, 100, 100, 27000.00, 12, 1.8392886439690794, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 27000, "score": 100, "status": "pass", "headroom": 13000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-30"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.8392886439690794, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(74, 9, 11, 3, 100, 100, 15000.00, 12, 4.244310825140965, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 25000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.244310825140965, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(75, 9, 25, 4, 84, 29, 23000.00, 12, 8.30528035412922, 2, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 23000, "score": 100, "status": "pass", "headroom": 17000}, "moveIn": {"want": "2026-10-01", "score": 93.33333333333333, "status": "later", "daysLate": 2, "availableFrom": "2026-10-03"}, "location": {"score": 29, "overKm": 3.30528035412922, "status": "near", "pinName": "MRT ศูนย์วัฒนธรรมแห่งประเทศไทย", "pinRank": 2, "pinWeight": 0.85, "distanceKm": 8.30528035412922, "distanceScore": 34}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(76, 9, 12, 5, 80, 100, 16000.00, 12, 1.9700782458308517, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 16000, "score": 100, "status": "pass", "headroom": 24000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-24"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.9700782458308517, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(77, 9, 13, 6, 80, 100, 29000.00, 12, 2.0859398862607375, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 29000, "score": 100, "status": "pass", "headroom": 11000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-28"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.0859398862607375, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(78, 9, 1, 7, 80, 100, 18000.00, 12, 2.205285607760282, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 22000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.205285607760282, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(79, 9, 21, 8, 80, 100, 18000.00, 12, 2.4598369780419165, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 22000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-20"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.4598369780419165, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(80, 9, 20, 9, 80, 100, 26000.00, 12, 3.121372937503834, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 26000, "score": 100, "status": "pass", "headroom": 14000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.121372937503834, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(81, 9, 31, 10, 80, 100, 17000.00, 12, 3.4742486004868023, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 17000, "score": 100, "status": "pass", "headroom": 23000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.4742486004868023, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(82, 9, 4, 11, 80, 100, 32000.00, 12, 3.4851726340514637, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 32000, "score": 100, "status": "pass", "headroom": 8000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-14"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.4851726340514637, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(83, 9, 15, 12, 80, 100, 30000.00, 12, 3.9687016330516096, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 30000, "score": 100, "status": "pass", "headroom": 10000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.9687016330516096, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(84, 9, 22, 13, 80, 100, 29500.00, 12, 4.842751543838098, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 29500, "score": 100, "status": "pass", "headroom": 10500}, "moveIn": {"want": "2026-10-01", "score": 0, "status": "later", "daysLate": 44, "availableFrom": "2026-11-14"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.842751543838098, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(85, 9, 14, 14, 75, 100, 28500.00, 12, 4.430087265436565, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 28500, "score": 100, "status": "pass", "headroom": 11500}, "moveIn": {"want": "2026-10-01", "score": 76.66666666666666, "status": "later", "daysLate": 7, "availableFrom": "2026-10-08"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.430087265436565, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(86, 9, 19, 15, 74, 100, 22000.00, 12, 2.5613349570571406, 1, '{"lease": {"want": 12, "score": 100, "terms": [3, 6, 12], "status": "pass"}, "budget": {"price": 22000, "score": 100, "status": "pass", "headroom": 18000}, "moveIn": {"want": "2026-10-01", "score": 70, "status": "later", "daysLate": 9, "availableFrom": "2026-10-10"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.5613349570571406, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(87, 9, 24, 16, 73, 100, 21000.00, 12, 0.18784403007619782, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 21000, "score": 100, "status": "pass", "headroom": 19000}, "moveIn": {"want": "2026-10-01", "score": 63.33333333333333, "status": "later", "daysLate": 11, "availableFrom": "2026-10-12"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.18784403007619782, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(88, 9, 5, 17, 72, 60, 14000.00, 12, 6.9773257449321715, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 14000, "score": 100, "status": "pass", "headroom": 26000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-21"}, "location": {"score": 60, "overKm": 1.9773257449321715, "status": "near", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 6.9773257449321715, "distanceScore": 60}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(89, 9, 17, 18, 70, 99, 24000.00, 12, 5.057394302404696, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 24000, "score": 100, "status": "pass", "headroom": 16000}, "moveIn": {"want": "2026-10-01", "score": 50, "status": "later", "daysLate": 15, "availableFrom": "2026-10-16"}, "location": {"score": 99, "overKm": 0.05739430240469634, "status": "near", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.057394302404696, "distanceScore": 99}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(90, 9, 23, 19, 70, 61, 15000.00, 12, 6.943280106098811, 1, '{"lease": {"want": 12, "score": 100, "terms": [3, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 25000}, "moveIn": {"want": "2026-10-01", "score": 86.66666666666667, "status": "later", "daysLate": 4, "availableFrom": "2026-10-05"}, "location": {"score": 61, "overKm": 1.9432801060988112, "status": "near", "pinName": "MRT พระราม 9", "pinRank": 1, "pinWeight": 1, "distanceKm": 6.943280106098811, "distanceScore": 61}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(91, 10, 10, 1, 80, 100, 19000.00, 12, 3.9011005836793977, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 19000, "score": 100, "status": "pass", "headroom": 6000}, "moveIn": {"want": "2026-11-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MAYA Lifestyle Shopping Center", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.9011005836793977, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(92, 11, 31, 1, 100, 100, 17500.00, 6, 0.15841175207636082, 1, '{"lease": {"want": 6, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 17500, "score": 100, "status": "pass", "headroom": 500}, "moveIn": {"want": "2026-10-05", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อารีย์", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.15841175207636082, "distanceScore": 100}, "roomType": {"have": "studio", "want": "studio", "score": 100, "status": "pass"}}'),
	(93, 12, 31, 1, 100, 100, 17500.00, 6, 0.15841175207636082, 1, '{"lease": {"want": 6, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 17500, "score": 100, "status": "pass", "headroom": 500}, "moveIn": {"want": "2026-10-05", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อารีย์", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.15841175207636082, "distanceScore": 100}, "roomType": {"have": "studio", "want": "studio", "score": 100, "status": "pass"}}'),
	(94, 13, 19, 1, 100, 100, 22000.00, 12, 0.6927218214532086, 1, '{"lease": {"want": 12, "score": 100, "terms": [3, 6, 12], "status": "pass"}, "budget": {"price": 22000, "score": 100, "status": "pass", "headroom": 6000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-10"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.6927218214532086, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "one_bedroom", "score": 100, "status": "pass"}}'),
	(95, 13, 24, 2, 100, 100, 21000.00, 12, 2.226765314763905, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 21000, "score": 100, "status": "pass", "headroom": 7000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-12"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.226765314763905, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "one_bedroom", "score": 100, "status": "pass"}}'),
	(96, 13, 1, 3, 80, 100, 18000.00, 12, 0.16679238996684442, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 10000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.16679238996684442, "distanceScore": 100}, "roomType": {"have": "studio", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(97, 13, 12, 4, 80, 100, 16000.00, 12, 0.5466263187122493, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 16000, "score": 100, "status": "pass", "headroom": 12000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-24"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.5466263187122493, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(98, 13, 18, 5, 80, 100, 27000.00, 12, 0.6095372984393583, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 27000, "score": 100, "status": "pass", "headroom": 1000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-30"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.6095372984393583, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(99, 13, 20, 6, 80, 100, 26000.00, 12, 1.3569711378216778, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 26000, "score": 100, "status": "pass", "headroom": 2000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.3569711378216778, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(100, 13, 21, 7, 80, 100, 18000.00, 12, 1.5210779024428527, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 10000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-20"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.5210779024428527, "distanceScore": 100}, "roomType": {"have": "studio", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(101, 14, 19, 1, 100, 100, 22000.00, 12, 0.6927218214532086, 1, '{"lease": {"want": 12, "score": 100, "terms": [3, 6, 12], "status": "pass"}, "budget": {"price": 22000, "score": 100, "status": "pass", "headroom": 6000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-10"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.6927218214532086, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "one_bedroom", "score": 100, "status": "pass"}}'),
	(102, 14, 24, 2, 100, 100, 21000.00, 12, 2.226765314763905, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 21000, "score": 100, "status": "pass", "headroom": 7000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-12"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.226765314763905, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "one_bedroom", "score": 100, "status": "pass"}}'),
	(103, 14, 1, 3, 80, 100, 18000.00, 12, 0.16679238996684442, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 10000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.16679238996684442, "distanceScore": 100}, "roomType": {"have": "studio", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(104, 14, 12, 4, 80, 100, 16000.00, 12, 0.5466263187122493, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 16000, "score": 100, "status": "pass", "headroom": 12000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-24"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.5466263187122493, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(105, 14, 18, 5, 80, 100, 27000.00, 12, 0.6095372984393583, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 27000, "score": 100, "status": "pass", "headroom": 1000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-30"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.6095372984393583, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(106, 14, 20, 6, 80, 100, 26000.00, 12, 1.3569711378216778, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 26000, "score": 100, "status": "pass", "headroom": 2000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.3569711378216778, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(107, 14, 21, 7, 80, 100, 18000.00, 12, 1.5210779024428527, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 10000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-20"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS อโศก", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.5210779024428527, "distanceScore": 100}, "roomType": {"have": "studio", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(108, 16, 13, 1, 100, 100, 29000.00, 12, 0.29787813351404335, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 29000, "score": 100, "status": "pass", "headroom": 1000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-28"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.29787813351404335, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "three_bedroom", "score": 100, "status": "pass"}}'),
	(109, 16, 15, 2, 100, 100, 30000.00, 12, 1.8760150277028593, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 30000, "score": 100, "status": "pass", "headroom": 0}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.8760150277028593, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "three_bedroom", "score": 100, "status": "pass"}}'),
	(110, 16, 14, 3, 95, 100, 28500.00, 12, 2.3645472360870836, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 28500, "score": 100, "status": "pass", "headroom": 1500}, "moveIn": {"want": "2026-10-01", "score": 76.66666666666666, "status": "later", "daysLate": 7, "availableFrom": "2026-10-08"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.3645472360870836, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "three_bedroom", "score": 100, "status": "pass"}}'),
	(111, 16, 17, 4, 81, 55, 24000.00, 12, 3.6538280564696546, 3, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 24000, "score": 100, "status": "pass", "headroom": 6000}, "moveIn": {"want": "2026-10-01", "score": 50, "status": "later", "daysLate": 15, "availableFrom": "2026-10-16"}, "location": {"score": 55, "overKm": 0.6538280564696546, "status": "near", "pinName": "บางกะปิ - เดอะมอลล์บางกะปิ", "pinRank": 3, "pinWeight": 0.7, "distanceKm": 3.6538280564696546, "distanceScore": 78}, "roomType": {"have": "three_bedroom", "want": "three_bedroom", "score": 100, "status": "pass"}}'),
	(112, 16, 1, 5, 80, 100, 18000.00, 12, 0.1633750251762473, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 12000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.1633750251762473, "distanceScore": 100}, "roomType": {"have": "studio", "want": "three_bedroom", "score": 0, "status": "mismatch"}}'),
	(113, 16, 12, 6, 80, 100, 16000.00, 12, 0.541612399862442, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 16000, "score": 100, "status": "pass", "headroom": 14000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-24"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.541612399862442, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "three_bedroom", "score": 0, "status": "mismatch"}}'),
	(114, 16, 18, 7, 80, 100, 27000.00, 12, 0.6045606987872637, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 27000, "score": 100, "status": "pass", "headroom": 3000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-30"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.6045606987872637, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "three_bedroom", "score": 0, "status": "mismatch"}}'),
	(115, 16, 20, 8, 80, 100, 26000.00, 12, 1.35582702899459, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 26000, "score": 100, "status": "pass", "headroom": 4000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.35582702899459, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "three_bedroom", "score": 0, "status": "mismatch"}}'),
	(116, 16, 21, 9, 80, 100, 18000.00, 12, 1.522733201039879, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 12000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-20"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.522733201039879, "distanceScore": 100}, "roomType": {"have": "studio", "want": "three_bedroom", "score": 0, "status": "mismatch"}}'),
	(117, 16, 16, 10, 74, 70, 26000.00, 6, 0.6554084036305176, 3, '{"lease": {"want": 12, "score": 0, "terms": [3, 6], "status": "mismatch"}, "budget": {"price": 26000, "score": 100, "status": "pass", "headroom": 4000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-25"}, "location": {"score": 70, "overKm": 0, "status": "pass", "pinName": "บางกะปิ - เดอะมอลล์บางกะปิ", "pinRank": 3, "pinWeight": 0.7, "distanceKm": 0.6554084036305176, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "three_bedroom", "score": 100, "status": "pass"}}'),
	(118, 16, 19, 11, 74, 100, 22000.00, 12, 0.6905421486331048, 1, '{"lease": {"want": 12, "score": 100, "terms": [3, 6, 12], "status": "pass"}, "budget": {"price": 22000, "score": 100, "status": "pass", "headroom": 8000}, "moveIn": {"want": "2026-10-01", "score": 70, "status": "later", "daysLate": 9, "availableFrom": "2026-10-10"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.6905421486331048, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "three_bedroom", "score": 0, "status": "mismatch"}}'),
	(119, 16, 25, 12, 73, 70, 23000.00, 12, 0.29496250484332165, 3, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 23000, "score": 100, "status": "pass", "headroom": 7000}, "moveIn": {"want": "2026-10-01", "score": 93.33333333333333, "status": "later", "daysLate": 2, "availableFrom": "2026-10-03"}, "location": {"score": 70, "overKm": 0, "status": "pass", "pinName": "บางกะปิ - เดอะมอลล์บางกะปิ", "pinRank": 3, "pinWeight": 0.7, "distanceKm": 0.29496250484332165, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "three_bedroom", "score": 0, "status": "mismatch"}}'),
	(120, 16, 24, 13, 73, 100, 21000.00, 12, 2.2224600487142596, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 21000, "score": 100, "status": "pass", "headroom": 9000}, "moveIn": {"want": "2026-10-01", "score": 63.33333333333333, "status": "later", "daysLate": 11, "availableFrom": "2026-10-12"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.2224600487142596, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "three_bedroom", "score": 0, "status": "mismatch"}}'),
	(121, 16, 31, 14, 65, 25, 17000.00, 12, 5.236370593650466, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 17000, "score": 100, "status": "pass", "headroom": 13000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 25, "overKm": 2.2363705936504656, "status": "near", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.236370593650466, "distanceScore": 25}, "roomType": {"have": "studio", "want": "three_bedroom", "score": 0, "status": "mismatch"}}'),
	(122, 16, 5, 15, 63, 13, 14000.00, 12, 5.6066236458295595, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 14000, "score": 100, "status": "pass", "headroom": 16000}, "moveIn": {"want": "2026-10-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-21"}, "location": {"score": 13, "overKm": 2.6066236458295595, "status": "near", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.6066236458295595, "distanceScore": 13}, "roomType": {"have": "studio", "want": "three_bedroom", "score": 0, "status": "mismatch"}}'),
	(123, 16, 23, 16, 61, 16, 15000.00, 12, 5.5339047000691926, 1, '{"lease": {"want": 12, "score": 100, "terms": [3, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 15000}, "moveIn": {"want": "2026-10-01", "score": 86.66666666666667, "status": "later", "daysLate": 4, "availableFrom": "2026-10-05"}, "location": {"score": 16, "overKm": 2.5339047000691926, "status": "near", "pinName": "Asok BTS Station", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.5339047000691926, "distanceScore": 16}, "roomType": {"have": "studio", "want": "three_bedroom", "score": 0, "status": "mismatch"}}'),
	(319, 30, 18, 2, 100, 100, 27000.00, 12, 2.861939267992649, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 27000, "score": 100, "status": "pass", "headroom": 23000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-30"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.861939267992649, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(320, 30, 6, 3, 100, 100, 45000.00, 12, 3.658711672093843, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 45000, "score": 100, "status": "pass", "headroom": 5000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.658711672093843, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(321, 30, 11, 4, 100, 100, 15000.00, 12, 3.8037065939377706, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 35000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.8037065939377706, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(322, 30, 22, 5, 90, 91, 29500.00, 12, 5.460574947599847, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 29500, "score": 100, "status": "pass", "headroom": 20500}, "moveIn": {"want": "2026-11-01", "score": 56.666666666666664, "status": "later", "daysLate": 13, "availableFrom": "2026-11-14"}, "location": {"score": 91, "overKm": 0.46057494759984685, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.460574947599847, "distanceScore": 91}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(323, 30, 25, 6, 87, 34, 23000.00, 12, 8.283670950010961, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 23000, "score": 100, "status": "pass", "headroom": 27000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-03"}, "location": {"score": 34, "overKm": 3.2836709500109613, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 8.283670950010961, "distanceScore": 34}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(324, 30, 24, 7, 80, 100, 21000.00, 12, 1.2050358696871628, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 21000, "score": 100, "status": "pass", "headroom": 29000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-12"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.2050358696871628, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(325, 30, 28, 8, 80, 100, 45000.00, 12, 2.851452904482099, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 45000, "score": 100, "status": "pass", "headroom": 5000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.851452904482099, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(326, 30, 12, 9, 80, 100, 16000.00, 12, 2.9816837235014195, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 16000, "score": 100, "status": "pass", "headroom": 34000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-24"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.9816837235014195, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(327, 30, 13, 10, 80, 100, 29000.00, 12, 3.133244752629342, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 29000, "score": 100, "status": "pass", "headroom": 21000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-28"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.133244752629342, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(328, 30, 1, 11, 80, 100, 18000.00, 12, 3.2674144973753125, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 32000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.2674144973753125, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(329, 30, 31, 12, 80, 100, 17000.00, 12, 3.293852288552931, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 17000, "score": 100, "status": "pass", "headroom": 33000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.293852288552931, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(330, 30, 21, 13, 80, 100, 18000.00, 12, 3.513087105722894, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 32000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-20"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.513087105722894, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(331, 30, 20, 14, 80, 100, 26000.00, 12, 4.003731299063104, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 26000, "score": 100, "status": "pass", "headroom": 24000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.003731299063104, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(332, 30, 4, 15, 80, 100, 32000.00, 12, 4.116338691877743, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 32000, "score": 100, "status": "pass", "headroom": 18000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-14"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.116338691877743, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(333, 30, 17, 16, 80, 100, 24000.00, 12, 4.638971736569134, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 24000, "score": 100, "status": "pass", "headroom": 26000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.638971736569134, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(334, 30, 15, 17, 80, 100, 30000.00, 12, 4.894591267528162, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 30000, "score": 100, "status": "pass", "headroom": 20000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.894591267528162, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(335, 30, 14, 18, 78, 90, 28500.00, 12, 5.523170924164837, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 28500, "score": 100, "status": "pass", "headroom": 21500}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-08"}, "location": {"score": 90, "overKm": 0.5231709241648366, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.523170924164837, "distanceScore": 90}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(336, 30, 23, 19, 70, 50, 15000.00, 12, 7.503276468117349, 1, '{"lease": {"want": 12, "score": 100, "terms": [3, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 35000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-05"}, "location": {"score": 50, "overKm": 2.503276468117349, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 7.503276468117349, "distanceScore": 50}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(337, 30, 5, 20, 70, 50, 14000.00, 12, 7.519719421663187, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 14000, "score": 100, "status": "pass", "headroom": 36000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-21"}, "location": {"score": 50, "overKm": 2.5197194216631873, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 7.519719421663187, "distanceScore": 50}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(338, 31, 12, 1, 100, 100, 16000.00, 12, 2.9816837235014195, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 16000, "score": 100, "status": "pass", "headroom": 34000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-24"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.9816837235014195, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "one_bedroom_plus", "score": 100, "status": "pass"}}'),
	(339, 31, 20, 2, 100, 100, 26000.00, 12, 4.003731299063104, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 26000, "score": 100, "status": "pass", "headroom": 24000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.003731299063104, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "one_bedroom_plus", "score": 100, "status": "pass"}}'),
	(340, 31, 24, 3, 80, 100, 21000.00, 12, 1.2050358696871628, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 21000, "score": 100, "status": "pass", "headroom": 29000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-12"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.2050358696871628, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(341, 31, 29, 4, 80, 100, 36000.00, 12, 2.580015684536064, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 36000, "score": 100, "status": "pass", "headroom": 14000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-26"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.580015684536064, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(342, 31, 28, 5, 80, 100, 45000.00, 12, 2.851452904482099, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 45000, "score": 100, "status": "pass", "headroom": 5000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.851452904482099, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(343, 31, 18, 6, 80, 100, 27000.00, 12, 2.861939267992649, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 27000, "score": 100, "status": "pass", "headroom": 23000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-30"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.861939267992649, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(344, 31, 13, 7, 80, 100, 29000.00, 12, 3.133244752629342, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 29000, "score": 100, "status": "pass", "headroom": 21000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-28"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.133244752629342, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(345, 31, 1, 8, 80, 100, 18000.00, 12, 3.2674144973753125, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 32000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.2674144973753125, "distanceScore": 100}, "roomType": {"have": "studio", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(346, 31, 31, 9, 80, 100, 17000.00, 12, 3.293852288552931, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 17000, "score": 100, "status": "pass", "headroom": 33000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.293852288552931, "distanceScore": 100}, "roomType": {"have": "studio", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(347, 31, 21, 10, 80, 100, 18000.00, 12, 3.513087105722894, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 32000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-20"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.513087105722894, "distanceScore": 100}, "roomType": {"have": "studio", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(348, 31, 6, 11, 80, 100, 45000.00, 12, 3.658711672093843, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 45000, "score": 100, "status": "pass", "headroom": 5000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.658711672093843, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(349, 31, 11, 12, 80, 100, 15000.00, 12, 3.8037065939377706, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 35000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.8037065939377706, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(350, 31, 4, 13, 80, 100, 32000.00, 12, 4.116338691877743, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 32000, "score": 100, "status": "pass", "headroom": 18000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-14"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.116338691877743, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(351, 31, 17, 14, 80, 100, 24000.00, 12, 4.638971736569134, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 24000, "score": 100, "status": "pass", "headroom": 26000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.638971736569134, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(352, 31, 15, 15, 80, 100, 30000.00, 12, 4.894591267528162, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 30000, "score": 100, "status": "pass", "headroom": 20000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.894591267528162, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(353, 31, 14, 16, 78, 90, 28500.00, 12, 5.523170924164837, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 28500, "score": 100, "status": "pass", "headroom": 21500}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-08"}, "location": {"score": 90, "overKm": 0.5231709241648366, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.523170924164837, "distanceScore": 90}, "roomType": {"have": "three_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(354, 31, 22, 17, 70, 91, 29500.00, 12, 5.460574947599847, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 29500, "score": 100, "status": "pass", "headroom": 20500}, "moveIn": {"want": "2026-11-01", "score": 56.666666666666664, "status": "later", "daysLate": 13, "availableFrom": "2026-11-14"}, "location": {"score": 91, "overKm": 0.46057494759984685, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.460574947599847, "distanceScore": 91}, "roomType": {"have": "two_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(355, 31, 23, 18, 70, 50, 15000.00, 12, 7.503276468117349, 1, '{"lease": {"want": 12, "score": 100, "terms": [3, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 35000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-05"}, "location": {"score": 50, "overKm": 2.503276468117349, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 7.503276468117349, "distanceScore": 50}, "roomType": {"have": "studio", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(356, 31, 5, 19, 70, 50, 14000.00, 12, 7.519719421663187, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 14000, "score": 100, "status": "pass", "headroom": 36000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-21"}, "location": {"score": 50, "overKm": 2.5197194216631873, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 7.519719421663187, "distanceScore": 50}, "roomType": {"have": "studio", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(357, 31, 25, 20, 67, 34, 23000.00, 12, 8.283670950010961, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 23000, "score": 100, "status": "pass", "headroom": 27000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-03"}, "location": {"score": 34, "overKm": 3.2836709500109613, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 8.283670950010961, "distanceScore": 34}, "roomType": {"have": "two_bedroom", "want": "one_bedroom_plus", "score": 0, "status": "mismatch"}}'),
	(358, 33, 1, 1, 80, 100, 18000.00, 12, 0.13517133597971093, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 0}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS Asok", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.13517133597971093, "distanceScore": 100}, "roomType": {"have": "studio", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(359, 33, 12, 2, 80, 100, 16000.00, 12, 0.5438091473942152, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 16000, "score": 100, "status": "pass", "headroom": 2000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-24"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS Asok", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.5438091473942152, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(360, 33, 21, 3, 80, 100, 18000.00, 12, 1.486668778602293, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 0}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-20"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS Asok", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.486668778602293, "distanceScore": 100}, "roomType": {"have": "studio", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(361, 34, 1, 1, 80, 100, 18000.00, 12, 0.13517133597971093, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 0}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS Asok", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.13517133597971093, "distanceScore": 100}, "roomType": {"have": "studio", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(362, 34, 12, 2, 80, 100, 16000.00, 12, 0.5438091473942152, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 16000, "score": 100, "status": "pass", "headroom": 2000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-24"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS Asok", "pinRank": 1, "pinWeight": 1, "distanceKm": 0.5438091473942152, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(363, 34, 21, 3, 80, 100, 18000.00, 12, 1.486668778602293, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 0}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-20"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "BTS Asok", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.486668778602293, "distanceScore": 100}, "roomType": {"have": "studio", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(364, 34, 23, 4, 69, 47, 15000.00, 12, 4.330483851333668, 2, '{"lease": {"want": 12, "score": 100, "terms": [3, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 3000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-05"}, "location": {"score": 47, "overKm": 1.3304838513336676, "status": "near", "pinName": "BTS Phrom Phong", "pinRank": 2, "pinWeight": 0.85, "distanceKm": 4.330483851333668, "distanceScore": 56}, "roomType": {"have": "studio", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(365, 34, 5, 5, 69, 45, 14000.00, 12, 4.400930628175218, 2, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 14000, "score": 100, "status": "pass", "headroom": 4000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-21"}, "location": {"score": 45, "overKm": 1.4009306281752183, "status": "near", "pinName": "BTS Phrom Phong", "pinRank": 2, "pinWeight": 0.85, "distanceKm": 4.400930628175218, "distanceScore": 53}, "roomType": {"have": "studio", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(366, 34, 31, 6, 65, 27, 17000.00, 12, 5.199668647393979, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 17000, "score": 100, "status": "pass", "headroom": 1000}, "moveIn": {"want": "2026-10-15", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 27, "overKm": 2.1996686473939793, "status": "near", "pinName": "BTS Asok", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.199668647393979, "distanceScore": 27}, "roomType": {"have": "studio", "want": "one_bedroom", "score": 0, "status": "mismatch"}}'),
	(258, 27, 29, 1, 100, 100, 36000.00, 12, 2.580015684536064, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 36000, "score": 100, "status": "pass", "headroom": 14000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-26"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.580015684536064, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(259, 27, 18, 2, 100, 100, 27000.00, 12, 2.861939267992649, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 27000, "score": 100, "status": "pass", "headroom": 23000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-30"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.861939267992649, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(260, 27, 6, 3, 100, 100, 45000.00, 12, 3.658711672093843, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 45000, "score": 100, "status": "pass", "headroom": 5000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.658711672093843, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(261, 27, 11, 4, 100, 100, 15000.00, 12, 3.8037065939377706, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 35000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.8037065939377706, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(262, 27, 22, 5, 90, 91, 29500.00, 12, 5.460574947599847, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 29500, "score": 100, "status": "pass", "headroom": 20500}, "moveIn": {"want": "2026-11-01", "score": 56.666666666666664, "status": "later", "daysLate": 13, "availableFrom": "2026-11-14"}, "location": {"score": 91, "overKm": 0.46057494759984685, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.460574947599847, "distanceScore": 91}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(263, 27, 25, 6, 87, 34, 23000.00, 12, 8.283670950010961, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 23000, "score": 100, "status": "pass", "headroom": 27000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-03"}, "location": {"score": 34, "overKm": 3.2836709500109613, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 8.283670950010961, "distanceScore": 34}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(264, 27, 24, 7, 80, 100, 21000.00, 12, 1.2050358696871628, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 21000, "score": 100, "status": "pass", "headroom": 29000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-12"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.2050358696871628, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(265, 27, 28, 8, 80, 100, 45000.00, 12, 2.851452904482099, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 45000, "score": 100, "status": "pass", "headroom": 5000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.851452904482099, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(266, 27, 12, 9, 80, 100, 16000.00, 12, 2.9816837235014195, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 16000, "score": 100, "status": "pass", "headroom": 34000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-24"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.9816837235014195, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(267, 27, 13, 10, 80, 100, 29000.00, 12, 3.133244752629342, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 29000, "score": 100, "status": "pass", "headroom": 21000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-28"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.133244752629342, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(268, 27, 1, 11, 80, 100, 18000.00, 12, 3.2674144973753125, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 32000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.2674144973753125, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(269, 27, 31, 12, 80, 100, 17000.00, 12, 3.293852288552931, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 17000, "score": 100, "status": "pass", "headroom": 33000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.293852288552931, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(270, 27, 21, 13, 80, 100, 18000.00, 12, 3.513087105722894, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 32000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-20"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.513087105722894, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(271, 27, 20, 14, 80, 100, 26000.00, 12, 4.003731299063104, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 26000, "score": 100, "status": "pass", "headroom": 24000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.003731299063104, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(272, 27, 4, 15, 80, 100, 32000.00, 12, 4.116338691877743, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 32000, "score": 100, "status": "pass", "headroom": 18000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-14"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.116338691877743, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(273, 27, 17, 16, 80, 100, 24000.00, 12, 4.638971736569134, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 24000, "score": 100, "status": "pass", "headroom": 26000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.638971736569134, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(274, 27, 15, 17, 80, 100, 30000.00, 12, 4.894591267528162, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 30000, "score": 100, "status": "pass", "headroom": 20000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.894591267528162, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(275, 27, 14, 18, 78, 90, 28500.00, 12, 5.523170924164837, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 28500, "score": 100, "status": "pass", "headroom": 21500}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-08"}, "location": {"score": 90, "overKm": 0.5231709241648366, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.523170924164837, "distanceScore": 90}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(276, 27, 23, 19, 70, 50, 15000.00, 12, 7.503276468117349, 1, '{"lease": {"want": 12, "score": 100, "terms": [3, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 35000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-05"}, "location": {"score": 50, "overKm": 2.503276468117349, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 7.503276468117349, "distanceScore": 50}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(277, 27, 5, 20, 70, 50, 14000.00, 12, 7.519719421663187, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 14000, "score": 100, "status": "pass", "headroom": 36000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-21"}, "location": {"score": 50, "overKm": 2.5197194216631873, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 7.519719421663187, "distanceScore": 50}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(278, 28, 29, 1, 100, 100, 36000.00, 12, 2.580015684536064, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 36000, "score": 100, "status": "pass", "headroom": 14000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-26"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.580015684536064, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(279, 28, 18, 2, 100, 100, 27000.00, 12, 2.861939267992649, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 27000, "score": 100, "status": "pass", "headroom": 23000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-30"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.861939267992649, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(280, 28, 6, 3, 100, 100, 45000.00, 12, 3.658711672093843, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 45000, "score": 100, "status": "pass", "headroom": 5000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.658711672093843, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(281, 28, 11, 4, 100, 100, 15000.00, 12, 3.8037065939377706, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 35000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.8037065939377706, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(282, 28, 22, 5, 90, 91, 29500.00, 12, 5.460574947599847, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 29500, "score": 100, "status": "pass", "headroom": 20500}, "moveIn": {"want": "2026-11-01", "score": 56.666666666666664, "status": "later", "daysLate": 13, "availableFrom": "2026-11-14"}, "location": {"score": 91, "overKm": 0.46057494759984685, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.460574947599847, "distanceScore": 91}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(283, 28, 25, 6, 87, 34, 23000.00, 12, 8.283670950010961, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 23000, "score": 100, "status": "pass", "headroom": 27000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-03"}, "location": {"score": 34, "overKm": 3.2836709500109613, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 8.283670950010961, "distanceScore": 34}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(284, 28, 24, 7, 80, 100, 21000.00, 12, 1.2050358696871628, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 21000, "score": 100, "status": "pass", "headroom": 29000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-12"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.2050358696871628, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(285, 28, 28, 8, 80, 100, 45000.00, 12, 2.851452904482099, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 45000, "score": 100, "status": "pass", "headroom": 5000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.851452904482099, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(286, 28, 12, 9, 80, 100, 16000.00, 12, 2.9816837235014195, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 16000, "score": 100, "status": "pass", "headroom": 34000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-24"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.9816837235014195, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(287, 28, 13, 10, 80, 100, 29000.00, 12, 3.133244752629342, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 29000, "score": 100, "status": "pass", "headroom": 21000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-28"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.133244752629342, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(288, 28, 1, 11, 80, 100, 18000.00, 12, 3.2674144973753125, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 32000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.2674144973753125, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(289, 28, 31, 12, 80, 100, 17000.00, 12, 3.293852288552931, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 17000, "score": 100, "status": "pass", "headroom": 33000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.293852288552931, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(290, 28, 21, 13, 80, 100, 18000.00, 12, 3.513087105722894, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 32000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-20"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.513087105722894, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(291, 28, 20, 14, 80, 100, 26000.00, 12, 4.003731299063104, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 26000, "score": 100, "status": "pass", "headroom": 24000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.003731299063104, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(292, 28, 4, 15, 80, 100, 32000.00, 12, 4.116338691877743, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 32000, "score": 100, "status": "pass", "headroom": 18000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-14"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.116338691877743, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(293, 28, 17, 16, 80, 100, 24000.00, 12, 4.638971736569134, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 24000, "score": 100, "status": "pass", "headroom": 26000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.638971736569134, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(294, 28, 15, 17, 80, 100, 30000.00, 12, 4.894591267528162, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 30000, "score": 100, "status": "pass", "headroom": 20000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.894591267528162, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(295, 28, 14, 18, 78, 90, 28500.00, 12, 5.523170924164837, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 28500, "score": 100, "status": "pass", "headroom": 21500}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-08"}, "location": {"score": 90, "overKm": 0.5231709241648366, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.523170924164837, "distanceScore": 90}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(296, 28, 23, 19, 70, 50, 15000.00, 12, 7.503276468117349, 1, '{"lease": {"want": 12, "score": 100, "terms": [3, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 35000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-05"}, "location": {"score": 50, "overKm": 2.503276468117349, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 7.503276468117349, "distanceScore": 50}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(297, 28, 5, 20, 70, 50, 14000.00, 12, 7.519719421663187, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 14000, "score": 100, "status": "pass", "headroom": 36000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-21"}, "location": {"score": 50, "overKm": 2.5197194216631873, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 7.519719421663187, "distanceScore": 50}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(298, 29, 29, 1, 100, 100, 36000.00, 12, 2.580015684536064, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 36000, "score": 100, "status": "pass", "headroom": 14000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-26"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.580015684536064, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(299, 29, 18, 2, 100, 100, 27000.00, 12, 2.861939267992649, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 27000, "score": 100, "status": "pass", "headroom": 23000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-30"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.861939267992649, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(300, 29, 6, 3, 100, 100, 45000.00, 12, 3.658711672093843, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 45000, "score": 100, "status": "pass", "headroom": 5000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.658711672093843, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(301, 29, 11, 4, 100, 100, 15000.00, 12, 3.8037065939377706, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 35000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.8037065939377706, "distanceScore": 100}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(302, 29, 22, 5, 90, 91, 29500.00, 12, 5.460574947599847, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 29500, "score": 100, "status": "pass", "headroom": 20500}, "moveIn": {"want": "2026-11-01", "score": 56.666666666666664, "status": "later", "daysLate": 13, "availableFrom": "2026-11-14"}, "location": {"score": 91, "overKm": 0.46057494759984685, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.460574947599847, "distanceScore": 91}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(303, 29, 25, 6, 87, 34, 23000.00, 12, 8.283670950010961, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 23000, "score": 100, "status": "pass", "headroom": 27000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-03"}, "location": {"score": 34, "overKm": 3.2836709500109613, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 8.283670950010961, "distanceScore": 34}, "roomType": {"have": "two_bedroom", "want": "two_bedroom", "score": 100, "status": "pass"}}'),
	(304, 29, 24, 7, 80, 100, 21000.00, 12, 1.2050358696871628, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 21000, "score": 100, "status": "pass", "headroom": 29000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-12"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 1.2050358696871628, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(305, 29, 28, 8, 80, 100, 45000.00, 12, 2.851452904482099, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 45000, "score": 100, "status": "pass", "headroom": 5000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.851452904482099, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(306, 29, 12, 9, 80, 100, 16000.00, 12, 2.9816837235014195, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 16000, "score": 100, "status": "pass", "headroom": 34000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-24"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 2.9816837235014195, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(307, 29, 13, 10, 80, 100, 29000.00, 12, 3.133244752629342, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 29000, "score": 100, "status": "pass", "headroom": 21000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-28"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.133244752629342, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(308, 29, 1, 11, 80, 100, 18000.00, 12, 3.2674144973753125, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 32000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-11"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.2674144973753125, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(309, 29, 31, 12, 80, 100, 17000.00, 12, 3.293852288552931, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 17000, "score": 100, "status": "pass", "headroom": 33000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.293852288552931, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(310, 29, 21, 13, 80, 100, 18000.00, 12, 3.513087105722894, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 18000, "score": 100, "status": "pass", "headroom": 32000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-20"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 3.513087105722894, "distanceScore": 100}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(311, 29, 20, 14, 80, 100, 26000.00, 12, 4.003731299063104, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 26000, "score": 100, "status": "pass", "headroom": 24000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.003731299063104, "distanceScore": 100}, "roomType": {"have": "one_bedroom_plus", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(312, 29, 4, 15, 80, 100, 32000.00, 12, 4.116338691877743, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 32000, "score": 100, "status": "pass", "headroom": 18000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-14"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.116338691877743, "distanceScore": 100}, "roomType": {"have": "one_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(313, 29, 17, 16, 80, 100, 24000.00, 12, 4.638971736569134, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 24000, "score": 100, "status": "pass", "headroom": 26000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-16"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.638971736569134, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(314, 29, 15, 17, 80, 100, 30000.00, 12, 4.894591267528162, 1, '{"lease": {"want": 12, "score": 100, "terms": [6, 12], "status": "pass"}, "budget": {"price": 30000, "score": 100, "status": "pass", "headroom": 20000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-01"}, "location": {"score": 100, "overKm": 0, "status": "pass", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 4.894591267528162, "distanceScore": 100}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(315, 29, 14, 18, 78, 90, 28500.00, 12, 5.523170924164837, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 28500, "score": 100, "status": "pass", "headroom": 21500}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-08"}, "location": {"score": 90, "overKm": 0.5231709241648366, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 5.523170924164837, "distanceScore": 90}, "roomType": {"have": "three_bedroom", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(316, 29, 23, 19, 70, 50, 15000.00, 12, 7.503276468117349, 1, '{"lease": {"want": 12, "score": 100, "terms": [3, 12], "status": "pass"}, "budget": {"price": 15000, "score": 100, "status": "pass", "headroom": 35000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-10-05"}, "location": {"score": 50, "overKm": 2.503276468117349, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 7.503276468117349, "distanceScore": 50}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}'),
	(317, 29, 5, 20, 70, 50, 14000.00, 12, 7.519719421663187, 1, '{"lease": {"want": 12, "score": 100, "terms": [12], "status": "pass"}, "budget": {"price": 14000, "score": 100, "status": "pass", "headroom": 36000}, "moveIn": {"want": "2026-11-01", "score": 100, "status": "pass", "daysLate": 0, "availableFrom": "2026-09-21"}, "location": {"score": 50, "overKm": 2.5197194216631873, "status": "near", "pinName": "MRT Thailand Cultural Centre", "pinRank": 1, "pinWeight": 1, "distanceKm": 7.519719421663187, "distanceScore": 50}, "roomType": {"have": "studio", "want": "two_bedroom", "score": 0, "status": "mismatch"}}');


--
-- Data for Name: lead_viewings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.lead_viewings (id, lead_id, rent_room_id, created_by_user_id, scheduled_at, status, note, created_at, updated_at) VALUES
	(1, 10, 18, 1, '2026-10-05 10:00:00+00', 'scheduled', NULL, '2026-10-05 03:30:11.862495+00', '2026-10-05 03:30:11.862495+00'),
	(2, 16, 10, 1, '2026-10-08 05:00:00+00', 'scheduled', NULL, '2026-10-05 03:46:56.015751+00', '2026-10-05 03:46:58.808804+00'),
	(3, 9, 31, 1, '2026-10-08 07:00:00+00', 'scheduled', NULL, '2026-10-05 04:47:59.019322+00', '2026-10-05 04:47:59.019322+00'),
	(4, 8, 19, 1, '2026-10-08 06:00:00+00', 'scheduled', NULL, '2026-10-05 04:48:30.633369+00', '2026-10-05 04:48:30.633369+00'),
	(5, 8, 24, 1, '2026-10-05 09:00:00+00', 'scheduled', NULL, '2026-10-05 08:53:13.914882+00', '2026-10-05 08:53:13.914882+00'),
	(6, 12, 12, 1, '2026-10-07 07:00:00+00', 'scheduled', NULL, '2026-10-06 07:25:54.319164+00', '2026-10-06 07:25:54.319164+00'),
	(7, 12, 29, 1, '2026-10-06 08:00:00+00', 'scheduled', NULL, '2026-10-06 07:26:57.93385+00', '2026-10-06 07:26:57.93385+00'),
	(8, 12, 20, 1, '2026-10-06 10:00:00+00', 'scheduled', NULL, '2026-10-06 07:27:19.496609+00', '2026-10-06 07:27:19.496609+00'),
	(9, 12, 18, 1, '2026-10-06 08:00:00+00', 'scheduled', NULL, '2026-10-06 07:27:49.364481+00', '2026-10-06 07:27:49.364481+00');


--
-- Data for Name: rent_room_contacts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.rent_room_contacts (id, rent_room_id, contact_id, is_primary, role_code, created_at) VALUES
	(1, 10, 1, true, 'contact', '2026-09-11 09:34:57.005329+00'),
	(4, 11, 1, true, 'contact', '2026-09-16 09:37:59.157339+00'),
	(5, 11, 2, false, 'contact', '2026-09-16 09:37:59.157339+00'),
	(18, 12, 2, true, 'contact', '2026-09-24 07:08:34.02836+00'),
	(19, 32, 2, true, 'contact', '2026-10-01 07:23:19.426464+00');


--
-- Data for Name: rent_room_documents; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: rent_room_prices; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.rent_room_prices (id, rent_room_id, contract_type_id, price) VALUES
	(1, 1, 1, 18000.00),
	(2, 2, 1, 26000.00),
	(3, 3, 1, 22000.00),
	(4, 4, 1, 32000.00),
	(5, 5, 1, 14000.00),
	(6, 6, 1, 45000.00),
	(7, 7, 1, 28000.00),
	(8, 8, 1, 21000.00),
	(9, 9, 1, 24000.00),
	(12, 10, 1, 19000.00),
	(15, 11, 2, 20000.00),
	(16, 11, 1, 15000.00),
	(31, 12, 2, 18000.00),
	(32, 12, 1, 16000.00),
	(34, 31, 1, 17000.00),
	(35, 29, 1, 36000.00),
	(36, 28, 1, 45000.00),
	(37, 27, 1, 85000.00),
	(38, 26, 1, 29900.00),
	(39, 25, 1, 23000.00),
	(40, 24, 1, 21000.00),
	(41, 23, 1, 15000.00),
	(42, 22, 1, 29500.00),
	(43, 21, 1, 18000.00),
	(44, 20, 1, 26000.00),
	(45, 19, 1, 22000.00),
	(46, 30, 1, 25000.00),
	(47, 15, 1, 30000.00),
	(48, 14, 1, 28500.00),
	(49, 13, 1, 29000.00),
	(50, 18, 1, 27000.00),
	(51, 17, 1, 24000.00),
	(52, 31, 2, 17500.00),
	(53, 28, 2, 48000.00),
	(54, 24, 2, 23000.00),
	(55, 21, 2, 19500.00),
	(56, 19, 2, 24000.00),
	(57, 15, 2, 33000.00),
	(58, 13, 2, 32000.00),
	(59, 18, 2, 29000.00),
	(60, 16, 2, 26000.00),
	(61, 23, 3, 17000.00),
	(62, 19, 3, 26000.00),
	(63, 16, 3, 28000.00),
	(64, 32, 1, 20000.00);


--
-- Data for Name: room_facilities; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.room_facilities (id, rent_room_id, group_id, f_id) VALUES
	(268, 31, 8, 30),
	(269, 29, 8, 30),
	(270, 28, 8, 30),
	(271, 27, 8, 30),
	(272, 26, 8, 30),
	(273, 25, 8, 30),
	(274, 24, 8, 30),
	(275, 23, 8, 30),
	(276, 22, 8, 30),
	(277, 21, 8, 30),
	(278, 20, 8, 30),
	(279, 19, 8, 30),
	(280, 30, 8, 30),
	(281, 15, 8, 30),
	(282, 14, 8, 30),
	(283, 13, 8, 30),
	(284, 18, 8, 30),
	(285, 17, 8, 30),
	(286, 16, 8, 30),
	(287, 27, 8, 31),
	(288, 27, 8, 32),
	(289, 15, 8, 32),
	(290, 31, 8, 33),
	(291, 27, 8, 33),
	(292, 24, 8, 33),
	(293, 21, 8, 33),
	(294, 20, 8, 33),
	(295, 19, 8, 33),
	(296, 15, 8, 33),
	(297, 13, 8, 33),
	(298, 18, 8, 33),
	(299, 29, 8, 34),
	(300, 28, 8, 34),
	(301, 27, 8, 34),
	(302, 26, 8, 34),
	(303, 25, 8, 34),
	(304, 22, 8, 34),
	(305, 15, 8, 34),
	(306, 14, 8, 34),
	(307, 13, 8, 34),
	(308, 18, 8, 34),
	(309, 16, 8, 34),
	(310, 27, 8, 35),
	(311, 20, 8, 35),
	(312, 15, 8, 35),
	(313, 18, 8, 35),
	(315, 29, 8, 36),
	(316, 28, 8, 36),
	(317, 27, 8, 36),
	(318, 26, 8, 36),
	(319, 25, 8, 36),
	(320, 24, 8, 36),
	(321, 22, 8, 36),
	(322, 20, 8, 36),
	(323, 19, 8, 36),
	(324, 30, 8, 36),
	(325, 15, 8, 36),
	(326, 14, 8, 36),
	(327, 13, 8, 36),
	(328, 18, 8, 36),
	(329, 17, 8, 36),
	(330, 16, 8, 36),
	(332, 31, 8, 37),
	(333, 29, 8, 37),
	(334, 28, 8, 37),
	(335, 27, 8, 37),
	(336, 26, 8, 37),
	(337, 25, 8, 37),
	(338, 24, 8, 37),
	(339, 23, 8, 37),
	(340, 22, 8, 37),
	(341, 21, 8, 37),
	(342, 20, 8, 37),
	(229, 12, 8, 30),
	(230, 12, 8, 33),
	(231, 12, 8, 34),
	(232, 12, 8, 35),
	(233, 12, 8, 36),
	(234, 12, 8, 37),
	(235, 12, 8, 38),
	(236, 12, 9, 40),
	(237, 12, 9, 42),
	(238, 12, 9, 44),
	(239, 12, 9, 45),
	(240, 12, 9, 47),
	(241, 12, 9, 48),
	(242, 12, 9, 49),
	(243, 12, 9, 51),
	(244, 12, 9, 52),
	(245, 12, 9, 53),
	(246, 12, 10, 57),
	(247, 12, 10, 59),
	(248, 12, 10, 62),
	(249, 12, 11, 64),
	(250, 12, 11, 66),
	(251, 12, 11, 69),
	(252, 12, 12, 72),
	(253, 12, 12, 73),
	(254, 12, 12, 76),
	(255, 12, 12, 77),
	(256, 12, 12, 78),
	(257, 12, 12, 79),
	(258, 12, 13, 81),
	(259, 12, 13, 82),
	(260, 12, 13, 83),
	(261, 12, 13, 84),
	(262, 12, 13, 85),
	(263, 12, 13, 86),
	(264, 12, 13, 87),
	(265, 12, 13, 88),
	(266, 12, 12, 80),
	(343, 19, 8, 37),
	(344, 30, 8, 37),
	(345, 15, 8, 37),
	(346, 14, 8, 37),
	(347, 13, 8, 37),
	(348, 18, 8, 37),
	(349, 17, 8, 37),
	(350, 16, 8, 37),
	(352, 31, 8, 38),
	(353, 29, 8, 38),
	(354, 28, 8, 38),
	(355, 27, 8, 38),
	(356, 26, 8, 38),
	(357, 25, 8, 38),
	(358, 24, 8, 38),
	(359, 23, 8, 38),
	(360, 22, 8, 38),
	(361, 21, 8, 38),
	(362, 20, 8, 38),
	(363, 19, 8, 38),
	(364, 30, 8, 38),
	(365, 15, 8, 38),
	(366, 14, 8, 38),
	(367, 13, 8, 38),
	(368, 18, 8, 38),
	(369, 17, 8, 38),
	(370, 16, 8, 38),
	(371, 27, 9, 39),
	(372, 20, 9, 39),
	(373, 15, 9, 39),
	(374, 31, 9, 40),
	(375, 27, 9, 40),
	(376, 24, 9, 40),
	(377, 21, 9, 40),
	(378, 20, 9, 40),
	(379, 19, 9, 40),
	(380, 15, 9, 40),
	(381, 13, 9, 40),
	(382, 18, 9, 40),
	(383, 27, 9, 41),
	(384, 15, 9, 41),
	(385, 27, 9, 42),
	(386, 20, 9, 42),
	(387, 15, 9, 42),
	(388, 13, 9, 42),
	(389, 16, 9, 43),
	(390, 28, 9, 44),
	(391, 27, 9, 44),
	(392, 26, 9, 44),
	(393, 24, 9, 44),
	(394, 22, 9, 44),
	(395, 20, 9, 44),
	(396, 19, 9, 44),
	(397, 15, 9, 44),
	(398, 13, 9, 44),
	(399, 18, 9, 44),
	(401, 31, 9, 45),
	(402, 29, 9, 45),
	(403, 28, 9, 45),
	(404, 27, 9, 45),
	(405, 26, 9, 45),
	(406, 25, 9, 45),
	(407, 24, 9, 45),
	(408, 23, 9, 45),
	(409, 22, 9, 45),
	(410, 21, 9, 45),
	(411, 20, 9, 45),
	(412, 19, 9, 45),
	(413, 30, 9, 45),
	(414, 15, 9, 45),
	(415, 14, 9, 45),
	(416, 13, 9, 45),
	(417, 18, 9, 45),
	(418, 17, 9, 45),
	(419, 16, 9, 45),
	(420, 27, 9, 46),
	(421, 26, 9, 46),
	(422, 15, 9, 46),
	(424, 29, 9, 47),
	(425, 28, 9, 47),
	(426, 27, 9, 47),
	(427, 26, 9, 47),
	(428, 25, 9, 47),
	(429, 24, 9, 47),
	(430, 22, 9, 47),
	(431, 20, 9, 47),
	(432, 19, 9, 47),
	(433, 30, 9, 47),
	(434, 15, 9, 47);
INSERT INTO public.room_facilities (id, rent_room_id, group_id, f_id) VALUES
	(435, 14, 9, 47),
	(436, 13, 9, 47),
	(437, 18, 9, 47),
	(438, 17, 9, 47),
	(439, 16, 9, 47),
	(440, 31, 9, 48),
	(441, 27, 9, 48),
	(442, 24, 9, 48),
	(443, 23, 9, 48),
	(444, 21, 9, 48),
	(445, 20, 9, 48),
	(446, 19, 9, 48),
	(447, 15, 9, 48),
	(448, 13, 9, 48),
	(449, 18, 9, 48),
	(451, 31, 9, 49),
	(452, 29, 9, 49),
	(453, 28, 9, 49),
	(454, 27, 9, 49),
	(455, 26, 9, 49),
	(456, 25, 9, 49),
	(457, 24, 9, 49),
	(458, 23, 9, 49),
	(459, 22, 9, 49),
	(460, 21, 9, 49),
	(461, 20, 9, 49),
	(462, 19, 9, 49),
	(463, 30, 9, 49),
	(464, 15, 9, 49),
	(465, 14, 9, 49),
	(466, 13, 9, 49),
	(467, 18, 9, 49),
	(468, 17, 9, 49),
	(469, 16, 9, 49),
	(470, 31, 9, 51),
	(471, 29, 9, 51),
	(472, 28, 9, 51),
	(473, 27, 9, 51),
	(474, 26, 9, 51),
	(475, 24, 9, 51),
	(476, 22, 9, 51),
	(477, 21, 9, 51),
	(478, 20, 9, 51),
	(479, 19, 9, 51),
	(480, 15, 9, 51),
	(481, 18, 9, 51),
	(482, 16, 9, 52),
	(484, 31, 9, 53),
	(485, 29, 9, 53),
	(486, 28, 9, 53),
	(487, 27, 9, 53),
	(488, 26, 9, 53),
	(489, 25, 9, 53),
	(490, 24, 9, 53),
	(491, 23, 9, 53),
	(492, 22, 9, 53),
	(493, 21, 9, 53),
	(494, 20, 9, 53),
	(495, 19, 9, 53),
	(496, 30, 9, 53),
	(497, 15, 9, 53),
	(498, 14, 9, 53),
	(499, 13, 9, 53),
	(500, 18, 9, 53),
	(501, 17, 9, 53),
	(502, 16, 9, 53),
	(503, 27, 10, 56),
	(504, 16, 10, 56),
	(505, 15, 10, 57),
	(506, 16, 10, 57),
	(507, 31, 10, 59),
	(508, 29, 10, 59),
	(509, 28, 10, 59),
	(510, 27, 10, 59),
	(511, 26, 10, 59),
	(512, 25, 10, 59),
	(513, 24, 10, 59),
	(514, 22, 10, 59),
	(515, 20, 10, 59),
	(516, 19, 10, 59),
	(517, 30, 10, 59),
	(518, 15, 10, 59),
	(519, 14, 10, 59),
	(520, 13, 10, 59),
	(521, 18, 10, 59),
	(522, 17, 10, 59),
	(523, 27, 10, 60),
	(524, 26, 10, 60),
	(525, 15, 10, 60),
	(526, 13, 10, 60),
	(528, 29, 10, 62),
	(529, 27, 10, 62),
	(530, 26, 10, 62),
	(531, 25, 10, 62),
	(532, 30, 10, 62),
	(533, 14, 10, 62),
	(534, 13, 10, 62),
	(535, 17, 10, 62),
	(536, 16, 10, 62),
	(537, 31, 10, 63),
	(538, 28, 10, 63),
	(539, 24, 10, 63),
	(540, 23, 10, 63),
	(541, 22, 10, 63),
	(542, 21, 10, 63),
	(543, 20, 10, 63),
	(544, 19, 10, 63),
	(545, 15, 10, 63),
	(546, 18, 10, 63),
	(547, 27, 11, 64),
	(548, 15, 11, 64),
	(549, 27, 11, 65),
	(550, 20, 11, 65),
	(551, 15, 11, 65),
	(552, 27, 11, 66),
	(553, 13, 11, 66),
	(554, 23, 11, 68),
	(555, 16, 11, 68),
	(557, 29, 11, 69),
	(558, 28, 11, 69),
	(559, 27, 11, 69),
	(560, 26, 11, 69),
	(561, 25, 11, 69),
	(562, 24, 11, 69),
	(563, 22, 11, 69),
	(564, 19, 11, 69),
	(565, 30, 11, 69),
	(566, 15, 11, 69),
	(567, 14, 11, 69),
	(568, 13, 11, 69),
	(569, 18, 11, 69),
	(570, 17, 11, 69),
	(571, 16, 11, 69),
	(572, 23, 12, 72),
	(573, 21, 12, 72),
	(574, 15, 12, 72),
	(575, 19, 12, 73),
	(576, 13, 12, 73),
	(577, 18, 12, 73),
	(578, 31, 12, 76),
	(579, 27, 12, 76),
	(580, 24, 12, 76),
	(581, 20, 12, 76),
	(582, 15, 12, 76),
	(583, 18, 12, 76),
	(584, 27, 12, 77),
	(585, 20, 12, 77),
	(586, 14, 12, 77),
	(587, 29, 12, 78),
	(588, 27, 12, 78),
	(589, 26, 12, 78),
	(590, 20, 12, 78),
	(591, 15, 12, 78),
	(592, 13, 12, 78),
	(593, 31, 12, 79),
	(594, 29, 12, 79),
	(595, 28, 12, 79),
	(596, 27, 12, 79),
	(597, 26, 12, 79),
	(598, 25, 12, 79),
	(599, 24, 12, 79),
	(600, 22, 12, 79),
	(601, 21, 12, 79),
	(602, 20, 12, 79),
	(603, 19, 12, 79),
	(604, 30, 12, 79),
	(605, 15, 12, 79),
	(606, 14, 12, 79),
	(607, 13, 12, 79),
	(608, 18, 12, 79),
	(609, 17, 12, 79),
	(610, 16, 13, 81),
	(611, 27, 13, 82),
	(612, 26, 13, 82),
	(613, 20, 13, 82),
	(614, 15, 13, 82),
	(615, 31, 13, 83),
	(616, 27, 13, 83),
	(617, 24, 13, 83),
	(618, 20, 13, 83),
	(619, 19, 13, 83),
	(620, 15, 13, 83),
	(621, 13, 13, 83),
	(622, 18, 13, 83),
	(623, 27, 13, 84),
	(624, 15, 13, 84),
	(625, 27, 13, 85),
	(626, 20, 13, 85),
	(627, 15, 13, 85),
	(629, 31, 13, 86),
	(630, 29, 13, 86),
	(631, 28, 13, 86),
	(632, 27, 13, 86),
	(633, 26, 13, 86),
	(634, 25, 13, 86),
	(635, 24, 13, 86),
	(636, 23, 13, 86),
	(637, 22, 13, 86),
	(638, 21, 13, 86),
	(639, 20, 13, 86);
INSERT INTO public.room_facilities (id, rent_room_id, group_id, f_id) VALUES
	(640, 19, 13, 86),
	(641, 30, 13, 86),
	(642, 15, 13, 86),
	(643, 14, 13, 86),
	(644, 13, 13, 86),
	(645, 18, 13, 86),
	(646, 17, 13, 86),
	(647, 16, 13, 86),
	(648, 31, 13, 87),
	(649, 29, 13, 87),
	(650, 28, 13, 87),
	(651, 27, 13, 87),
	(652, 26, 13, 87),
	(653, 25, 13, 87),
	(654, 24, 13, 87),
	(655, 23, 13, 87),
	(656, 22, 13, 87),
	(657, 21, 13, 87),
	(658, 20, 13, 87),
	(659, 19, 13, 87),
	(660, 30, 13, 87),
	(661, 15, 13, 87),
	(662, 14, 13, 87),
	(663, 13, 13, 87),
	(664, 18, 13, 87),
	(665, 17, 13, 87),
	(667, 31, 13, 88),
	(668, 29, 13, 88),
	(669, 28, 13, 88),
	(670, 27, 13, 88),
	(671, 26, 13, 88),
	(672, 25, 13, 88),
	(673, 24, 13, 88),
	(674, 22, 13, 88),
	(675, 21, 13, 88),
	(676, 20, 13, 88),
	(677, 19, 13, 88),
	(678, 30, 13, 88),
	(679, 15, 13, 88),
	(680, 14, 13, 88),
	(681, 13, 13, 88),
	(682, 18, 13, 88),
	(683, 17, 13, 88),
	(685, 31, 12, 80),
	(686, 29, 12, 80),
	(687, 28, 12, 80),
	(688, 27, 12, 80),
	(689, 26, 12, 80),
	(690, 25, 12, 80),
	(691, 24, 12, 80),
	(692, 23, 12, 80),
	(693, 22, 12, 80),
	(694, 21, 12, 80),
	(695, 20, 12, 80),
	(696, 19, 12, 80),
	(697, 30, 12, 80),
	(698, 15, 12, 80),
	(699, 14, 12, 80),
	(700, 13, 12, 80),
	(701, 18, 12, 80),
	(702, 17, 12, 80),
	(703, 32, 8, 30),
	(704, 32, 8, 36),
	(705, 32, 8, 37),
	(706, 32, 8, 38),
	(707, 32, 9, 45),
	(708, 32, 9, 47),
	(709, 32, 9, 49),
	(710, 32, 9, 53),
	(711, 32, 10, 62),
	(712, 32, 11, 69),
	(713, 32, 13, 86),
	(714, 32, 13, 88),
	(715, 32, 12, 80);


--
-- Data for Name: room_layout_values; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.room_layout_values (id, rent_room_id, layout_id, value) VALUES
	(5, 1, 1, '0'),
	(6, 1, 2, '1'),
	(7, 1, 3, '34'),
	(8, 2, 1, '1'),
	(9, 2, 2, '1'),
	(10, 2, 3, '37'),
	(11, 3, 1, '2'),
	(12, 3, 2, '2'),
	(13, 3, 3, '55'),
	(14, 4, 1, '1'),
	(15, 4, 2, '1'),
	(16, 4, 3, '36'),
	(17, 5, 1, '0'),
	(18, 5, 2, '1'),
	(19, 5, 3, '33'),
	(20, 6, 1, '2'),
	(21, 6, 2, '2'),
	(22, 6, 3, '64'),
	(23, 7, 1, '1'),
	(24, 7, 2, '1'),
	(25, 7, 3, '45'),
	(26, 8, 1, '0'),
	(27, 8, 2, '1'),
	(28, 8, 3, '31'),
	(29, 9, 1, '1'),
	(30, 9, 2, '1'),
	(31, 9, 3, '39'),
	(3, 10, 1, '2'),
	(4, 10, 2, '2'),
	(34, 10, 3, '52'),
	(40, 11, 1, '2'),
	(41, 11, 2, '1'),
	(42, 11, 3, '999'),
	(43, 11, 4, '99'),
	(44, 11, 5, 'ZZ'),
	(80, 12, 1, '1'),
	(81, 12, 2, '1'),
	(82, 12, 3, '40'),
	(83, 12, 4, '9'),
	(84, 12, 5, 'B'),
	(86, 31, 1, '0'),
	(87, 29, 1, '2'),
	(88, 28, 1, '3'),
	(89, 27, 1, '3'),
	(90, 26, 1, '3'),
	(91, 25, 1, '2'),
	(92, 24, 1, '1'),
	(93, 23, 1, '0'),
	(94, 22, 1, '2'),
	(95, 21, 1, '0'),
	(96, 20, 1, '1'),
	(97, 19, 1, '1'),
	(98, 30, 1, '3'),
	(99, 15, 1, '3'),
	(100, 14, 1, '3'),
	(101, 13, 1, '3'),
	(102, 18, 1, '2'),
	(103, 17, 1, '3'),
	(104, 16, 1, '3'),
	(106, 31, 2, '1'),
	(107, 29, 2, '2'),
	(108, 28, 2, '2'),
	(109, 27, 2, '4'),
	(110, 26, 2, '3'),
	(111, 25, 2, '1'),
	(112, 24, 2, '1'),
	(113, 23, 2, '1'),
	(114, 22, 2, '2'),
	(115, 21, 2, '1'),
	(116, 20, 2, '1'),
	(117, 19, 2, '1'),
	(118, 30, 2, '2'),
	(119, 15, 2, '3'),
	(120, 14, 2, '2'),
	(121, 13, 2, '2'),
	(122, 18, 2, '2'),
	(123, 17, 2, '2'),
	(124, 16, 2, '3'),
	(126, 31, 3, '28'),
	(127, 29, 3, '80'),
	(128, 28, 3, '115'),
	(129, 27, 3, '220'),
	(130, 26, 3, '140'),
	(131, 25, 3, '58'),
	(132, 24, 3, '35'),
	(133, 23, 3, '26'),
	(134, 22, 3, '70'),
	(135, 21, 3, '30'),
	(136, 20, 3, '55'),
	(137, 19, 3, '42'),
	(138, 30, 3, '95'),
	(139, 15, 3, '130'),
	(140, 14, 3, '105'),
	(141, 13, 3, '120'),
	(142, 18, 3, '65'),
	(143, 17, 3, '98'),
	(144, 16, 3, '160'),
	(146, 31, 4, '16'),
	(147, 29, 4, '25'),
	(148, 28, 4, '22'),
	(149, 27, 4, '40'),
	(150, 26, 4, '30'),
	(151, 25, 4, '11'),
	(152, 24, 4, '19'),
	(153, 23, 4, '7'),
	(154, 22, 4, '26'),
	(155, 21, 4, '21'),
	(156, 20, 4, '35'),
	(157, 19, 4, '9'),
	(158, 30, 4, '14'),
	(159, 15, 4, '32'),
	(160, 14, 4, '15'),
	(161, 13, 4, '28'),
	(162, 18, 4, '18'),
	(163, 17, 4, '12'),
	(164, 16, 4, '1'),
	(166, 31, 5, 'A'),
	(167, 29, 5, 'B'),
	(168, 28, 5, 'A'),
	(169, 27, 5, 'A'),
	(170, 26, 5, 'A'),
	(171, 25, 5, 'A'),
	(172, 24, 5, 'A'),
	(173, 23, 5, 'A'),
	(174, 22, 5, 'A'),
	(175, 21, 5, 'B'),
	(176, 20, 5, 'A'),
	(177, 19, 5, 'B'),
	(178, 30, 5, 'A'),
	(179, 15, 5, 'C'),
	(180, 14, 5, 'B'),
	(181, 13, 5, 'A'),
	(182, 18, 5, 'A'),
	(183, 17, 5, 'A'),
	(184, 32, 1, '2'),
	(185, 32, 2, '1'),
	(186, 32, 3, '60'),
	(187, 32, 4, '8'),
	(188, 32, 5, 'A');


--
-- Data for Name: room_medias; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.room_medias (id, rent_id, media_url, media_type, category, is_cover, sort_order, created_at) VALUES
	(212, 11, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/1fb43fc7-4b14-4044-92d0-61874395443e.jpg', 'image', 'room', true, 0, '2026-09-16 09:37:59.157339+00'),
	(213, 11, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/ae4fadd5-c9e5-4370-b403-83dd8fc7912f.jpg', 'image', 'room', false, 1, '2026-09-16 09:37:59.157339+00'),
	(214, 11, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/f96163f2-0ba3-4aa5-844c-9d363b0d79ca.jpg', 'image', 'room', false, 2, '2026-09-16 09:37:59.157339+00'),
	(215, 11, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/3eac9791-1cc0-4aeb-954c-3909d41924ae.jpg', 'image', 'room', false, 3, '2026-09-16 09:37:59.157339+00'),
	(216, 11, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/0b297f6b-44da-4acf-b46a-1b7ca5d54bee.jpg', 'image', 'room', false, 4, '2026-09-16 09:37:59.157339+00'),
	(269, 13, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/0929f14d-7516-4042-bdb3-e9e0d2b49c09.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:06.664309+00'),
	(270, 13, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/aa503d18-cdb6-4a2c-9aae-c5b54a658098.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:06.809871+00'),
	(271, 13, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/5887da51-8a50-4199-b066-89ca1a80ee94.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:06.943749+00'),
	(272, 13, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/d8af613c-419d-4284-bb03-cbab9a61d709.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:07.756708+00'),
	(273, 13, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/c4c1d688-af22-4644-94f3-cd44eac46070.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:08.471994+00'),
	(274, 14, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/4673521a-36d7-40fa-99f1-30ad6c61b1d3.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:08.518385+00'),
	(275, 14, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/3aa17629-13c1-4c63-8d25-2acd1c079eb4.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:08.563652+00'),
	(276, 14, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/eb4b2b0d-910b-4771-a9fc-9b9a9afd45be.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:08.630009+00'),
	(277, 14, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/6b0d6093-2b78-4ccc-9dbf-a0c5fd4378a5.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:08.663756+00'),
	(278, 14, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/e6ace86e-1534-4028-b003-2e073bdf7cda.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:09.422488+00'),
	(279, 15, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/8300d032-3ac6-4a09-b6e2-052baed37314.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:09.45721+00'),
	(280, 15, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/854b38b0-f86b-49f5-b12a-328a0b0add57.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:09.487706+00'),
	(281, 15, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/7e15635b-bbde-42fc-834f-b03b02042a0b.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:09.515486+00'),
	(282, 15, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/19e3ecff-0f1b-405e-8ce6-9f7dbad9b82b.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:09.551895+00'),
	(283, 15, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/8d70efdb-04a8-4f50-88ae-6e6d0281ba03.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:09.83129+00'),
	(284, 16, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/6bdbe119-dd8e-49e4-bfa6-93fed925f33c.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:09.867476+00'),
	(285, 16, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/0af97aec-9416-4e43-867a-ac29e8701e40.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:09.896968+00'),
	(286, 16, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/15d8f496-3bc7-4a4a-bb02-856c2f5d054b.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:09.933108+00'),
	(287, 16, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/bbd49705-d038-40b7-9406-f152328b588c.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:09.969412+00'),
	(288, 16, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/bc212103-bf67-43a7-8900-0da10308ac75.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:11.106139+00'),
	(289, 17, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/c9b17796-4057-4478-b621-ff32320d081b.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:11.135194+00'),
	(290, 17, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/14675806-bf17-4105-9a02-41d117051918.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:11.164446+00'),
	(291, 17, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/03cfb5a6-5fdc-428f-aa86-ff88d73c7b49.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:11.392603+00'),
	(292, 17, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/35221bfb-e24d-40fc-beda-661e48b78d4a.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:11.424068+00'),
	(293, 17, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/29447c9f-3108-42a0-a911-a095a9f14b64.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:11.549013+00'),
	(294, 18, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/fd18c8a2-c80e-444f-b3cb-4a6b0a382871.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:11.583754+00'),
	(295, 18, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/fb42122a-e5a5-4708-8126-ac49df82fad3.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:11.612924+00'),
	(296, 18, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/4fabc685-0f13-4284-9285-a9f42dc1a4c7.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:11.63971+00'),
	(297, 18, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/a9448e87-6173-4c9d-ab0e-f50cc73a7ec3.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:11.708756+00'),
	(298, 18, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/cc5b2d18-32e9-4867-ba52-9dd3d7d4b0e6.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:11.840806+00'),
	(299, 19, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/faa4fe93-6730-4702-9564-1ca4b232ac20.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:11.923253+00'),
	(300, 19, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/8dbd4f36-04ca-4754-badb-5f3220d99a52.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:11.950584+00'),
	(301, 19, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/42962db0-27dc-4854-919b-e649f1c9ebe6.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:12.014618+00'),
	(302, 19, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/7fccfe9f-11b1-4f61-83ea-067a54874008.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:12.040743+00'),
	(303, 19, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/5bbc25ec-b0a0-42f5-994f-9d51b903ae9d.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:12.068068+00'),
	(304, 20, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/c398e1ab-8ad4-4635-8191-035b20bf2a69.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:12.096418+00'),
	(305, 20, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/2c9c54bb-c206-496b-97b0-af5a9b6a0edf.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:12.15924+00'),
	(306, 20, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/0c96b878-dcd7-4d79-903d-94abc618314a.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:12.207021+00'),
	(307, 20, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/7dd08a03-1396-42de-87de-32fb625d9206.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:12.234723+00'),
	(308, 20, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/9056196b-fb90-4ac8-b885-6d12ac90f7f4.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:12.267274+00'),
	(309, 21, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/0eab9376-6114-47e2-985c-f9313f65740c.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:12.297271+00'),
	(209, 10, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/f3a44e1f-a662-43cc-97e6-4822b5774b28.jpg', 'image', 'room', false, 2, '2026-09-14 08:36:06.660641+00'),
	(210, 10, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/d5801787-06e9-4f0d-b899-30d129ae26ec.jpg', 'image', 'room', false, 3, '2026-09-14 08:36:06.686597+00'),
	(211, 10, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/098955b8-2938-4032-b581-5669b60326f7.jpg', 'image', 'room', false, 4, '2026-09-14 08:36:06.71022+00'),
	(258, 12, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/6c02aadd-b399-4ede-b909-1541006d1107.jpg', 'image', 'room', true, 0, '2026-09-24 07:08:34.02836+00'),
	(259, 12, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/a63ef4df-43b5-46df-85f5-01600e2b8e4c.jpg', 'image', 'room', false, 1, '2026-09-24 07:08:34.02836+00'),
	(260, 12, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/025ac8c7-6fdb-4d8a-b511-75820090c9ab.jpg', 'image', 'room', false, 2, '2026-09-24 07:08:34.02836+00'),
	(261, 12, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/f21c8790-fa45-4e13-b498-41c9942340fd.jpg', 'image', 'room', false, 3, '2026-09-24 07:08:34.02836+00'),
	(262, 12, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/dbdd2eb0-00df-40bb-adff-bcbe9c41a071.jpg', 'image', 'room', false, 4, '2026-09-24 07:08:34.02836+00'),
	(263, 12, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/1d5cfcdf-f6a7-4736-be1b-8110758bcab2.jpg', 'image', 'room', false, 5, '2026-09-24 07:08:34.02836+00'),
	(264, 12, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/3f35ce90-ad3a-49e5-a6c1-18b456b59e6f.jpg', 'image', 'room', false, 6, '2026-09-24 07:08:34.02836+00'),
	(265, 12, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/c58d7861-c9ef-44b6-ac1f-812aaa66b792.jpg', 'image', 'room', false, 7, '2026-09-24 07:08:34.02836+00'),
	(266, 12, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/f67902a5-af56-4426-bbcc-59c2f04ed32f.jpg', 'image', 'room', false, 8, '2026-09-24 07:08:34.02836+00'),
	(267, 12, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/b66b09b2-32c7-4621-9347-7fa19a8202fb.jpg', 'image', 'room', false, 9, '2026-09-24 07:08:34.02836+00'),
	(268, 12, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/fe9a60ec-ed71-4a9a-b47d-2149b890ec9d.jpg', 'image', 'room', false, 10, '2026-09-24 07:08:34.02836+00'),
	(310, 21, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/b543184d-cb80-4fa9-923d-11e4233ef1a9.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:12.32464+00'),
	(311, 21, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/e2b99ff2-2191-4796-b542-2cba46ab37b5.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:12.352219+00'),
	(312, 21, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/a4637fbc-8dff-4e65-9f5a-15daaa8b3b39.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:12.453831+00'),
	(313, 21, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/3c5c3b4a-a521-444d-96e5-3f2b69cdb970.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:12.486822+00'),
	(314, 22, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/1a68b47f-718a-4fa6-8b35-97e9bbdefd14.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:12.517153+00'),
	(315, 22, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/39c8997e-e60d-432b-a47b-1a1afc4c7df5.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:12.543696+00'),
	(316, 22, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/1a63746a-a6d0-4a37-bb2c-66f8bf57bab8.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:12.575253+00'),
	(317, 22, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/67bc85e9-eb14-4889-8283-d7915c3462cf.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:12.607287+00'),
	(318, 22, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/6f1308da-9368-40e4-99fb-41c16a493cd5.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:12.635841+00'),
	(319, 23, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/d45ca6d8-3c6c-4453-94a7-3372627c593f.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:12.668516+00'),
	(320, 23, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/a529a804-a13c-415a-8b5b-9484e9e599f0.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:12.701145+00'),
	(321, 23, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/fb85df7a-ab85-4799-83d5-c8ea7e30301a.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:12.747135+00'),
	(322, 23, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/f31ab95b-08b8-49b9-8f8e-21317c5b710b.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:12.855832+00'),
	(323, 23, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/0b1ca4a4-8300-4ca6-8f37-bef39afaee66.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:12.929325+00'),
	(324, 24, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/52c0f27f-b00d-4454-9a97-1618eeda879f.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:12.976662+00'),
	(325, 24, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/19a30dfa-b23b-4e42-b122-33d67c577623.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:13.017035+00'),
	(326, 24, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/54792c08-41a2-4b75-a61c-c4a91f5afd0a.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:13.043074+00'),
	(327, 24, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/2ed31b91-3241-4f67-ab60-e9f4b9fba21c.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:13.066272+00'),
	(328, 24, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/f92ee33f-78d0-4015-aa40-0e8cb302a721.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:13.093504+00'),
	(329, 25, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/88ec828b-8ffb-417f-9731-fe2dbf5d86b0.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:13.121375+00'),
	(330, 25, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/9fc63cda-60b1-4262-9975-a9e529ef1716.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:13.151251+00'),
	(331, 25, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/5440f780-9d1b-4756-ad3d-318d40744b35.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:13.189832+00'),
	(332, 25, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/a0d31e53-c2fb-4e2b-95ae-e1d756d810bc.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:13.223808+00'),
	(333, 25, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/bce92b15-4038-4d5d-8a26-a4f0e329537b.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:13.254597+00'),
	(334, 26, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/0a1acf95-bcd5-4c84-8d45-784c9e9b1631.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:13.283069+00'),
	(335, 26, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/eb108bb3-55e3-44af-9b71-810c3b327f29.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:13.310781+00'),
	(336, 26, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/995f3cbc-da8a-46f0-9892-a840ab2705fa.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:13.340577+00'),
	(337, 26, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/9d3b1875-ea3e-4fd7-b883-c13a4da20cdf.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:13.365675+00'),
	(338, 26, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/b8bda163-8c73-409c-b65a-3873c8ac45d7.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:13.393451+00'),
	(339, 27, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/6c2d7e6c-f42e-4463-96a7-3dfa8a60098d.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:13.422518+00'),
	(340, 27, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/b79a249c-3ada-4f58-8e2f-b75b3f32da0b.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:13.499829+00'),
	(341, 27, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/313e95ed-9120-4802-8e0d-b723fc9b5753.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:13.526603+00'),
	(342, 27, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/8972c0d1-000c-4648-a076-7a05b02cd4ed.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:13.554604+00'),
	(162, 1, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/75e5460e-c050-4718-b0eb-89c72373f63a.jpg', 'image', 'room', true, 0, '2026-09-14 08:36:05.056737+00'),
	(163, 1, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/8c37bff9-ffd1-4ac4-89fb-43d9150299aa.jpg', 'image', 'room', false, 1, '2026-09-14 08:36:05.091928+00'),
	(164, 1, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/7a25ebf9-debe-42d9-af8b-842e1e3f8c41.jpg', 'image', 'room', false, 2, '2026-09-14 08:36:05.129768+00'),
	(165, 1, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/437dc0c7-be18-419f-87bf-2e44c0a052f2.jpg', 'image', 'room', false, 3, '2026-09-14 08:36:05.162026+00'),
	(166, 1, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/b6b6d004-75be-47b4-884e-081c49fbd803.jpg', 'image', 'room', false, 4, '2026-09-14 08:36:05.194859+00'),
	(167, 2, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/8c5ec7db-722d-4588-962c-54b6364f865e.jpg', 'image', 'room', true, 0, '2026-09-14 08:36:05.224745+00'),
	(168, 2, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/51f5fca2-fb94-4f83-b914-691feff81858.jpg', 'image', 'room', false, 1, '2026-09-14 08:36:05.253613+00'),
	(169, 2, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/bb06129b-d190-4e9a-941f-014b90ab48f5.jpg', 'image', 'room', false, 2, '2026-09-14 08:36:05.284081+00'),
	(170, 2, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/e3413e75-c72b-4fa2-92e7-2c48253009fc.jpg', 'image', 'room', false, 3, '2026-09-14 08:36:05.310085+00'),
	(171, 2, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/042b4ed5-b401-46c0-819c-eb1f6f908797.jpg', 'image', 'room', false, 4, '2026-09-14 08:36:05.338673+00'),
	(172, 3, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/26421980-369e-4a25-ba7f-9b17958ea32c.jpg', 'image', 'room', true, 0, '2026-09-14 08:36:05.436183+00'),
	(173, 3, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/db75706e-1dd2-4562-8dfd-381f3e56c7c6.jpg', 'image', 'room', false, 1, '2026-09-14 08:36:05.465675+00'),
	(174, 3, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/c18cdf9a-8406-4b24-8db7-73d676dcf320.jpg', 'image', 'room', false, 2, '2026-09-14 08:36:05.491328+00'),
	(175, 3, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/9792781e-e2ad-46b7-aa64-27c60ec5eb39.jpg', 'image', 'room', false, 3, '2026-09-14 08:36:05.522194+00'),
	(176, 3, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/daa35cad-b67f-48ba-9860-3cac5cc511f1.jpg', 'image', 'room', false, 4, '2026-09-14 08:36:05.54949+00'),
	(177, 4, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/81dcb79f-f044-4d63-83af-77e862b0b860.jpg', 'image', 'room', true, 0, '2026-09-14 08:36:05.577253+00'),
	(178, 4, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/23d50622-51cb-424a-82b2-ed98cc25a2fe.jpg', 'image', 'room', false, 1, '2026-09-14 08:36:05.605421+00'),
	(179, 4, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/3bbea2eb-4425-4f2f-a87f-881ab0db29d1.jpg', 'image', 'room', false, 2, '2026-09-14 08:36:05.630633+00'),
	(180, 4, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/d24a9c32-6a09-4403-9c3d-a597a17d1bdb.jpg', 'image', 'room', false, 3, '2026-09-14 08:36:05.66597+00'),
	(181, 4, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/27932a08-9f2e-4084-b1d5-ea5b359940e8.jpg', 'image', 'room', false, 4, '2026-09-14 08:36:05.707388+00'),
	(182, 5, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/aee77c8f-72aa-43b2-8415-df29da9be868.jpg', 'image', 'room', true, 0, '2026-09-14 08:36:05.738367+00'),
	(183, 5, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/a09a16fb-275d-4e7a-bc53-8b932954ba72.jpg', 'image', 'room', false, 1, '2026-09-14 08:36:05.764985+00'),
	(184, 5, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/7f78d5de-b313-4b6f-a2fa-4da8278376b7.jpg', 'image', 'room', false, 2, '2026-09-14 08:36:05.793247+00'),
	(185, 5, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/fe24bafe-6968-4eb4-a944-86c948465f69.jpg', 'image', 'room', false, 3, '2026-09-14 08:36:05.822123+00'),
	(186, 5, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/4aa68054-1aea-42fc-b3b5-d012a64dab08.jpg', 'image', 'room', false, 4, '2026-09-14 08:36:05.848162+00'),
	(187, 6, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/6094e1bb-35d7-42b5-b591-47e8053d449b.jpg', 'image', 'room', true, 0, '2026-09-14 08:36:05.879557+00'),
	(188, 6, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/a257419d-8c21-450b-8997-8491b606de7b.jpg', 'image', 'room', false, 1, '2026-09-14 08:36:05.966149+00'),
	(189, 6, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/d7f6d0bd-8931-4085-b802-ca9c60ab1168.jpg', 'image', 'room', false, 2, '2026-09-14 08:36:06.000194+00'),
	(190, 6, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/75dd92a2-5913-4546-9431-7098db88142b.jpg', 'image', 'room', false, 3, '2026-09-14 08:36:06.025146+00'),
	(191, 6, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/6e14414e-ca3d-4ef5-a2a4-18e182de03b4.jpg', 'image', 'room', false, 4, '2026-09-14 08:36:06.055228+00'),
	(192, 7, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/34edfd0f-db34-42e3-a1bf-ff45fe7f8ef9.jpg', 'image', 'room', true, 0, '2026-09-14 08:36:06.079778+00'),
	(193, 7, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/59ec8cac-53e7-4278-be41-d8c0d26f6dde.jpg', 'image', 'room', false, 1, '2026-09-14 08:36:06.107134+00'),
	(194, 7, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/3f989234-c9cc-4c2a-aa00-de11f3ebcf42.jpg', 'image', 'room', false, 2, '2026-09-14 08:36:06.133808+00'),
	(195, 7, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/f229d2d1-f883-4b85-80e7-6315c3f5bd90.jpg', 'image', 'room', false, 3, '2026-09-14 08:36:06.177574+00'),
	(196, 7, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/891f0e8e-8d95-4a08-850e-6dbb4ec32dcb.jpg', 'image', 'room', false, 4, '2026-09-14 08:36:06.207929+00'),
	(197, 8, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/74bba087-fe8a-4390-a856-3baf1772ff1e.jpg', 'image', 'room', true, 0, '2026-09-14 08:36:06.234441+00'),
	(198, 8, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/a5f97367-2dcc-46cc-8e9a-c298c0082e07.jpg', 'image', 'room', false, 1, '2026-09-14 08:36:06.257638+00'),
	(199, 8, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/f15aeea0-fb11-465d-8f54-b15e318e83e6.jpg', 'image', 'room', false, 2, '2026-09-14 08:36:06.285534+00'),
	(200, 8, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/c8322364-ff88-46bb-8f72-bb7f412aea16.jpg', 'image', 'room', false, 3, '2026-09-14 08:36:06.309263+00'),
	(201, 8, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/579cbb13-9239-4530-9814-babe118b812f.jpg', 'image', 'room', false, 4, '2026-09-14 08:36:06.337249+00'),
	(202, 9, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/83936a71-576b-4392-860e-5a8fb4c58483.jpg', 'image', 'room', true, 0, '2026-09-14 08:36:06.360349+00'),
	(203, 9, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/ab8c0d3a-58fb-49ee-a7cc-e72d6d0dc8a1.jpg', 'image', 'room', false, 1, '2026-09-14 08:36:06.386044+00'),
	(204, 9, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/987f2eb8-2b0b-42a0-bb84-4353005ed084.jpg', 'image', 'room', false, 2, '2026-09-14 08:36:06.410346+00'),
	(205, 9, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/36255f62-c671-49a2-9d15-c67a7a767c46.jpg', 'image', 'room', false, 3, '2026-09-14 08:36:06.509338+00'),
	(206, 9, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/a254a65f-5f44-41ba-86c9-6a0a6c44cbc7.jpg', 'image', 'room', false, 4, '2026-09-14 08:36:06.545844+00'),
	(207, 10, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/7e547df9-a69d-4f34-bb22-c06818510fac.jpg', 'image', 'room', true, 0, '2026-09-14 08:36:06.573757+00'),
	(208, 10, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/e1ccb42d-d1d1-442f-bf24-c213e046b103.jpg', 'image', 'room', false, 1, '2026-09-14 08:36:06.602451+00'),
	(343, 27, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/dbf89435-16a7-4ba5-a156-763f752e6678.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:13.581129+00'),
	(344, 28, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/b8716f64-54d0-45ba-a8fc-eadb7d59e9b5.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:13.626021+00'),
	(345, 28, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/c8afc257-8cda-4cba-a97e-425f01b2a06c.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:13.653481+00'),
	(346, 28, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/91ca4e07-242f-4e3a-91dc-bc0cc71f8b56.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:13.678524+00'),
	(347, 28, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/529605d9-b4e8-4279-ab5f-45809fc1ef66.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:13.703712+00'),
	(348, 28, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/4775af21-61fe-4122-81da-3674bd16688e.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:13.727241+00'),
	(349, 29, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/0b89b4e0-750f-4f32-a1b0-498e6ec8ec1f.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:13.752079+00'),
	(350, 29, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/b3e670aa-0ba6-4bd1-ac3e-0aa008944fdd.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:13.779843+00'),
	(351, 29, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/82bd09f6-a27e-49e5-8216-03ea08be6ee4.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:13.80425+00'),
	(352, 29, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/9a7e8365-d606-47a8-9d75-2eedbbcffc7f.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:13.829081+00'),
	(353, 29, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/52fdaa99-4309-4df1-9a51-0587e9fe24b2.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:13.872695+00'),
	(354, 30, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/419c1e55-ac4d-4335-812e-982f742e9be4.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:13.901877+00'),
	(355, 30, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/fa674507-e1fe-4e61-be8e-a32050287cf4.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:13.931272+00'),
	(356, 30, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/f7367c14-f665-460a-85ef-6b0b9f7dfdbb.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:14.019985+00'),
	(357, 30, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/3785ed76-f752-4a33-8a00-42658d4f9ee4.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:14.06302+00'),
	(358, 30, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/5ef6f299-63ea-4972-814b-7110b3bbfc81.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:14.097699+00'),
	(359, 31, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/dd472fb6-9259-4062-b12a-b5f8fbff3931.jpg', 'image', 'room', true, 0, '2026-09-30 10:05:14.133061+00'),
	(360, 31, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/da31e6f7-9ae4-4a6d-ab93-0d5774f79f57.jpg', 'image', 'room', false, 1, '2026-09-30 10:05:14.172068+00'),
	(361, 31, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/6f0fdbfa-d252-4711-8d4d-acc3944030ee.jpg', 'image', 'room', false, 2, '2026-09-30 10:05:14.197474+00'),
	(362, 31, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/e5a75657-c165-4ec7-8563-f7f360cadd8b.jpg', 'image', 'room', false, 3, '2026-09-30 10:05:14.226461+00'),
	(363, 31, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/35cc6e16-a44c-45b2-9a6b-d4e3bf29f404.jpg', 'image', 'room', false, 4, '2026-09-30 10:05:14.258215+00'),
	(369, 32, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/ca6707cc-c766-42b1-956a-bbfd7b2bec96.jpg', 'image', 'room', true, 0, '2026-10-01 07:23:19.426464+00'),
	(370, 32, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/53710cac-74c4-4f61-8442-f18176d3e707.jpg', 'image', 'room', false, 1, '2026-10-01 07:23:19.426464+00'),
	(371, 32, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/98b4b040-36fa-4636-bca5-aa46f7251354.jpg', 'image', 'room', false, 2, '2026-10-01 07:23:19.426464+00'),
	(372, 32, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/ef2523bf-9512-4711-a2a1-d7739f5d4973.jpg', 'image', 'room', false, 3, '2026-10-01 07:23:19.426464+00'),
	(373, 32, '{{SUPABASE_URL}}/storage/v1/object/public/property-images/1/007813fc-9f6e-487e-afc5-5114cada972d.jpg', 'image', 'room', false, 4, '2026-10-01 07:23:19.426464+00');


--
-- Data for Name: room_share_links; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.room_share_links (id, rent_room_id, created_by_user_id, token_hash, expires_at, revoked_at, share_sections, contact_id, created_at) VALUES
	(3, 12, 1, '71845e425d4b1c12224a69ff390ae5bf8a348bdaa30b3db77f125ba2575a6e92', '2026-09-30 03:04:53.091+00', '2026-09-23 04:15:38.35+00', '{"price": true, "photos": true, "contact": true, "location": true, "facilities": true}', 2, '2026-09-23 03:04:53.092315+00'),
	(2, 12, 1, 'dc49b312937f7bee7568c965a1ad8ff550b816cb893e43d37dc22ad7e0d090b0', '2026-09-30 02:59:16.859+00', '2026-09-23 04:15:41.466+00', '{"price": true, "photos": true, "contact": true, "location": true, "facilities": true}', 2, '2026-09-23 02:59:16.859979+00'),
	(1, 12, 1, '7f962d7a2402515f71e409c388849e60d39b87ba5e7695320ad0f3d21e563541', '2026-09-30 02:57:40.141+00', '2026-09-23 04:15:45.019+00', '{"price": true, "photos": true, "contact": false, "location": true, "facilities": true}', 2, '2026-09-23 02:57:40.148927+00'),
	(4, 12, 1, 'c7f4672b0c95ccef746b39c710f3468116bd0a58265a8a42467a32f502f84696', '2026-10-01 07:09:37.621+00', '2026-09-24 07:09:58.369+00', '{"price": true, "photos": true, "contact": false, "location": false, "facilities": false}', NULL, '2026-09-24 07:09:37.621946+00');


--
-- Data for Name: tenant_bills; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_roles (user_id, role_id) VALUES
	(1, 1),
	(1, 2),
	(1, 3),
	(1, 4),
	(1, 5),
	(2, 1),
	(2, 4),
	(3, 1);


--
-- Name: agent_commission_confirmations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agent_commission_confirmations_id_seq', 1, false);


--
-- Name: agent_invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agent_invoices_id_seq', 1, false);


--
-- Name: agreement_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agreement_documents_id_seq', 1, false);


--
-- Name: agreement_sign_invites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agreement_sign_invites_id_seq', 1, false);


--
-- Name: agreement_template_document_requirements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agreement_template_document_requirements_id_seq', 21, true);


--
-- Name: agreement_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agreement_templates_id_seq', 10, true);


--
-- Name: contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contacts_id_seq', 3, true);


--
-- Name: contract_deposit_settlements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contract_deposit_settlements_id_seq', 1, false);


--
-- Name: contract_deposit_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contract_deposit_transfers_id_seq', 1, false);


--
-- Name: deposit_deduction_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.deposit_deduction_items_id_seq', 1, false);


--
-- Name: lead_locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lead_locations_id_seq', 36, true);


--
-- Name: lead_match_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lead_match_results_id_seq', 366, true);


--
-- Name: lead_match_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lead_match_runs_id_seq', 34, true);


--
-- Name: lead_viewings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lead_viewings_id_seq', 9, true);


--
-- Name: leads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leads_id_seq', 20, true);


--
-- Name: lease_contracts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lease_contracts_id_seq', 1, false);


--
-- Name: properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.properties_id_seq', 32, true);


--
-- Name: property_owners_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.property_owners_id_seq', 3, true);


--
-- Name: rent_room_contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rent_room_contacts_id_seq', 19, true);


--
-- Name: rent_room_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rent_room_documents_id_seq', 1, false);


--
-- Name: rent_room_prices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rent_room_prices_id_seq', 64, true);


--
-- Name: rent_rooms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rent_rooms_id_seq', 32, true);


--
-- Name: room_facilities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.room_facilities_id_seq', 715, true);


--
-- Name: room_layout_values_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.room_layout_values_id_seq', 188, true);


--
-- Name: room_medias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.room_medias_id_seq', 373, true);


--
-- Name: room_share_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.room_share_links_id_seq', 4, true);


--
-- Name: room_tenancies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.room_tenancies_id_seq', 1, false);


--
-- Name: tenant_bills_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tenant_bills_id_seq', 1, false);


--
-- Name: tenants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tenants_id_seq', 2, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- PostgreSQL database dump complete
--



SET session_replication_role = origin;
