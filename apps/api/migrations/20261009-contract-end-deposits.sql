-- Apply transactionally after agreement-templates-renewals. No historical money is inferred.
CREATE TABLE IF NOT EXISTS master_contract_end_reasons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name_th VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  applicable_status VARCHAR(40) NOT NULL CHECK (applicable_status IN ('expired', 'terminated', 'cancelled')),
  default_deposit_policy VARCHAR(32) NOT NULL DEFAULT 'manual_review'
    CHECK (default_deposit_policy IN ('refund_full', 'refund_after_deductions', 'manual_review')),
  requires_note BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO master_contract_end_reasons
  (code, name_th, name_en, applicable_status, default_deposit_policy, requires_note, sort_order)
VALUES
  ('term_completed', 'ครบกำหนดสัญญา', 'Term completed', 'expired', 'refund_after_deductions', FALSE, 10),
  ('non_payment', 'ค้างชำระค่าเช่า', 'Unpaid rent', 'terminated', 'refund_after_deductions', TRUE, 20),
  ('tenant_requested', 'ผู้เช่าขอยุติก่อนกำหนด', 'Early termination requested by tenant', 'terminated', 'manual_review', TRUE, 30),
  ('mutual_agreement', 'ทั้งสองฝ่ายตกลงยุติสัญญา', 'Termination by mutual agreement', 'terminated', 'manual_review', TRUE, 40),
  ('contract_breach', 'ผิดเงื่อนไขสัญญา', 'Contract breach', 'terminated', 'manual_review', TRUE, 50),
  ('other_termination', 'เหตุผลอื่นในการยุติสัญญา', 'Other termination reason', 'terminated', 'manual_review', TRUE, 60),
  ('draft_cancelled', 'ยกเลิกฉบับร่าง', 'Draft cancelled', 'cancelled', 'manual_review', TRUE, 70)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE lease_contracts
  ADD COLUMN IF NOT EXISTS end_reason_id INTEGER REFERENCES master_contract_end_reasons(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS end_reason_note TEXT,
  ADD COLUMN IF NOT EXISTS effective_end_date DATE,
  ADD COLUMN IF NOT EXISTS end_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_recorded_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_contract_end_reason ON lease_contracts(end_reason_id);

CREATE TABLE IF NOT EXISTS contract_deposit_settlements (
  id SERIAL PRIMARY KEY,
  lease_contract_id INTEGER NOT NULL UNIQUE REFERENCES lease_contracts(id) ON DELETE RESTRICT,
  deposit_received_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (deposit_received_amount >= 0 AND deposit_received_amount <> 'NaN'::numeric),
  deposit_received_reference TEXT,
  available_deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (available_deposit_amount >= 0 AND available_deposit_amount <> 'NaN'::numeric),
  deduction_total DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (deduction_total >= 0 AND deduction_total <> 'NaN'::numeric),
  carried_forward_total DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (carried_forward_total >= 0 AND carried_forward_total <> 'NaN'::numeric),
  refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0 AND refund_amount <> 'NaN'::numeric),
  status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'completed')),
  decision_note TEXT,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_deposit_settlement_balance CHECK (status = 'draft' OR
    available_deposit_amount = deduction_total + carried_forward_total + refund_amount),
  CONSTRAINT chk_deposit_settlement_approval CHECK (status = 'draft' OR
    (approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL AND NULLIF(BTRIM(decision_note), '') IS NOT NULL)),
  CONSTRAINT chk_deposit_refund_proof CHECK (refunded_at IS NULL OR
    (status <> 'draft' AND refund_amount > 0 AND NULLIF(BTRIM(refund_reference), '') IS NOT NULL)),
  CONSTRAINT chk_deposit_completion CHECK (status <> 'completed' OR refund_amount = 0 OR refunded_at IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS deposit_deduction_items (
  id SERIAL PRIMARY KEY,
  settlement_id INTEGER NOT NULL REFERENCES contract_deposit_settlements(id) ON DELETE RESTRICT,
  deduction_type VARCHAR(32) NOT NULL CHECK (deduction_type IN ('rent', 'utilities', 'damage', 'other')),
  description TEXT NOT NULL CHECK (BTRIM(description) <> ''),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0 AND amount <> 'NaN'::numeric),
  evidence_reference TEXT NOT NULL CHECK (BTRIM(evidence_reference) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deposit_deduction_settlement ON deposit_deduction_items(settlement_id);
CREATE TABLE IF NOT EXISTS contract_deposit_transfers (
  id SERIAL PRIMARY KEY,
  from_contract_id INTEGER NOT NULL REFERENCES lease_contracts(id) ON DELETE RESTRICT,
  to_contract_id INTEGER NOT NULL REFERENCES lease_contracts(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0 AND amount <> 'NaN'::numeric),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ,
  transferred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_deposit_transfer_distinct CHECK (from_contract_id <> to_contract_id),
  CONSTRAINT chk_deposit_transfer_completion CHECK (
    (status = 'completed' AND approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL AND transferred_at IS NOT NULL)
    OR (status <> 'completed' AND transferred_at IS NULL))
);
-- A predecessor has at most one live successor, and its deposit is allocated once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_deposit_transfer_live_source
  ON contract_deposit_transfers(from_contract_id) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_deposit_transfer_destination ON contract_deposit_transfers(to_contract_id);

-- Supabase clients receive no direct financial write access; backend uses its DB role.
ALTER TABLE master_contract_end_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_deposit_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_deduction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_deposit_transfers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION validate_contract_end_reason() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE reason master_contract_end_reasons%ROWTYPE;
BEGIN
  IF NEW.end_reason_id IS NULL THEN
    -- Existing closed rows remain readable/editable without inventing their history.
    IF (TG_OP = 'INSERT' AND NEW.status IN ('expired','terminated','cancelled')) OR
      (TG_OP = 'UPDATE' AND (OLD.end_reason_id IS NOT NULL OR
       (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('expired','terminated','cancelled')))) THEN
      RAISE EXCEPTION 'New contract closure requires an end reason' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO reason FROM master_contract_end_reasons WHERE id = NEW.end_reason_id;
  IF NOT FOUND OR reason.applicable_status <> NEW.status THEN
    RAISE EXCEPTION 'End reason must match contract status' USING ERRCODE = '23514';
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.end_reason_id IS DISTINCT FROM OLD.end_reason_id) AND NOT reason.is_active THEN
    RAISE EXCEPTION 'Inactive end reason cannot be selected' USING ERRCODE = '23514';
  END IF;
  IF reason.requires_note AND NULLIF(BTRIM(NEW.end_reason_note), '') IS NULL THEN
    RAISE EXCEPTION 'This end reason requires a note' USING ERRCODE = '23514';
  END IF;
  IF NEW.effective_end_date IS NULL OR NEW.end_recorded_at IS NULL THEN
    RAISE EXCEPTION 'Contract end requires effective date and recorded time' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'expired' AND (NEW.end_date IS NULL OR NEW.effective_end_date <> NEW.end_date) THEN
    RAISE EXCEPTION 'Expired contract must retain its scheduled end date' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'terminated' AND (NEW.effective_end_date < NEW.start_date OR
    (NEW.end_date IS NOT NULL AND NEW.effective_end_date >= NEW.end_date)) THEN
    RAISE EXCEPTION 'Early termination date must fall within the contract term' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contract_end_reason_guard ON lease_contracts;
CREATE TRIGGER contract_end_reason_guard BEFORE INSERT OR UPDATE ON lease_contracts
FOR EACH ROW EXECUTE FUNCTION validate_contract_end_reason();

CREATE OR REPLACE FUNCTION protect_used_contract_end_reason() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['is_active','sort_order']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['is_active','sort_order']) AND
    EXISTS (SELECT 1 FROM lease_contracts WHERE end_reason_id = OLD.id) THEN
    RAISE EXCEPTION 'Create a new reason instead of changing a used reason' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contract_end_reason_immutable ON master_contract_end_reasons;
