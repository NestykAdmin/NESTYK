CREATE TABLE public.agent_calendar_events (
  id SERIAL PRIMARY KEY,
  created_by_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  title VARCHAR(160) NOT NULL,
  location VARCHAR(160) NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  kind VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_agent_calendar_events_status CHECK (status IN ('pending', 'confirmed'))
);
CREATE INDEX idx_agent_calendar_events_agent_starts ON public.agent_calendar_events(created_by_user_id, starts_at);
ALTER TABLE public.agent_calendar_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.agent_calendar_events FROM anon;
    REVOKE ALL ON SEQUENCE public.agent_calendar_events_id_seq FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.agent_calendar_events FROM authenticated;
    REVOKE ALL ON SEQUENCE public.agent_calendar_events_id_seq FROM authenticated;
  END IF;
END $$;
