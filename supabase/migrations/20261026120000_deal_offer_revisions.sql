-- D2 round 2 (AC-2.4, Aof 26 Oct 2026): a confirmed offer can be changed when the landlord agrees to new terms.
-- Every change needs a reason and how the landlord agreed (phone, LINE, in person or other); this table keeps them
-- with the terms before and after the change. The offer itself keeps its first confirmation.
-- The landlord does not confirm the change again in the app (Aof); the landlord sees the history in the app.
-- Changes are allowed until the lease of the deal has a signature, and not while a document of the deal is partly
-- signed (both checked by the API).
-- Adds a table only; existing data is not changed.

CREATE TABLE public.deal_offer_revisions (
    id serial PRIMARY KEY,
    deal_offer_id integer NOT NULL,
    revision integer NOT NULL,
    reason character varying(500) NOT NULL,
    agreed_via character varying(16) NOT NULL,
    before_terms jsonb NOT NULL,
    after_terms jsonb NOT NULL,
    created_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT deal_offer_revisions_deal_offer_id_fkey FOREIGN KEY (deal_offer_id) REFERENCES public.deal_offers(id) ON DELETE RESTRICT,
    CONSTRAINT deal_offer_revisions_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
    -- The revision the offer reached with this change (a confirmed offer is at revision 1 or later, so a change is 2 or later).
    CONSTRAINT chk_deal_offer_revisions_revision CHECK (revision > 1),
    CONSTRAINT chk_deal_offer_revisions_reason CHECK (btrim(reason) <> ''),
    CONSTRAINT chk_deal_offer_revisions_agreed_via CHECK (agreed_via IN ('phone', 'line', 'in_person', 'other')),
    CONSTRAINT chk_deal_offer_revisions_terms CHECK (
        jsonb_typeof(before_terms) = 'object' AND jsonb_typeof(after_terms) = 'object' AND before_terms <> after_terms)
);
CREATE UNIQUE INDEX uq_deal_offer_revisions_offer_revision ON public.deal_offer_revisions (deal_offer_id, revision);
ALTER TABLE public.deal_offer_revisions ENABLE ROW LEVEL SECURITY;
