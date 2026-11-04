-- Account deletion can be immediate or scheduled 30 days ahead. The login stays usable until deletion_effective_at.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_effective_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_deletion_effective_at
  ON public.users (deletion_effective_at)
  WHERE deletion_effective_at IS NOT NULL;
