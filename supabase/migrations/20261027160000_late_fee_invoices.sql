-- D12 (AC-7.8): ใบแจ้งหนี้ค่าปรับของบิลค่าเช่า ออกในนามผู้ให้เช่า 1 ใบต่อบิล
-- นายหน้ากรอกยอดเอง เลขที่ LF-<เลขบิล> ใบเสร็จ REC-LF-<เลขบิล>
-- ใบเดิมทุกใบไม่มี tenant_bill_id จึงผ่านเงื่อนไขใหม่ ยังยกเลิกได้เฉพาะใบเงินประกันที่ไม่มีใบเสร็จ

ALTER TABLE public.agent_invoices
    ADD COLUMN tenant_bill_id integer;

ALTER TABLE public.agent_invoices
    DROP CONSTRAINT chk_agent_invoices_kind;

ALTER TABLE public.agent_invoices
    ADD CONSTRAINT agent_invoices_tenant_bill_id_fkey FOREIGN KEY (tenant_bill_id) REFERENCES public.tenant_bills(id) ON DELETE RESTRICT,
    ADD CONSTRAINT chk_agent_invoices_kind CHECK (invoice_kind IN ('general', 'deposit', 'late_fee')),
    ADD CONSTRAINT chk_agent_invoices_late_fee CHECK (
        invoice_kind <> 'late_fee'
        OR (lease_contract_id IS NOT NULL AND tenant_bill_id IS NOT NULL AND issuer_party = 'landlord' AND amount IS NOT NULL AND amount > 0 AND due_date IS NOT NULL)),
    ADD CONSTRAINT chk_agent_invoices_bill_link CHECK (
        tenant_bill_id IS NULL OR invoice_kind = 'late_fee');

-- บิลค่าเช่า 1 ใบมีใบแจ้งหนี้ค่าปรับได้ใบเดียว (กันกดซ้ำและการสร้างพร้อมกัน)
CREATE UNIQUE INDEX uq_agent_invoices_one_late_fee ON public.agent_invoices (tenant_bill_id) WHERE invoice_kind = 'late_fee';
