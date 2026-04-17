-- ============================================================================
-- Migration 018: Rename tier 'trainee' → 'daily'
--
-- The free tier was originally called 'trainee' but the product uses 'Daily'
-- as the user-facing name. Aligning the DB value avoids confusion and matches
-- the subscription model: Daily, Artist, Supervisor, Designer.
--
-- Safe to run on a live database — idempotent, no data loss.
-- ============================================================================

-- 1. Update any existing 'trainee' records to 'daily'
UPDATE public.users SET tier = 'daily' WHERE tier = 'trainee';

-- 2. Drop the old CHECK constraint and create a new one
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tier_check;
ALTER TABLE public.users ADD CONSTRAINT users_tier_check
  CHECK (tier IN ('daily', 'artist', 'supervisor', 'designer'));

-- 3. Update the default for new users
ALTER TABLE public.users ALTER COLUMN tier SET DEFAULT 'daily';

-- 4. Update the handle_new_user trigger function so new signups get 'daily'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'daily'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
