-- -----------------------------------------------------------------
-- 012: tenant isolation — a teacher sees only their own classes.
-- Also: invite_code gets a server-side default so new workspaces can
-- be inserted by any client (it was backfilled in 009 but had no default,
-- which broke class creation).
-- Previously ANY teacher could read (and insert into) ALL workspaces,
-- sources, chunks, progress, diagnostics, roadmaps and assignments.
-- Scope every teacher-facing policy to the classes they own via
-- class_memberships.teacher_id (no RLS recursion: the memberships
-- policy does not reference these tables).
-- -----------------------------------------------------------------

ALTER TABLE public.workspaces ALTER COLUMN invite_code SET DEFAULT encode(gen_random_bytes(6), 'hex');

-- Workspaces: owner, or student member. Insert/update only as owner.
DROP POLICY IF EXISTS "Workspaces owner full access" ON public.workspaces;
CREATE POLICY "Workspaces owner full access"
    ON public.workspaces FOR ALL
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.class_memberships m
            WHERE m.workspace_id = workspaces.id AND m.student_id = auth.uid()
        )
    )
    WITH CHECK (user_id = auth.uid());

-- Profiles: own profile, or students in my classes.
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.class_memberships m
            WHERE m.student_id = profiles.id AND m.teacher_id = auth.uid()
        )
    );

-- Sources: my workspace, or a workspace of a class I teach.
DROP POLICY IF EXISTS "Sources workspace access" ON public.sources;
CREATE POLICY "Sources workspace access"
    ON public.sources FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = sources.workspace_id
          AND (
              w.user_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.teacher_id = auth.uid()
              )
          )
    ));

-- Document chunks: same scope as sources.
DROP POLICY IF EXISTS "Chunks workspace access" ON public.document_chunks;
CREATE POLICY "Chunks workspace access"
    ON public.document_chunks FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.sources s
        JOIN public.workspaces w ON w.id = s.workspace_id
        WHERE s.id = document_chunks.source_id
          AND (
              w.user_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.teacher_id = auth.uid()
              )
          )
    ));

-- Workspace artifacts: same scope as sources.
DROP POLICY IF EXISTS "Artifacts workspace access" ON public.workspace_artifacts;
CREATE POLICY "Artifacts workspace access"
    ON public.workspace_artifacts FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = workspace_artifacts.workspace_id
          AND (
              w.user_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.teacher_id = auth.uid()
              )
          )
    ));

-- Lesson sessions: my workspace, my class as teacher, or my class as student.
DROP POLICY IF EXISTS "Lesson sessions workspace access" ON public.lesson_sessions;
CREATE POLICY "Lesson sessions workspace access"
    ON public.lesson_sessions FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = lesson_sessions.workspace_id
          AND (
              w.user_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.teacher_id = auth.uid()
              )
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.student_id = auth.uid()
              )
          )
    ));

-- Lesson blocks: same scope as sessions.
DROP POLICY IF EXISTS "Lesson blocks workspace access" ON public.lesson_blocks;
CREATE POLICY "Lesson blocks workspace access"
    ON public.lesson_blocks FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.lesson_sessions s
        JOIN public.workspaces w ON w.id = s.workspace_id
        WHERE s.id = lesson_blocks.session_id
          AND (
              w.user_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.teacher_id = auth.uid()
              )
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.student_id = auth.uid()
              )
          )
    ));

-- Lesson highlights: same scope as sessions.
DROP POLICY IF EXISTS "Lesson highlights workspace access" ON public.lesson_highlights;
CREATE POLICY "Lesson highlights workspace access"
    ON public.lesson_highlights FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.lesson_sessions s
        JOIN public.workspaces w ON w.id = s.workspace_id
        WHERE s.id = lesson_highlights.session_id
          AND (
              w.user_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.teacher_id = auth.uid()
              )
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.student_id = auth.uid()
              )
          )
    ));

-- Student progress: own, or students in my classes.
DROP POLICY IF EXISTS "Student progress access" ON public.student_progress;
CREATE POLICY "Student progress access"
    ON public.student_progress FOR ALL
    USING (
        student_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.class_memberships m
            WHERE m.student_id = student_progress.student_id AND m.teacher_id = auth.uid()
        )
    );

-- Diagnostic results: own, or students in my classes.
DROP POLICY IF EXISTS "Diagnostic results access" ON public.diagnostic_results;
CREATE POLICY "Diagnostic results access"
    ON public.diagnostic_results FOR ALL
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.class_memberships m
            WHERE m.student_id = diagnostic_results.user_id AND m.teacher_id = auth.uid()
        )
    );

-- Roadmap plans: own, or students in my classes.
DROP POLICY IF EXISTS "Roadmap plans access" ON public.roadmap_plans;
CREATE POLICY "Roadmap plans access"
    ON public.roadmap_plans FOR ALL
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.class_memberships m
            WHERE m.student_id = roadmap_plans.user_id AND m.teacher_id = auth.uid()
        )
    );

-- Roadmap progress: own (directly or via my plans), or students in my classes.
DROP POLICY IF EXISTS "Roadmap progress access" ON public.roadmap_progress;
CREATE POLICY "Roadmap progress access"
    ON public.roadmap_progress FOR ALL
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.roadmap_plans p
            WHERE p.id = roadmap_progress.plan_id AND p.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.class_memberships m
            WHERE m.student_id = roadmap_progress.user_id AND m.teacher_id = auth.uid()
        )
    );

-- Assignments: owner of the workspace, teacher of the class, or student member.
DROP POLICY IF EXISTS "Assignments access" ON public.assignments;
CREATE POLICY "Assignments access"
    ON public.assignments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = assignments.workspace_id AND w.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.class_memberships m
            WHERE m.workspace_id = assignments.workspace_id AND m.teacher_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.class_memberships m
            WHERE m.workspace_id = assignments.workspace_id AND m.student_id = auth.uid()
        )
    );

-- Assignment progress: own, teacher of the class, or student in the class.
DROP POLICY IF EXISTS "Assignment progress access" ON public.assignment_progress;
CREATE POLICY "Assignment progress access"
    ON public.assignment_progress FOR ALL
    USING (
        student_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.assignments a
            JOIN public.class_memberships m ON m.workspace_id = a.workspace_id
            WHERE a.id = assignment_progress.assignment_id AND m.teacher_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.assignments a
            JOIN public.class_memberships m ON m.workspace_id = a.workspace_id
            WHERE a.id = assignment_progress.assignment_id AND m.student_id = auth.uid()
        )
    );
