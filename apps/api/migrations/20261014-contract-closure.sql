-- Prerequisite: contract-end-deposits. Do not infer historical closures or money.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS booking_released_at TIMESTAMPTZ;
DROP INDEX IF EXISTS uq_leads_one_booked_per_room;
CREATE UNIQUE INDEX uq_leads_one_booked_per_room ON leads(rent_room_id)
  WHERE status = 'booked' AND booking_released_at IS NULL;

INSERT INTO master_contract_end_reasons
  (code, name_th, name_en, applicable_status, default_deposit_policy, requires_note, sort_order)
VALUES ('before_start_cancelled', 'ยกเลิกก่อนเริ่มเช่า', 'Cancelled before lease start',
  'cancelled', 'manual_review', TRUE, 65)
ON CONFLICT (code) DO NOTHING;
