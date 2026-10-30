-- L1 (review of 9644dd9, Aof 29 Oct 2026): validate_deposit_settlement from 20261028100000 used
-- "SET search_path FROM CURRENT" and unqualified table names. The same function again, with the fixed
-- search_path of the other functions ('public') and "public." on every table. Its checks do not change.
-- No table or row is changed.

CREATE OR REPLACE FUNCTION public.validate_deposit_settlement() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE incoming NUMERIC; deductions NUMERIC; outgoing NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Approved settlement cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.contract_deposit_transfers WHERE from_contract_id = OLD.lease_contract_id AND status <> 'cancelled') THEN
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
      (to_jsonb(NEW) - ARRAY['status','refunded_at','refund_reference','return_received_reference','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['status','refunded_at','refund_reference','return_received_reference','updated_at']) THEN
      RAISE EXCEPTION 'Approved settlement amounts and approval are immutable' USING ERRCODE = '23514';
    END IF;
    IF (OLD.status = 'approved' AND NEW.status = 'draft') OR
       (OLD.status = 'completed' AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at')) THEN
      RAISE EXCEPTION 'Settlement cannot be reopened or completed proof changed' USING ERRCODE = '23514';
    END IF;
    IF OLD.refunded_at IS NOT NULL AND
      (NEW.refunded_at IS DISTINCT FROM OLD.refunded_at
       OR NEW.refund_reference IS DISTINCT FROM OLD.refund_reference
       OR NEW.return_received_reference IS DISTINCT FROM OLD.return_received_reference) THEN
      RAISE EXCEPTION 'Recorded refund proof is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.status = 'draft' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.lease_contracts WHERE id = NEW.lease_contract_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'A cancelled lease cannot approve a deposit settlement' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lease_contracts lc
    WHERE lc.id = NEW.lease_contract_id
      AND (
        lc.status IN ('expired', 'terminated')
        OR lc.end_date <= (now() AT TIME ZONE 'Asia/Bangkok')::date
        OR lc.data ? 'notRenewing'
        OR lc.data ? 'endsOn'
      )
  ) THEN
    RAISE EXCEPTION 'Only a lease that is ending can approve a deposit settlement' USING ERRCODE = '23514';
  END IF;
  IF NEW.deposit_received_amount > 0 AND NULLIF(BTRIM(NEW.deposit_received_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Actual deposit receipt requires evidence' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO incoming FROM public.contract_deposit_transfers
    WHERE to_contract_id = NEW.lease_contract_id AND status = 'completed';
  SELECT COALESCE(SUM(amount), 0) INTO deductions FROM public.deposit_deduction_items WHERE settlement_id = NEW.id;
  SELECT COALESCE(SUM(amount), 0) INTO outgoing FROM public.contract_deposit_transfers
    WHERE from_contract_id = NEW.lease_contract_id AND status <> 'cancelled';
  IF NEW.available_deposit_amount <> NEW.deposit_received_amount + incoming OR
     NEW.deduction_total <> deductions OR NEW.carried_forward_total <> outgoing THEN
    RAISE EXCEPTION 'Settlement must reconcile actual receipts, deductions and transfers' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'completed' AND EXISTS (SELECT 1 FROM public.contract_deposit_transfers
    WHERE from_contract_id = NEW.lease_contract_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Complete outgoing transfers before closing settlement' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
