-- D5 (AC-C.1 to C.4, Aof 26 Oct 2026): cancelling a deal before the room is handed over.
-- The agent records who caused it (the tenant or the landlord), a reason and at least 1 evidence file. Every open
-- booking letter and lease of the deal becomes "cancelled" in one go. Only money with an issued receipt counts:
-- the tenant at fault forfeits it; the landlord at fault means it is refunded within 7 days from the day the agent
-- was told (the agent records the refund with a proof file, once; past the due day the agent is reminded).
-- Adds a table, 2 end reasons and 1 reminder kind; existing data is not changed.

-- Fixed ids like 20261014120000_contract_closure.sql (the seed inserts ids 1-7 explicitly).
INSERT INTO public.master_contract_end_reasons
  (id, code, name_th, name_en, applicable_status, default_deposit_policy, requires_note, sort_order)
VALUES
  (9, 'deal_cancelled', 'ยกเลิกดีลก่อนส่งมอบห้อง', 'Deal cancelled before handover', 'cancelled', 'manual_review', TRUE, 66),
  (10, 'landlord_withdrew', 'ผู้ให้เช่าไม่ให้เช่าต่อ', 'Landlord withdrew the room', 'terminated', 'manual_review', TRUE, 67)
ON CONFLICT DO NOTHING;
SELECT pg_catalog.setval('public.master_contract_end_reasons_id_seq',
  (SELECT max(id) FROM public.master_contract_end_reasons), true);

CREATE TABLE public.deal_cancellations (
    id serial PRIMARY KEY,
    agent_user_id integer NOT NULL,
    lead_id integer NOT NULL,
    rent_room_id integer NOT NULL,
    tenant_id integer,
    -- The deal's latest agreement (the lease, else the booking letter): what the app and the reminders point at.
    lease_contract_id integer NOT NULL,
    -- Every agreement this cancellation closed.
    contract_ids integer[] NOT NULL,
    at_fault character varying(16) NOT NULL,
    reason character varying(1000) NOT NULL,
    -- Storage paths of the evidence files (images or PDFs), at least 1.
    evidence_paths jsonb NOT NULL,
    -- The day the agent was told (the landlord at fault: the refund is due 7 days after it).
    notified_on date,
    -- Received with an issued receipt when cancelled.
    booking_received numeric(12,2) DEFAULT 0 NOT NULL,
    deposit_received numeric(12,2) DEFAULT 0 NOT NULL,
    forfeited_amount numeric(12,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(12,2) DEFAULT 0 NOT NULL,
    refund_due_on date,
    refunded_on date,
    refund_proof_path text,
    refund_recorded_at timestamp with time zone,
    refund_recorded_by_user_id integer,
    -- The landlord at fault and the agent also ended the broker appointment for the room.
    appointment_ended boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT deal_cancellations_agent_user_id_fkey FOREIGN KEY (agent_user_id) REFERENCES public.users(id),
    CONSTRAINT deal_cancellations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id),
    CONSTRAINT deal_cancellations_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id),
    CONSTRAINT deal_cancellations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
    CONSTRAINT deal_cancellations_lease_contract_id_fkey FOREIGN KEY (lease_contract_id) REFERENCES public.lease_contracts(id),
    CONSTRAINT deal_cancellations_refund_recorded_by_user_id_fkey FOREIGN KEY (refund_recorded_by_user_id) REFERENCES public.users(id),
    CONSTRAINT chk_deal_cancellations_at_fault CHECK (at_fault IN ('tenant', 'landlord')),
    CONSTRAINT chk_deal_cancellations_reason CHECK (char_length(btrim(reason)) > 0),
    CONSTRAINT chk_deal_cancellations_contracts CHECK (cardinality(contract_ids) >= 1 AND lease_contract_id = ANY (contract_ids)),
    CONSTRAINT chk_deal_cancellations_evidence CHECK (jsonb_typeof(evidence_paths) = 'array' AND jsonb_array_length(evidence_paths) >= 1),
    CONSTRAINT chk_deal_cancellations_notified CHECK (at_fault <> 'landlord' OR notified_on IS NOT NULL),
    CONSTRAINT chk_deal_cancellations_amounts CHECK (booking_received >= 0 AND deposit_received >= 0 AND forfeited_amount >= 0 AND refund_amount >= 0
        AND forfeited_amount + refund_amount = booking_received + deposit_received
        AND (at_fault = 'tenant' OR forfeited_amount = 0) AND (at_fault = 'landlord' OR refund_amount = 0)),
    CONSTRAINT chk_deal_cancellations_refund_due CHECK ((refund_amount > 0) = (refund_due_on IS NOT NULL)),
    CONSTRAINT chk_deal_cancellations_refund CHECK ((refunded_on IS NULL AND refund_proof_path IS NULL AND refund_recorded_at IS NULL)
        OR (refund_amount > 0 AND refunded_on IS NOT NULL AND refund_proof_path IS NOT NULL AND refund_recorded_at IS NOT NULL)),
    CONSTRAINT chk_deal_cancellations_appointment CHECK (NOT appointment_ended OR at_fault = 'landlord')
);
CREATE UNIQUE INDEX uq_deal_cancellations_contract ON public.deal_cancellations (lease_contract_id);
CREATE INDEX idx_deal_cancellations_agent ON public.deal_cancellations (agent_user_id);
CREATE INDEX idx_deal_cancellations_refund_open ON public.deal_cancellations (refund_due_on)
    WHERE refund_amount > 0 AND refunded_on IS NULL;
ALTER TABLE public.deal_cancellations ENABLE ROW LEVEL SECURITY;

-- The 7th reminder: a refund not recorded after its due day (TC-C.05, C.07).
ALTER TABLE public.contract_reminders DROP CONSTRAINT chk_contract_reminders_kind;
ALTER TABLE public.contract_reminders ADD CONSTRAINT chk_contract_reminders_kind CHECK (kind IN (
    'reservation_sign_late', 'lease_sign_late', 'deposit_unpaid', 'rent_overdue', 'rent_overdue_15', 'renewal_notice',
    'refund_late'));
