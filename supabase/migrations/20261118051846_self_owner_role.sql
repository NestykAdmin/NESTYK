-- Role change round 2 (docs/ROLE-CHANGE-PLAN.md 5.1, Mos 18 Nov 2026): add the account role 'self_owner'
-- (an owner who lists rooms without an agent). Sample menus only for now: no API route grants it anything (@Roles).
-- The id is fixed (MIGRATION-RULES rule 5): supabase/seed/masters.sql inserts ids 1-5 after this file on a fresh
-- database, and its master_roles_id_seq setval already uses max(id), so the seed needs no change.
-- Order: run this BEFORE the code that lists self_owner in MASTER_ROLE_NAMES starts; the API of that code refuses
-- to start while the row is missing. Older code only logs a warning about the unknown role.
-- Undo: DELETE FROM public.user_roles WHERE role_id = 6; DELETE FROM public.master_roles WHERE id = 6 AND name = 'self_owner';
--       (only while no account depends on it; the code that needs it must be rolled back first).

DO $$
DECLARE
  taken_by text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.master_roles WHERE name = 'self_owner') THEN
    SELECT name INTO taken_by FROM public.master_roles WHERE id = 6;
    IF taken_by IS NOT NULL THEN
      RAISE EXCEPTION 'master_roles id 6 is already used by %, so self_owner cannot take it (docs/ROLE-CHANGE-PLAN.md 5.1)', taken_by;
    END IF;
    INSERT INTO public.master_roles (id, name, details)
    VALUES (6, 'self_owner', 'Owner who lists rooms without an agent');
  END IF;
END $$;

SELECT pg_catalog.setval('public.master_roles_id_seq', (SELECT max(id) FROM public.master_roles), true);
