-- Apply transactionally with search_path set to DB_SCHEMA, using the same DATABASE_URL as the API
-- (apps/api/scripts/apply-lock-down-data-api.cjs).
-- The apps only use Supabase for Auth; every table is read and written by the API's own connection.
-- Supabase's Data API (anon / authenticated roles) must therefore see none of these tables.
-- Same policy 20260911-agreement-types.sql already applies to "server-only tables", extended to all of them:
--   * RLS on with no policy  -> anon / authenticated get zero rows even if a grant slips back in
--   * grants revoked          -> anon / authenticated cannot reach the tables or sequences at all
-- The API keeps working because the table owner (or a role with BYPASSRLS) is not subject to RLS.
-- The first block stops the migration if the role running it would be blocked, since that is the API's role.

DO $$
DECLARE
  app_schema text := current_schema();
  t record;
  blocked text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO blocked
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = app_schema AND c.relkind = 'r'
    AND NOT pg_has_role(current_user, c.relowner, 'USAGE')
    AND NOT (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = current_user);
  IF blocked IS NOT NULL THEN
    RAISE EXCEPTION 'Role % neither owns nor bypasses RLS on: %. Enabling RLS would block the API.', current_user, blocked;
  END IF;

  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = app_schema AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', app_schema, t.relname);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM anon', app_schema);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM anon', app_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM anon', app_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM anon', app_schema);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM authenticated', app_schema);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM authenticated', app_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM authenticated', app_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM authenticated', app_schema);
  END IF;
END $$;
