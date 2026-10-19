-- =============================================================================
-- Portable blueprint — Roles & Access Control (DDL)
-- =============================================================================
-- Docs: docs/new-project/roles/README.md
--       docs/new-project/roles/database.md
--
-- Prerequisite: none (รันก่อน agent/create-room/schema.sql)
--
-- Run:
--   psql "$DATABASE_URL" -f docs/new-project/roles/schema.sql
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id                 SERIAL PRIMARY KEY,
  supabase_user_id   UUID         NULL UNIQUE,
  email              VARCHAR(255) NOT NULL UNIQUE,
  password           VARCHAR(255) NULL,
  first_name         VARCHAR(255) NOT NULL DEFAULT 'User',
  last_name          VARCHAR(255) NOT NULL DEFAULT '',
  phone              VARCHAR(50)  NULL,
  avatar_url         VARCHAR(512) NULL,
  profile_completed  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_supabase_user_id ON users (supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS master_roles (
  id      SERIAL PRIMARY KEY,
  name    VARCHAR(100) NOT NULL UNIQUE,
  details VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES master_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);

INSERT INTO master_roles (name, details)
VALUES
  ('guest',  'Default app identity — not a gated management mode'),
  ('landlord', 'Landlord — signs documents an agent sends'),
  ('tenant', 'Tenant mode — /tenant'),
  ('agent',  'Field agent mode — /agent'),
  ('admin',  'Admin operations — /admin')
ON CONFLICT (name) DO NOTHING;

-- Migrate older blueprints that seeded `resident` → `tenant`
DO $$
DECLARE
  resident_id INT;
  tenant_id INT;
BEGIN
  SELECT id INTO resident_id FROM master_roles WHERE name = 'resident';
  SELECT id INTO tenant_id FROM master_roles WHERE name = 'tenant';

  IF resident_id IS NOT NULL AND tenant_id IS NOT NULL THEN
    UPDATE user_roles
    SET role_id = tenant_id
    WHERE role_id = resident_id
      AND NOT EXISTS (
        SELECT 1 FROM user_roles ur2
        WHERE ur2.user_id = user_roles.user_id AND ur2.role_id = tenant_id
      );
    DELETE FROM user_roles WHERE role_id = resident_id;
    DELETE FROM master_roles WHERE id = resident_id;
  ELSIF resident_id IS NOT NULL AND tenant_id IS NULL THEN
    UPDATE master_roles
    SET name = 'tenant',
        details = 'Tenant mode — /tenant'
    WHERE id = resident_id;
  END IF;
END $$;
COMMIT;
