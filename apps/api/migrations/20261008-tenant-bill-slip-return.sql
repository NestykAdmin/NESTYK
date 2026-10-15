-- Agent can return a rent slip when the image is incorrect.
ALTER TABLE tenant_bills
  ADD COLUMN IF NOT EXISTS slip_return_note TEXT;
