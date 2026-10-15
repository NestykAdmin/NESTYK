-- Apply transactionally with search_path set to DB_SCHEMA (apps/api/scripts/apply-document-numbers-owner-index.cjs).
-- 1) INV / REC / CCM numbers are issued system-wide (nextInvoiceNo, nextReceiptNo, nextCommissionNo in
--    agent-contracts.service.ts), so they must be unique system-wide, not only per agent.
--    The new indexes also let "latest number" lookups read the end of the index instead of the whole table.
-- 2) Owner bill / owner inbox queries filter lease_contracts.owner_user_id, which had no index.
-- 3) tenant_bills.period is always YYYY-MM (rent-schedule.ts: dueDate.slice(0, 7)); enforce it so
--    uq_tenant_bills_period cannot be bypassed by a differently formatted month.

DO $$
DECLARE dup text;
BEGIN
  SELECT string_agg(document_no, ', ') INTO dup FROM (
    SELECT document_no FROM agent_invoices GROUP BY document_no HAVING count(*) > 1 LIMIT 5) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'agent_invoices.document_no has duplicates across agents: %', dup;
  END IF;

  SELECT string_agg(receipt_document_no, ', ') INTO dup FROM (
    SELECT receipt_document_no FROM agent_invoices WHERE receipt_document_no IS NOT NULL
    GROUP BY receipt_document_no HAVING count(*) > 1 LIMIT 5) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'agent_invoices.receipt_document_no has duplicates across agents: %', dup;
  END IF;

  SELECT string_agg(document_no, ', ') INTO dup FROM (
    SELECT document_no FROM agent_commission_confirmations GROUP BY document_no HAVING count(*) > 1 LIMIT 5) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'agent_commission_confirmations.document_no has duplicates across agents: %', dup;
  END IF;

  SELECT string_agg(period, ', ') INTO dup FROM (
    SELECT DISTINCT period FROM tenant_bills WHERE period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' LIMIT 5) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'tenant_bills.period has values that are not YYYY-MM: %', dup;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_invoices_document_no
  ON agent_invoices (document_no);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_invoices_receipt_document_no
  ON agent_invoices (receipt_document_no)
  WHERE receipt_document_no IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_commission_confirmations_document_no
  ON agent_commission_confirmations (document_no);

CREATE INDEX IF NOT EXISTS idx_lease_contracts_owner_user_id
  ON lease_contracts (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'tenant_bills'::regclass AND conname = 'chk_tenant_bills_period_format'
  ) THEN
    ALTER TABLE tenant_bills
      ADD CONSTRAINT chk_tenant_bills_period_format
      CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  END IF;
END $$;
