-- Role change round 1 (docs/ROLE-CHANGE-PLAN.md): the role 'owner' (landlord who signs what an agent sends)
-- becomes 'landlord'. The row keeps its id, so every user_roles row keeps working without a data move.
-- The code 'owner' is retired for good: the API refuses to start while a role named 'owner' exists.
-- Contract-party values ('owner' in agreement_sign_invites.party / agreement_documents.subject, owner_* columns)
-- are a different thing ("the landlord side of a contract") and stay as they are (decision D2).
-- On a fresh database master_roles is still empty here; supabase/seed/masters.sql inserts 'landlord' itself.

DO $$
DECLARE
  owner_id int;
  landlord_id int;
BEGIN
  SELECT id INTO owner_id FROM public.master_roles WHERE name = 'owner';
  SELECT id INTO landlord_id FROM public.master_roles WHERE name = 'landlord';

  IF owner_id IS NOT NULL AND landlord_id IS NULL THEN
    UPDATE public.master_roles
       SET name = 'landlord', details = 'Landlord — signs documents an agent sends'
     WHERE id = owner_id;
  ELSIF owner_id IS NOT NULL AND landlord_id IS NOT NULL THEN
    -- Both exist (e.g. an old seed re-added 'owner'): fold its users into landlord, then drop it.
    INSERT INTO public.user_roles (user_id, role_id)
      SELECT user_id, landlord_id FROM public.user_roles WHERE role_id = owner_id
    ON CONFLICT DO NOTHING;
    DELETE FROM public.user_roles WHERE role_id = owner_id;
    DELETE FROM public.master_roles WHERE id = owner_id;
  END IF;
END $$;
