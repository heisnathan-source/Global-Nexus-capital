-- CMC avatar persistence
-- Stores each user's selected profile avatar directly on their CMC account.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_id TEXT NOT NULL DEFAULT 'avatar-1';

UPDATE users
SET avatar_id = 'avatar-1'
WHERE avatar_id IS NULL OR BTRIM(avatar_id) = '';
