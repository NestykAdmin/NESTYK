-- Link the QA logins (qa-<role>@nestyk.test) to their profile and roles.
--
-- The logins themselves are NOT created here: make them in Supabase > Authentication > Users > Add user
-- (Auto Confirm User on) BEFORE this migration runs. Passwords stay in Supabase Auth only, never in git.
-- This file only touches public.users / public.user_roles for e-mails that already exist in auth.users,
-- so it does nothing on a database without those logins (prod, a fresh local DB).
-- It runs once per database. Logins added after it ran: copy the statement between $sql$ ... $sql$ below
-- into the Supabase SQL Editor and run it (safe to re-run).
--
-- No fixed ids needed (rule 5): it never runs before demo seed on a fresh DB, because auth.users is empty then.
-- Plain Postgres without the Supabase auth schema (some local labs): skipped.

DO $mig$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'link_qa_accounts: auth.users not found, skipped';
    RETURN;
  END IF;

  EXECUTE $sql$
    WITH qa (email, first_name, last_name, phone, identity_number, roles) AS (
      VALUES
        ('qa-guest@nestyk.test',    'QA', 'Guest',    '0990000001', NULL,            ARRAY['guest']),
        ('qa-tenant@nestyk.test',   'QA', 'Tenant',   '0990000002', '0000000000002', ARRAY['guest', 'tenant']),
        ('qa-landlord@nestyk.test', 'QA', 'Landlord', '0990000003', '0000000000003', ARRAY['guest', 'landlord']),
        ('qa-agent@nestyk.test',    'QA', 'Agent',    '0990000004', NULL,            ARRAY['guest', 'agent']),
        ('qa-admin@nestyk.test',    'QA', 'Admin',    '0990000005', NULL,            ARRAY['guest', 'admin'])
    ),
    au AS (
      SELECT qa.*, a.id AS auth_id
      FROM qa
      JOIN auth.users a ON lower(a.email) = qa.email
    ),
    up AS (
      INSERT INTO public.users
        (supabase_user_id, email, first_name, last_name, phone, identity_number, nationality, profile_completed)
      SELECT auth_id, email, first_name, last_name, phone, identity_number, 'ไทย', true
      FROM au
      ON CONFLICT (email) DO UPDATE SET
        supabase_user_id  = EXCLUDED.supabase_user_id,
        first_name        = EXCLUDED.first_name,
        last_name         = EXCLUDED.last_name,
        phone             = EXCLUDED.phone,
        identity_number   = EXCLUDED.identity_number,
        nationality       = EXCLUDED.nationality,
        profile_completed = true
      RETURNING id, email
    )
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT up.id, r.id
    FROM up
    JOIN au USING (email)
    JOIN public.master_roles r ON r.name = ANY (au.roles)
    ON CONFLICT DO NOTHING
  $sql$;
END
$mig$;
