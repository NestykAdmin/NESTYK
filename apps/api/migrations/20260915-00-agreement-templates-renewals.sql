-- Run transactionally after agreement-types, reservation-documents and signatures migrations.
CREATE TABLE IF NOT EXISTS agreement_templates (
  id SERIAL PRIMARY KEY,
  agreement_type_code VARCHAR(64) NOT NULL REFERENCES master_agreement_types(code) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  name VARCHAR(255) NOT NULL,
  form_kind VARCHAR(32) NOT NULL CHECK (form_kind IN ('reservation', 'lease')),
  data_schema JSONB NOT NULL CHECK (jsonb_typeof(data_schema) = 'object'),
  document_template_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (agreement_type_code, version),
  UNIQUE (id, agreement_type_code)
);
ALTER TABLE agreement_templates ENABLE ROW LEVEL SECURITY;
INSERT INTO agreement_templates (agreement_type_code, version, name, form_kind, data_schema, document_template_key)
SELECT code, 1, name_th, form_kind,
  CASE WHEN form_kind = 'reservation' THEN
    '{"type":"object","additionalProperties":false,"required":["startDate","moveInDate","reservationFee"],"properties":{"startDate":{"type":"string"},"moveInDate":{"type":"string"},"reservationFee":{"type":"number","minimum":0}}}'::jsonb
  ELSE
    '{"type":"object","additionalProperties":false,"required":["startDate","endDate","monthlyRent","deposit"],"properties":{"startDate":{"type":"string"},"endDate":{"type":"string"},"monthlyRent":{"type":"number","exclusiveMinimum":0},"deposit":{"type":"number","minimum":0}}}'::jsonb
  END,
  CASE WHEN form_kind = 'reservation' THEN 'reservation/mock-v2' ELSE NULL END
FROM master_agreement_types
ON CONFLICT (agreement_type_code, version) DO NOTHING;

ALTER TABLE lease_contracts
  ADD COLUMN IF NOT EXISTS template_id INTEGER,
  ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS party_snapshot JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS agreement_kind VARCHAR(16) NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS previous_agreement_id INTEGER REFERENCES lease_contracts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS root_agreement_id INTEGER REFERENCES lease_contracts(id) ON DELETE RESTRICT;
UPDATE lease_contracts c SET template_id = t.id,
  data = CASE WHEN t.form_kind = 'reservation' THEN
    jsonb_build_object('startDate', c.start_date, 'moveInDate', c.move_in_date, 'reservationFee', c.reservation_fee)
  ELSE jsonb_build_object('startDate', c.start_date, 'endDate', c.end_date, 'monthlyRent', c.monthly_rent, 'deposit', c.deposit) END
FROM agreement_templates t WHERE t.agreement_type_code = c.agreement_type_code AND t.version = 1 AND c.template_id IS NULL;
-- Legacy original_contract_id is preserved without guessing whether it meant root or predecessor.
UPDATE lease_contracts SET root_agreement_id = id WHERE root_agreement_id IS NULL;
ALTER TABLE lease_contracts ALTER COLUMN template_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'lease_contracts'::regclass AND conname = 'fk_contract_template_type') THEN
    ALTER TABLE lease_contracts ADD CONSTRAINT fk_contract_template_type
      FOREIGN KEY (template_id, agreement_type_code) REFERENCES agreement_templates(id, agreement_type_code) ON DELETE RESTRICT;
    ALTER TABLE lease_contracts ADD CONSTRAINT chk_agreement_lineage CHECK (
      (agreement_kind = 'new' AND previous_agreement_id IS NULL) OR
      (agreement_kind = 'renewal' AND previous_agreement_id IS NOT NULL AND root_agreement_id IS NOT NULL AND previous_agreement_id <> id AND root_agreement_id <> id)
    );
    ALTER TABLE lease_contracts ADD CONSTRAINT chk_agreement_data CHECK (jsonb_typeof(data) = 'object' AND jsonb_typeof(party_snapshot) = 'object');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_agreement_root ON lease_contracts(root_agreement_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agreement_one_renewal ON lease_contracts(previous_agreement_id)
  WHERE previous_agreement_id IS NOT NULL AND status <> 'cancelled';

CREATE OR REPLACE FUNCTION protect_agreement_template() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'is_active') IS DISTINCT FROM (to_jsonb(OLD) - 'is_active') THEN
    RAISE EXCEPTION 'Create a new template version instead of modifying an existing version';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agreement_template_immutable ON agreement_templates;
CREATE TRIGGER agreement_template_immutable BEFORE UPDATE ON agreement_templates
FOR EACH ROW EXECUTE FUNCTION protect_agreement_template();
