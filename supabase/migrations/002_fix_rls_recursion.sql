-- -----------------------------------------------------------------
-- FIX: RLS infinite recursion in profiles policy
-- The previous policies referenced public.profiles from within a
-- policy on public.profiles (and friends), causing 42P17 recursion.
-- Replace teacher checks with the JWT claim (user_metadata.role).
-- -----------------------------------------------------------------

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher');

DROP POLICY IF EXISTS "Workspaces owner full access" ON public.workspaces;
CREATE POLICY "Workspaces owner full access"
    ON public.workspaces FOR ALL
    USING (user_id = auth.uid() OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher');

DROP POLICY IF EXISTS "Sources workspace access" ON public.sources;
CREATE POLICY "Sources workspace access"
    ON public.sources FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = sources.workspace_id
          AND (w.user_id = auth.uid() OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher')
    ));

DROP POLICY IF EXISTS "Chunks workspace access" ON public.document_chunks;
CREATE POLICY "Chunks workspace access"
    ON public.document_chunks FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.sources s
        JOIN public.workspaces w ON w.id = s.workspace_id
        WHERE s.id = document_chunks.source_id
          AND (w.user_id = auth.uid() OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher')
    ));

DROP POLICY IF EXISTS "Artifacts workspace access" ON public.workspace_artifacts;
CREATE POLICY "Artifacts workspace access"
    ON public.workspace_artifacts FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = workspace_artifacts.workspace_id
          AND (w.user_id = auth.uid() OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher')
    ));

DROP POLICY IF EXISTS "Student progress access" ON public.student_progress;
CREATE POLICY "Student progress access"
    ON public.student_progress FOR ALL
    USING (student_id = auth.uid() OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher');