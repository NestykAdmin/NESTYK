-- A rent slip stays with the tenant until they confirm it for the agent.
ALTER TABLE tenant_bills
  ADD COLUMN IF NOT EXISTS slip_submitted_at TIMESTAMPTZ;
