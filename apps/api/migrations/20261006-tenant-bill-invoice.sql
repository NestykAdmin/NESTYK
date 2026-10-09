ALTER TABLE tenant_bills
  ADD COLUMN IF NOT EXISTS invoice_path TEXT;
