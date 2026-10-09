-- Monthly rent bills generated automatically from active lease agreements.
CREATE TABLE IF NOT EXISTS tenant_bills (
  id SERIAL PRIMARY KEY,
  lease_contract_id INTEGER NOT NULL REFERENCES lease_contracts (id) ON DELETE RESTRICT,
  tenant_id INTEGER NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  period VARCHAR(7) NOT NULL,
  document_no VARCHAR(40) NOT NULL UNIQUE,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  grace_until DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  payment_slip_path TEXT,
  invoice_path TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_bills_period UNIQUE (lease_contract_id, period),
  CONSTRAINT chk_tenant_bills_status CHECK (status IN ('pending', 'paid'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_bills_tenant
  ON tenant_bills (tenant_id, due_date DESC);
