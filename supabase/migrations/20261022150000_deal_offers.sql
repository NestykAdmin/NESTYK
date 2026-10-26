-- D2 (AC-2.1 to 2.4, round 1, Aof 22 Oct 2026): the terms agreed for a lead and a room, confirmed by the landlord
-- before the room is booked. The numbers then flow into the reservation letter and the lease.
--   status: draft -> awaiting_landlord -> confirmed; closed as room_taken (another lead booked the room, AC-3.1) or cancelled
--   The landlord confirms in the app (confirmation_channel 'app'), or the agent records the landlord's confirmation
--   (confirmation_channel 'agent_recorded', with how it was given and a note).
--   The reservation amount is not stored: it is 1 month of rent (AC-2.2).
--   renewal_notice_days left blank by the agent is stored as 30 (AC-2.3).
--   co_broke: another agent is on the deal; the signed co-broke file is then required before the letter is issued (AC-3.8).
-- A confirmed offer cannot be changed in round 1; the agent cancels it and makes a new one.
-- Only one open offer (draft, awaiting_landlord or confirmed) per lead and room.

CREATE TABLE public.deal_offers (
    id serial PRIMARY KEY,
    lead_id integer NOT NULL,
    rent_room_id integer NOT NULL,
    status character varying(24) DEFAULT 'draft' NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    monthly_rent numeric(12,2) NOT NULL,
    term_months integer NOT NULL,
    start_date date NOT NULL,
    deposit_amount numeric(12,2) NOT NULL,
    contract_date date NOT NULL,
    rent_due_day smallint NOT NULL,
    grace_day smallint,
    late_fee_per_day numeric(12,2),
    renewal_notice_days integer DEFAULT 30 NOT NULL,
    co_broke boolean DEFAULT false NOT NULL,
    co_broke_agent_name character varying(120),
    sent_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    confirmed_by_user_id integer,
    confirmation_channel character varying(16),
    confirmation_method character varying(16),
    confirmation_note text,
    closed_at timestamp with time zone,
    created_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT deal_offers_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE RESTRICT,
    CONSTRAINT deal_offers_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id) ON DELETE RESTRICT,
    CONSTRAINT deal_offers_confirmed_by_user_id_fkey FOREIGN KEY (confirmed_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
    CONSTRAINT deal_offers_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_deal_offers_status CHECK (status IN ('draft', 'awaiting_landlord', 'confirmed', 'room_taken', 'cancelled')),
    CONSTRAINT chk_deal_offers_revision CHECK (revision > 0),
    CONSTRAINT chk_deal_offers_terms CHECK (
        monthly_rent > 0 AND term_months BETWEEN 1 AND 120 AND deposit_amount >= 0 AND contract_date <= start_date
        AND rent_due_day BETWEEN 1 AND 31 AND (grace_day IS NULL OR grace_day BETWEEN 1 AND 31)
        AND (late_fee_per_day IS NULL OR late_fee_per_day >= 0) AND renewal_notice_days BETWEEN 1 AND 365),
    CONSTRAINT chk_deal_offers_co_broke CHECK (
        (co_broke AND co_broke_agent_name IS NOT NULL AND btrim(co_broke_agent_name) <> '')
        OR (NOT co_broke AND co_broke_agent_name IS NULL)),
    -- A confirmation says who confirmed it and how; one recorded by the agent also says how the landlord gave it.
    CONSTRAINT chk_deal_offers_confirmation CHECK (
        (confirmed_at IS NULL AND confirmed_by_user_id IS NULL AND confirmation_channel IS NULL AND confirmation_method IS NULL AND confirmation_note IS NULL)
        OR (confirmed_at IS NOT NULL AND confirmed_by_user_id IS NOT NULL AND (
            (confirmation_channel = 'app' AND confirmation_method IS NULL AND confirmation_note IS NULL)
            OR (confirmation_channel = 'agent_recorded' AND confirmation_method IN ('phone', 'line', 'in_person', 'other')
                AND confirmation_note IS NOT NULL AND btrim(confirmation_note) <> '' AND char_length(confirmation_note) <= 500)))),
    CONSTRAINT chk_deal_offers_status_dates CHECK (
        (status <> 'confirmed' OR confirmed_at IS NOT NULL)
        AND (status NOT IN ('draft', 'awaiting_landlord') OR confirmed_at IS NULL)
        AND (status <> 'awaiting_landlord' OR sent_at IS NOT NULL)
        AND ((status IN ('room_taken', 'cancelled')) = (closed_at IS NOT NULL)))
);
CREATE UNIQUE INDEX uq_deal_offers_one_open ON public.deal_offers (lead_id, rent_room_id)
    WHERE status IN ('draft', 'awaiting_landlord', 'confirmed');
CREATE INDEX idx_deal_offers_room_status ON public.deal_offers (rent_room_id, status);
CREATE INDEX idx_deal_offers_agent ON public.deal_offers (created_by_user_id, id);
ALTER TABLE public.deal_offers ENABLE ROW LEVEL SECURITY;
