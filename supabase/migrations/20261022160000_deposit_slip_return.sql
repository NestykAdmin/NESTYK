-- D11 (AC-5.4): นายหน้าตีกลับสลิปเงินประกันที่ผู้เช่าส่งมาได้ พร้อมเหตุผล ผู้เช่าเห็นเหตุผลแล้วส่งสลิปใหม่
-- เก็บเหตุผลไว้ในใบแจ้งหนี้เงินประกัน และล้างเมื่อผู้เช่าส่งสลิปใหม่ (สลิปค่าจองเก็บเหตุผลใน data ของหนังสือจอง ไม่ต้องเพิ่มคอลัมน์)
-- เพิ่มคอลัมน์อย่างเดียว ไม่แก้ข้อมูลเดิม

ALTER TABLE public.agent_invoices
    ADD COLUMN slip_return_note character varying(500);

ALTER TABLE public.agent_invoices
    ADD CONSTRAINT chk_agent_invoices_slip_return CHECK (
        slip_return_note IS NULL OR char_length(btrim(slip_return_note)) > 0);
