-- D7 ต่อ (Aof 22 ต.ค. 2026): ผู้เช่าต้องจ่ายเงินประกันให้เรียบร้อยภายในวันเข้าอยู่
-- ถ้าปิดสัญญาเช่าตอนยังรอเงินประกัน ใบแจ้งหนี้เงินประกันที่ยังไม่มีใบเสร็จถูกยกเลิก (voided_at) ผู้เช่าไม่ต้องชำระ
-- ยกเลิกได้เฉพาะใบแจ้งหนี้เงินประกันที่ยังไม่มีใบเสร็จ และใบที่ยกเลิกแล้วใส่ใบเสร็จไม่ได้

ALTER TABLE public.agent_invoices
    ADD COLUMN voided_at timestamp with time zone;

ALTER TABLE public.agent_invoices
    ADD CONSTRAINT chk_agent_invoices_void CHECK (
        voided_at IS NULL
        OR (invoice_kind = 'deposit' AND receipt_pdf_path IS NULL AND receipt_document_no IS NULL));
