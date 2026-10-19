ALTER TABLE public.agent_calendar_events DROP CONSTRAINT chk_agent_calendar_events_status;
ALTER TABLE public.agent_calendar_events ADD CONSTRAINT chk_agent_calendar_events_status
  CHECK (status IN ('pending', 'confirmed', 'scheduled', 'done', 'cancelled'));
ALTER TABLE public.agent_calendar_events ALTER COLUMN status SET DEFAULT 'scheduled';
