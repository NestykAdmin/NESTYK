-- D10 (AC-5.1 ถึง 5.5): ใบแจ้งหนี้เงินประกันของสัญญาเช่า ออกในนามผู้ให้เช่า 1 ใบต่อสัญญา
-- ใบแจ้งหนี้เดิมทุกใบเป็นชนิด general (ใบที่นายหน้าออกเอง) ออกในนามนายหน้าเหมือนเดิม
-- ใบชนิด deposit ระบบออกเองหลังนายหน้าสร้างเอกสารสัญญาเช่า เลขที่ DEP-<เลขสัญญา> ใบเสร็จ REC-DEP-<เลขสัญญา>
-- เงินประกัน 0 บาทไม่ออกใบ (ยอดต้องมากกว่า 0)
-- ทุกเงื่อนไขใน CHECK ต้องมี IS NOT NULL เพราะผลที่ไม่รู้ค่า (NULL) ไม่นับเป็นการละเมิด

ALTER TABLE public.agent_invoices
    ADD COLUMN invoice_kind character varying(24) DEFAULT 'general' NOT NULL,
    ADD COLUMN lease_contract_id integer,
    ADD COLUMN issuer_party character varying(16) DEFAULT 'agent' NOT NULL,
    ADD COLUMN amount numeric(12,2),
    ADD COLUMN due_date date,
    -- เวลาที่ผู้เช่าส่งสลิปในแอป (สลิปที่นายหน้าแนบตอนออกใบเสร็จไม่ตั้งค่านี้)
    ADD COLUMN slip_submitted_at timestamp with time zone;

ALTER TABLE public.agent_invoices
    ADD CONSTRAINT agent_invoices_lease_contract_id_fkey FOREIGN KEY (lease_contract_id) REFERENCES public.lease_contracts(id) ON DELETE RESTRICT,
    ADD CONSTRAINT chk_agent_invoices_kind CHECK (invoice_kind IN ('general', 'deposit')),
    ADD CONSTRAINT chk_agent_invoices_issuer CHECK (issuer_party IN ('landlord', 'agent')),
    ADD CONSTRAINT chk_agent_invoices_deposit CHECK (
        invoice_kind <> 'deposit'
        OR (lease_contract_id IS NOT NULL AND issuer_party = 'landlord' AND amount IS NOT NULL AND amount > 0 AND due_date IS NOT NULL));

-- สัญญาเช่า 1 ฉบับมีใบแจ้งหนี้เงินประกันได้ใบเดียว (กันกดซ้ำและการออกพร้อมกัน)
CREATE UNIQUE INDEX uq_agent_invoices_one_deposit ON public.agent_invoices (lease_contract_id) WHERE invoice_kind = 'deposit';
