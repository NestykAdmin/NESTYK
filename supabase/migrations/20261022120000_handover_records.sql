-- D6 (AC-6.1 to 6.4): handing the room over is a form in the system, filled after the deposit receipt.
--   handover_records  1 record per lease and kind: move_in (before moving in) now; move_out is kept for D16
--   handover_items    annex 1: what is in the room, how many, and its condition (damaged or missing needs a note)
--   handover_photos   annex 2: photos of the room
-- The landlord and the tenant sign the record (in their own app, or on the agent's device at the room). The signatures
-- go into agreement_signatures with handover_record_id set; signatures of the lease itself keep handover_record_id NULL.
-- The lease template no longer asks for annex files before signing: template 11 (lease v6) copies template 9 (lease v5)
-- without the 2 annex requirements. Requirements of a template in use cannot change (trigger
-- agreement_requirements_immutable), so drafts on template 9 keep asking for the files.

CREATE TABLE public.handover_records (
    id serial PRIMARY KEY,
    agreement_id integer NOT NULL,
    kind character varying(16) NOT NULL,
    handover_date date,
    note text,
    revision integer DEFAULT 1 NOT NULL,
    completed_at timestamp with time zone,
    created_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT handover_records_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES public.lease_contracts(id) ON DELETE RESTRICT,
    CONSTRAINT handover_records_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_handover_records_kind CHECK (kind IS NOT NULL AND kind IN ('move_in', 'move_out')),
    CONSTRAINT chk_handover_records_revision CHECK (revision > 0),
    CONSTRAINT chk_handover_records_note CHECK (note IS NULL OR char_length(note) <= 1000)
);
CREATE UNIQUE INDEX uq_handover_records_agreement_kind ON public.handover_records (agreement_id, kind);
ALTER TABLE public.handover_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.handover_items (
    id serial PRIMARY KEY,
    handover_record_id integer NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    name character varying(120) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    condition character varying(16) NOT NULL,
    note character varying(500),
    move_in_item_id integer,
    CONSTRAINT handover_items_handover_record_id_fkey FOREIGN KEY (handover_record_id) REFERENCES public.handover_records(id) ON DELETE CASCADE,
    CONSTRAINT handover_items_move_in_item_id_fkey FOREIGN KEY (move_in_item_id) REFERENCES public.handover_items(id) ON DELETE SET NULL,
    CONSTRAINT chk_handover_items_name CHECK (btrim(name) <> ''),
    CONSTRAINT chk_handover_items_quantity CHECK (quantity BETWEEN 1 AND 999),
    CONSTRAINT chk_handover_items_condition CHECK (condition IS NOT NULL AND condition IN ('good', 'damaged', 'missing')),
    -- Something damaged or missing needs a note.
    CONSTRAINT chk_handover_items_note CHECK (condition = 'good' OR btrim(coalesce(note, '')) <> '')
);
CREATE INDEX idx_handover_items_record ON public.handover_items (handover_record_id, sort_order);
ALTER TABLE public.handover_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.handover_photos (
    id serial PRIMARY KEY,
    handover_record_id integer NOT NULL,
    storage_path text NOT NULL,
    caption character varying(200),
    uploaded_by_user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT handover_photos_handover_record_id_fkey FOREIGN KEY (handover_record_id) REFERENCES public.handover_records(id) ON DELETE CASCADE,
    CONSTRAINT handover_photos_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_handover_photos_record ON public.handover_photos (handover_record_id, id);
ALTER TABLE public.handover_photos ENABLE ROW LEVEL SECURITY;

-- Signatures of a handover record: only the landlord and the tenant, in their app or on the agent's device (AC-6.3).
ALTER TABLE public.agreement_signatures ADD COLUMN handover_record_id integer;
ALTER TABLE public.agreement_signatures
    ADD CONSTRAINT agreement_signatures_handover_record_id_fkey FOREIGN KEY (handover_record_id) REFERENCES public.handover_records(id) ON DELETE RESTRICT,
    ADD CONSTRAINT chk_agreement_signatures_handover CHECK (
        handover_record_id IS NULL OR (party IN ('owner', 'tenant') AND channel IN ('app', 'on_site')));
-- One live signature per party of the lease, and separately one per party of each handover record.
DROP INDEX public.uq_agreement_signatures_live_party;
CREATE UNIQUE INDEX uq_agreement_signatures_live_party ON public.agreement_signatures (agreement_id, party)
    WHERE voided_at IS NULL AND handover_record_id IS NULL;
CREATE UNIQUE INDEX uq_agreement_signatures_live_handover_party ON public.agreement_signatures (handover_record_id, party)
    WHERE voided_at IS NULL AND handover_record_id IS NOT NULL;

-- Lease template v6 without the annex files. Only on a database that already has template 9 (lease v5): a new
-- database gets both from seed/masters.sql, which runs after the migrations (MIGRATION-RULES rule 5).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.agreement_templates WHERE id = 9 AND agreement_type_code = 'lease' AND version = 5) THEN
    RAISE NOTICE 'handover_records: no lease template 9 (v5), so lease template 11 was not added (a new database gets it from seed/masters.sql)';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.agreement_templates WHERE id = 11 AND NOT (agreement_type_code = 'lease' AND version = 6)) THEN
    RAISE EXCEPTION 'agreement_templates id 11 is already used by another template';
  END IF;
  INSERT INTO public.agreement_templates (id, agreement_type_code, version, name, form_kind, data_schema, document_template_key, is_active)
  SELECT 11, t.agreement_type_code, 6, t.name, t.form_kind, t.data_schema, t.document_template_key, true
  FROM public.agreement_templates t
  WHERE t.id = 9
  ON CONFLICT (id) DO NOTHING;
  PERFORM pg_catalog.setval('public.agreement_templates_id_seq', (SELECT max(id) FROM public.agreement_templates), true);
  -- The same requirements as template 9 apart from the 2 annex files.
  IF NOT EXISTS (SELECT 1 FROM public.agreement_template_document_requirements WHERE template_id = 11) THEN
    PERFORM pg_catalog.setval('public.agreement_template_document_requirements_id_seq',
      (SELECT max(id) FROM public.agreement_template_document_requirements), true);
    INSERT INTO public.agreement_template_document_requirements (template_id, group_key, label, subject, document_type_code)
    SELECT 11, r.group_key, r.label, r.subject, r.document_type_code
    FROM public.agreement_template_document_requirements r
    WHERE r.template_id = 9 AND r.document_type_code NOT IN ('lease_annex_1', 'lease_annex_2')
    ORDER BY r.id;
  END IF;
  UPDATE public.agreement_templates SET is_active = false WHERE id = 9;
END $$;
