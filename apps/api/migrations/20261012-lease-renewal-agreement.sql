-- Lease renewal addendum as its own agreement form_kind.
ALTER TABLE master_agreement_types
  DROP CONSTRAINT IF EXISTS chk_agreement_form_kind;
ALTER TABLE master_agreement_types
  ADD CONSTRAINT chk_agreement_form_kind
  CHECK (form_kind IN ('reservation', 'lease', 'broker_appointment', 'renewal'));

ALTER TABLE agreement_templates
  DROP CONSTRAINT IF EXISTS agreement_templates_form_kind_check;
ALTER TABLE agreement_templates
  ADD CONSTRAINT agreement_templates_form_kind_check
  CHECK (form_kind IN ('reservation', 'lease', 'broker_appointment', 'renewal'));

INSERT INTO master_agreement_types (code, name_th, name_en, icon, form_kind, sort_order)
VALUES (
  'lease_renewal',
  'หนังสือต่อสัญญาเช่า',
  'Lease renewal addendum',
  'key',
  'renewal',
  25
)
ON CONFLICT (code) DO UPDATE
SET
  name_th = EXCLUDED.name_th,
  name_en = EXCLUDED.name_en,
  icon = EXCLUDED.icon,
  form_kind = EXCLUDED.form_kind,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO agreement_templates (
  agreement_type_code, version, name, form_kind, data_schema, document_template_key, is_active
)
SELECT
  'lease_renewal',
  1,
  'หนังสือต่อสัญญาเช่า',
  'renewal',
  jsonb_build_object(
    'type', 'object',
    'required', jsonb_build_array('startDate', 'endDate', 'monthlyRent', 'deposit'),
    'properties', jsonb_build_object(
      'startDate', jsonb_build_object('type', 'string'),
      'endDate', jsonb_build_object('type', 'string'),
      'monthlyRent', jsonb_build_object('type', 'number'),
      'deposit', jsonb_build_object('type', 'number'),
      'leaseRenewal', jsonb_build_object('type', 'object')
    ),
    'additionalProperties', false
  ),
  'lease_renewal/v1',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM agreement_templates
  WHERE agreement_type_code = 'lease_renewal' AND is_active
);
