-- -----------------------------------------------------------------
-- CLASS MEMBERSHIPS
-- Links students to teacher workspaces so students can access
-- assigned lessons and teachers can manage their class roster.
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, student_id)
);

CREATE INDEX IF NOT EXISTS class_memberships_student_idx ON public.class_memberships (student_id);
CREATE INDEX IF NOT EXISTS class_memberships_workspace_idx ON public.class_memberships (workspace_id);

COMMENT ON TABLE public.class_memberships IS 'Maps students to workspaces/classes owned by teachers';

ALTER TABLE public.class_memberships ENABLE ROW LEVEL SECURITY;

-- Students can see their own memberships; teachers can manage memberships for workspaces they own
DROP POLICY IF EXISTS "Class memberships access" ON public.class_memberships;
CREATE POLICY "Class memberships access"
    ON public.class_memberships FOR ALL
    USING (
        student_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = class_memberships.workspace_id AND w.user_id = auth.uid()
        )
    );

-- Update workspace read policy: students can read workspaces they are members of
DROP POLICY IF EXISTS "Workspaces owner full access" ON public.workspaces;
CREATE POLICY "Workspaces owner full access"
    ON public.workspaces FOR ALL
    USING (
        user_id = auth.uid()
        OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher'
        OR EXISTS (
            SELECT 1 FROM public.class_memberships m
            WHERE m.workspace_id = workspaces.id AND m.student_id = auth.uid()
        )
    );