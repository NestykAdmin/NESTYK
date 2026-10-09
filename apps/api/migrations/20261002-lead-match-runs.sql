-- Manual lead ↔ room matching: per-lead settings plus stored runs (docs/new-project/agent/leads/match-settings.md).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS match_settings jsonb NULL;

CREATE TABLE IF NOT EXISTS lead_match_runs (
  id serial PRIMARY KEY,
  lead_id int NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  run_by_user_id int NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  settings jsonb NOT NULL,
  input_hash varchar(64) NOT NULL,
  scoring_version smallint NOT NULL,
  candidate_count int NOT NULL,
  result_count int NOT NULL,
  top_score smallint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_lead_match_runs_counts CHECK (candidate_count >= 0 AND result_count >= 0 AND result_count <= candidate_count),
  CONSTRAINT chk_lead_match_runs_top_score CHECK (top_score IS NULL OR top_score BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_lead_match_runs_lead_created
  ON lead_match_runs (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_match_results (
  id serial PRIMARY KEY,
  run_id int NOT NULL REFERENCES lead_match_runs (id) ON DELETE CASCADE,
  rent_room_id int NOT NULL REFERENCES rent_rooms (id) ON DELETE CASCADE,
  rank smallint NOT NULL,
  score smallint NULL,
  location_score smallint NOT NULL,
  price numeric(12, 2) NOT NULL,
  term_months smallint NULL,
  distance_km double precision NOT NULL,
  pin_rank smallint NOT NULL,
  comparison jsonb NOT NULL,
  CONSTRAINT chk_lead_match_results_score CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  CONSTRAINT chk_lead_match_results_location CHECK (location_score BETWEEN 0 AND 100),
  CONSTRAINT uq_lead_match_results_rank UNIQUE (run_id, rank),
  CONSTRAINT uq_lead_match_results_room UNIQUE (run_id, rent_room_id)
);
