-- D17 + D9: บันทึกการลงนาม 1 แถวต่อ 1 ลายเซ็น (ใครกด ลงผ่านช่องทางไหน ลิงก์ไหน) และพยานในสัญญาเช่า
-- รอบที่ 1 ของการย้ายลายเซ็น (S3 ใน nestyk-contract-schema-plan.md): คอลัมน์ลายเซ็นเดิมใน lease_contracts
-- และ trigger ด่านเอกสารแนบยังอยู่และยังถูกเขียนตามเดิม ไฟล์ cleanup รอบที่ 2 จะลบทีหลัง
-- ช่องทาง:
--   app           ฝ่ายนั้นลงนามในแอปของตัวเอง (นายหน้าลงนามของตัวเองก็นับเป็น app)
--   link          ลงนามผ่านลิงก์ลงนาม (ต้องอ้าง sign_invite_id)
--   on_site       นายหน้ากดลงนามแทนฝ่ายนั้นในเครื่องของนายหน้า (พยานที่ไม่มีบัญชีก็ใช้ช่องทางนี้)
--   uploaded_file แนบไฟล์เอกสารที่เซ็นแล้ว (ต้องอ้าง signed_file_document_id) ยังไม่มีโค้ดใช้
--   legacy        ลายเซ็นที่คัดลอกมาจากคอลัมน์เดิม ไม่รู้ช่องทาง ระบบใหม่ห้ามใช้ค่านี้

CREATE TABLE public.agreement_signatures (
    id serial PRIMARY KEY,
    agreement_id integer NOT NULL,
    party character varying(16) NOT NULL,
    channel character varying(16) NOT NULL,
    signed_by_user_id integer,
    signer_name character varying(255),
    sign_invite_id integer,
    signature_url text,
    signed_file_document_id integer,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    voided_at timestamp with time zone,
    CONSTRAINT agreement_signatures_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES public.lease_contracts(id) ON DELETE RESTRICT,
    CONSTRAINT agreement_signatures_signed_by_user_id_fkey FOREIGN KEY (signed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT agreement_signatures_sign_invite_id_fkey FOREIGN KEY (sign_invite_id) REFERENCES public.agreement_sign_invites(id) ON DELETE RESTRICT,
    CONSTRAINT agreement_signatures_signed_file_document_id_fkey FOREIGN KEY (signed_file_document_id) REFERENCES public.agreement_documents(id) ON DELETE RESTRICT,
    CONSTRAINT chk_agreement_signatures_party CHECK (party IN ('owner', 'tenant', 'agent', 'witness')),
    CONSTRAINT chk_agreement_signatures_channel CHECK (channel IN ('app', 'link', 'on_site', 'uploaded_file', 'legacy')),
    CONSTRAINT chk_agreement_signatures_evidence CHECK (
        channel = 'legacy'
        OR (channel = 'uploaded_file' AND signed_file_document_id IS NOT NULL)
        OR (channel IN ('app', 'link', 'on_site') AND signature_url IS NOT NULL)),
    CONSTRAINT chk_agreement_signatures_legacy CHECK (channel <> 'legacy' OR party IN ('owner', 'tenant', 'agent')),
    CONSTRAINT chk_agreement_signatures_link CHECK (channel <> 'link' OR sign_invite_id IS NOT NULL),
    -- พยานไม่ต้องมีบัญชี แต่ต้องมีชื่อ (D9)
    CONSTRAINT chk_agreement_signatures_witness_name CHECK (party <> 'witness' OR signed_by_user_id IS NOT NULL OR btrim(coalesce(signer_name, '')) <> '')
);
-- ลายเซ็นที่ยังใช้ได้มีฝ่ายละ 1 แถว ถ้าต้องเซ็นใหม่ ให้ใส่ voided_at แถวเดิมก่อน
CREATE UNIQUE INDEX uq_agreement_signatures_live_party ON public.agreement_signatures (agreement_id, party) WHERE voided_at IS NULL;
ALTER TABLE public.agreement_signatures ENABLE ROW LEVEL SECURITY;

-- คัดลอกลายเซ็นเดิมทุกตัว (S3 รอบที่ 1)
INSERT INTO public.agreement_signatures (agreement_id, party, channel, signature_url, signed_at)
SELECT c.id, p.party, 'legacy', p.url, p.at
FROM public.lease_contracts c
CROSS JOIN LATERAL (VALUES
    ('owner', c.owner_signed_at, c.owner_signature_url),
    ('tenant', c.tenant_signed_at, c.tenant_signature_url),
    ('agent', c.agent_signed_at, c.agent_signature_url)
) AS p(party, at, url)
WHERE p.at IS NOT NULL;
