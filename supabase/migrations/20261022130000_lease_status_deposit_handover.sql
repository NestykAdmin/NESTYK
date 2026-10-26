-- D7 (AC-4.6, 5.4, 6.3): a generated lease is not in force until the room is handed over.
--   awaiting_deposit   the lease document is generated; the deposit receipt is not issued yet
--   awaiting_handover  the deposit is received (or the lease has no deposit); the handover is not signed by both yet
--   active             the handover is signed by the landlord and the tenant; rent bills start (from the start date)
-- S1 in nestyk-contract-schema-plan.md: awaiting_payment and awaiting_payment_verification were never set by any
-- code and are removed. Leases already active stay active. Renewals, reservations and broker appointments are
-- still active when generated.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lease_contracts WHERE status IN ('awaiting_payment', 'awaiting_payment_verification')) THEN
    RAISE EXCEPTION 'lease_contracts still uses awaiting_payment or awaiting_payment_verification; move those rows first';
  END IF;
END $$;
ALTER TABLE public.lease_contracts DROP CONSTRAINT chk_lease_contracts_status;
ALTER TABLE public.lease_contracts ADD CONSTRAINT chk_lease_contracts_status CHECK (status IS NOT NULL AND status IN (
  'draft', 'awaiting_signatures', 'awaiting_agent_review', 'awaiting_deposit', 'awaiting_handover',
  'active', 'cancelled', 'expired', 'terminated'));
