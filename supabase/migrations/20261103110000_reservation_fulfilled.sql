-- A booking letter ends when its deal's lease is in force (both parties signed the move-in handover): the booking fee
-- became the first month's rent. The API records it as terminated with this reason in the handover transaction
-- (reservation-fulfilment.ts). The reason is not offered when closing a lease, and the close API refuses it.
-- Fixed id after the seed and the earlier migrations (MIGRATION-RULES.md rule 5).
INSERT INTO public.master_contract_end_reasons
  (id, code, name_th, name_en, applicable_status, default_deposit_policy, requires_note, sort_order)
VALUES (11, 'reservation_fulfilled', 'ใช้แล้ว: ทำสัญญาเช่าแล้ว', 'Used: the lease is in force',
  'terminated', 'manual_review', FALSE, 68)
ON CONFLICT DO NOTHING;
SELECT pg_catalog.setval('public.master_contract_end_reasons_id_seq',
  (SELECT max(id) FROM public.master_contract_end_reasons), true);

-- Backfill: booking letters still active whose deal (lead, room, tenant) already has its first lease in force or
-- ended. They end on the date of the completed move-in handover, or the lease start date for a lease from before
-- handover records, and never before the letter's own date. Undo: see the comment at the end of this file.
WITH reason AS (
  SELECT id FROM public.master_contract_end_reasons WHERE code = 'reservation_fulfilled'
), letters AS (
  SELECT r.id, r.start_date, r.created_by_user_id, r.lead_id, r.rent_room_id, r.tenant_id
  FROM public.lease_contracts r
  LEFT JOIN public.agreement_templates rt ON rt.id = r.template_id
  LEFT JOIN public.master_agreement_types ra ON ra.code = r.agreement_type_code
  WHERE r.status = 'active' AND COALESCE(rt.form_kind, ra.form_kind) = 'reservation'
), fulfilled AS (
  SELECT DISTINCT ON (letters.id) letters.id, letters.start_date, letters.created_by_user_id,
    COALESCE(h.handover_date, l.start_date) AS moved_in
  FROM letters
  JOIN public.lease_contracts l
    ON l.lead_id = letters.lead_id AND l.rent_room_id = letters.rent_room_id AND l.tenant_id = letters.tenant_id
  LEFT JOIN public.agreement_templates lt ON lt.id = l.template_id
  LEFT JOIN public.master_agreement_types la ON la.code = l.agreement_type_code
  LEFT JOIN public.handover_records h
    ON h.agreement_id = l.id AND h.kind = 'move_in' AND h.completed_at IS NOT NULL
  WHERE COALESCE(lt.form_kind, la.form_kind) = 'lease' AND l.agreement_kind = 'new'
    AND l.status IN ('active', 'expired', 'terminated')
  ORDER BY letters.id, l.id
)
UPDATE public.lease_contracts c
SET status = 'terminated',
    end_reason_id = (SELECT id FROM reason),
    end_reason_note = NULL,
    effective_end_date = GREATEST(fulfilled.moved_in, fulfilled.start_date),
    end_recorded_at = now(),
    end_recorded_by_user_id = fulfilled.created_by_user_id
FROM fulfilled
WHERE c.id = fulfilled.id AND c.status = 'active';

-- Undo (run by hand only if this change is rolled back; not part of the migration). contract_end_reason_guard refuses
-- to clear an end reason, so it is switched off for this one transaction:
--   BEGIN;
--   ALTER TABLE public.lease_contracts DISABLE TRIGGER contract_end_reason_guard;
--   UPDATE public.lease_contracts SET status = 'active', end_reason_id = NULL, effective_end_date = NULL,
--     end_recorded_at = NULL, end_recorded_by_user_id = NULL
--   WHERE end_reason_id = (SELECT id FROM public.master_contract_end_reasons WHERE code = 'reservation_fulfilled');
--   ALTER TABLE public.lease_contracts ENABLE TRIGGER contract_end_reason_guard;
--   COMMIT;
