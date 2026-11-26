-- Self owner contracts (plans/2026-11-26-self-owner-contracts-api): a lease and its tenancy may now point at a self owner
-- room (self_owner_rooms) instead of an agent room (rent_rooms), exactly one of the two. rent_room_id becomes nullable,
-- self_owner_room_id is new on lease_contracts and room_tenancies, and a self owner room has at most one active tenancy.
-- The two deposit guards compare the new column too (a NULL rent_room_id on both sides must not pass as "same room").
-- Existing rows all have rent_room_id, so the new CHECKs hold for them. Both guard functions keep their body, search_path
-- and language from the baseline (20261014100838_baseline.sql); only the lines named above change.
-- Undo (only once no lease or tenancy uses a self owner room: delete or move those rows first):
--   ALTER TABLE public.room_tenancies DROP CONSTRAINT chk_room_tenancies_one_room;
--   DROP INDEX public.uq_room_tenancies_one_active_per_self_owner_room;
--   ALTER TABLE public.room_tenancies DROP COLUMN self_owner_room_id;   -- drops its FK and index too
--   ALTER TABLE public.room_tenancies ALTER COLUMN rent_room_id SET NOT NULL;
--   ALTER TABLE public.lease_contracts DROP CONSTRAINT chk_lease_contracts_one_room;
--   ALTER TABLE public.lease_contracts DROP COLUMN self_owner_room_id;  -- drops its FK and index too
--   ALTER TABLE public.lease_contracts ALTER COLUMN rent_room_id SET NOT NULL;
--   then CREATE OR REPLACE both functions below with the bodies from 20261014100838_baseline.sql (triggers stay as they are).

ALTER TABLE public.lease_contracts ALTER COLUMN rent_room_id DROP NOT NULL;
ALTER TABLE public.lease_contracts ADD COLUMN self_owner_room_id integer;
ALTER TABLE public.lease_contracts
  ADD CONSTRAINT lease_contracts_self_owner_room_id_fkey FOREIGN KEY (self_owner_room_id) REFERENCES public.self_owner_rooms (id) ON DELETE RESTRICT;
ALTER TABLE public.lease_contracts
  ADD CONSTRAINT chk_lease_contracts_one_room CHECK (num_nonnulls(rent_room_id, self_owner_room_id) = 1);
CREATE INDEX idx_lease_contracts_self_owner_room_id ON public.lease_contracts (self_owner_room_id);

ALTER TABLE public.room_tenancies ALTER COLUMN rent_room_id DROP NOT NULL;
ALTER TABLE public.room_tenancies ADD COLUMN self_owner_room_id integer;
ALTER TABLE public.room_tenancies
  ADD CONSTRAINT room_tenancies_self_owner_room_id_fkey FOREIGN KEY (self_owner_room_id) REFERENCES public.self_owner_rooms (id) ON DELETE RESTRICT;
ALTER TABLE public.room_tenancies
  ADD CONSTRAINT chk_room_tenancies_one_room CHECK (num_nonnulls(rent_room_id, self_owner_room_id) = 1);
CREATE INDEX idx_room_tenancies_self_owner_room_id ON public.room_tenancies (self_owner_room_id);
CREATE UNIQUE INDEX uq_room_tenancies_one_active_per_self_owner_room ON public.room_tenancies (self_owner_room_id) WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.protect_deposit_contract_link() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (NEW.tenant_id, NEW.rent_room_id, NEW.self_owner_room_id, NEW.previous_agreement_id, NEW.agreement_kind, NEW.start_date, NEW.end_date, NEW.deposit)
    IS DISTINCT FROM
    (OLD.tenant_id, OLD.rent_room_id, OLD.self_owner_room_id, OLD.previous_agreement_id, OLD.agreement_kind, OLD.start_date, OLD.end_date, OLD.deposit)
    AND EXISTS (SELECT 1 FROM contract_deposit_transfers
      WHERE (from_contract_id = OLD.id OR to_contract_id = OLD.id) AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Cancel pending deposit allocation before changing contract terms' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IN ('cancelled','terminated') AND NEW.status IS DISTINCT FROM OLD.status AND
    EXISTS (SELECT 1 FROM contract_deposit_transfers t JOIN contract_deposit_settlements s
      ON s.lease_contract_id = t.from_contract_id
      WHERE t.to_contract_id = OLD.id AND t.status = 'pending' AND s.status <> 'draft') THEN
    RAISE EXCEPTION 'Resolve approved deposit allocation before cancelling its renewal' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_deposit_transfer() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE source lease_contracts%ROWTYPE; destination lease_contracts%ROWTYPE;
  source_settlement contract_deposit_settlements%ROWTYPE; destination_status VARCHAR;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cancel a pending transfer instead of deleting its history' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'Create a pending transfer before completion' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Completed or cancelled transfer is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.from_contract_id <> OLD.from_contract_id OR NEW.to_contract_id <> OLD.to_contract_id) THEN
    RAISE EXCEPTION 'Transfer contracts cannot be changed' USING ERRCODE = '23514';
  END IF;
  -- Serialize with approval and other money operations on both contracts.
  PERFORM id FROM contract_deposit_settlements
    WHERE lease_contract_id IN (NEW.from_contract_id, NEW.to_contract_id) ORDER BY id FOR UPDATE;
  SELECT * INTO source_settlement FROM contract_deposit_settlements WHERE lease_contract_id = NEW.from_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source requires a deposit settlement' USING ERRCODE = '23514'; END IF;
  SELECT status INTO destination_status FROM contract_deposit_settlements WHERE lease_contract_id = NEW.to_contract_id;
  IF source_settlement.status <> 'draft' AND NOT
    (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'completed' AND
     source_settlement.status = 'approved' AND NEW.amount = OLD.amount AND
     NEW.created_by_user_id = OLD.created_by_user_id) THEN
    RAISE EXCEPTION 'Approved transfer allocation cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  SELECT * INTO source FROM lease_contracts WHERE id = NEW.from_contract_id;
  SELECT * INTO destination FROM lease_contracts WHERE id = NEW.to_contract_id;
  IF source.id IS NULL OR destination.id IS NULL OR
    destination.previous_agreement_id IS DISTINCT FROM source.id OR destination.agreement_kind <> 'renewal' OR
    source.tenant_id <> destination.tenant_id OR
    source.rent_room_id IS DISTINCT FROM destination.rent_room_id OR source.self_owner_room_id IS DISTINCT FROM destination.self_owner_room_id OR
    source.end_date IS NULL OR destination.start_date <= source.end_date OR
    destination.status IN ('cancelled', 'terminated', 'expired') OR
    destination.deposit IS NULL OR NEW.amount > destination.deposit THEN
    RAISE EXCEPTION 'Deposit transfer must target the direct renewal for the same tenant and room' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'completed' AND (source_settlement.status <> 'approved' OR source.status <> 'expired' OR
    destination.status <> 'active' OR destination_status IN ('approved','completed')) THEN
    RAISE EXCEPTION 'Transfer needs an approved source settlement, expired predecessor and active renewal' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
