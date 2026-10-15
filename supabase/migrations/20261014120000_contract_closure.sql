-- Contract closure (apps/api/migrations/20261014-contract-closure.sql, commit c35fd24) was added after the
-- baseline was dumped, so the baseline lacks it. Prerequisite: baseline (contract-end-deposits is inside it).
-- Do not infer historical closures or money.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS booking_released_at timestamptz;

-- A room may have one active booking; a released booking (booking_released_at set) no longer blocks it.
DROP INDEX IF EXISTS public.uq_leads_one_booked_per_room;
CREATE UNIQUE INDEX uq_leads_one_booked_per_room ON public.leads (rent_room_id)
  WHERE status = 'booked' AND booking_released_at IS NULL;

-- Fixed id 8: supabase/seed/masters.sql inserts ids 1-7 explicitly, so a sequence-assigned id here
-- (1 on an empty table) would make the seed fail with a duplicate primary key.
INSERT INTO public.master_contract_end_reasons
  (id, code, name_th, name_en, applicable_status, default_deposit_policy, requires_note, sort_order)
VALUES (8, 'before_start_cancelled', 'ยกเลิกก่อนเริ่มเช่า', 'Cancelled before lease start',
  'cancelled', 'manual_review', TRUE, 65)
ON CONFLICT DO NOTHING;

SELECT pg_catalog.setval('public.master_contract_end_reasons_id_seq',
  (SELECT max(id) FROM public.master_contract_end_reasons), true);
