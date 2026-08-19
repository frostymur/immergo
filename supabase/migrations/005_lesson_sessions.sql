-- -----------------------------------------------------------------
-- LESSON SESSIONS
-- A live whiteboard lesson started from a student prompt. The AI
-- tutor ("Lumi") writes notes on the board block by block and
-- speaks them via TTS, conversing with the student in real time.
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    lang app_language NOT NULL DEFAULT 'en',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.lesson_sessions IS 'Live whiteboard lesson sessions started from a student prompt';

CREATE INDEX IF NOT EXISTS lesson_sessions_workspace_idx ON public.lesson_sessions (workspace_id);

-- -----------------------------------------------------------------
-- LESSON BLOCKS
-- Ordered whiteboard blocks (sections, notes, formulas, tasks,
-- student messages, tutor feedback) that make up a lesson board.
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.lesson_sessions(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    block JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.lesson_blocks IS 'Ordered whiteboard blocks written during a lesson session';

CREATE INDEX IF NOT EXISTS lesson_blocks_session_idx ON public.lesson_blocks (session_id, idx);

-- -----------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------
ALTER TABLE public.lesson_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_blocks ENABLE ROW LEVEL SECURITY;

-- Sessions: workspace owners, teachers, and enrolled class members
DROP POLICY IF EXISTS "Lesson sessions workspace access" ON public.lesson_sessions;
CREATE POLICY "Lesson sessions workspace access"
    ON public.lesson_sessions FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = lesson_sessions.workspace_id
          AND (
              w.user_id = auth.uid()
              OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher'
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.student_id = auth.uid()
              )
          )
    ));

-- Blocks: accessible through the parent session's workspace
DROP POLICY IF EXISTS "Lesson blocks workspace access" ON public.lesson_blocks;
CREATE POLICY "Lesson blocks workspace access"
    ON public.lesson_blocks FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.lesson_sessions s
        JOIN public.workspaces w ON w.id = s.workspace_id
        WHERE s.id = lesson_blocks.session_id
          AND (
              w.user_id = auth.uid()
              OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher'
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.student_id = auth.uid()
              )
          )
    ));
