-- CMC final-audit schema repair
-- Idempotent: safe to run once or repeatedly.
-- This file restores the missing migration referenced by:
--   npm run db:final-audit
--
-- No existing rows are deleted.

ALTER TABLE fund_products
  ADD COLUMN IF NOT EXISTS period_days INTEGER;

ALTER TABLE fund_products
  ADD COLUMN IF NOT EXISTS min_purchase NUMERIC;

ALTER TABLE fund_products
  ADD COLUMN IF NOT EXISTS max_purchase NUMERIC;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

ALTER TABLE lucky_card_draws
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE lucky_card_draws
  ADD COLUMN IF NOT EXISTS fulfillment_note TEXT;

ALTER TABLE lucky_card_draws
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lucky_card_draws_user_created
  ON lucky_card_draws (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lucky_card_draws_event_created
  ON lucky_card_draws (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lucky_card_draws_fulfillment_status
  ON lucky_card_draws (fulfillment_status, created_at DESC);
