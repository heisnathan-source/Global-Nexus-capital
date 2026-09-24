-- Global schedule controls for withdrawals and rank tasks.
-- Idempotent: safe to run once or repeatedly.
-- Ghana uses UTC, so these withdrawal times and task weekdays are evaluated in UTC.

ALTER TABLE withdrawal_settings
  ADD COLUMN IF NOT EXISTS withdrawal_start_time TIME NOT NULL DEFAULT '08:00:00';

ALTER TABLE withdrawal_settings
  ADD COLUMN IF NOT EXISTS withdrawal_end_time TIME NOT NULL DEFAULT '17:00:00';

CREATE TABLE IF NOT EXISTS rank_task_days (
  rank_id UUID NOT NULL REFERENCES ranks(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (rank_id, weekday)
);

CREATE INDEX IF NOT EXISTS idx_rank_task_days_rank_weekday
  ON rank_task_days (rank_id, weekday);

-- If the existing withdrawal settings row exists, keep the requested default window.
UPDATE withdrawal_settings
SET
  withdrawal_start_time = COALESCE(withdrawal_start_time, '08:00:00'),
  withdrawal_end_time = COALESCE(withdrawal_end_time, '17:00:00')
WHERE id = TRUE;
