-- 014_user_preferences.sql
-- Add detailed user preference fields for AI personalization

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deadline DATE,
ADD COLUMN IF NOT EXISTS interests TEXT,
ADD COLUMN IF NOT EXISTS goal_text TEXT,
ADD COLUMN IF NOT EXISTS learning_accommodations TEXT,
ADD COLUMN IF NOT EXISTS custom_instructions TEXT;
