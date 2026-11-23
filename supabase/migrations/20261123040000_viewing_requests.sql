-- Viewing requests from the guest web (project-docs/nestyk-guest-viewing-request-plan-20261123.md, Mos approved
-- step 1 on 23 Nov 2026). A signed-in account asks to view a public room; NESTYK admin coordinates it. For an agent's
-- room admin forwards it to the agent, who either handles it (and then sees the guest's contact) or hands it back.
-- Two new tables only; no existing table changes. Writes go through the API (no policies, like every other table).
-- Undo: DROP TABLE public.viewing_request_events, public.viewing_requests;
--       (the requests and their coordination notes are lost; no other table changes).
CREATE TABLE public.viewing_requests (
  id serial PRIMARY KEY,
  rent_room_id integer NOT NULL,
  requester_user_id integer NOT NULL,
  agent_user_id integer,
  contact_name varchar(255) NOT NULL,
  contact_phone varchar(50) NOT NULL,
  contact_email varchar(255),
  preferred_dates date[] NOT NULL,
  preferred_slot varchar(10) NOT NULL,
  message varchar(500),
  status varchar(20) NOT NULL DEFAULT 'new',
  handled_by varchar(10),
  scheduled_at timestamptz,
  close_reason varchar(500),
  cancelled_by varchar(10),
  owner_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT viewing_requests_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms (id) ON DELETE CASCADE,
  CONSTRAINT viewing_requests_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT viewing_requests_agent_user_id_fkey FOREIGN KEY (agent_user_id) REFERENCES public.users (id) ON DELETE SET NULL,
  CONSTRAINT chk_viewing_requests_status CHECK (status IN ('new', 'awaiting_agent', 'agent_handling', 'admin_handling', 'scheduled', 'viewed', 'cancelled', 'closed')),
  CONSTRAINT chk_viewing_requests_slot CHECK (preferred_slot IN ('morning', 'afternoon', 'evening', 'any')),
  CONSTRAINT chk_viewing_requests_dates CHECK (cardinality(preferred_dates) BETWEEN 1 AND 3),
  CONSTRAINT chk_viewing_requests_handled_by CHECK (handled_by IS NULL OR handled_by IN ('agent', 'admin')),
  CONSTRAINT chk_viewing_requests_cancelled_by CHECK (cancelled_by IS NULL OR cancelled_by IN ('guest', 'admin')),
  CONSTRAINT chk_viewing_requests_handler_set CHECK (status NOT IN ('agent_handling', 'admin_handling', 'scheduled', 'viewed') OR handled_by IS NOT NULL),
  CONSTRAINT chk_viewing_requests_scheduled_at CHECK (status NOT IN ('scheduled', 'viewed') OR scheduled_at IS NOT NULL),
  CONSTRAINT chk_viewing_requests_close_reason CHECK (status <> 'closed' OR close_reason IS NOT NULL)
);

CREATE INDEX idx_viewing_requests_requester_created ON public.viewing_requests (requester_user_id, created_at);
CREATE INDEX idx_viewing_requests_status_created ON public.viewing_requests (status, created_at);
CREATE INDEX idx_viewing_requests_agent_status ON public.viewing_requests (agent_user_id, status);
CREATE INDEX idx_viewing_requests_rent_room_id ON public.viewing_requests (rent_room_id);
-- One open request per account per room (the API answers 409 REQUEST_EXISTS before this; this guards two at once).
CREATE UNIQUE INDEX uq_viewing_requests_open_per_room ON public.viewing_requests (requester_user_id, rent_room_id)
  WHERE status IN ('new', 'awaiting_agent', 'agent_handling', 'admin_handling', 'scheduled');

ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;

-- Who did what and when (every status change, plus admin's coordination notes).
CREATE TABLE public.viewing_request_events (
  id serial PRIMARY KEY,
  request_id integer NOT NULL,
  actor_user_id integer,
  from_status varchar(20),
  to_status varchar(20) NOT NULL,
  note varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT viewing_request_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.viewing_requests (id) ON DELETE CASCADE,
  CONSTRAINT viewing_request_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE SET NULL
);

CREATE INDEX idx_viewing_request_events_request_created ON public.viewing_request_events (request_id, created_at);
CREATE INDEX idx_viewing_request_events_actor_user_id ON public.viewing_request_events (actor_user_id);

ALTER TABLE public.viewing_request_events ENABLE ROW LEVEL SECURITY;
