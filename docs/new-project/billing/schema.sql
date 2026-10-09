-- =============================================================================
-- Portable blueprint — Billing: plans, subscriptions, entitlements, usage (DDL)
-- =============================================================================
-- Docs: docs/new-project/billing/README.md
--       docs/new-project/billing/database.md
--       docs/new-project/billing/features.md
--
-- Prerequisite: docs/new-project/roles/schema.sql (users)
--
-- Run:
--   psql "$DATABASE_URL" -f docs/new-project/billing/schema.sql
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS plans (
  id                 SERIAL PRIMARY KEY,
  code               VARCHAR(50)   NOT NULL UNIQUE,
  is_active          BOOLEAN       NOT NULL DEFAULT TRUE,
  is_default         BOOLEAN       NOT NULL DEFAULT FALSE,
  sort_order         SMALLINT      NOT NULL DEFAULT 0,
  entitlements       JSONB         NOT NULL DEFAULT '{}'::jsonb,
  store_products     JSONB         NOT NULL DEFAULT '{}'::jsonb,
  display_price_thb  DECIMAL(10, 2) NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_plans_entitlements_object CHECK (jsonb_typeof(entitlements) = 'object'),
  CONSTRAINT chk_plans_store_products_object CHECK (jsonb_typeof(store_products) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_plans_single_default ON plans (is_default) WHERE is_default;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                        SERIAL PRIMARY KEY,
  user_id                   INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id                   INT          NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status                    VARCHAR(20)  NOT NULL,
  provider                  VARCHAR(20)  NOT NULL,
  provider_customer_id      VARCHAR(255) NULL,
  provider_subscription_id  VARCHAR(255) NULL,
  current_period_start      TIMESTAMPTZ  NOT NULL,
  current_period_end        TIMESTAMPTZ  NOT NULL,
  cancel_at_period_end      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_subscriptions_status
    CHECK (status IN ('trialing', 'active', 'grace', 'canceled', 'expired')),
  CONSTRAINT chk_subscriptions_provider
    CHECK (provider IN ('revenuecat', 'stripe', 'manual')),
  CONSTRAINT chk_subscriptions_period
    CHECK (current_period_end > current_period_start)
);

-- One entitlement-granting subscription per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user_live
  ON subscriptions (user_id)
  WHERE status IN ('trialing', 'active', 'grace');

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_provider_ref
  ON subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS entitlement_overrides (
  id                  SERIAL PRIMARY KEY,
  user_id             INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key         VARCHAR(100) NOT NULL,
  value               JSONB        NOT NULL,
  starts_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ  NULL,
  reason              VARCHAR(255) NOT NULL,
  created_by_user_id  INT          NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_entitlement_overrides_window
    CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_user_feature
  ON entitlement_overrides (user_id, feature_key);

CREATE TABLE IF NOT EXISTS usage_counters (
  user_id       INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key   VARCHAR(100) NOT NULL,
  period_start  TIMESTAMPTZ  NOT NULL,
  used          INT          NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, feature_key, period_start),
  CONSTRAINT chk_usage_counters_used CHECK (used >= 0)
);

CREATE TABLE IF NOT EXISTS usage_events (
  id               BIGSERIAL PRIMARY KEY,
  user_id          INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key      VARCHAR(100) NOT NULL,
  quantity         INT          NOT NULL DEFAULT 1,
  period_start     TIMESTAMPTZ  NOT NULL,
  idempotency_key  VARCHAR(100) NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'consumed',
  ref_type         VARCHAR(50)  NULL,
  ref_id           VARCHAR(100) NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_usage_events_idempotency UNIQUE (user_id, idempotency_key),
  CONSTRAINT chk_usage_events_quantity CHECK (quantity > 0),
  CONSTRAINT chk_usage_events_status CHECK (status IN ('consumed', 'refunded'))
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_feature_period
  ON usage_events (user_id, feature_key, period_start);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id            BIGSERIAL PRIMARY KEY,
  provider      VARCHAR(20)  NOT NULL,
  event_id      VARCHAR(255) NOT NULL,
  event_type    VARCHAR(100) NOT NULL,
  payload       JSONB        NOT NULL,
  received_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ  NULL,
  error         TEXT         NULL,
  CONSTRAINT uq_billing_webhook_events_provider_event UNIQUE (provider, event_id),
  CONSTRAINT chk_billing_webhook_events_provider CHECK (provider IN ('revenuecat', 'stripe'))
);

-- Seed: values follow docs/new-project/billing/features.md §3 (adjust per launch phase).
INSERT INTO plans (code, is_default, sort_order, entitlements)
VALUES
  ('free', TRUE, 0, '{
    "agent.match.run": 10,
    "agent.match.max_results": 10,
    "agent.match.min_score": false,
    "agent.match.budget_tolerance": false,
    "agent.match.radius_multiplier": false,
    "agent.match.required_criteria": false,
    "agent.match.weights": false,
    "agent.match.scope_cobroke": false,
    "agent.match.auto_notify": false,
    "agent.ai.listing_promo": 10,
    "agent.ai.photo_enhance": 5
  }'::jsonb),
  ('pro', FALSE, 1, '{
    "agent.match.run": 100,
    "agent.match.max_results": 50,
    "agent.match.min_score": true,
    "agent.match.budget_tolerance": true,
    "agent.match.radius_multiplier": true,
    "agent.match.required_criteria": true,
    "agent.match.weights": false,
    "agent.match.scope_cobroke": false,
    "agent.match.auto_notify": false,
    "agent.ai.listing_promo": 100,
    "agent.ai.photo_enhance": 50
  }'::jsonb),
  ('business', FALSE, 2, '{
    "agent.match.run": null,
    "agent.match.max_results": 100,
    "agent.match.min_score": true,
    "agent.match.budget_tolerance": true,
    "agent.match.radius_multiplier": true,
    "agent.match.required_criteria": true,
    "agent.match.weights": true,
    "agent.match.scope_cobroke": true,
    "agent.match.auto_notify": true,
    "agent.ai.listing_promo": null,
    "agent.ai.photo_enhance": 200
  }'::jsonb)
ON CONFLICT (code) DO NOTHING;

COMMIT;
