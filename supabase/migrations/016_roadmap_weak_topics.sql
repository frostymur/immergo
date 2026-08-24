-- 016_roadmap_weak_topics.sql
-- Add weak_topics column to roadmap_plans to persist diagnostic weak topics with the plan.

ALTER TABLE roadmap_plans
ADD COLUMN IF NOT EXISTS weak_topics jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN roadmap_plans.weak_topics IS 'Weak topics from diagnostic that should be prioritized in this plan';
