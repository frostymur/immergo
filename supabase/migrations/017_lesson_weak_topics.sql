-- 017_lesson_weak_topics.sql
-- Add weak_topics column to lesson_sessions to persist diagnostic weak topics with the lesson.

ALTER TABLE lesson_sessions
ADD COLUMN IF NOT EXISTS weak_topics jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN lesson_sessions.weak_topics IS 'Weak topics from diagnostic that should be prioritized in this lesson';
