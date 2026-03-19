-- Beta Access Gate: Schema changes
-- Run this migration BEFORE deploying the beta gate code.

-- 1. Add beta fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS beta_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beta_granted_at timestamptz;

-- 2. Grandfather all existing users — full beta access, designer tier, no disruption
UPDATE users
SET
  beta_access = true,
  beta_granted_at = created_at,
  tier = 'designer'
WHERE beta_access = false;

-- Verify: SELECT COUNT(*) FROM users WHERE beta_access = false;
-- Result must be 0 before the gate goes live.

-- 3. Create app_config table for beta code (single-row config)
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert the initial beta code. Change 'CHECKS-BETA' to whatever you want.
INSERT INTO app_config (key, value)
VALUES ('beta_code', 'CHECKS-BETA')
ON CONFLICT (key) DO NOTHING;

-- 4. RLS on app_config — beta code is publicly shared (Instagram), so public read is correct
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON app_config
  FOR SELECT USING (true);
