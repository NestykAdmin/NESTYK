-- Room viewings an agent books for a lead (docs/new-project/agent/leads/viewings.md).
CREATE TABLE IF NOT EXISTS lead_viewings (
  id serial PRIMARY KEY,
  lead_id int NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  rent_room_id int NOT NULL REFERENCES rent_rooms (id) ON DELETE CASCADE,
  created_by_user_id int NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'scheduled',
  note varchar(500) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_lead_viewings_status CHECK (status IN ('scheduled', 'done', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_lead_viewings_agent_scheduled
  ON lead_viewings (created_by_user_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_lead_viewings_lead_scheduled
  ON lead_viewings (lead_id, scheduled_at);
