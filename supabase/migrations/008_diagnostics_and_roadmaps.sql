-- -----------------------------------------------------------------
-- 008_diagnostics_and_roadmaps.sql
-- Personal student cabinet data: diagnostic results and study roadmaps
-- -----------------------------------------------------------------

-- -----------------------------------------------------------------
-- DIAGNOSTIC RESULTS
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnostic_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    grade INTEGER NOT NULL,
    goal TEXT NOT NULL DEFAULT 'school',
    correct INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    level TEXT NOT NULL DEFAULT 'intermediate',
    feedback TEXT,
    weak_topics JSONB NOT NULL DEFAULT '[]',
    recommendation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.diagnostic_results IS 'Saved diagnostic test results per student';

CREATE INDEX IF NOT EXISTS diagnostic_results_user_idx
    ON public.diagnostic_results (user_id, created_at DESC);

-- -----------------------------------------------------------------
-- ROADMAP PLANS
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roadmap_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    goal TEXT NOT NULL DEFAULT 'school',
    level TEXT NOT NULL DEFAULT 'intermediate',
    stages JSONB NOT NULL DEFAULT '[]',
    total_weeks INTEGER NOT NULL DEFAULT 4,
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.roadmap_plans IS 'Personalized study roadmaps leading to a student goal';

CREATE INDEX IF NOT EXISTS roadmap_plans_user_idx
    ON public.roadmap_plans (user_id, created_at DESC);

-- -----------------------------------------------------------------
-- ROADMAP PROGRESS (completed stages per plan)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roadmap_progress (
    plan_id UUID NOT NULL REFERENCES public.roadmap_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    stage_index INTEGER NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (plan_id, stage_index)
);

COMMENT ON TABLE public.roadmap_progress IS 'Completed roadmap stages per student';

-- -----------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------
ALTER TABLE public.diagnostic_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_progress ENABLE ROW LEVEL SECURITY;

-- Students own their diagnostic results; teachers read all
DROP POLICY IF EXISTS "Diagnostic results access" ON public.diagnostic_results;
CREATE POLICY "Diagnostic results access"
    ON public.diagnostic_results FOR ALL
    USING (user_id = auth.uid() OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher');

-- Students own their roadmap plans; teachers read all
DROP POLICY IF EXISTS "Roadmap plans access" ON public.roadmap_plans;
CREATE POLICY "Roadmap plans access"
    ON public.roadmap_plans FOR ALL
    USING (user_id = auth.uid() OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher');

-- Progress follows the plan ownership
DROP POLICY IF EXISTS "Roadmap progress access" ON public.roadmap_progress;
CREATE POLICY "Roadmap progress access"
    ON public.roadmap_progress FOR ALL
    USING (
        user_id = auth.uid()
        OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher'
        OR EXISTS (
            SELECT 1 FROM public.roadmap_plans p
            WHERE p.id = roadmap_progress.plan_id AND p.user_id = auth.uid()
        )
    );