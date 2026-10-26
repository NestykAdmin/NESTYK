-- D4 (AC-3.6, 4.6, 5.5, 7.4 to 7.6, Aof 26 Oct 2026): the reminders the system sent, so each one is sent once.
-- A daily job works out what is due (a letter or lease not signed in time, the deposit not paid by the handover
-- date, rent past its grace or 15 days late, the lease nearing its end) and adds one row per reminder and person;
-- the unique index makes a second run (or a second API instance) add nothing. The e-mail is sent from these rows.
-- What the app shows is worked out from the current state, not from this table.
-- Adds a table only; existing data is not changed.

CREATE TABLE public.contract_reminders (
    id serial PRIMARY KEY,
    kind character varying(32) NOT NULL,
    lease_contract_id integer NOT NULL,
    tenant_bill_id integer,
    -- The due day the reminder is about (a later due day, e.g. a postponed handover, is a new reminder).
    due_date date NOT NULL,
    recipient_user_id integer NOT NULL,
    emailed_at timestamp with time zone,
    email_error character varying(200),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contract_reminders_lease_contract_id_fkey FOREIGN KEY (lease_contract_id) REFERENCES public.lease_contracts(id) ON DELETE CASCADE,
    CONSTRAINT contract_reminders_tenant_bill_id_fkey FOREIGN KEY (tenant_bill_id) REFERENCES public.tenant_bills(id) ON DELETE CASCADE,
    CONSTRAINT contract_reminders_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT chk_contract_reminders_kind CHECK (kind IN (
        'reservation_sign_late', 'lease_sign_late', 'deposit_unpaid', 'rent_overdue', 'rent_overdue_15', 'renewal_notice')),
    -- Rent reminders are about a bill; the others are not.
    CONSTRAINT chk_contract_reminders_bill CHECK (((kind)::text LIKE 'rent_%') = (tenant_bill_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_contract_reminders_once
    ON public.contract_reminders (kind, lease_contract_id, (COALESCE(tenant_bill_id, 0)), due_date, recipient_user_id);
CREATE INDEX idx_contract_reminders_unsent ON public.contract_reminders (created_at) WHERE emailed_at IS NULL;
ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;
