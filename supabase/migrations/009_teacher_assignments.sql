-- -----------------------------------------------------------------
-- 009_teacher_assignments.sql
-- Teacher-directed flow: class join by invite link, assignments
-- with deadlines, per-student progress, and student profile fields.
-- -----------------------------------------------------------------

-- Student profile: grade + default goal (used by diagnostic/roadmap)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_goal TEXT NOT NULL DEFAULT 'ent';

-- Workspace invite codes: teacher shares a link, students join the class
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS invite_code TEXT;
UPDATE public.workspaces SET invite_code = encode(gen_random_bytes(6), 'hex') WHERE invite_code IS NULL;
ALTER TABLE public.workspaces ALTER COLUMN invite_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_invite_code_idx ON public.workspaces (invite_code);

-- -----------------------------------------------------------------
-- ASSIGNMENTS (homework given by a teacher to a class)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    description TEXT,
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.assignments IS 'Teacher-assigned homework topics with optional deadlines';

CREATE INDEX IF NOT EXISTS assignments_workspace_idx
    ON public.assignments (workspace_id, created_at DESC);

-- -----------------------------------------------------------------
-- ASSIGNMENT PROGRESS (per student per assignment)
-- status: 'assigned' -> 'started' -> 'done'
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_progress (
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'assigned',
    done_at TIMESTAMPTZ,
    PRIMARY KEY (assignment_id, student_id)
);

COMMENT ON TABLE public.assignment_progress IS 'Per-student status of teacher assignments';

CREATE INDEX IF NOT EXISTS assignment_progress_student_idx
    ON public.assignment_progress (student_id);

-- -----------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_progress ENABLE ROW LEVEL SECURITY;

-- Teachers manage assignments; class members read them
DROP POLICY IF EXISTS "Assignments access" ON public.assignments;
CREATE POLICY "Assignments access"
    ON public.assignments FOR ALL
    USING (
        auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher'
        OR EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = assignments.workspace_id AND w.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.class_memberships m
            WHERE m.workspace_id = assignments.workspace_id AND m.student_id = auth.uid()
        )
    );

-- Students update their own progress; teachers read all
DROP POLICY IF EXISTS "Assignment progress access" ON public.assignment_progress;
CREATE POLICY "Assignment progress access"
    ON public.assignment_progress FOR ALL
    USING (
        student_id = auth.uid()
        OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher'
        OR EXISTS (
            SELECT 1 FROM public.assignments a
            JOIN public.class_memberships m ON m.workspace_id = a.workspace_id
            WHERE a.id = assignment_progress.assignment_id AND m.student_id = auth.uid()
        )
    );