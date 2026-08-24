-- -----------------------------------------------------------------
-- 011_class_insights.sql
-- Shared diagnostic tests + per-question answers for class analytics.
-- -----------------------------------------------------------------

-- One shared diagnostic per (subject, grade, goal, lang), persisted in the DB
-- so every student takes the SAME test (the old disk cache was wiped on every
-- deploy and each student got a freshly generated, different test).
CREATE TABLE IF NOT EXISTS public.diagnostic_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    grade INTEGER NOT NULL,
    goal TEXT NOT NULL DEFAULT 'school',
    lang TEXT NOT NULL DEFAULT 'kz',
    questions JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT diagnostic_tests_params_unique UNIQUE (subject, grade, goal, lang)
);

COMMENT ON TABLE public.diagnostic_tests IS 'Shared LLM-generated diagnostic tests, one per (subject, grade, goal, lang)';

ALTER TABLE public.diagnostic_tests ENABLE ROW LEVEL SECURITY;
-- Backend (service role) is the only consumer; deny-by-default for clients.

-- Per-question answers on each diagnostic result: [{topic, correct}]
-- Powers the teacher "struggling topics" class analytics.
ALTER TABLE public.diagnostic_results
    ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.diagnostic_results.answers IS 'Per-question results [{topic, correct}] used for class-level topic analytics';
