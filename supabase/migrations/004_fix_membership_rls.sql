-- -----------------------------------------------------------------
-- FIX: cross-table RLS recursion between workspaces and class_memberships
-- Add teacher_id to memberships so the policy can check ownership
-- without querying workspaces, breaking the recursion cycle.
-- -----------------------------------------------------------------
ALTER TABLE public.class_memberships ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Populate teacher_id from workspace owner for existing rows
UPDATE public.class_memberships m
SET teacher_id = w.user_id
FROM public.workspaces w
WHERE w.id = m.workspace_id AND m.teacher_id IS NULL;

-- Make teacher_id NOT NULL going forward
ALTER TABLE public.class_memberships ALTER COLUMN teacher_id SET NOT NULL;

-- Drop recursive policy
DROP POLICY IF EXISTS "Class memberships access" ON public.class_memberships;

-- New non-recursive policy: own membership OR teacher owns the membership row
CREATE POLICY "Class memberships access"
    ON public.class_memberships FOR ALL
    USING (student_id = auth.uid() OR teacher_id = auth.uid());

-- Workspaces policy can now safely reference class_memberships (its RLS no longer recurses)
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

-- Trigger: auto-set teacher_id from workspace owner on insert
CREATE OR REPLACE FUNCTION public.set_membership_teacher()
RETURNS TRIGGER AS $$
BEGIN
    SELECT user_id INTO NEW.teacher_id
    FROM public.workspaces
    WHERE id = NEW.workspace_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_membership_teacher_trigger ON public.class_memberships;
CREATE TRIGGER set_membership_teacher_trigger
    BEFORE INSERT ON public.class_memberships
    FOR EACH ROW EXECUTE FUNCTION public.set_membership_teacher();