CREATE TRIGGER contract_end_reason_immutable BEFORE UPDATE ON master_contract_end_reasons
FOR EACH ROW EXECUTE FUNCTION protect_used_contract_end_reason();

CREATE OR REPLACE FUNCTION validate_deposit_settlement() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE incoming NUMERIC; deductions NUMERIC; outgoing NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Approved settlement cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM contract_deposit_transfers WHERE from_contract_id = OLD.lease_contract_id AND status <> 'cancelled') THEN
      RAISE EXCEPTION 'Cancel pending transfers before deleting draft settlement' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'Create a draft settlement before approval' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.lease_contract_id <> OLD.lease_contract_id THEN
      RAISE EXCEPTION 'Settlement contract cannot be changed' USING ERRCODE = '23514';
    END IF;
    IF OLD.status <> 'draft' AND
      (to_jsonb(NEW) - ARRAY['status','refunded_at','refund_reference','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['status','refunded_at','refund_reference','updated_at']) THEN
      RAISE EXCEPTION 'Approved settlement amounts and approval are immutable' USING ERRCODE = '23514';
    END IF;
    IF (OLD.status = 'approved' AND NEW.status = 'draft') OR
       (OLD.status = 'completed' AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at')) THEN
      RAISE EXCEPTION 'Settlement cannot be reopened or completed proof changed' USING ERRCODE = '23514';
    END IF;
    IF OLD.refunded_at IS NOT NULL AND
      (NEW.refunded_at IS DISTINCT FROM OLD.refunded_at OR NEW.refund_reference IS DISTINCT FROM OLD.refund_reference) THEN
      RAISE EXCEPTION 'Recorded refund proof is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.status = 'draft' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM lease_contracts WHERE id = NEW.lease_contract_id AND status IN ('expired','terminated','cancelled')) THEN
    RAISE EXCEPTION 'Only ended contracts can approve a final deposit settlement' USING ERRCODE = '23514';
  END IF;
  IF NEW.deposit_received_amount > 0 AND NULLIF(BTRIM(NEW.deposit_received_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Actual deposit receipt requires evidence' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO incoming FROM contract_deposit_transfers
    WHERE to_contract_id = NEW.lease_contract_id AND status = 'completed';
  SELECT COALESCE(SUM(amount), 0) INTO deductions FROM deposit_deduction_items WHERE settlement_id = NEW.id;
  SELECT COALESCE(SUM(amount), 0) INTO outgoing FROM contract_deposit_transfers
    WHERE from_contract_id = NEW.lease_contract_id AND status <> 'cancelled';
  IF NEW.available_deposit_amount <> NEW.deposit_received_amount + incoming OR
     NEW.deduction_total <> deductions OR NEW.carried_forward_total <> outgoing THEN
    RAISE EXCEPTION 'Settlement must reconcile actual receipts, deductions and transfers' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'completed' AND EXISTS (SELECT 1 FROM contract_deposit_transfers
    WHERE from_contract_id = NEW.lease_contract_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Complete outgoing transfers before closing settlement' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS deposit_settlement_guard ON contract_deposit_settlements;
CREATE TRIGGER deposit_settlement_guard BEFORE INSERT OR UPDATE OR DELETE ON contract_deposit_settlements
FOR EACH ROW EXECUTE FUNCTION validate_deposit_settlement();

CREATE OR REPLACE FUNCTION protect_deposit_deduction() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE parent_status VARCHAR;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.settlement_id <> OLD.settlement_id THEN
    RAISE EXCEPTION 'Deduction cannot move to another settlement' USING ERRCODE = '23514';
  END IF;
  SELECT status INTO parent_status FROM contract_deposit_settlements
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.settlement_id ELSE NEW.settlement_id END FOR UPDATE;
  IF parent_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Only draft settlement deductions may be changed' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS deposit_deduction_guard ON deposit_deduction_items;
CREATE TRIGGER deposit_deduction_guard BEFORE INSERT OR UPDATE OR DELETE ON deposit_deduction_items
FOR EACH ROW EXECUTE FUNCTION protect_deposit_deduction();

CREATE OR REPLACE FUNCTION validate_deposit_transfer() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE source lease_contracts%ROWTYPE; destination lease_contracts%ROWTYPE;
  source_settlement contract_deposit_settlements%ROWTYPE; destination_status VARCHAR;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cancel a pending transfer instead of deleting its history' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'Create a pending transfer before completion' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Completed or cancelled transfer is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.from_contract_id <> OLD.from_contract_id OR NEW.to_contract_id <> OLD.to_contract_id) THEN
    RAISE EXCEPTION 'Transfer contracts cannot be changed' USING ERRCODE = '23514';
  END IF;
  -- Serialize with approval and other money operations on both contracts.
  PERFORM id FROM contract_deposit_settlements
    WHERE lease_contract_id IN (NEW.from_contract_id, NEW.to_contract_id) ORDER BY id FOR UPDATE;
  SELECT * INTO source_settlement FROM contract_deposit_settlements WHERE lease_contract_id = NEW.from_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source requires a deposit settlement' USING ERRCODE = '23514'; END IF;
  SELECT status INTO destination_status FROM contract_deposit_settlements WHERE lease_contract_id = NEW.to_contract_id;
  IF source_settlement.status <> 'draft' AND NOT
    (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'completed' AND
     source_settlement.status = 'approved' AND NEW.amount = OLD.amount AND
     NEW.created_by_user_id = OLD.created_by_user_id) THEN
    RAISE EXCEPTION 'Approved transfer allocation cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  SELECT * INTO source FROM lease_contracts WHERE id = NEW.from_contract_id;
  SELECT * INTO destination FROM lease_contracts WHERE id = NEW.to_contract_id;
  IF source.id IS NULL OR destination.id IS NULL OR
    destination.previous_agreement_id IS DISTINCT FROM source.id OR destination.agreement_kind <> 'renewal' OR
    source.tenant_id <> destination.tenant_id OR source.rent_room_id <> destination.rent_room_id OR
    source.end_date IS NULL OR destination.start_date <= source.end_date OR
    destination.status IN ('cancelled', 'terminated', 'expired') OR
    destination.deposit IS NULL OR NEW.amount > destination.deposit THEN
    RAISE EXCEPTION 'Deposit transfer must target the direct renewal for the same tenant and room' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'completed' AND (source_settlement.status <> 'approved' OR source.status <> 'expired' OR
    destination.status <> 'active' OR destination_status IN ('approved','completed')) THEN
    RAISE EXCEPTION 'Transfer needs an approved source settlement, expired predecessor and active renewal' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS deposit_transfer_guard ON contract_deposit_transfers;
CREATE TRIGGER deposit_transfer_guard BEFORE INSERT OR UPDATE OR DELETE ON contract_deposit_transfers
FOR EACH ROW EXECUTE FUNCTION validate_deposit_transfer();

-- Prevent changes to lineage/parties/term after a deposit allocation is prepared.
CREATE OR REPLACE FUNCTION protect_deposit_contract_link() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (NEW.tenant_id, NEW.rent_room_id, NEW.previous_agreement_id, NEW.agreement_kind, NEW.start_date, NEW.end_date, NEW.deposit)
    IS DISTINCT FROM
    (OLD.tenant_id, OLD.rent_room_id, OLD.previous_agreement_id, OLD.agreement_kind, OLD.start_date, OLD.end_date, OLD.deposit)
    AND EXISTS (SELECT 1 FROM contract_deposit_transfers
      WHERE (from_contract_id = OLD.id OR to_contract_id = OLD.id) AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Cancel pending deposit allocation before changing contract terms' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IN ('cancelled','terminated') AND NEW.status IS DISTINCT FROM OLD.status AND
    EXISTS (SELECT 1 FROM contract_deposit_transfers t JOIN contract_deposit_settlements s
      ON s.lease_contract_id = t.from_contract_id
      WHERE t.to_contract_id = OLD.id AND t.status = 'pending' AND s.status <> 'draft') THEN
    RAISE EXCEPTION 'Resolve approved deposit allocation before cancelling its renewal' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS deposit_contract_link_guard ON lease_contracts;
CREATE TRIGGER deposit_contract_link_guard BEFORE UPDATE ON lease_contracts
FOR EACH ROW EXECUTE FUNCTION protect_deposit_contract_link();
